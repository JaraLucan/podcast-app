import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">PodBrief</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/shows" className="text-neutral-500 hover:text-foreground">
            Catalog
          </Link>
          {user ? (
            <Link
              href="/feed"
              className="rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              Your feed
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <section className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          The world&apos;s best tech &amp; finance podcasts, in 3-minute briefs.
        </h1>
        <p className="mt-6 text-pretty text-lg text-neutral-500">
          PodBrief turns every new episode into a sharp, written brief — the
          numbers, the predictions, the disagreements — with timestamps back to
          the audio. Read in minutes; listen when it&apos;s worth it.
        </p>
        <div className="mt-10 flex items-center gap-3">
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

      <footer className="px-6 py-8 text-center text-xs text-neutral-400">
        A companion to podcasts, not a replacement. Every brief links to the full
        episode.
      </footer>
    </main>
  );
}
