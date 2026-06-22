import { JsonParseError, llmProvider, runJsonPass, type PassResult } from "./llm";
import { buildExtractUser, EXTRACT_SYSTEM, retryFeedback } from "./prompts";
import { extractionSchema, type Extraction } from "./types";

const ANTHROPIC_MAX_TOKENS = 8000;
// ~125k tokens of transcript; truncate beyond to stay within context.
const MAX_TRANSCRIPT_CHARS = 500_000;

// Groq's free tier (6000 TPM on the 8B extract model) can't take a whole
// transcript in one call — prompt + reserved output must fit under the cap. So
// for Groq we map-reduce: extract structured facts per transcript chunk, then
// merge. Each chunk is sized so (system + chunk + output) stays under 6000.
const GROQ_CHUNK_CHARS = 11_000; // ~2.7k tokens of transcript per call
const GROQ_EXTRACT_MAX_TOKENS = 1500;

/** One extraction call with a single parse-failure retry. */
async function runExtract(
  user: string,
  maxTokens: number,
): Promise<PassResult<Extraction>> {
  try {
    return await runJsonPass({
      tier: "extract",
      system: EXTRACT_SYSTEM,
      user,
      maxTokens,
      schema: extractionSchema,
    });
  } catch (err) {
    if (!(err instanceof JsonParseError)) throw err;
    return runJsonPass({
      tier: "extract",
      system: EXTRACT_SYSTEM,
      user: `${user}\n\n${retryFeedback([err.message], err.raw)}`,
      maxTokens,
      schema: extractionSchema,
    });
  }
}

/** Pass 1 — strict factual extraction (cheap model). */
export async function extract(input: {
  showTitle: string;
  episodeTitle: string;
  transcript: string;
}): Promise<PassResult<Extraction>> {
  const transcript =
    input.transcript.length > MAX_TRANSCRIPT_CHARS
      ? input.transcript.slice(0, MAX_TRANSCRIPT_CHARS)
      : input.transcript;

  // Anthropic has a large context + high rate limits → one call over the whole
  // transcript (best cross-references, no merge artifacts).
  if (llmProvider() !== "groq") {
    return runExtract(
      buildExtractUser({ ...input, transcript }),
      ANTHROPIC_MAX_TOKENS,
    );
  }

  // Groq free tier → chunk by whole timestamped lines, extract each, merge.
  const chunks = chunkByLines(transcript, GROQ_CHUNK_CHARS);
  const parts: PassResult<Extraction>[] = [];
  for (const chunk of chunks) {
    parts.push(
      await runExtract(
        buildExtractUser({
          showTitle: input.showTitle,
          episodeTitle: input.episodeTitle,
          transcript: chunk,
        }),
        GROQ_EXTRACT_MAX_TOKENS,
      ),
    );
  }
  return mergeParts(parts);
}

/**
 * Split a `[seconds] text`-per-line transcript into chunks no larger than
 * `maxChars`, never breaking a line (so timestamps stay intact).
 */
function chunkByLines(transcript: string, maxChars: number): string[] {
  const lines = transcript.split("\n");
  const chunks: string[] = [];
  let buf = "";
  for (const line of lines) {
    if (buf && buf.length + line.length + 1 > maxChars) {
      chunks.push(buf);
      buf = "";
    }
    buf = buf ? `${buf}\n${line}` : line;
  }
  if (buf) chunks.push(buf);
  return chunks.length ? chunks : [transcript];
}

/** Combine per-chunk results: merge the extractions, sum tokens + cost. */
function mergeParts(parts: PassResult<Extraction>[]): PassResult<Extraction> {
  return {
    data: mergeExtractions(parts.map((p) => p.data)),
    model: parts[0]?.model ?? "groq",
    tokensIn: parts.reduce((a, p) => a + p.tokensIn, 0),
    tokensOut: parts.reduce((a, p) => a + p.tokensOut, 0),
    costUsd: Math.round(parts.reduce((a, p) => a + p.costUsd, 0) * 1e6) / 1e6,
  };
}

// Caps keep the merged extraction (the editorial pass's input) bounded so it
// stays well under the editorial model's TPM budget on long episodes.
const CAPS = {
  topics: 25,
  claims: 60,
  numbers: 40,
  people: 60,
  companies: 60,
  disagreements: 25,
  quotes: 25,
  structure: 30,
} as const;

function mergeExtractions(parts: Extraction[]): Extraction {
  const all = <T>(sel: (p: Extraction) => T[]): T[] => parts.flatMap(sel);
  return {
    topics: uniqStrings(all((p) => p.topics)).slice(0, CAPS.topics),
    claims: capEvenly(
      dedupeByText(all((p) => p.claims)).sort(
        (a, b) => a.ts_seconds - b.ts_seconds,
      ),
      CAPS.claims,
    ),
    numbers: dedupeBy(
      all((p) => p.numbers),
      (n) => `${n.label}|${n.value}`,
    ).slice(0, CAPS.numbers),
    entities: {
      people: uniqStrings(all((p) => p.entities.people)).slice(0, CAPS.people),
      companies: uniqStrings(all((p) => p.entities.companies)).slice(
        0,
        CAPS.companies,
      ),
    },
    disagreements: dedupeByText(all((p) => p.disagreements)).slice(
      0,
      CAPS.disagreements,
    ),
    quotes: capEvenly(
      dedupeByText(all((p) => p.quotes)).sort(
        (a, b) => a.ts_seconds - b.ts_seconds,
      ),
      CAPS.quotes,
    ),
    structure: uniqStrings(all((p) => p.structure)).slice(0, CAPS.structure),
  };
}

function uniqStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const k = s.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s.trim());
  }
  return out;
}

function dedupeByText<T extends { text: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = item.text.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function dedupeBy<T>(arr: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item).trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/** Down-sample to `max` items spread evenly across the array (keeps coverage). */
function capEvenly<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}
