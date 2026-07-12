"use client";

import { useEffect, useState } from "react";

/**
 * Site-wide beta notice. Sets expectations that the free ride is temporary —
 * paid plans (with a free tier) are coming — so early users aren't surprised
 * later. Dismissible; the choice is remembered in localStorage.
 */
export function BetaBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("pb-beta-dismissed") !== "1") setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="w-full border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950 dark:text-amber-200">
      <span>
        <strong>Free public beta.</strong> PodBrief won&apos;t stay free
        forever — paid plans (with a free tier) are coming. Read all you want
        now while it&apos;s open.
      </span>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem("pb-beta-dismissed", "1");
          setVisible(false);
        }}
        className="ml-3 underline underline-offset-2 hover:no-underline"
        aria-label="Dismiss beta notice"
      >
        Got it
      </button>
    </div>
  );
}
