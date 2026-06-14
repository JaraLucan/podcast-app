import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Job, Json } from "@/lib/types/database";

type DB = SupabaseClient<Database>;

export type JobType = "ingest_show" | "process_episode";

export type JobPayloads = {
  ingest_show: { show_id: string };
  process_episode: { episode_id: string };
};

const MAX_ATTEMPTS = 3;

export async function enqueue<T extends JobType>(
  db: DB,
  type: T,
  payload: JobPayloads[T],
  runAfter?: Date,
): Promise<void> {
  await db.from("jobs").insert({
    type,
    payload: payload as Json,
    run_after: (runAfter ?? new Date()).toISOString(),
  });
}

/** Atomically claim the next due job (FOR UPDATE SKIP LOCKED via SQL fn). */
export async function claimJob(db: DB): Promise<Job | null> {
  const { data, error } = await db.rpc("claim_job");
  if (error) throw new Error(`claim_job failed: ${error.message}`);
  return (data as Job | null) ?? null;
}

export async function completeJob(db: DB, id: number): Promise<void> {
  await db
    .from("jobs")
    .update({ status: "done", locked_at: null, error: null })
    .eq("id", id);
}

/** Mark failed with exponential backoff, or give up after MAX_ATTEMPTS. */
export async function failJob(
  db: DB,
  job: Job,
  message: string,
): Promise<void> {
  if (job.attempts >= MAX_ATTEMPTS) {
    await db
      .from("jobs")
      .update({ status: "failed", error: message, locked_at: null })
      .eq("id", job.id);
    return;
  }
  const backoffMin = Math.pow(2, job.attempts); // 2, 4, 8 min
  const runAfter = new Date(Date.now() + backoffMin * 60_000);
  await db
    .from("jobs")
    .update({
      status: "pending",
      error: message,
      locked_at: null,
      run_after: runAfter.toISOString(),
    })
    .eq("id", job.id);
}

/** Count episodes that entered the pipeline today (cost circuit breaker). */
export async function episodesQueuedToday(db: DB): Promise<number> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count } = await db
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("type", "process_episode")
    .gte("created_at", since.toISOString());
  return count ?? 0;
}
