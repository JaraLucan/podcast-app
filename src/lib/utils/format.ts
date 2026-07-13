/** Shared display formatters used across the product and admin UIs. */

/** Seconds -> "1:02:03" or "2:03". */
export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Seconds -> "92 min" listen estimate. */
export function listenMinutes(durationSeconds: number | null): number | null {
  if (!durationSeconds) return null;
  return Math.max(1, Math.round(durationSeconds / 60));
}

/** Estimated read time from a brief's prose (≈220 wpm). */
export function readMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Flatten a takeaway to plain text — handles both the rich {insight,
 *  explanation} card shape and legacy plain-string takeaways from briefs
 *  generated before the card format existed. */
export function takeawayText(
  t: string | { insight: string; explanation: string },
): string {
  return typeof t === "string" ? t : `${t.insight} ${t.explanation}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "3h ago", "2d ago", or a date for older items. */
export function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

export function formatUsd(n: number | null | undefined): string {
  return `$${(n ?? 0).toFixed(2)}`;
}

/** YouTube deep-link to a timestamp, or null if not a YouTube url. */
export function youtubeTimestampUrl(
  youtubeUrl: string | null,
  seconds: number,
): string | null {
  if (!youtubeUrl || !/(?:youtube\.com|youtu\.be)/i.test(youtubeUrl)) {
    return null;
  }
  const sep = youtubeUrl.includes("?") ? "&" : "?";
  return `${youtubeUrl}${sep}t=${Math.floor(seconds)}s`;
}
