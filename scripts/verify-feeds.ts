/**
 * Verifies the curated catalog without touching the database (PRD §10: "verify
 * RSS feeds at build time"). Resolves each show via the iTunes Search API and
 * prints the matched title + feed so you can sanity-check before seeding.
 *
 *   pnpm db:verify-feeds
 */
import { SEED_SHOWS } from "./shows.seed";
import { resolveFeed, sleep } from "./itunes";

async function main() {
  let missing = 0;
  console.log("slug".padEnd(28), "feed?", " resolved iTunes title");
  console.log("-".repeat(78));

  for (const show of SEED_SHOWS) {
    const r = await resolveFeed(show.search);
    const ok = Boolean(r?.feedUrl);
    if (!ok) missing++;
    console.log(
      show.slug.padEnd(28),
      ok ? " yes " : " NO  ",
      ` ${r?.collectionName ?? "—"}`,
    );
    await sleep(350);
  }

  console.log(
    `\n${SEED_SHOWS.length} shows checked, ${missing} without a feed.`,
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
