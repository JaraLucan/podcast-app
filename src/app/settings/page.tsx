import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { FollowButton } from "@/components/follow-button";
import { ShowAvatar } from "@/components/show-avatar";
import { deleteAccount } from "@/lib/data/actions";
import {
  getCatalog,
  getCurrentUser,
  getFollowedShowIds,
} from "@/lib/data/queries";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");

  const [catalog, followed] = await Promise.all([
    getCatalog(),
    getFollowedShowIds(),
  ]);
  const followedShows = catalog.filter((s) => followed.has(s.id));

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-10 px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Account
          </h2>
          <p className="mt-2 text-sm">{user.email}</p>
          <form action="/auth/signout" method="post" className="mt-3">
            <button className="text-sm text-neutral-500 hover:text-foreground">
              Sign out
            </button>
          </form>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Following ({followedShows.length})
          </h2>
          {followedShows.length === 0 ? (
            <p className="text-sm text-neutral-400">
              You aren&apos;t following any shows yet.
            </p>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {followedShows.map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-3">
                  <ShowAvatar title={s.title} imageUrl={s.image_url} size={36} />
                  <span className="flex-1 truncate text-sm font-medium">
                    {s.title}
                  </span>
                  <FollowButton showId={s.id} following />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-red-200 p-5 dark:border-red-900/50">
          <h2 className="text-sm font-semibold text-red-600 dark:text-red-400">
            Delete account
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Permanently deletes your account and all your data (follows, reads,
            saves). This cannot be undone.
          </p>
          <form action={deleteAccount} className="mt-3 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <input type="checkbox" name="confirm" required />I understand
            </label>
            <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
              Delete my account
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
