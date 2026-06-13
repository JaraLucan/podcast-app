import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/types/database";

/**
 * Server Supabase client for Server Components, Route Handlers, and Server
 * Actions. `cookies()` is async in Next 16, so this helper is async too.
 *
 * Uses the anon key + the request's auth cookie, so RLS still applies. For
 * privileged backend work (worker, admin), use `createServiceClient` instead.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component where cookies are
            // read-only. The session refresh is handled by proxy.ts, so this
            // is safe to ignore.
          }
        },
      },
    },
  );
}
