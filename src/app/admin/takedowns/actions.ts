"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/service";

/** Record an incoming takedown request (from takedown@podbrief.com etc.). */
export async function logTakedown(formData: FormData) {
  await requireAdmin();
  const db = createServiceClient();
  await db.from("takedown_requests").insert({
    show_id: (formData.get("show_id") as string) || null,
    email: (formData.get("email") as string)?.trim() || null,
    reason: (formData.get("reason") as string)?.trim() || null,
    status: "open",
  });
  revalidatePath("/admin/takedowns");
}

/** Resolve a request and put the named show on DMCA hold (cascade-hides briefs). */
export async function resolveAndHold(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const showId = (formData.get("show_id") as string) || null;
  const db = createServiceClient();

  if (showId) {
    await db
      .from("shows")
      .update({ dmca_hold: true, is_active: false })
      .eq("id", showId);
  }
  await db
    .from("takedown_requests")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/takedowns");
  revalidatePath("/admin/shows");
}

/** Resolve without holding (e.g. invalid/duplicate request). */
export async function resolveTakedown(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const db = createServiceClient();
  await db
    .from("takedown_requests")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/takedowns");
}
