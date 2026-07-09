"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const emailSchema = z.email({ error: "Enter a valid email address." });
const MIN_PASSWORD_LENGTH = 8;

export type MagicLinkState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

export type PasswordState = {
  status: "idle" | "confirm" | "error";
  message?: string;
};

/** Only same-site paths — mirrors the guard in /auth/callback. */
function safeNext(raw: FormDataEntryValue | null): string {
  const next = typeof raw === "string" && raw ? raw : "/feed";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/feed";
}

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

  // Rate-limit: 5 magic-link requests per IP per 15 minutes.
  const h = await headers();
  const limit = checkRateLimit(`magic:${clientIp(h)}`, 5, 15 * 60_000);
  if (!limit.ok) {
    return {
      status: "error",
      message: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} min.`,
    };
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
    message: `We just sent a sign-in link to ${parsed.data}. Click it and you're straight in — no password needed. If it doesn't show up within a minute, check your spam folder. The link expires in 60 minutes.`,
  };
}

/** Email + password sign-in / sign-up. One action for both — the submitting
 *  button's `intent` value picks the branch, so a single form state covers it. */
export async function passwordAuth(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message };
  }
  const password = typeof formData.get("password") === "string"
    ? (formData.get("password") as string)
    : "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      status: "error",
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  // Shared limit for sign-in and sign-up: 10 tries per IP per 15 minutes.
  const h = await headers();
  const limit = checkRateLimit(`pw:${clientIp(h)}`, 10, 15 * 60_000);
  if (!limit.ok) {
    return {
      status: "error",
      message: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} min.`,
    };
  }

  const next = safeNext(formData.get("next"));
  const supabase = await createClient();

  if (formData.get("intent") === "signup") {
    const origin = await getOrigin();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      return { status: "error", message: error.message };
    }
    // Existing account: Supabase returns an obfuscated user with no identities.
    if (data.user && data.user.identities?.length === 0) {
      return {
        status: "error",
        message: "An account with this email already exists. Sign in instead.",
      };
    }
    if (data.session) redirect(next); // email confirmation disabled → straight in
    return {
      status: "confirm",
      message: `Account created. We sent a confirmation link to ${parsed.data} — click it, then sign in with your password.`,
    };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data,
    password,
  });
  if (error) {
    // One generic message — don't reveal whether the email exists.
    return { status: "error", message: "Wrong email or password." };
  }
  redirect(next);
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
