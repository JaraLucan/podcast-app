import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { BriefCard } from "@/components/brief-card";
import { FollowButton } from "@/components/follow-button";
import { ShowAvatar } from "@/components/show-avatar";
import {
  getCurrentUser,
  getFollowedShowIds,
  getShowBriefs,
  getShowBySlug,
} from "@/lib/data/queries";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const show = await getShowBySlug(slug);
  if (!show) return { title: "Show not found" };
  return {
    title: show.title,
    description: show.description ?? `Briefs of ${show.title} on PodBrief.`,
  };
}

export default async function ShowPage({ params }: { params: Params }) {
  const { slug } = await params;
  const show = await getShowBySlug(slug);
  if (!show) notFound();

  const [briefs, followed, user] = await Promise.all([
    getShowBriefs(show.id),
    getFollowedShowIds(),
    getCurrentUser(),
  ]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-6">
        <div className="flex items-start gap-4">
          <ShowAvatar title={show.title} imageUrl={show.image_url} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {show.title}
            </h1>
            <div className="mt-1 text-sm text-neutral-400">
              {show.publisher} · {show.category}
            </div>
            {show.description && (
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
                {show.description}
              </p>
            )}
            <div className="mt-4">
              {user ? (
                <FollowButton showId={show.id} following={followed.has(show.id)} />
              ) : (
                <Link
                  href={`/login?next=/shows/${show.slug}`}
                  className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
                >
                  Sign in to follow
                </Link>
              )}
            </div>
          </div>
        </div>

        <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Recent briefs
        </h2>
        {briefs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-400 dark:border-neutral-700">
            No briefs published yet — they appear within an hour of each new
            episode.
          </p>
        ) : (
          <div className="space-y-4">
            {briefs.map((b) => (
              <BriefCard key={b.id} brief={b} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
