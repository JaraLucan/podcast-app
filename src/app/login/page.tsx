import Link from "next/link";

import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in · PodBrief",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/feed", error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          PodBrief
        </Link>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-neutral-500">
            The top tech &amp; finance podcasts, in 3-minute briefs.
          </p>
        </div>

        {error && (
          <p className="w-full rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            Something went wrong signing you in. Please try again.
          </p>
        )}

        <LoginForm next={next} />

        <p className="text-center text-xs text-neutral-400">
          By continuing you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </main>
  );
}
