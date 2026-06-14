import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

/**
 * Privileged Supabase client using the service-role key. **Bypasses RLS** —
 * use only on the server (Route Handlers, admin pages) and in the worker / CLI
 * scripts. Never import this into a Client Component.
 *
 * (No `server-only` guard here on purpose: the worker and CLI run outside the
 * Next bundler via tsx and need this factory too.)
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
    );
  }

  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
