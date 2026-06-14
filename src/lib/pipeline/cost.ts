// Per-million-token pricing (USD). Keep in sync with the model catalog.
// Matched by longest-prefix against the model id so date-suffixed ids resolve.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

const FALLBACK = { input: 3, output: 15 };

export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

function priceFor(model: string) {
  const key = Object.keys(PRICING).find((k) => model.startsWith(k));
  return key ? PRICING[key] : FALLBACK;
}

/** USD cost of one Messages API call. Cache reads bill ~0.1x, writes ~1.25x. */
export function computeCost(model: string, usage: TokenUsage): number {
  const { input, output } = priceFor(model);
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const dollars =
    (usage.input_tokens * input) / 1_000_000 +
    (usage.output_tokens * output) / 1_000_000 +
    (cacheRead * input * 0.1) / 1_000_000 +
    (cacheWrite * input * 1.25) / 1_000_000;
  return Math.round(dollars * 1e6) / 1e6;
}
