import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Your feed" };

// Placeholder feed. The real personalized feed (cards, unread/saved tabs,
// read-time vs listen-time) is built in M4 — this proves auth + session wiring.
export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/feed");
  }

  const { count: followCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          PodBrief
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-sm text-neutral-500 hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </header>

      <div className="mt-16 rounded-xl border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
        <h1 className="text-xl font-semibold">Your feed is taking shape</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Signed in as <span className="font-medium">{user.email}</span>. You
          follow {followCount ?? 0} show{followCount === 1 ? "" : "s"}.
        </p>
        <p className="mt-4 text-sm text-neutral-400">
          The personalized brief feed lands in milestone M4.
        </p>
        <Link
          href="/shows"
          className="mt-6 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Browse shows to follow
        </Link>
      </div>
    </main>
  );
}
