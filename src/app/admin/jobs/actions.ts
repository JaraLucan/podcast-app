"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/service";

export async function retryJob(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const db = createServiceClient();
  await db
    .from("jobs")
    .update({
      status: "pending",
      attempts: 0,
      run_after: new Date().toISOString(),
      locked_at: null,
      error: null,
    })
    .eq("id", id);
  revalidatePath("/admin/jobs");
}

export async function deleteJob(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const db = createServiceClient();
  await db.from("jobs").delete().eq("id", id);
  revalidatePath("/admin/jobs");
}
