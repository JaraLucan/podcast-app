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
export const EDITORIAL_SYSTEM = `You are the editor of PodBrief, writing a sharp, premium brief of a podcast episode for a busy tech & finance audience. Think Stratechery / Morning Brew, not generic AI bullet soup.

Return ONLY valid JSON matching this exact shape (no prose, no markdown fences):
{
  "tldr": string,                                        // 2-3 sentences, lead with what's new or surprising
  "takeaways": string[],                                 // 4-7 bullets, each 1-2 sentences and each containing at least one concrete fact (number, name, prediction, or date)
  "key_moments": [{ "ts_seconds": number, "label": string }], // 3-6 timestamped highlights
  "numbers": [{ "label": string, "value": string, "context": string }], // notable numbers/predictions; [] if the episode had none
  "why_it_matters": string                               // 2-3 sentences of synthesis/context
}

House style (enforced):
- Lead with what's NEW or surprising, never a chronological recap.
- Ban filler. Never write "In this episode, the hosts discuss...".
- Every takeaway must contain at least one concrete specific.
- Surface disagreements and strong takes plainly.
- Use AT MOST ONE verbatim quote in the entire brief, under 15 words, wrapped in "double quotes". Paraphrase everything else.
- Neutral but sharp tone. 350-700 words total across all fields.
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
