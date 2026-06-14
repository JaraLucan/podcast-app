/**
 * PodBrief worker (PRD §3). A single long-running process that polls the
 * Postgres `jobs` table and runs the pipeline. Deploy as one $5/month container
 * (Railway/Fly) — not serverless, so long audio jobs don't hit function timeouts.
 *
 *   pnpm worker
 */
import { config } from "dotenv";

import { createServiceClient } from "@/lib/supabase/service";
import { claimJob, completeJob, failJob } from "@/lib/jobs/queue";
import { runJob } from "@/lib/jobs/handlers";
import { reportError } from "@/lib/observability";

config({ path: ".env.local" });

const IDLE_MS = Number(process.env.WORKER_IDLE_MS ?? 5000);
const db = createServiceClient();

let running = true;
process.on("SIGINT", () => {
  console.log("\nShutting down after current job…");
  running = false;
});
process.on("SIGTERM", () => {
  running = false;
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loop() {
  console.log("PodBrief worker started. Polling for jobs…");
  while (running) {
    let job;
    try {
      job = await claimJob(db);
    } catch (err) {
      console.error("claim error:", (err as Error).message);
      await sleep(IDLE_MS);
      continue;
    }

    if (!job) {
      await sleep(IDLE_MS);
      continue;
    }

    const started = Date.now();
    console.log(`▶ job ${job.id} (${job.type}) attempt ${job.attempts}`);
    try {
      const summary = await runJob(db, job);
      await completeJob(db, job.id);
      console.log(`✓ job ${job.id}: ${summary} [${Date.now() - started}ms]`);
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      await failJob(db, job, message);
      await reportError(err, { jobId: job.id, type: job.type });
    }
  }
  console.log("Worker stopped.");
  process.exit(0);
}

loop();
