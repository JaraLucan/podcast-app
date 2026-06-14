"use client";

import { useEffect } from "react";

import { markBriefRead } from "@/lib/data/actions";

/** Fire-and-forget: marks a brief read for the signed-in user on open. */
export function MarkReadOnView({ briefId }: { briefId: string }) {
  useEffect(() => {
    markBriefRead(briefId).catch(() => {});
  }, [briefId]);
  return null;
}
