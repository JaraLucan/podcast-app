import { createServiceClient } from "@/lib/supabase/service";
import { relativeTime } from "@/lib/utils/format";

import { deleteJob, retryJob } from "./actions";

export const metadata = { title: "Jobs · Admin" };

const STATUS_STYLES: Record<string, string> = {
  pending: "text-amber-600 dark:text-amber-400",
  running: "text-blue-600 dark:text-blue-400",
  done: "text-emerald-600 dark:text-emerald-400",
  failed: "text-red-600 dark:text-red-400",
};

export default async function AdminJobs() {
  const db = createServiceClient();
  const { data: jobs } = await db
    .from("jobs")
    .select("*")
    .order("id", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Jobs</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="py-2">#</th>
            <th className="py-2">Type</th>
            <th className="py-2">Status</th>
            <th className="py-2">Tries</th>
            <th className="py-2">Updated</th>
            <th className="py-2">Error</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {(jobs ?? []).map((j) => (
            <tr
              key={j.id}
              className="border-b border-neutral-100 align-top dark:border-neutral-900"
            >
              <td className="py-2 tabular-nums text-neutral-400">{j.id}</td>
              <td className="py-2 font-medium">{j.type}</td>
              <td className={`py-2 ${STATUS_STYLES[j.status] ?? ""}`}>
                {j.status}
              </td>
              <td className="py-2 tabular-nums">{j.attempts}</td>
              <td className="py-2 text-neutral-500">{relativeTime(j.updated_at)}</td>
              <td className="max-w-xs py-2 text-xs text-red-500">
                {j.error ? j.error.slice(0, 140) : ""}
              </td>
              <td className="py-2 text-right">
                {(j.status === "failed" || j.status === "running") && (
                  <form action={retryJob} className="inline">
                    <input type="hidden" name="id" value={j.id} />
                    <button className="mr-3 text-blue-600 hover:underline dark:text-blue-400">
                      Retry
                    </button>
                  </form>
                )}
                {j.status !== "running" && (
                  <form action={deleteJob} className="inline">
                    <input type="hidden" name="id" value={j.id} />
                    <button className="text-neutral-400 hover:text-red-500">
                      Delete
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {(jobs ?? []).length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-neutral-400">
                No jobs yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
