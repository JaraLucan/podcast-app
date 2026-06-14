import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { BriefCard } from "@/components/brief-card";
import { saveNote } from "@/lib/data/actions";
import { getCurrentUser, getSaved } from "@/lib/data/queries";

export const metadata = { title: "Saved" };

export default async function SavedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/saved");

  const saved = await getSaved();

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-6">
        <h1 className="mb-5 text-2xl font-semibold tracking-tight">Saved</h1>

        {saved.length === 0 ? (
          <div className="mt-16 rounded-xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
            <h2 className="text-lg font-semibold">Nothing saved yet</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Tap Save on any brief to keep it here with an optional note.
            </p>
            <Link
              href="/feed"
              className="mt-6 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              Go to your feed
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {saved.map((b) => (
              <div key={b.id}>
                <BriefCard brief={b} />
                <form action={saveNote} className="mt-2 flex gap-2">
                  <input type="hidden" name="brief_id" value={b.id} />
                  <input
                    name="note"
                    defaultValue={b.note ?? ""}
                    placeholder="Add a private note…"
                    className="flex-1 rounded-lg border border-neutral-200 bg-transparent px-3 py-1.5 text-sm dark:border-neutral-800"
                  />
                  <button className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 hover:text-foreground dark:border-neutral-700">
                    Save note
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
