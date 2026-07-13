import type { QualityFlags } from "@/lib/types/database";

import { JsonParseError, runJsonPass, type PassResult } from "./llm";
import {
  buildEditorialUser,
  buildExpandUser,
  EDITORIAL_SYSTEM,
  EXPAND_SYSTEM,
  retryFeedback,
} from "./prompts";
import {
  briefSchema,
  expandedCardsSchema,
  type BriefContent,
  type EditorialContext,
  type Extraction,
  type Takeaway,
} from "./types";
import { validateBrief, words } from "./validate";

// ~2300 words of JSON (up to 14 cards) needs headroom beyond raw prose tokens
// for field names/braces/escaping — 4000 was cutting it close and risked
// truncated JSON on the richest episodes.
const MAX_TOKENS = 6000;

// Slightly under the prompt's 60-word floor — only flag cards that are
// genuinely thin, not borderline ones a model reasonably rounded down from.
const MIN_CARD_WORDS = 55;
const EXPAND_MAX_TOKENS = 2500;

/**
 * Pass 3 (conditional) — targeted rewrite of underdeveloped card
 * explanations. Small/local models reliably nail the insight but often
 * under-shoot the explanation length even with explicit counts + an example
 * in the main prompt; regenerating the whole brief to fix a few thin cards
 * wastes the good cards already written, so this only rewrites the short
 * ones. Best-effort: any failure here just returns the input unchanged
 * rather than failing the episode over an enhancement step.
 */
async function expandShortCards(
  result: PassResult<BriefContent>,
  extraction: Extraction,
): Promise<PassResult<BriefContent>> {
  const takeaways = result.data.takeaways;
  const shortIndexes = takeaways
    .map((t, i) => (words(t.explanation) < MIN_CARD_WORDS ? i : -1))
    .filter((i) => i !== -1);
  if (shortIndexes.length === 0) return result;

  try {
    const shortCards: Takeaway[] = shortIndexes.map((i) => takeaways[i]);
    const expand = await runJsonPass({
      tier: "editorial",
      system: EXPAND_SYSTEM,
      user: buildExpandUser({ extraction, shortCards }),
      maxTokens: EXPAND_MAX_TOKENS,
      schema: expandedCardsSchema,
    });

    // Defensive: only splice back if the model returned exactly as many
    // cards as it was asked to expand — a count mismatch means we can't
    // trust the ordering, so keep the originals rather than guess.
    if (expand.data.cards.length !== shortIndexes.length) return result;

    const merged = [...takeaways];
    shortIndexes.forEach((origIndex, j) => {
      const expanded = expand.data.cards[j].explanation.trim();
      // Only accept the rewrite if it actually got longer — never let a
      // worse or equally-short response regress a card.
      if (words(expanded) > words(merged[origIndex].explanation)) {
        merged[origIndex] = { ...merged[origIndex], explanation: expanded };
      }
    });

    return {
      ...result,
      data: { ...result.data, takeaways: merged },
      costUsd: Math.round((result.costUsd + expand.costUsd) * 1e6) / 1e6,
      tokensIn: result.tokensIn + expand.tokensIn,
      tokensOut: result.tokensOut + expand.tokensOut,
    };
  } catch {
    return result;
  }
}

export type EditorialResult = {
  result: PassResult<BriefContent>;
  quality: QualityFlags;
};

/**
 * Pass 2 — editorial brief (strong model). Generates, runs code validation,
 * retries once with the failures appended (PRD §5.3), and — if still
 * failing — runs one targeted pass (Pass 3) that rewrites only the
 * underdeveloped card explanations rather than regenerating everything.
 * Returns the final brief plus quality_flags (passed=false means hold for
 * admin review).
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

  let quality = validateBrief(result.data, input.durationSeconds);

  // One validation retry with the specific issues fed back.
  if (!quality.passed) {
    try {
      const retry = await attempt(
        `${baseUser}\n\n${retryFeedback(quality.issues, JSON.stringify(result.data))}`,
      );
      // Combine token cost across both editorial attempts (new object, no mutation).
      result = {
        ...retry,
        costUsd: Math.round((retry.costUsd + result.costUsd) * 1e6) / 1e6,
        tokensIn: retry.tokensIn + result.tokensIn,
        tokensOut: retry.tokensOut + result.tokensOut,
      };
      quality = validateBrief(result.data, input.durationSeconds);
    } catch (err) {
      // A parse failure on retry → keep the first (validated-but-flagged)
      // result and fall through to the expand pass below; any other error
      // (network, rate limit) must propagate.
      if (!(err instanceof JsonParseError)) throw err;
    }
  }

  // Pass 3: still short (usually thin card explanations) → targeted rewrite
  // of just those cards instead of burning another full-brief attempt.
  if (!quality.passed) {
    const expanded = await expandShortCards(result, input.extraction);
    if (expanded !== result) {
      result = expanded;
      quality = validateBrief(result.data, input.durationSeconds);
    }
  }

  return { result, quality };
}
