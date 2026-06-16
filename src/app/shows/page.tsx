import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { FollowButton } from "@/components/follow-button";
import { ShowAvatar } from "@/components/show-avatar";
import {
  getCatalog,
  getCurrentUser,
  getFollowedShowIds,
} from "@/lib/data/queries";
import type { ShowCategory } from "@/lib/types/database";

export const metadata = {
  title: "Catalog",
  description: "Browse the tech, finance, and AI shows PodBrief covers.",
};

const CATEGORIES: ShowCategory[] = [
  "tech",
  "finance",
  "ai",
  "crypto",
  "business",
];

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const active = CATEGORIES.includes(category as ShowCategory)
    ? (category as ShowCategory)
    : null;
  const query = (q ?? "").trim().toLowerCase();

  const [shows, followed, user] = await Promise.all([
    getCatalog(),
    getFollowedShowIds(),
    getCurrentUser(),
  ]);

  const filtered = shows.filter((s) => {
    if (active && s.category !== active) return false;
    if (query) {
      const hay = `${s.title} ${s.publisher ?? ""}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Follow shows to build your feed.
        </p>

        <form method="get" className="mt-5">
          {active && <input type="hidden" name="category" value={active} />}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search shows…"
            className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100"
          />
        </form>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Chip href="/shows" label="All" active={!active} />
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              href={`/shows?category=${c}`}
              label={c}
              active={active === c}
            />
          ))}
        </div>

        <div className="mt-6 divide-y divide-neutral-100 dark:divide-neutral-900">
          {filtered.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-4">
              <ShowAvatar title={s.title} imageUrl={s.image_url} size={48} />
              <Link href={`/shows/${s.slug}`} className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium hover:underline">
                    {s.title}
                  </span>
                  {s.featured && (
                    <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      Featured
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-neutral-400">
                  {s.publisher} · {s.category}
                </div>
              </Link>
              {user ? (
                <FollowButton showId={s.id} following={followed.has(s.id)} />
              ) : (
                <Link
                  href="/login?next=/shows"
                  className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
                >
                  Follow
                </Link>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-10 text-center text-neutral-400">
              {query
                ? `No shows match “${q}”.`
                : "No shows in this category yet."}
            </p>
          )}
        </div>
      </main>
    </>
  );
}

function Chip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-neutral-900 px-3 py-1 font-medium capitalize text-white dark:bg-white dark:text-neutral-900"
          : "rounded-full border border-neutral-300 px-3 py-1 capitalize text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
      }
    >
      {label}
    </Link>
  );
}
