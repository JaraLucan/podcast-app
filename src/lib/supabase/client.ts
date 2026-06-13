import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/types/database";

/**
 * Browser Supabase client. Safe to call in Client Components — it only ever
 * sees the public anon key and the user's own session cookie (RLS enforced).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
