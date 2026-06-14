import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { computeCost } from "./cost";

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  cached ??= new Anthropic();
  return cached;
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
    // Last resort: grab the outermost {...} span.
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new JsonParseError("Response was not valid JSON", text);
  }
}

/**
 * Run one JSON-returning Messages API call and validate the result against a
 * zod schema. Throws JsonParseError (carrying the raw text) on parse/validation
 * failure so the caller can retry with feedback (PRD §5.3).
 */
export async function runJsonPass<T>({
  model,
  system,
  user,
  maxTokens,
  schema,
}: {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  schema: z.ZodType<T>;
}): Promise<PassResult<T>> {
  const client = getAnthropic();

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const parsed = extractJson(text);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new JsonParseError(
      `JSON did not match schema: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
      text,
    );
  }

  const tokensIn = response.usage.input_tokens;
  const tokensOut = response.usage.output_tokens;

  return {
    data: result.data,
    model,
    tokensIn,
    tokensOut,
    costUsd: computeCost(model, response.usage),
  };
}
