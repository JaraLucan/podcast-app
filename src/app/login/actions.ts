"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const emailSchema = z.email({ error: "Enter a valid email address." });

export type MagicLinkState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

async function getOrigin() {
  const h = await headers();
  return (
    h.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  );
}

/** Email magic-link sign-in (PRD §3: Supabase Auth, email magic link). */
export async function signInWithMagicLink(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }

  const next = (formData.get("next") as string) || "/feed";
  const origin = await getOrigin();
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return {
    status: "sent",
    message: `Check ${parsed.data} for your sign-in link.`,
  };
}

/** Google OAuth sign-in (PRD §3: Supabase Auth, Google OAuth). */
export async function signInWithGoogle(formData: FormData) {
  const next = (formData.get("next") as string) || "/feed";
  const origin = await getOrigin();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth");
  }

  redirect(data.url);
}
