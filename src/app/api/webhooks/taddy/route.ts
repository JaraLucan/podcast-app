import { NextResponse } from "next/server";

import { enqueue } from "@/lib/jobs/queue";
import { createServiceClient } from "@/lib/supabase/service";

// Taddy "new episode" webhook (PRD §5.1). Taddy posts an event referencing a
// podcast series; we map it to a known show by `taddy_uuid` and enqueue an
// ingest job, which re-polls the feed and processes the new episode. Robust to
// payload-shape variation: we just need the series uuid somewhere in the body.
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.TADDY_WEBHOOK_SECRET;
  if (!secret) return true;
  const url = new URL(request.url);
  return (
    request.headers.get("x-taddy-secret") === secret ||
    url.searchParams.get("secret") === secret
  );
}

/** Best-effort dig for a podcast-series uuid in an unknown payload shape. */
function findSeriesUuid(body: unknown): string | null {
  const candidates = [
    "podcastSeriesUuid",
    "taddyUuid",
    "uuid",
    "podcast_uuid",
    "seriesUuid",
  ];
  const visit = (obj: unknown, depth: number): string | null => {
    if (!obj || typeof obj !== "object" || depth > 4) return null;
    for (const [k, v] of Object.entries(obj)) {
      if (candidates.includes(k) && typeof v === "string") return v;
      if (typeof v === "object") {
        const found = visit(v, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  return visit(body, 0);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const seriesUuid = findSeriesUuid(body);
  if (!seriesUuid) {
    // Acknowledge so Taddy doesn't retry; nothing actionable for us.
    return NextResponse.json({ ok: true, matched: false });
  }

  const db = createServiceClient();
  const { data: show } = await db
    .from("shows")
    .select("id, is_active")
    .eq("taddy_uuid", seriesUuid)
    .maybeSingle();

  if (!show || !show.is_active) {
    return NextResponse.json({ ok: true, matched: false });
  }

  await enqueue(db, "ingest_show", { show_id: show.id });
  return NextResponse.json({ ok: true, matched: true });
}
