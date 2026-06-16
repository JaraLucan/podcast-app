import { createServiceClient } from "@/lib/supabase/service";
import { relativeTime } from "@/lib/utils/format";

import { logTakedown, resolveAndHold, resolveTakedown } from "./actions";

export const metadata = { title: "Takedowns · Admin" };

export default async function AdminTakedowns() {
  const db = createServiceClient();

  const [{ data: requests }, { data: shows }] = await Promise.all([
    db
      .from("takedown_requests")
      .select("id, show_id, email, reason, status, created_at, shows(title)")
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("shows").select("id, title").order("title"),
  ]);

  const input =
    "rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700";

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-1 text-xl font-semibold">Takedown requests</h1>
        <p className="mb-4 text-sm text-neutral-500">
          Log incoming requests from{" "}
          <span className="font-mono">takedown@podbrief.com</span>. Resolving with
          “Hold show” cascade-hides every brief for that show instantly.
        </p>

        <form
          action={logTakedown}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <select name="show_id" className={input} defaultValue="">
            <option value="">— Show (optional) —</option>
            {(shows ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <input name="email" placeholder="Requester email" className={input} />
          <input
            name="reason"
            placeholder="Reason / notes"
            className={`${input} sm:col-span-2`}
          />
          <div className="sm:col-span-2">
            <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
              Log request
            </button>
          </div>
        </form>
      </section>

      <section>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th className="py-2">When</th>
              <th className="py-2">Show</th>
              <th className="py-2">From</th>
              <th className="py-2">Reason</th>
              <th className="py-2">Status</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(requests ?? []).map((r) => {
              const show = r.shows as unknown as { title: string } | null;
              return (
                <tr
                  key={r.id}
                  className="border-b border-neutral-100 align-top dark:border-neutral-900"
                >
                  <td className="py-2 text-neutral-500">
                    {relativeTime(r.created_at)}
                  </td>
                  <td className="py-2">{show?.title ?? "—"}</td>
                  <td className="py-2 text-neutral-500">{r.email ?? "—"}</td>
                  <td className="max-w-xs py-2 text-xs">{r.reason ?? ""}</td>
                  <td className="py-2">
                    <span
                      className={
                        r.status === "open"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    {r.status === "open" && (
                      <>
                        {r.show_id && (
                          <form action={resolveAndHold} className="inline">
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="show_id" value={r.show_id} />
                            <button className="mr-3 text-red-500 hover:underline">
                              Resolve &amp; hold
                            </button>
                          </form>
                        )}
                        <form action={resolveTakedown} className="inline">
                          <input type="hidden" name="id" value={r.id} />
                          <button className="text-neutral-500 hover:underline">
                            Resolve
                          </button>
                        </form>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {(requests ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-neutral-400">
                  No takedown requests logged.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
