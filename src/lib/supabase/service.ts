import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

/**
 * Privileged Supabase client using the service-role key. **Bypasses RLS** —
 * use only on the server for the pipeline worker, admin pages, and scripts.
 * Never import this into a Client Component.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
