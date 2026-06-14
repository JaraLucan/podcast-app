import { NextResponse } from "next/server";

import { enqueueAllActiveShows } from "@/lib/pipeline/ingest";
import { createServiceClient } from "@/lib/supabase/service";

// Vercel Cron hits this every 30 min (see vercel.json). Enqueues an ingest job
// for each active show; the worker then polls each feed and processes new
// episodes. Protected by CRON_SECRET (Vercel sends it as a Bearer token).
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured (local/dev)
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  return auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = createServiceClient();
    const count = await enqueueAllActiveShows(db);
    return NextResponse.json({ ok: true, enqueued_shows: count });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
