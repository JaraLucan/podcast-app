"use client";

import { useActionState } from "react";

import {
  signInWithGoogle,
  signInWithMagicLink,
  type MagicLinkState,
} from "./actions";

const initialState: MagicLinkState = { status: "idle" };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(
    signInWithMagicLink,
    initialState,
  );

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          Continue with Google
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        or
        <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      </div>

      {state.status === "sent" ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {state.message}
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="email" className="sr-only">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="rounded-lg border border-neutral-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100"
          />
          {state.status === "error" && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {state.message}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {pending ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
      )}
    </div>
  );
}
