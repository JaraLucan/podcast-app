import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { enqueueAllActiveShows } from "@/lib/pipeline/ingest";
import { reportError } from "@/lib/observability";
import { createServiceClient } from "@/lib/supabase/service";

// Vercel Cron hits this every 30 min (see vercel.json). Enqueues an ingest job
// for each active show; the worker then polls each feed and processes new
// episodes. Protected by CRON_SECRET (Vercel sends it as a Bearer token).
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed — never run unauthenticated
  const auth = request.headers.get("authorization") ?? "";
  return safeEqual(auth, `Bearer ${secret}`);
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
    await reportError(err, { route: "cron/poll-feeds" });
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
