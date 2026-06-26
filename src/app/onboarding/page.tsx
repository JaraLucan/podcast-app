import { redirect } from "next/navigation";

import { ShowAvatar } from "@/components/show-avatar";
import { completeOnboarding } from "@/lib/data/actions";
import { getCatalog, getCurrentUser, getProfile } from "@/lib/data/queries";
import type { ShowCategory } from "@/lib/types/database";

export const metadata = { title: "Welcome" };

const CATEGORIES: ShowCategory[] = [
  "tech",
  "finance",
  "ai",
  "crypto",
  "business",
];

// A few sensible pre-checked defaults so new users land with a non-empty feed.
const DEFAULTS = new Set([
  "all-in",
  "acquired",
  "odd-lots",
  "dwarkesh",
  "lex-fridman",
  "the-compound-and-friends",
]);

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");

  const profile = await getProfile();
  if (profile?.onboarded) redirect("/feed");

  const catalog = await getCatalog();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        Pick shows to follow
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Choose at least 3. We&apos;ll build your feed from new episodes of these
        shows. You can change this anytime.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Something went wrong saving your picks. Please try again.
        </p>
      )}

      <form action={completeOnboarding} className="mt-8 space-y-8">
        {CATEGORIES.map((cat) => {
          const shows = catalog.filter((s) => s.category === cat);
          if (shows.length === 0) return null;
          return (
            <section key={cat}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {cat}
              </h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {shows.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 p-3 text-sm transition hover:border-neutral-300 has-[:checked]:border-neutral-900 dark:border-neutral-800 dark:has-[:checked]:border-white"
                  >
                    <input
                      type="checkbox"
                      name="show_id"
                      value={s.id}
                      defaultChecked={DEFAULTS.has(s.slug)}
                    />
                    <ShowAvatar
                      title={s.title}
                      imageUrl={s.image_url}
                      size={32}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {s.title}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          );
        })}

        <div className="sticky bottom-0 -mx-6 border-t border-neutral-200 bg-background/90 px-6 py-4 backdrop-blur dark:border-neutral-800">
          <button className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
            Start reading →
          </button>
        </div>
      </form>
    </main>
  );
}
