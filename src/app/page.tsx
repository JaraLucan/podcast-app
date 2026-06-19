import Link from "next/link";

import { ShowAvatar } from "@/components/show-avatar";
import { getCatalog, getLatestBriefs } from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";
import { readMinutes } from "@/lib/utils/format";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [latest, catalog] = await Promise.all([
    getLatestBriefs(3).catch(() => []),
    getCatalog().catch(() => []),
  ]);

  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">PodBrief</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/shows" className="text-neutral-500 hover:text-foreground">
            Catalog
          </Link>
          <Link
            href={user ? "/feed" : "/login"}
            className="rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            {user ? "Your feed" : "Sign in"}
          </Link>
        </nav>
      </header>

      <section className="mx-auto w-full max-w-2xl px-6 pb-12 pt-16 text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          The world&apos;s best tech &amp; finance podcasts, in 3-minute briefs.
        </h1>
        <p className="mt-6 text-pretty text-lg text-neutral-500">
          Podcasts are long; most never get finished. PodBrief turns each new
          episode into a sharp 3-minute brief — the numbers, predictions, and
          disagreements, with timestamps back to the audio — so you can decide
          what&apos;s worth a full listen.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link
            href={user ? "/feed" : "/login"}
            className="rounded-lg bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {user ? "Go to your feed" : "Get started — it's free"}
          </Link>
          <Link
            href="/shows"
            className="rounded-lg px-6 py-3 text-sm font-medium text-neutral-600 transition hover:text-foreground"
          >
            Browse the catalog
          </Link>
        </div>
      </section>

      {/* Example briefs (SEO + conversion) */}
      {latest.length > 0 && (
        <section className="mx-auto w-full max-w-3xl px-6 py-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Latest briefs
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {latest.map((b) => (
              <Link
                key={b.id}
                href={`/b/${b.show.slug}/${b.episode.slug}`}
                className="rounded-xl border border-neutral-200 p-4 transition hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
              >
                <div className="flex items-center gap-2">
                  <ShowAvatar
                    title={b.show.title}
                    imageUrl={b.show.imageUrl}
                    size={24}
                  />
                  <span className="truncate text-xs text-neutral-500">
                    {b.show.title}
                  </span>
                </div>
                <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">
                  {b.episode.title}
                </h3>
                {b.tldr && (
                  <p className="mt-2 line-clamp-3 text-xs text-neutral-500">
                    {b.tldr}
                  </p>
                )}
                <span className="mt-3 block text-xs font-medium text-neutral-400">
                  {readMinutes(
                    [b.tldr, ...b.takeaways].filter(Boolean).join(" "),
                  )}{" "}
                  min read
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Catalog preview */}
      {catalog.length > 0 && (
        <section className="mx-auto w-full max-w-3xl px-6 py-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Shows we cover
            </h2>
            <Link
              href="/shows"
              className="text-sm text-neutral-500 hover:text-foreground"
            >
              See all {catalog.length} →
            </Link>
          </div>
          <div className="flex flex-wrap gap-3">
            {catalog.slice(0, 14).map((s) => (
              <Link
                key={s.id}
                href={`/shows/${s.slug}`}
                className="flex items-center gap-2 rounded-full border border-neutral-200 py-1 pl-1 pr-3 text-sm transition hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
              >
                <ShowAvatar title={s.title} imageUrl={s.image_url} size={24} />
                <span className="max-w-[12rem] truncate">{s.title}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="mx-auto mt-auto w-full max-w-3xl px-6 py-10 text-sm text-neutral-400">
        <p>A companion to podcasts, not a replacement. Every brief links to the full episode.</p>
        <nav className="mt-3 flex gap-4">
          <Link href="/shows" className="hover:text-foreground">
            Catalog
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <a href="mailto:takedown@podbrief.com" className="hover:text-foreground">
            Takedown
          </a>
        </nav>
      </footer>
    </main>
  );
}
