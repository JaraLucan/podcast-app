import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { BriefCard } from "@/components/brief-card";
import { markAllRead } from "@/lib/data/actions";
import {
  getCurrentUser,
  getFeed,
  getProfile,
  type FeedFilter,
} from "@/lib/data/queries";

export const metadata = { title: "Your feed" };

const TABS: { key: FeedFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "saved", label: "Saved" },
];

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/feed");

  const profile = await getProfile();
  if (!profile?.onboarded) redirect("/onboarding");

  const { tab } = await searchParams;
  const filter: FeedFilter =
    tab === "unread" || tab === "saved" ? tab : "all";

  const { items, followsCount } = await getFeed(filter);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex gap-1 rounded-full bg-neutral-100 p-1 text-sm dark:bg-neutral-900">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={t.key === "all" ? "/feed" : `/feed?tab=${t.key}`}
                className={
                  filter === t.key
                    ? "rounded-full bg-white px-3 py-1 font-medium shadow-sm dark:bg-neutral-700"
                    : "rounded-full px-3 py-1 text-neutral-500"
                }
              >
                {t.label}
              </Link>
            ))}
          </div>
          {filter === "unread" && items.length > 0 && (
            <form action={markAllRead}>
              <button className="text-sm text-neutral-500 hover:text-foreground">
                Mark all read
              </button>
            </form>
          )}
        </div>

        {followsCount === 0 ? (
          <EmptyState
            title="Your feed is empty"
            body="Follow a few shows and their briefs will appear here within an hour of each new episode."
            cta={{ href: "/shows", label: "Browse the catalog" }}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title={
              filter === "saved"
                ? "Nothing saved yet"
                : filter === "unread"
                  ? "You're all caught up"
                  : "No briefs yet"
            }
            body={
              filter === "saved"
                ? "Tap Save on any brief to keep it here."
                : filter === "unread"
                  ? "New briefs will show up as your shows publish."
                  : "Briefs will appear as your followed shows publish new episodes."
            }
            cta={{ href: "/shows", label: "Find more shows" }}
          />
        ) : (
          <div className="space-y-4">
            {items.map((b) => (
              <BriefCard key={b.id} brief={b} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <div className="mt-16 rounded-xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-500">{body}</p>
      <Link
        href={cta.href}
        className="mt-6 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        {cta.label}
      </Link>
    </div>
  );
}
