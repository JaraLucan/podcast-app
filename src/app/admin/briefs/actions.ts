"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/service";

export async function publishBrief(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const db = createServiceClient();

  const { data: brief } = await db
    .from("briefs")
    .select("episode_id")
    .eq("id", id)
    .single();

  await db
    .from("briefs")
    .update({ published_at: new Date().toISOString() })
    .eq("id", id);

  if (brief) {
    await db
      .from("episodes")
      .update({ status: "published" })
      .eq("id", brief.episode_id);
  }
  revalidatePath("/admin/briefs");
}

export async function holdBrief(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const db = createServiceClient();
  await db.from("briefs").update({ published_at: null }).eq("id", id);
  revalidatePath("/admin/briefs");
}

export async function saveBriefText(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  const tldr = (formData.get("tldr") as string)?.trim();
  const why = (formData.get("why_it_matters") as string)?.trim();
  const db = createServiceClient();
  await db
    .from("briefs")
    .update({ tldr, why_it_matters: why })
    .eq("id", id);
  revalidatePath("/admin/briefs");
}
