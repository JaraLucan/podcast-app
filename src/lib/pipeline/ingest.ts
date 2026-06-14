import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { enqueue, episodesQueuedToday } from "@/lib/jobs/queue";
import { episodeSlug } from "@/lib/utils/slug";

import { fetchFeed, shouldSkipEpisode } from "./rss";

type DB = SupabaseClient<Database>;

const MIN_MINUTES = Number(process.env.MIN_EPISODE_MINUTES ?? 10);
const MAX_PER_DAY = Number(process.env.MAX_EPISODES_PER_DAY ?? 40);

export type IngestResult = {
  show: string;
  discovered: number;
  enqueued: number;
  skipped: number;
};

/**
 * Poll one show's feed: upsert new episodes, apply skip rules (PRD §5.1), and
 * enqueue a process job for each genuinely new episode — respecting the global
 * daily cap as a runaway-cost circuit breaker (PRD §5.5).
 */
export async function ingestShow(db: DB, showId: string): Promise<IngestResult> {
  const { data: show, error } = await db
    .from("shows")
    .select("*")
    .eq("id", showId)
    .single();
  if (error || !show) throw new Error(`Show not found: ${showId}`);
  if (!show.rss_url) throw new Error(`Show ${show.slug} has no rss_url`);

  const feed = await fetchFeed(show.rss_url);
  let enqueued = 0;
  let skipped = 0;
  let budget = MAX_PER_DAY - (await episodesQueuedToday(db));

  for (const ep of feed.episodes) {
    const { skip } = shouldSkipEpisode(ep, MIN_MINUTES);

    // Is this episode already known?
    const { data: existing } = await db
      .from("episodes")
      .select("id, status")
      .eq("show_id", show.id)
      .eq("guid", ep.guid)
      .maybeSingle();

    if (existing) continue; // already discovered — nothing to do

    const status = skip ? "skipped" : "discovered";
    const { data: inserted } = await db
      .from("episodes")
      .insert({
        show_id: show.id,
        guid: ep.guid,
        slug: episodeSlug(ep.title, ep.guid),
        title: ep.title,
        description: ep.description,
        audio_url: ep.audioUrl,
        published_at: ep.publishedAt,
        duration_seconds: ep.durationSeconds,
        youtube_url: ep.link?.includes("youtu") ? ep.link : null,
        status,
      })
      .select("id")
      .single();

    if (skip || !inserted) {
      skipped++;
      continue;
    }

    if (budget <= 0) {
      skipped++; // over daily cap — leave as 'discovered' for a later run
      continue;
    }

    await enqueue(db, "process_episode", { episode_id: inserted.id });
    enqueued++;
    budget--;
  }

  return {
    show: show.title,
    discovered: feed.episodes.length,
    enqueued,
    skipped,
  };
}

/** Enqueue an ingest job for every active show (RSS poller cron, PRD §5.1). */
export async function enqueueAllActiveShows(db: DB): Promise<number> {
  const { data: shows } = await db
    .from("shows")
    .select("id")
    .eq("is_active", true);
  for (const s of shows ?? []) {
    await enqueue(db, "ingest_show", { show_id: s.id });
  }
  return shows?.length ?? 0;
}
