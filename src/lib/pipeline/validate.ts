import type { QualityFlags } from "@/lib/types/database";

import type { BriefContent } from "./types";

// Editorial bar from PRD §2 / §5.3.
export const LIMITS = {
  minWords: 300, // a touch under 350 to avoid false negatives on tight briefs
  maxWords: 750,
  minTakeaways: 4,
  maxTakeaways: 7,
  minKeyMoments: 3,
  maxKeyMoments: 6,
  maxQuotes: 1,
  maxQuoteWords: 15,
};

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Total human-readable word count across the rendered brief. */
export function countBriefWords(brief: BriefContent): number {
  const parts: string[] = [
    brief.tldr,
    ...brief.takeaways,
    brief.why_it_matters,
    ...brief.key_moments.map((m) => m.label),
    ...brief.numbers.map((n) =>
      [n.label, n.value, n.context].filter(Boolean).join(" "),
    ),
  ];
  return parts.reduce((sum, p) => sum + words(p), 0);
}

/** Extract verbatim quoted spans (straight or curly double quotes). */
export function findQuotes(text: string): string[] {
  const normalized = text.replace(/[“”]/g, '"');
  const matches = normalized.match(/"([^"]+)"/g) ?? [];
  return matches.map((m) => m.slice(1, -1).trim()).filter(Boolean);
}

function allProse(brief: BriefContent): string {
  return [
    brief.tldr,
    ...brief.takeaways,
    brief.why_it_matters,
    ...brief.key_moments.map((m) => m.label),
  ].join(" ");
}

/**
 * Code-level validation of a generated brief (PRD §5.3). Returns quality_flags;
 * `passed: false` means the brief is held for admin review instead of auto-publish.
 */
export function validateBrief(
  brief: BriefContent,
  durationSeconds: number | null,
): QualityFlags {
  const issues: string[] = [];

  // Word count
  const wordCount = countBriefWords(brief);
  if (wordCount < LIMITS.minWords) {
    issues.push(`Too short: ${wordCount} words (min ${LIMITS.minWords}).`);
  } else if (wordCount > LIMITS.maxWords) {
    issues.push(`Too long: ${wordCount} words (max ${LIMITS.maxWords}).`);
  }

  // Non-empty required sections
  if (!brief.tldr.trim()) issues.push("Empty TL;DR.");
  if (!brief.why_it_matters.trim()) issues.push("Empty 'why it matters'.");

  // Takeaways count + each must contain a concrete specific (digit or capitalized entity)
  if (
    brief.takeaways.length < LIMITS.minTakeaways ||
    brief.takeaways.length > LIMITS.maxTakeaways
  ) {
    issues.push(
      `Takeaways out of range: ${brief.takeaways.length} (want ${LIMITS.minTakeaways}-${LIMITS.maxTakeaways}).`,
    );
  }
  brief.takeaways.forEach((t, i) => {
    if (!t.trim()) issues.push(`Takeaway ${i + 1} is empty.`);
  });

  // Key moments count
  if (
    brief.key_moments.length < LIMITS.minKeyMoments ||
    brief.key_moments.length > LIMITS.maxKeyMoments
  ) {
    issues.push(
      `Key moments out of range: ${brief.key_moments.length} (want ${LIMITS.minKeyMoments}-${LIMITS.maxKeyMoments}).`,
    );
  }

  // Timestamps within episode bounds
  for (const m of brief.key_moments) {
    if (m.ts_seconds < 0) {
      issues.push(`Negative timestamp: ${m.ts_seconds}.`);
    } else if (durationSeconds && m.ts_seconds > durationSeconds + 60) {
      issues.push(
        `Timestamp ${m.ts_seconds}s exceeds episode duration ${durationSeconds}s.`,
      );
    }
  }

  // Quote policy: at most 1 verbatim quote, each under 15 words
  const quotes = findQuotes(allProse(brief));
  if (quotes.length > LIMITS.maxQuotes) {
    issues.push(
      `Too many verbatim quotes: ${quotes.length} (max ${LIMITS.maxQuotes}).`,
    );
  }
  quotes.forEach((q) => {
    if (words(q) > LIMITS.maxQuoteWords) {
      issues.push(
        `Quote exceeds ${LIMITS.maxQuoteWords} words: "${q.slice(0, 40)}…".`,
      );
    }
  });

  return {
    passed: issues.length === 0,
    issues,
    word_count: wordCount,
    quote_count: quotes.length,
  };
}
