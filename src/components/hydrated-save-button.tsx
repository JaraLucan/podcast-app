"use client";

import { useEffect, useState } from "react";

import { toggleSave } from "@/lib/data/actions";

const PILL =
  "rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800";

type State = { authed: boolean; saved: boolean };

/** Save button for the public (ISR) reader: hydrates the user's state client-side. */
export function HydratedSaveButton({ briefId }: { briefId: string }) {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    fetch(`/api/brief-state?id=${briefId}`)
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState({ authed: false, saved: false }));
  }, [briefId]);

  if (!state) {
    return (
      <span className={`${PILL} opacity-50`} aria-hidden>
        ☆ Save
      </span>
    );
  }

  if (!state.authed) {
    const next =
      typeof window !== "undefined" ? window.location.pathname : "/";
    return (
      <a href={`/login?next=${encodeURIComponent(next)}`} className={PILL}>
        ☆ Save
      </a>
    );
  }

  return (
    <form action={toggleSave}>
      <input type="hidden" name="brief_id" value={briefId} />
      <input type="hidden" name="saved" value={String(state.saved)} />
      <button className={PILL}>{state.saved ? "★ Saved" : "☆ Save"}</button>
    </form>
  );
}
