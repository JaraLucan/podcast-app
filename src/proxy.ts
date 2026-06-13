import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

// Next 16 renamed Middleware to Proxy. This refreshes the Supabase session on
// every matched request and redirects unauthenticated users away from the
// app's private areas.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image optimization
     * files. Auth pages are intentionally included so the session refreshes.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
