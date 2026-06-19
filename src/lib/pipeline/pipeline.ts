import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  ShowCategory,
  TranscriptSegment,
} from "@/lib/types/database";
import { episodeSlug, slugify } from "@/lib/utils/slug";

import { extract } from "./extract";
import { writeBrief } from "./editorial";
import { fetchFeed, type ParsedEpisode } from "./rss";
import {
  renderTranscriptForPrompt,
  transcribe,
  type TranscriptResult,
} from "./transcription";
import type { BriefContent } from "./types";

type DB = SupabaseClient<Database>;

export type ProcessResult = {
  episodeId: string;
  briefId: string;
  published: boolean;
  costUsd: number;
  brief: BriefContent;
  issues: string[];
};

/** TL;DRs of recent briefs (same show + same-category, last 7 days) for context. */
async function getRecentContext(
  db: DB,
  showId: string,
  category: ShowCategory | null,
): Promise<string[]> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const sameShow = await db
    .from("briefs")
    .select("tldr, episodes!inner(show_id)")
    .eq("episodes.show_id", showId)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(2);

  const context: string[] = (sameShow.data ?? [])
    .map((b) => b.tldr)
    .filter((t): t is string => Boolean(t));

  if (category) {
    const sameCat = await db
      .from("briefs")
      .select("tldr, published_at, episodes!inner(shows!inner(category))")
      .eq("episodes.shows.category", category)
      .not("published_at", "is", null)
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(3);
    for (const b of sameCat.data ?? []) {
      if (b.tldr && !context.includes(b.tldr)) context.push(b.tldr);
    }
  }

  return context.slice(0, 4);
}

/** Reuse a stored transcript if present; otherwise transcribe and persist. */
async function ensureTranscript(
  db: DB,
  episode: Database["public"]["Tables"]["episodes"]["Row"],
): Promise<TranscriptResult> {
  const existing = await db
    .from("transcripts")
    .select("*")
    .eq("episode_id", episode.id)
    .maybeSingle();

  if (existing.data) {
    const segments = (existing.data.segments ?? []) as TranscriptSegment[];
    return {
      source: existing.data.source,
      segments,
      fullText: existing.data.full_text ?? "",
      wordCount: existing.data.word_count ?? 0,
      costUsd: Number(existing.data.cost_usd ?? 0),
    };
  }

  if (!episode.audio_url) {
    throw new Error(`Episode ${episode.id} has no audio_url to transcribe`);
  }

  const transcript = await transcribe(episode.audio_url);

  await db.from("transcripts").upsert(
    {
      episode_id: episode.id,
      source: transcript.source,
      segments: transcript.segments,
      full_text: transcript.fullText,
      word_count: transcript.wordCount,
      cost_usd: transcript.costUsd,
    },
    { onConflict: "episode_id" },
  );

  return transcript;
}

/** Run the full pipeline for one already-discovered episode. */
export async function processEpisode(
  db: DB,
  episodeId: string,
): Promise<ProcessResult> {
  const { data: episode, error } = await db
    .from("episodes")
    .select("*")
    .eq("id", episodeId)
    .single();
  if (error || !episode) {
    throw new Error(`Episode not found: ${episodeId}`);
  }

  const { data: show } = await db
    .from("shows")
    .select("*")
    .eq("id", episode.show_id)
    .single();
  if (!show) throw new Error(`Show not found for episode ${episodeId}`);

  try {
    await db
      .from("episodes")
      .update({ status: "transcribing" })
      .eq("id", episode.id);

    const transcript = await ensureTranscript(db, episode);

    await db
      .from("episodes")
      .update({ status: "summarizing" })
      .eq("id", episode.id);

    const extraction = await extract({
      showTitle: show.title,
      episodeTitle: episode.title,
      transcript: renderTranscriptForPrompt(
        transcript.segments,
        transcript.fullText,
      ),
    });

    const recentContext = await getRecentContext(db, show.id, show.category);

    const { result, quality } = await writeBrief({
      extraction: extraction.data,
      durationSeconds: episode.duration_seconds,
      context: {
        showTitle: show.title,
        episodeTitle: episode.title,
        publishedAt: episode.published_at,
        durationSeconds: episode.duration_seconds,
        recentContext,
      },
    });

    const costUsd =
      Math.round((extraction.costUsd + result.costUsd) * 1e6) / 1e6;
    const published = quality.passed;

    const { data: brief, error: briefErr } = await db
      .from("briefs")
      .upsert(
        {
          episode_id: episode.id,
          tldr: result.data.tldr,
          takeaways: result.data.takeaways,
          key_moments: result.data.key_moments,
          numbers: result.data.numbers,
          why_it_matters: result.data.why_it_matters,
          // Persist pass-1 extraction for future cross-episode intelligence.
          extraction: extraction.data,
          model_used: result.model,
          tokens_in: extraction.tokensIn + result.tokensIn,
          tokens_out: extraction.tokensOut + result.tokensOut,
          cost_usd: costUsd,
          quality_flags: quality,
          published_at: published ? new Date().toISOString() : null,
        },
        { onConflict: "episode_id" },
      )
      .select("id")
      .single();

    if (briefErr || !brief) {
      throw new Error(`Failed to store brief: ${briefErr?.message}`);
    }

    // Auto-publish only when validation passed; otherwise hold for admin review.
    await db
      .from("episodes")
      .update({ status: published ? "published" : "summarizing" })
      .eq("id", episode.id);

    return {
      episodeId: episode.id,
      briefId: brief.id,
      published,
      costUsd,
      brief: result.data,
      issues: quality.issues,
    };
  } catch (err) {
    await db
      .from("episodes")
      .update({ status: "failed" })
      .eq("id", episode.id);
    throw err;
  }
}

/**
 * CLI entry: process a single episode straight from an RSS feed (PRD M2). Finds
 * or creates the show + episode rows, then runs the pipeline end-to-end.
 */
export async function processFeedItem(
  db: DB,
  opts: { feedUrl: string; guid?: string; index?: number },
): Promise<ProcessResult> {
  const feed = await fetchFeed(opts.feedUrl);
  if (feed.episodes.length === 0) {
    throw new Error("Feed has no episodes");
  }

  let item: ParsedEpisode | undefined;
  if (opts.guid) {
    item = feed.episodes.find((e) => e.guid === opts.guid);
    if (!item) throw new Error(`No episode with guid ${opts.guid}`);
  } else {
    item = feed.episodes[opts.index ?? 0];
  }

  // Find or create the show (keyed on rss_url).
  let { data: show } = await db
    .from("shows")
    .select("*")
    .eq("rss_url", opts.feedUrl)
    .maybeSingle();

  if (!show) {
    const title = feed.showTitle ?? "Untitled show";
    const created = await db
      .from("shows")
      .upsert(
        {
          slug: slugify(title) || `show-${Date.now()}`,
          title,
          rss_url: opts.feedUrl,
          image_url: feed.showImage,
          ingest_source: "rss",
        },
        { onConflict: "slug" },
      )
      .select("*")
      .single();
    if (created.error || !created.data) {
      throw new Error(`Failed to create show: ${created.error?.message}`);
    }
    show = created.data;
  }

  const { data: episode, error: epErr } = await db
    .from("episodes")
    .upsert(
      {
        show_id: show.id,
        guid: item.guid,
        slug: episodeSlug(item.title, item.guid),
        title: item.title,
        description: item.description,
        audio_url: item.audioUrl,
        published_at: item.publishedAt,
        duration_seconds: item.durationSeconds,
        youtube_url: item.link?.includes("youtu") ? item.link : null,
        status: "discovered",
      },
      { onConflict: "show_id,guid" },
    )
    .select("id")
    .single();

  if (epErr || !episode) {
    throw new Error(`Failed to upsert episode: ${epErr?.message}`);
  }

  return processEpisode(db, episode.id);
}
