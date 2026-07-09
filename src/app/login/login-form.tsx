"use client";

import { useActionState, useState } from "react";

import {
  passwordAuth,
  signInWithGoogle,
  signInWithMagicLink,
  type MagicLinkState,
  type PasswordState,
} from "./actions";

const initialMagicState: MagicLinkState = { status: "idle" };
const initialPasswordState: PasswordState = { status: "idle" };

const inputClass =
  "rounded-lg border border-neutral-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100";

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [magicState, magicAction, magicPending] = useActionState(
    signInWithMagicLink,
    initialMagicState,
  );
  const [pwState, pwAction, pwPending] = useActionState(
    passwordAuth,
    initialPasswordState,
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

      {mode === "magic" ? (
        magicState.status === "sent" ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-800 dark:bg-emerald-950">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              Your sign-in link is on its way
            </p>
            <p className="mt-1.5 text-sm text-emerald-700 dark:text-emerald-300">
              {magicState.message}
            </p>
            <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">
              Wrong address?{" "}
              <a href="/login" className="underline underline-offset-2">
                Try a different email
              </a>
            </p>
          </div>
        ) : (
          <form action={magicAction} className="flex flex-col gap-3">
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
              className={inputClass}
            />
            {magicState.status === "error" && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {magicState.message}
              </p>
            )}
            <button
              type="submit"
              disabled={magicPending}
              className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {magicPending ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>
        )
      ) : pwState.status === "confirm" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-800 dark:bg-emerald-950">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            Confirm your email
          </p>
          <p className="mt-1.5 text-sm text-emerald-700 dark:text-emerald-300">
            {pwState.message}
          </p>
        </div>
      ) : (
        <form action={pwAction} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="pw-email" className="sr-only">
            Email address
          </label>
          <input
            id="pw-email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className={inputClass}
          />
          <label htmlFor="pw-password" className="sr-only">
            Password
          </label>
          <input
            id="pw-password"
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Password (min. 8 characters)"
            autoComplete="current-password"
            className={inputClass}
          />
          {pwState.status === "error" && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {pwState.message}
            </p>
          )}
          <button
            type="submit"
            name="intent"
            value="signin"
            disabled={pwPending}
            className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {pwPending ? "Working…" : "Sign in"}
          </button>
          <button
            type="submit"
            name="intent"
            value="signup"
            disabled={pwPending}
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Create an account
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={() => setMode(mode === "magic" ? "password" : "magic")}
        className="text-center text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        {mode === "magic"
          ? "Prefer a password? Sign in or create an account"
          : "No password needed — use a magic link instead"}
      </button>
    </div>
  );
}
