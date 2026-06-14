import { JsonParseError, runJsonPass, type PassResult } from "./anthropic";
import { buildExtractUser, EXTRACT_SYSTEM, retryFeedback } from "./prompts";
import { extractionSchema, type Extraction } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL_EXTRACT ?? "claude-haiku-4-5";
const MAX_TOKENS = 8000;
// ~125k tokens of transcript; truncate beyond to stay within context.
const MAX_TRANSCRIPT_CHARS = 500_000;

/** Pass 1 — strict factual extraction (cheap model), with one retry. */
export async function extract(input: {
  showTitle: string;
  episodeTitle: string;
  transcript: string;
}): Promise<PassResult<Extraction>> {
  const transcript =
    input.transcript.length > MAX_TRANSCRIPT_CHARS
      ? input.transcript.slice(0, MAX_TRANSCRIPT_CHARS)
      : input.transcript;

  const user = buildExtractUser({ ...input, transcript });

  try {
    return await runJsonPass({
      model: MODEL,
      system: EXTRACT_SYSTEM,
      user,
      maxTokens: MAX_TOKENS,
      schema: extractionSchema,
    });
  } catch (err) {
    if (!(err instanceof JsonParseError)) throw err;
    // One retry with the parser's complaint appended.
    return runJsonPass({
      model: MODEL,
      system: EXTRACT_SYSTEM,
      user: `${user}\n\n${retryFeedback([err.message], err.raw)}`,
      maxTokens: MAX_TOKENS,
      schema: extractionSchema,
    });
  }
}
