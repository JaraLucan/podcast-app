import { NextResponse } from "next/server";

import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

// Lightweight liveness/readiness probe for uptime monitoring.
export async function GET() {
  let db = false;
  try {
    const supabase = createPublicClient();
    const { error } = await supabase
      .from("shows")
      .select("id", { count: "exact", head: true });
    db = !error;
  } catch {
    db = false;
  }

  return NextResponse.json(
    { ok: db, db, time: new Date().toISOString() },
    { status: db ? 200 : 503 },
  );
}
