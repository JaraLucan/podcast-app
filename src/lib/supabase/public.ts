import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

/**
 * Anon, cookie-less Supabase client for public, cacheable pages (the brief
 * reader). Because it never reads request cookies, pages using it can be
 * statically rendered with ISR. Only sees published, public-read rows (RLS).
 */
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
