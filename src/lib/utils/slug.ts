import { createHash } from "node:crypto";

/** URL-safe slug from arbitrary text. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/g, "");
}

/** Stable episode slug: title slug + short hash of the guid (unique per show). */
export function episodeSlug(title: string, guid: string): string {
  const base = slugify(title) || "episode";
  const hash = createHash("sha1").update(guid).digest("hex").slice(0, 6);
  return `${base}-${hash}`;
}
