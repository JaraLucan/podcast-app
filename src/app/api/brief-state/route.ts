import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Per-user save state for a brief — lets the static (ISR) reader page hydrate
// the correct Save button state for signed-in users without going dynamic.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ authed: false, saved: false });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ authed: false, saved: false });

  const { data } = await supabase
    .from("saves")
    .select("brief_id")
    .eq("user_id", user.id)
    .eq("brief_id", id)
    .maybeSingle();

  return NextResponse.json({ authed: true, saved: Boolean(data) });
}
