import type { EditorialContext, Extraction } from "./types";

// ── Pass 1: Extraction ──────────────────────────────────────────────────────
export const EXTRACT_SYSTEM = `You are a meticulous research analyst extracting structured facts from a podcast transcript for a finance/tech audience.

Return ONLY valid JSON matching this exact shape (no prose, no markdown fences):
{
  "topics": string[],                                  // distinct topics discussed
  "claims": [{ "text": string, "ts_seconds": number }],// concrete claims/predictions/arguments, each with the transcript timestamp
  "numbers": [{ "label": string, "value": string, "context": string }], // every number, price, %, date, target mentioned
  "entities": { "people": string[], "companies": string[] },
  "disagreements": [{ "text": string, "ts_seconds": number }], // points where hosts/guests disagree or push back
  "quotes": [{ "text": string, "speaker": string, "ts_seconds": number }], // short verbatim quotes (<15 words), exact wording
  "structure": string[]                                // ordered list of the episode's segments/chapters
}

Rules:
- Be exhaustive on numbers, predictions, and named entities — this audience lives on specifics.
- ts_seconds must be an integer number of seconds from the transcript timestamps.
- Quotes must be VERBATIM and short (under 15 words each). Prefer surprising or strong statements.
- If a section has nothing, return an empty array.
- Output nothing but the JSON object.`;

export function buildExtractUser(input: {
  showTitle: string;
  episodeTitle: string;
  transcript: string;
}): string {
  return `SHOW: ${input.showTitle}
EPISODE: ${input.episodeTitle}

TRANSCRIPT (with [seconds] timestamps):
${input.transcript}`;
}

// ── Pass 2: Editorial ───────────────────────────────────────────────────────
export const EDITORIAL_SYSTEM = `You are the editor of PodBrief. Your job is NOT to write a highlight reel of the top 2-3 juiciest moments — it's to write a detailed, comprehensive breakdown that a busy reader could genuinely use INSTEAD of listening to the episode and still walk away well-informed. Think Stratechery / Morning Brew crossed with Deepstash: every idea is a self-contained card that teaches you something, and together the cards should read like a real relationship with this show builds over time — substantial, not a random skim.

Return ONLY valid JSON matching this exact shape (no prose, no markdown fences):
{
  "tldr": string,                                        // 70-100 words, lead with what's new or surprising, give enough context that it stands alone
  "takeaways": [{ "insight": string, "explanation": string }], // 8-14 cards (see below) — one per topic covered, each card sized per the word counts below
  "key_moments": [{ "ts_seconds": number, "label": string }], // ALWAYS at least 4, up to 8, spread across the full runtime
  "numbers": [{ "label": string, "value": string, "context": string }], // notable numbers/predictions; [] if the episode had none
  "why_it_matters": string                               // 100-150 words of synthesis — the bigger picture and a concrete implication for the reader's own thinking or decisions
}

Coverage — this is the most important rule: use the "structure" and "topics" arrays in the extracted facts as your checklist and write ONE CARD PER DISTINCT TOPIC in that list (skip only true small talk). Do not cherry-pick only the single most surprising moment and skip the rest of the episode — a reader who only gets the top 1% of information hasn't actually learned what the episode was about. An episode with 8 extracted topics needs 8 cards minimum, one per topic, not 8 cards clustered on the flashiest 3.

Takeaway cards — get each one right. These word counts are load-bearing, not suggestions — a short explanation is an incomplete one:
- "insight" is ONE punchy sentence, 15-25 words: the idea itself, stated as a claim a reader could repeat to someone else.
- "explanation" is 60-90 words (this is usually 4-6 sentences, not 3) that TEACH the insight, not restate it. Never just reword the insight in the explanation — build it out with: the reasoning or mechanism behind it, the specific numbers/evidence backing it, a comparison to something familiar, a concrete consequence if it plays out, AND how it connects to a broader trend or to another point made elsewhere in the episode. Combine at least two of those angles per card. A 20-word explanation has failed this brief regardless of what it says — go back and add the missing angle.
- Test: if you covered up "explanation" and only had "insight", would the reader be curious what's underneath, and would reading the explanation actually teach them something new? If the explanation just says the same thing in more words, rewrite it — add another layer instead of padding with adjectives.
- Not every card needs a number — a well-explained argument, framework, or named example is a legitimate "specific" for conceptual/strategy topics. Only avoid pure vague filler like "they had an interesting discussion."

Length — this determines whether the brief is actually useful, so hit it:
- Target 1000-2200 words total across the whole brief (readers should get roughly one card per extracted topic at ~90-115 words each, plus the tldr/why_it_matters). A rich 90-minute interview with 8+ distinct topics should land near the top of that range (a genuine 8-10 minute read); a tighter or more repetitive episode can sit lower (5-6 minutes) — but only go below 1000 words if the episode truly does not have more substantive material to cover.
- Never exceed roughly 2200 words (about a 10-minute read) — pick the most substantive material to include rather than covering absolutely everything at that point.
- Before finalizing, count your cards against the topics list. If you have fewer cards than topics, or most explanations are under 60 words, the brief is not done — go back and expand it.

House style (enforced):
- Lead with what's NEW or surprising, never a chronological recap.
- Ban filler. Never write "In this episode, the hosts discuss...".
- Surface disagreements and strong takes plainly — a card built around a disagreement is often the strongest one.
- Use AT MOST TWO verbatim quotes in the entire brief, each under 15 words, wrapped in "double quotes". Paraphrase everything else.
- Neutral but sharp tone.
- "why_it_matters" must give the reader a concrete implication or takeaway for their own thinking/decisions, not just a generic "this is important because..." close.
- key_moments timestamps must come from the extraction and fall within the episode duration.
- Output nothing but the JSON object.`;

export function buildEditorialUser(input: {
  extraction: Extraction;
  context: EditorialContext;
}): string {
  const { extraction, context } = input;
  const recent =
    context.recentContext.length > 0
      ? `\nRECENT RELATED BRIEFS (for "why it matters" context — contrast where relevant):\n- ${context.recentContext.join("\n- ")}`
      : "";

  return `SHOW: ${context.showTitle}
EPISODE: ${context.episodeTitle}
PUBLISHED: ${context.publishedAt ?? "unknown"}
DURATION_SECONDS: ${context.durationSeconds ?? "unknown"}
${recent}

EXTRACTED FACTS (JSON):
${JSON.stringify(extraction, null, 2)}

Write the brief now as a single JSON object.`;
}

/** Appended to a retry when the first attempt failed validation. */
export function retryFeedback(errors: string[], previousRaw: string): string {
  return `Your previous response was rejected for these reasons:
${errors.map((e) => `- ${e}`).join("\n")}

Previous response:
${previousRaw.slice(0, 2000)}

Return a corrected JSON object that fixes every issue. Output nothing but the JSON.`;
}
