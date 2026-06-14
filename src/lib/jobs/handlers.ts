import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Job } from "@/lib/types/database";
import { ingestShow } from "@/lib/pipeline/ingest";
import { processEpisode } from "@/lib/pipeline/pipeline";

import type { JobPayloads } from "./queue";

type DB = SupabaseClient<Database>;

/** Dispatch a claimed job to its handler. Throws on failure (caller retries). */
export async function runJob(db: DB, job: Job): Promise<string> {
  const payload = (job.payload ?? {}) as Record<string, unknown>;

  switch (job.type) {
    case "ingest_show": {
      const { show_id } = payload as JobPayloads["ingest_show"];
      const r = await ingestShow(db, show_id);
      return `ingested ${r.show}: ${r.enqueued} enqueued, ${r.skipped} skipped`;
    }
    case "process_episode": {
      const { episode_id } = payload as JobPayloads["process_episode"];
      const r = await processEpisode(db, episode_id);
      return `episode ${episode_id}: ${r.published ? "published" : "held"} ($${r.costUsd.toFixed(4)})`;
    }
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}
