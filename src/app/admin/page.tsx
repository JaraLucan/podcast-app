import Link from "next/link";

import { createServiceClient } from "@/lib/supabase/service";
import { formatUsd } from "@/lib/utils/format";
import type { EpisodeStatus } from "@/lib/types/database";

async function countEpisodes(
  db: ReturnType<typeof createServiceClient>,
  status: EpisodeStatus,
) {
  const { count } = await db
    .from("episodes")
    .select("*", { count: "exact", head: true })
    .eq("status", status);
  return count ?? 0;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </div>
    </div>
  );
}

export default async function AdminDashboard() {
  const db = createServiceClient();

  const [published, summarizing, failed, discovered] = await Promise.all([
    countEpisodes(db, "published"),
    countEpisodes(db, "summarizing"),
    countEpisodes(db, "failed"),
    countEpisodes(db, "discovered"),
  ]);

  const { count: heldCount } = await db
    .from("briefs")
    .select("*", { count: "exact", head: true })
    .is("published_at", null);

  const { count: failedJobs } = await db
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed");

  const { count: pendingJobs } = await db
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { data: costs } = await db
    .from("daily_costs")
    .select("*")
    .order("day", { ascending: false })
    .limit(7);

  const total7d = (costs ?? []).reduce((s, c) => s + Number(c.total_cost), 0);
  const today = costs?.[0];

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Pipeline
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Published" value={published} />
          <Stat label="In progress" value={summarizing + discovered} />
          <Stat label="Held for review" value={heldCount ?? 0} />
          <Stat label="Failed episodes" value={failed} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Queue &amp; spend
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Pending jobs" value={pendingJobs ?? 0} />
          <Stat label="Failed jobs" value={failedJobs ?? 0} />
          <Stat label="Today's cost" value={formatUsd(Number(today?.total_cost ?? 0))} />
          <Stat label="7-day cost" value={formatUsd(total7d)} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Daily spend (last 7 days)
        </h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th className="py-2">Day</th>
              <th className="py-2">Briefs</th>
              <th className="py-2">Transcription</th>
              <th className="py-2">LLM</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(costs ?? []).map((c) => (
              <tr
                key={c.day}
                className="border-b border-neutral-100 dark:border-neutral-900"
              >
                <td className="py-2">{c.day}</td>
                <td className="py-2 tabular-nums">{c.briefs}</td>
                <td className="py-2 tabular-nums">{formatUsd(Number(c.transcript_cost))}</td>
                <td className="py-2 tabular-nums">{formatUsd(Number(c.brief_cost))}</td>
                <td className="py-2 text-right font-medium tabular-nums">
                  {formatUsd(Number(c.total_cost))}
                </td>
              </tr>
            ))}
            {(costs ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-neutral-400">
                  No spend recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="flex gap-3 text-sm">
        <Link href="/admin/briefs" className="text-neutral-500 hover:text-foreground">
          Review held briefs →
        </Link>
        <Link href="/admin/jobs" className="text-neutral-500 hover:text-foreground">
          Inspect jobs →
        </Link>
      </div>
    </div>
  );
}
