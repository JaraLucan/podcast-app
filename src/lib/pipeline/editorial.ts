import type { QualityFlags } from "@/lib/types/database";

import { JsonParseError, runJsonPass, type PassResult } from "./anthropic";
import {
  buildEditorialUser,
  EDITORIAL_SYSTEM,
  retryFeedback,
} from "./prompts";
import {
  briefSchema,
  type BriefContent,
  type EditorialContext,
  type Extraction,
} from "./types";
import { validateBrief } from "./validate";

const MODEL = process.env.ANTHROPIC_MODEL_EDITORIAL ?? "claude-sonnet-4-6";
const MAX_TOKENS = 4000;

export type EditorialResult = {
  result: PassResult<BriefContent>;
  quality: QualityFlags;
};

/**
 * Pass 2 — editorial brief (strong model). Generates, runs code validation,
 * and retries once with the failures appended (PRD §5.3). Returns the final
 * brief plus quality_flags (passed=false means hold for admin review).
 */
export async function writeBrief(input: {
  extraction: Extraction;
  context: EditorialContext;
  durationSeconds: number | null;
}): Promise<EditorialResult> {
  const baseUser = buildEditorialUser({
    extraction: input.extraction,
    context: input.context,
  });

  const attempt = async (user: string) =>
    runJsonPass({
      model: MODEL,
      system: EDITORIAL_SYSTEM,
      user,
      maxTokens: MAX_TOKENS,
      schema: briefSchema,
    });

  let result: PassResult<BriefContent>;
  try {
    result = await attempt(baseUser);
  } catch (err) {
    if (!(err instanceof JsonParseError)) throw err;
    result = await attempt(`${baseUser}\n\n${retryFeedback([err.message], err.raw)}`);
  }

  const quality = validateBrief(result.data, input.durationSeconds);
  if (quality.passed) return { result, quality };

  // One validation retry with the specific issues fed back.
  try {
    const retry = await attempt(
      `${baseUser}\n\n${retryFeedback(quality.issues, JSON.stringify(result.data))}`,
    );
    const retryQuality = validateBrief(retry.data, input.durationSeconds);
    // Combine token cost across both editorial attempts.
    retry.costUsd = Math.round((retry.costUsd + result.costUsd) * 1e6) / 1e6;
    retry.tokensIn += result.tokensIn;
    retry.tokensOut += result.tokensOut;
    return { result: retry, quality: retryQuality };
  } catch {
    return { result, quality };
  }
}
