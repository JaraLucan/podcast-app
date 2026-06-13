import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/types/database";

/**
 * Refreshes the Supabase auth session on every request and keeps the auth
 * cookies in sync between the request and the response. Called from `proxy.ts`
 * (Next 16's renamed middleware). See the Supabase SSR guide.
 *
 * IMPORTANT: do not run code between creating the client and calling
 * `getClaims()` — it can cause hard-to-debug session bugs.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the token if expired and rewrites the cookies on the response.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gate authenticated-only areas. Public marketing + brief pages stay open.
  const path = request.nextUrl.pathname;
  const protectedPrefixes = ["/feed", "/saved", "/settings", "/onboarding", "/admin"];
  const isProtected = protectedPrefixes.some((p) => path.startsWith(p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
