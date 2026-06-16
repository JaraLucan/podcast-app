"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/service";
import type { ShowCategory } from "@/lib/types/database";
import { enqueue } from "@/lib/jobs/queue";
import { slugify } from "@/lib/utils/slug";

const CATEGORIES: ShowCategory[] = [
  "tech",
  "finance",
  "ai",
  "crypto",
  "business",
];

export async function upsertShow(formData: FormData) {
  await requireAdmin();
  const db = createServiceClient();

  const title = (formData.get("title") as string)?.trim();
  if (!title) return;
  const rawCategory = formData.get("category") as string;
  const category = CATEGORIES.includes(rawCategory as ShowCategory)
    ? (rawCategory as ShowCategory)
    : null;

  await db.from("shows").upsert(
    {
      slug: ((formData.get("slug") as string)?.trim() || slugify(title)) ,
      title,
      publisher: (formData.get("publisher") as string)?.trim() || null,
      rss_url: (formData.get("rss_url") as string)?.trim() || null,
      taddy_uuid: (formData.get("taddy_uuid") as string)?.trim() || null,
      category,
      ingest_source: (formData.get("rss_url") as string) ? "rss" : "taddy",
      is_active: true,
    },
    { onConflict: "slug" },
  );
  revalidatePath("/admin/shows");
}

export async function toggleShowActive(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  const db = createServiceClient();
  await db.from("shows").update({ is_active: !active }).eq("id", id);
  revalidatePath("/admin/shows");
}

export async function toggleFeatured(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const featured = formData.get("featured") === "true";
  const db = createServiceClient();
  await db.from("shows").update({ featured: !featured }).eq("id", id);
  revalidatePath("/admin/shows");
}

/** Manually trigger an ingest poll for one show. */
export async function ingestNow(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const db = createServiceClient();
  await enqueue(db, "ingest_show", { show_id: id });
  revalidatePath("/admin/shows");
}

/**
 * DMCA takedown (PRD v2 §3): set the reversible `dmca_hold` flag — this hides
 * every brief for the show in one query (enforced in RLS too) without losing
 * the data — deactivate it, and log the request.
 */
export async function takedownShow(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const reason = (formData.get("reason") as string)?.trim() || "admin takedown";
  const db = createServiceClient();

  await db
    .from("shows")
    .update({ dmca_hold: true, is_active: false })
    .eq("id", id);
  await db
    .from("takedown_requests")
    .insert({ show_id: id, reason, status: "resolved", resolved_at: new Date().toISOString() });
  revalidatePath("/admin/shows");
  revalidatePath("/admin/takedowns");
}

/** Reverse a takedown: clear the hold and reactivate the show. */
export async function restoreShow(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const db = createServiceClient();
  await db
    .from("shows")
    .update({ dmca_hold: false, is_active: true })
    .eq("id", id);
  revalidatePath("/admin/shows");
}
