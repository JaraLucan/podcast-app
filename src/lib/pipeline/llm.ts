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

export function llmProvider(): "anthropic" | "groq" {
  return process.env.LLM_PROVIDER === "groq" ? "groq" : "anthropic";
}
const provider = llmProvider;

function modelFor(tier: LlmTier): string {
  if (provider() === "groq") {
    return tier === "extract"
      ? (process.env.GROQ_MODEL_EXTRACT ?? "llama-3.1-8b-instant")
      : (process.env.GROQ_MODEL_EDITORIAL ?? "llama-3.3-70b-versatile");
  }
  return tier === "extract"
    ? (process.env.ANTHROPIC_MODEL_EXTRACT ?? "claude-haiku-4-5")
    : (process.env.ANTHROPIC_MODEL_EDITORIAL ?? "claude-sonnet-4-6");
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

/** Parse Groq's rate-limit "try again in 12.5s" / Retry-After into ms. */
function retryAfterMs(err: unknown): number {
  const msg = (err as { message?: string })?.message ?? "";
  const m = msg.match(/try again in ([\d.]+)\s*s/i);
  if (m) return Math.ceil(parseFloat(m[1]) * 1000) + 500;
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
      // too large) is not fixable by waiting, so propagate.
      const status = (err as { status?: number })?.status;
      if (status !== 429 || attempt >= 3) throw err;
      await sleep(retryAfterMs(err));
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
  const model = modelFor(tier);
  const completion =
    provider() === "groq"
      ? await completeGroq(model, system, user, maxTokens)
      : await completeAnthropic(model, system, user, maxTokens);

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
