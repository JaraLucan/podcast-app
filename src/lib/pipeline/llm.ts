import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { z } from "zod";

import { computeCost } from "./cost";

/**
 * Provider-agnostic JSON completion for the two summarization passes.
 *
 * LLM_PROVIDER=anthropic (default) → Claude (best quality, paid per token).
 * LLM_PROVIDER=groq                → Llama on Groq's free tier ($0, lower quality).
 *
 * Either way the result is parsed and validated against a zod schema, so the
 * pipeline's quality gate (validate.ts) is identical regardless of provider.
 */
export type LlmTier = "extract" | "editorial";

let anthropicClient: Anthropic | null = null;
let groqClient: Groq | null = null;

function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  anthropicClient ??= new Anthropic();
  return anthropicClient;
}

function getGroq(): Groq {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set");
  }
  groqClient ??= new Groq();
  return groqClient;
}

export type LlmProviderName = "anthropic" | "groq" | "nvidia" | "gemini";

function asProvider(v: string | undefined): LlmProviderName | null {
  return v === "anthropic" || v === "groq" || v === "nvidia" || v === "gemini"
    ? v
    : null;
}

/** Global default provider (LLM_PROVIDER); anthropic if unset/unknown. */
export function llmProvider(): LlmProviderName {
  return asProvider(process.env.LLM_PROVIDER) ?? "anthropic";
}

/** Provider for a specific pass — lets extraction and editorial run on
 *  different backends (e.g. free NVIDIA Llama for extraction, one pinned
 *  Gemini for every final brief). Falls back to the global default. */
export function providerForTier(tier: LlmTier): LlmProviderName {
  const per =
    tier === "extract"
      ? process.env.EXTRACT_PROVIDER
      : process.env.EDITORIAL_PROVIDER;
  return asProvider(per) ?? llmProvider();
}

function modelFor(tier: LlmTier, provider: LlmProviderName): string {
  const extract = tier === "extract";
  switch (provider) {
    case "groq":
      return extract
        ? (process.env.GROQ_MODEL_EXTRACT ?? "llama-3.1-8b-instant")
        : (process.env.GROQ_MODEL_EDITORIAL ?? "llama-3.3-70b-versatile");
    case "nvidia":
      return extract
        ? (process.env.NVIDIA_MODEL_EXTRACT ?? "meta/llama-3.3-70b-instruct")
        : (process.env.NVIDIA_MODEL_EDITORIAL ?? "meta/llama-3.3-70b-instruct");
    case "gemini":
      return extract
        ? (process.env.GEMINI_MODEL_EXTRACT ?? "gemini-flash-latest")
        : (process.env.GEMINI_MODEL_EDITORIAL ?? "gemini-flash-latest");
    default:
      return extract
        ? (process.env.ANTHROPIC_MODEL_EXTRACT ?? "claude-haiku-4-5")
        : (process.env.ANTHROPIC_MODEL_EDITORIAL ?? "claude-sonnet-4-6");
  }
}

export class JsonParseError extends Error {
  constructor(
    message: string,
    public raw: string,
  ) {
    super(message);
    this.name = "JsonParseError";
  }
}

export type PassResult<T> = {
  data: T;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

/** Pull JSON out of a model response that may be fenced or prefixed with prose. */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new JsonParseError("Response was not valid JSON", text);
  }
}

type RawCompletion = {
  text: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

async function completeAnthropic(
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<RawCompletion> {
  const response = await getAnthropic().messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return {
    text,
    tokensIn: response.usage.input_tokens,
    tokensOut: response.usage.output_tokens,
    costUsd: computeCost(model, response.usage),
  };
}

// ── Groq free-tier rate limiting ────────────────────────────────────────────
// The free tier caps tokens-per-minute (TPM) per model, and a single request
// (prompt + reserved max_tokens) that exceeds the cap is rejected outright. We
// (a) proactively pace requests with a per-model token bucket, and (b) retry on
// 429 honoring the server's "try again in Ns". Callers must still size each
// request under the cap (see extract.ts chunking).
const GROQ_TPM: Record<string, number> = {
  "llama-3.1-8b-instant": 6000,
  "llama-3.3-70b-versatile": 12000,
  "llama-3.1-70b-versatile": 12000,
};
const GROQ_DEFAULT_TPM = 6000;
const GROQ_TPM_HEADROOM = 0.92; // stay just under the hard limit

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const groqWindow = new Map<string, { start: number; used: number }>();

/** ~4 chars/token heuristic for budgeting before the server reports usage. */
function estTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

/** Block until `tokens` fit in the current 60s window for `model`. */
async function reserveGroqTpm(model: string, tokens: number): Promise<void> {
  const limit = Math.floor((GROQ_TPM[model] ?? GROQ_DEFAULT_TPM) * GROQ_TPM_HEADROOM);
  const need = Math.min(tokens, limit); // a request can't reserve beyond the cap
  for (;;) {
    const now = Date.now();
    let w = groqWindow.get(model);
    if (!w || now - w.start >= 60_000) {
      w = { start: now, used: 0 };
      groqWindow.set(model, w);
    }
    if (w.used + need <= limit) {
      w.used += need;
      return;
    }
    await sleep(60_000 - (now - w.start) + 250);
  }
}

/** Parse Groq's rate-limit "try again in 12m19.75s" / "in 12.5s" / Retry-After
 *  into ms. Daily (TPD) limits come back as minutes — must not read "12m19s"
 *  as 19 seconds. */
function retryAfterMs(err: unknown): number {
  const msg = (err as { message?: string })?.message ?? "";
  const m = msg.match(/try again in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/i);
  if (m) {
    const h = m[1] ? parseInt(m[1], 10) : 0;
    const min = m[2] ? parseInt(m[2], 10) : 0;
    return Math.ceil((h * 3600 + min * 60 + parseFloat(m[3])) * 1000) + 500;
  }
  const hdr = (err as { headers?: Record<string, string> })?.headers?.["retry-after"];
  if (hdr && !Number.isNaN(Number(hdr))) return Number(hdr) * 1000 + 500;
  return 15_000;
}

async function completeGroq(
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<RawCompletion> {
  await reserveGroqTpm(model, estTokens(system) + estTokens(user) + maxTokens);

  const create = () =>
    getGroq().chat.completions.create({
      model,
      max_tokens: maxTokens,
      // JSON mode; our prompts already instruct "Return ONLY valid JSON".
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

  let response;
  for (let attempt = 0; ; attempt++) {
    try {
      response = await create();
      break;
    } catch (err) {
      // 429 = rate limited → wait and retry. Anything else (e.g. 413 request
      // too large) is not fixable by waiting, so propagate. Waits over 2 min
      // mean the daily (TPD) budget is gone — propagate so the job parks in
      // the queue instead of stalling the tick with in-process sleeps.
      const status = (err as { status?: number })?.status;
      const waitMs = retryAfterMs(err);
      if (status !== 429 || attempt >= 3 || waitMs > 120_000) throw err;
      await sleep(waitMs);
      groqWindow.delete(model); // fresh window after the forced wait
    }
  }

  return {
    text: response.choices[0]?.message?.content ?? "",
    tokensIn: response.usage?.prompt_tokens ?? 0,
    tokensOut: response.usage?.completion_tokens ?? 0,
    costUsd: 0, // Groq free tier
  };
}

// OpenAI-compatible backends (NVIDIA NIM, Google Gemini's OpenAI shim). Both
// speak /chat/completions, so one fetch path covers them — only the base URL,
// key, and model id differ. Free tiers → costUsd 0.
const OPENAI_COMPAT: Record<string, { baseUrl: string; keyEnv: string }> = {
  nvidia: {
    baseUrl: "https://integrate.api.nvidia.com/v1",
    keyEnv: "NVIDIA_API_KEY",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GEMINI_API_KEY",
  },
};

async function completeOpenAICompatible(
  provider: "nvidia" | "gemini",
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<RawCompletion> {
  const cfg = OPENAI_COMPAT[provider];
  const key = process.env[cfg.keyEnv];
  if (!key) throw new Error(`${cfg.keyEnv} is not set`);

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    // Free 70B endpoints are slow (~20s) but a hung request must not stall the
    // whole drain loop — abort after 2 min so the job fails and retries later.
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    // Surface status so failJob can park 429/quota errors instead of killing
    // the job (see isTransientFailure in jobs/queue.ts).
    throw new Error(`${provider} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
    costUsd: 0,
  };
}

/**
 * Run one JSON-returning completion and validate against a zod schema. Throws
 * JsonParseError (carrying the raw text) on parse/validation failure so callers
 * can retry with feedback (PRD §5.3).
 */
export async function runJsonPass<T>({
  tier,
  system,
  user,
  maxTokens,
  schema,
}: {
  tier: LlmTier;
  system: string;
  user: string;
  maxTokens: number;
  schema: z.ZodType<T>;
}): Promise<PassResult<T>> {
  const provider = providerForTier(tier);
  const model = modelFor(tier, provider);
  const completion =
    provider === "groq"
      ? await completeGroq(model, system, user, maxTokens)
      : provider === "anthropic"
        ? await completeAnthropic(model, system, user, maxTokens)
        : await completeOpenAICompatible(provider, model, system, user, maxTokens);

  const parsed = extractJson(completion.text);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new JsonParseError(
      `JSON did not match schema: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
      completion.text,
    );
  }

  return {
    data: result.data,
    model,
    tokensIn: completion.tokensIn,
    tokensOut: completion.tokensOut,
    costUsd: completion.costUsd,
  };
}
