import { z } from "zod";

// ── Pass 1: Extraction (cheap model) ───────────────────────────────────────
// Strict, factual dump from the transcript. No editorializing here.
export const extractionSchema = z.object({
  topics: z.array(z.string()),
  claims: z.array(
    z.object({
      text: z.string(),
      ts_seconds: z.number(),
    }),
  ),
  numbers: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      context: z.string().optional(),
    }),
  ),
  entities: z.object({
    people: z.array(z.string()),
    companies: z.array(z.string()),
  }),
  disagreements: z.array(
    z.object({
      text: z.string(),
      ts_seconds: z.number().optional(),
    }),
  ),
  quotes: z.array(
    z.object({
      text: z.string(),
      speaker: z.string().optional(),
      ts_seconds: z.number(),
    }),
  ),
  structure: z.array(z.string()),
});

export type Extraction = z.infer<typeof extractionSchema>;

// ── Pass 2: Editorial brief (strong model) ──────────────────────────────────
// Maps 1:1 onto the `briefs` table jsonb columns.
export const briefSchema = z.object({
  tldr: z.string(),
  takeaways: z.array(z.string()),
  key_moments: z.array(
    z.object({
      ts_seconds: z.number(),
      label: z.string(),
    }),
  ),
  numbers: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      context: z.string().optional(),
    }),
  ),
  why_it_matters: z.string(),
});

export type BriefContent = z.infer<typeof briefSchema>;

// Metadata passed into the editorial pass for "Why it matters" context.
export type EditorialContext = {
  showTitle: string;
  episodeTitle: string;
  publishedAt: string | null;
  durationSeconds: number | null;
  /** TL;DRs of recent briefs from the same show + same category (last 7 days). */
  recentContext: string[];
};
