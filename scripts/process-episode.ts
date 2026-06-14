/**
 * Run the full pipeline on a single episode and print the brief (PRD M2).
 *
 *   pnpm process-episode <rss-feed-url> [--index N | --guid <guid>]
 *   pnpm process-episode --episode-id <uuid>     # re-process an existing row
 *
 * This is the iterate-on-quality harness: run it on 5-10 real episodes and tune
 * the prompts in src/lib/pipeline/prompts.ts until briefs clear the §2 bar.
 */
import { config } from "dotenv";

import { createServiceClient } from "@/lib/supabase/service";
import {
  processEpisode,
  processFeedItem,
  type ProcessResult,
} from "@/lib/pipeline/pipeline";

config({ path: ".env.local" });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function printBrief(r: ProcessResult) {
  const b = r.brief;
  const line = "─".repeat(72);
  console.log(`\n${line}`);
  console.log(`TL;DR\n${b.tldr}\n`);
  console.log("KEY TAKEAWAYS");
  b.takeaways.forEach((t) => console.log(`  • ${t}`));
  console.log("\nKEY MOMENTS");
  b.key_moments.forEach((m) =>
    console.log(`  [${fmt(m.ts_seconds)}] ${m.label}`),
  );
  if (b.numbers.length) {
    console.log("\nNOTABLE NUMBERS & PREDICTIONS");
    b.numbers.forEach((n) =>
      console.log(`  • ${n.label}: ${n.value}${n.context ? ` — ${n.context}` : ""}`),
    );
  }
  console.log(`\nWHY IT MATTERS\n${b.why_it_matters}`);
  console.log(line);
  console.log(
    `${r.published ? "✓ PUBLISHED" : "⚠ HELD FOR REVIEW"}  ·  cost $${r.costUsd.toFixed(4)}  ·  brief ${r.briefId}`,
  );
  if (r.issues.length) {
    console.log("Validation issues:");
    r.issues.forEach((i) => console.log(`  - ${i}`));
  }
}

function fmt(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

async function main() {
  const db = createServiceClient();
  const episodeId = arg("episode-id");

  let result: ProcessResult;
  if (episodeId) {
    console.log(`Processing existing episode ${episodeId}…`);
    result = await processEpisode(db, episodeId);
  } else {
    const feedUrl = process.argv[2];
    if (!feedUrl || feedUrl.startsWith("--")) {
      console.error(
        "Usage: pnpm process-episode <rss-feed-url> [--index N | --guid <guid>]\n" +
          "       pnpm process-episode --episode-id <uuid>",
      );
      process.exit(1);
    }
    const indexArg = arg("index");
    console.log(`Processing feed ${feedUrl}…`);
    result = await processFeedItem(db, {
      feedUrl,
      guid: arg("guid"),
      index: indexArg ? parseInt(indexArg, 10) : undefined,
    });
  }

  printBrief(result);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("\n✗ Pipeline failed:", err.message ?? err);
    process.exit(1);
  },
);
