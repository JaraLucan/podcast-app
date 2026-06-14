import { createServiceClient } from "@/lib/supabase/service";
import type { QualityFlags } from "@/lib/types/database";

import { publishBrief, saveBriefText } from "./actions";

export const metadata = { title: "Held briefs · Admin" };

export default async function AdminBriefs() {
  const db = createServiceClient();
  const { data: briefs } = await db
    .from("briefs")
    .select(
      "id, tldr, why_it_matters, takeaways, quality_flags, episodes!inner(title, shows!inner(title))",
    )
    .is("published_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Held briefs</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Briefs that failed automatic validation, awaiting review. Edit and
        publish, or leave held.
      </p>

      <div className="space-y-6">
        {(briefs ?? []).map((b) => {
          const ep = b.episodes as unknown as {
            title: string;
            shows: { title: string };
          };
          const flags = b.quality_flags as QualityFlags | null;
          return (
            <div
              key={b.id}
              className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
            >
              <div className="mb-1 text-xs uppercase tracking-wide text-neutral-400">
                {ep?.shows?.title}
              </div>
              <div className="mb-3 font-medium">{ep?.title}</div>

              {flags?.issues && flags.issues.length > 0 && (
                <ul className="mb-4 space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  {flags.issues.map((i, idx) => (
                    <li key={idx}>⚠ {i}</li>
                  ))}
                </ul>
              )}

              <form action={saveBriefText} className="space-y-3">
                <input type="hidden" name="id" value={b.id} />
                <label className="block text-xs font-medium text-neutral-500">
                  TL;DR
                  <textarea
                    name="tldr"
                    defaultValue={b.tldr ?? ""}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent p-2 text-sm dark:border-neutral-700"
                  />
                </label>
                <label className="block text-xs font-medium text-neutral-500">
                  Why it matters
                  <textarea
                    name="why_it_matters"
                    defaultValue={b.why_it_matters ?? ""}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-transparent p-2 text-sm dark:border-neutral-700"
                  />
                </label>
                <button className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
                  Save edits
                </button>
              </form>

              <div className="mt-3 flex gap-2">
                <form action={publishBrief}>
                  <input type="hidden" name="id" value={b.id} />
                  <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
                    Publish
                  </button>
                </form>
              </div>
            </div>
          );
        })}
        {(briefs ?? []).length === 0 && (
          <p className="py-10 text-center text-neutral-400">
            Nothing held for review. 🎉
          </p>
        )}
      </div>
    </div>
  );
}
