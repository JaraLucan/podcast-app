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

/** Manually trigger an ingest poll for one show. */
export async function ingestNow(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const db = createServiceClient();
  await enqueue(db, "ingest_show", { show_id: id });
  revalidatePath("/admin/shows");
}

/** Takedown (PRD §8): deactivate the show and unpublish all its briefs. */
export async function takedownShow(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const db = createServiceClient();

  const { data: eps } = await db
    .from("episodes")
    .select("id")
    .eq("show_id", id);
  const ids = (eps ?? []).map((e) => e.id);

  if (ids.length) {
    await db.from("briefs").update({ published_at: null }).in("episode_id", ids);
  }
  await db.from("shows").update({ is_active: false }).eq("id", id);
  revalidatePath("/admin/shows");
}
