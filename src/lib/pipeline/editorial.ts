import type { QualityFlags } from "@/lib/types/database";

import { JsonParseError, runJsonPass, type PassResult } from "./llm";
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

// ~2300 words of JSON (up to 14 cards) needs headroom beyond raw prose tokens
// for field names/braces/escaping — 4000 was cutting it close and risked
// truncated JSON on the richest episodes.
const MAX_TOKENS = 6000;

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
      tier: "editorial",
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
    // Combine token cost across both editorial attempts (new object, no mutation).
    const merged: PassResult<BriefContent> = {
      ...retry,
      costUsd: Math.round((retry.costUsd + result.costUsd) * 1e6) / 1e6,
      tokensIn: retry.tokensIn + result.tokensIn,
      tokensOut: retry.tokensOut + result.tokensOut,
    };
    return { result: merged, quality: retryQuality };
  } catch (err) {
    // A parse failure on retry → keep the first (validated-but-flagged) result;
    // any other error (network, rate limit) must propagate.
    if (!(err instanceof JsonParseError)) throw err;
    return { result, quality };
  }
}
