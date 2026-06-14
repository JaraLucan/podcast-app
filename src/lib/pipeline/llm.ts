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

function provider(): "anthropic" | "groq" {
  return process.env.LLM_PROVIDER === "groq" ? "groq" : "anthropic";
}

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

async function completeGroq(
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<RawCompletion> {
  const response = await getGroq().chat.completions.create({
    model,
    max_tokens: maxTokens,
    // JSON mode; our prompts already instruct "Return ONLY valid JSON".
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
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
