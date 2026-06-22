/**
 * One pipeline "tick" — for free, serverless operation (GitHub Actions cron).
 * Optionally enqueues an ingest for every active show, then drains the job
 * queue to completion and exits. Run on a schedule instead of an always-on
 * worker (see .github/workflows/pipeline.yml).
 *
 *   pnpm tick            # just drain whatever is queued
 *   pnpm tick --ingest   # poll all feeds first, then drain
 */
import { config } from "dotenv";

import { runJob } from "@/lib/jobs/handlers";
import { claimJob, completeJob, failJob } from "@/lib/jobs/queue";
import { reportError } from "@/lib/observability";
import { enqueueAllActiveShows } from "@/lib/pipeline/ingest";
import { createServiceClient } from "@/lib/supabase/service";

config({ path: ".env.local" });

const MAX_JOBS = Number(process.env.TICK_MAX_JOBS ?? 50);

async function main() {
  const db = createServiceClient();

  if (process.argv.includes("--ingest")) {
    const n = await enqueueAllActiveShows(db);
    console.log(`Enqueued ingest for ${n} active show(s).`);
  }

  let processed = 0;
  let failed = 0;
  while (processed + failed < MAX_JOBS) {
    const job = await claimJob(db);
    if (!job) break; // queue drained (jobs scheduled in the future are skipped)

    try {
      const summary = await runJob(db, job);
      await completeJob(db, job.id);
      console.log(`✓ job ${job.id} (${job.type}): ${summary}`);
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await failJob(db, job, message);
      await reportError(err, { jobId: job.id, type: job.type });
      console.error(`✗ job ${job.id} (${job.type}): ${message}`);
      failed++;
    }
  }

  console.log(`Tick complete: ${processed} done, ${failed} failed.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
