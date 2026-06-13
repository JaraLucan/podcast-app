/**
 * Seeds the `shows` catalog (PRD M1).
 *
 * For each curated show in `shows.seed.ts` we resolve the real RSS feed,
 * artwork, and Apple page via the free iTunes Search API, then upsert into
 * Supabase (keyed on `slug`, so it's safe to re-run). Always review the
 * resolved titles printed at the end — a wrong iTunes match means a wrong feed.
 *
 *   pnpm db:seed
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { SEED_SHOWS } from "./shows.seed";
import { resolveFeed, sleep } from "./itunes";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const summary: { slug: string; resolved: string; feed: boolean }[] = [];

  for (const show of SEED_SHOWS) {
    const result = await resolveFeed(show.search);

    const row = {
      slug: show.slug,
      title: show.title,
      publisher: show.publisher,
      category: show.category,
      description: show.description,
      rss_url: result?.feedUrl ?? null,
      image_url: result?.artworkUrl600 ?? result?.artworkUrl100 ?? null,
      website_url: result?.collectionViewUrl ?? null,
      is_active: true,
    };

    const { error } = await supabase
      .from("shows")
      .upsert(row, { onConflict: "slug" });

    if (error) {
      console.error(`✗ ${show.slug}: ${error.message}`);
    } else {
      summary.push({
        slug: show.slug,
        resolved: result?.collectionName ?? "—",
        feed: Boolean(result?.feedUrl),
      });
    }

    await sleep(350); // be polite to the iTunes API
  }

  console.log("\nSeed complete. Verify the iTunes match for each show:\n");
  console.log("slug".padEnd(28), "feed?", " resolved title");
  console.log("-".repeat(72));
  for (const s of summary) {
    console.log(
      s.slug.padEnd(28),
      s.feed ? " yes " : " NO  ",
      ` ${s.resolved}`,
    );
  }

  const missing = summary.filter((s) => !s.feed);
  if (missing.length) {
    console.warn(
      `\n⚠ ${missing.length} show(s) have no RSS feed — fix manually: ${missing
        .map((m) => m.slug)
        .join(", ")}`,
    );
  }
  console.log(`\n${summary.length} shows upserted.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
