"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function followShow(formData: FormData) {
  const showId = formData.get("show_id") as string;
  const { supabase, user } = await requireUser();
  await supabase
    .from("follows")
    .upsert({ user_id: user.id, show_id: showId }, { onConflict: "user_id,show_id" });
  revalidatePath("/shows");
  revalidatePath("/feed");
}

export async function unfollowShow(formData: FormData) {
  const showId = formData.get("show_id") as string;
  const { supabase, user } = await requireUser();
  await supabase
    .from("follows")
    .delete()
    .eq("user_id", user.id)
    .eq("show_id", showId);
  revalidatePath("/shows");
  revalidatePath("/feed");
  revalidatePath("/settings");
}

export async function markRead(formData: FormData) {
  const briefId = formData.get("brief_id") as string;
  const { supabase, user } = await requireUser();
  await supabase
    .from("reads")
    .upsert(
      { user_id: user.id, brief_id: briefId },
      { onConflict: "user_id,brief_id" },
    );
  revalidatePath("/feed");
}

/** Programmatic mark-read (called from the reader on view). */
export async function markBriefRead(briefId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("reads")
    .upsert(
      { user_id: user.id, brief_id: briefId },
      { onConflict: "user_id,brief_id" },
    );
}

export async function markAllRead() {
  const { supabase, user } = await requireUser();
  const { data: follows } = await supabase
    .from("follows")
    .select("show_id")
    .eq("user_id", user.id);
  const showIds = (follows ?? []).map((f) => f.show_id);
  if (showIds.length === 0) return;

  const { data: briefs } = await supabase
    .from("briefs")
    .select("id, episodes!inner(show_id)")
    .not("published_at", "is", null)
    .in("episodes.show_id", showIds);

  const rows = (briefs ?? []).map((b) => ({
    user_id: user.id,
    brief_id: b.id,
  }));
  if (rows.length) {
    await supabase.from("reads").upsert(rows, { onConflict: "user_id,brief_id" });
  }
  revalidatePath("/feed");
}

export async function toggleSave(formData: FormData) {
  const briefId = formData.get("brief_id") as string;
  const saved = formData.get("saved") === "true";
  const { supabase, user } = await requireUser();

  if (saved) {
    await supabase
      .from("saves")
      .delete()
      .eq("user_id", user.id)
      .eq("brief_id", briefId);
  } else {
    await supabase
      .from("saves")
      .upsert(
        { user_id: user.id, brief_id: briefId },
        { onConflict: "user_id,brief_id" },
      );
  }
  revalidatePath("/saved");
}

export async function saveNote(formData: FormData) {
  const briefId = formData.get("brief_id") as string;
  const note = ((formData.get("note") as string) ?? "").trim() || null;
  const { supabase, user } = await requireUser();
  await supabase
    .from("saves")
    .upsert(
      { user_id: user.id, brief_id: briefId, note },
      { onConflict: "user_id,brief_id" },
    );
  revalidatePath("/saved");
}

/** Onboarding: follow the chosen shows and mark the profile onboarded. */
export async function completeOnboarding(formData: FormData) {
  const { supabase, user } = await requireUser();
  const showIds = formData.getAll("show_id") as string[];

  if (showIds.length) {
    const { error: followsError } = await supabase.from("follows").upsert(
      showIds.map((show_id) => ({ user_id: user.id, show_id })),
      { onConflict: "user_id,show_id" },
    );
    if (followsError) console.error("[onboarding] follows upsert failed:", followsError.message);
  }

  // Service client bypasses RLS for the profile flag — safe because requireUser()
  // already verified the session and we're only flipping `onboarded`.
  const admin = createServiceClient();
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ user_id: user.id, onboarded: true }, { onConflict: "user_id" });

  if (profileError) {
    console.error("[onboarding] profile upsert failed:", profileError.message);
    redirect("/onboarding?error=1");
  }

  redirect("/feed");
}

/** GDPR account deletion — cascades all user rows via FK on auth.users. */
export async function deleteAccount() {
  const { supabase, user } = await requireUser();
  const admin = createServiceClient();
  await admin.auth.admin.deleteUser(user.id);
  await supabase.auth.signOut();
  redirect("/");
}
