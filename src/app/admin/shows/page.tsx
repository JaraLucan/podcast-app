import { createServiceClient } from "@/lib/supabase/service";

import {
  ingestNow,
  restoreShow,
  takedownShow,
  toggleFeatured,
  toggleShowActive,
  upsertShow,
} from "./actions";

export const metadata = { title: "Shows · Admin" };

const CATEGORIES = ["tech", "finance", "ai", "crypto", "business"] as const;

export default async function AdminShows() {
  const db = createServiceClient();
  const { data: shows } = await db
    .from("shows")
    .select(
      "id, slug, title, publisher, category, rss_url, is_active, taddy_uuid, dmca_hold, featured, ingest_source",
    )
    .order("title");

  const input =
    "rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700";

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-xl font-semibold">Add or update a show</h1>
        <form
          action={upsertShow}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <input name="title" placeholder="Title *" required className={input} />
          <input name="slug" placeholder="slug (optional)" className={input} />
          <input name="publisher" placeholder="Publisher" className={input} />
          <input name="rss_url" placeholder="RSS URL" className={input} />
          <input name="taddy_uuid" placeholder="Taddy UUID" className={input} />
          <select name="category" className={input} defaultValue="tech">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="sm:col-span-2">
            <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
              Save show
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Catalog ({shows?.length ?? 0})
        </h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th className="py-2">Show</th>
              <th className="py-2">Category</th>
              <th className="py-2">Feed</th>
              <th className="py-2">Active</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(shows ?? []).map((s) => (
              <tr
                key={s.id}
                className="border-b border-neutral-100 dark:border-neutral-900"
              >
                <td className="py-2">
                  <div className="flex items-center gap-2 font-medium">
                    {s.title}
                    {s.featured && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        Featured
                      </span>
                    )}
                    {s.dmca_hold && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-700 dark:bg-red-950 dark:text-red-300">
                        DMCA hold
                      </span>
                    )}
                    {s.ingest_source === "blocked" && (
                      <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                        Blocked
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-400">{s.publisher}</div>
                </td>
                <td className="py-2">{s.category ?? "—"}</td>
                <td className="py-2">
                  {s.rss_url ? (
                    <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                  ) : (
                    <span className="text-neutral-400">none</span>
                  )}
                </td>
                <td className="py-2">{s.is_active ? "yes" : "no"}</td>
                <td className="py-2 text-right">
                  <form action={ingestNow} className="inline">
                    <input type="hidden" name="id" value={s.id} />
                    <button className="mr-3 text-blue-600 hover:underline dark:text-blue-400">
                      Poll
                    </button>
                  </form>
                  <form action={toggleFeatured} className="inline">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="featured" value={String(s.featured)} />
                    <button className="mr-3 text-amber-600 hover:underline dark:text-amber-400">
                      {s.featured ? "Unfeature" : "Feature"}
                    </button>
                  </form>
                  <form action={toggleShowActive} className="inline">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="active" value={String(s.is_active)} />
                    <button className="mr-3 text-neutral-500 hover:underline">
                      {s.is_active ? "Pause" : "Activate"}
                    </button>
                  </form>
                  {s.dmca_hold ? (
                    <form action={restoreShow} className="inline">
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-emerald-600 hover:underline dark:text-emerald-400">
                        Restore
                      </button>
                    </form>
                  ) : (
                    <form action={takedownShow} className="inline">
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-red-500 hover:underline">
                        Takedown
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
