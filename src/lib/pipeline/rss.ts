import { XMLParser } from "fast-xml-parser";

import { assertPublicHttpUrl } from "./net";

export type ParsedEpisode = {
  guid: string;
  title: string;
  description: string | null;
  audioUrl: string | null;
  publishedAt: string | null; // ISO
  durationSeconds: number | null;
  link: string | null;
};

export type ParsedFeed = {
  showTitle: string | null;
  showImage: string | null;
  episodes: ParsedEpisode[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
});

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function text(node: unknown): string | null {
  if (node == null) return null;
  if (typeof node === "string") return node.trim() || null;
  if (typeof node === "object" && "#text" in node) {
    const t = (node as { "#text": unknown })["#text"];
    return typeof t === "string" ? t.trim() || null : null;
  }
  return null;
}

/** "1:02:03" | "62:03" | "3723" -> seconds */
export function parseDuration(raw: unknown): number | null {
  const s = text(raw);
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const parts = s.split(":").map((p) => parseInt(p, 10));
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function parseDate(raw: unknown): string | null {
  const s = text(raw);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseFeed(xml: string): ParsedFeed {
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel ?? doc?.channel ?? {};

  const showImage =
    channel?.["itunes:image"]?.["@_href"] ?? text(channel?.image?.url) ?? null;

  const episodes: ParsedEpisode[] = asArray(channel?.item).map((item) => {
    const guidNode = item?.guid;
    const guid =
      text(guidNode) ?? text(item?.link) ?? text(item?.title) ?? crypto.randomUUID();

    const enclosure = item?.enclosure;
    const audioUrl =
      (Array.isArray(enclosure) ? enclosure[0] : enclosure)?.["@_url"] ?? null;

    return {
      guid,
      title: text(item?.title) ?? "Untitled episode",
      description: text(item?.description) ?? text(item?.["itunes:summary"]),
      audioUrl,
      publishedAt: parseDate(item?.pubDate),
      durationSeconds: parseDuration(item?.["itunes:duration"]),
      link: text(item?.link),
    };
  });

  return {
    showTitle: text(channel?.title),
    showImage,
    episodes,
  };
}

// Substack (and some CDNs) 403 requests that look like bots coming from
// datacenter IPs (our GitHub Actions runners). A browser-like UA gets through.
const FEED_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "application/rss+xml, application/xml, text/xml, */*",
};

export async function fetchFeed(url: string): Promise<ParsedFeed> {
  assertPublicHttpUrl(url); // SSRF guard
  const res = await fetch(url, { headers: FEED_HEADERS });
  if (!res.ok) {
    throw new Error(`Feed fetch failed (${res.status}) for ${url}`);
  }
  return parseFeed(await res.text());
}

const SKIP_PATTERNS = [
  /\brebroadcast\b/i,
  /\bbest of\b/i,
  /\bencore\b/i,
  /\bre-?air\b/i,
  /\btrailer\b/i,
  /\bpreview\b/i,
];

/** PRD §5.1 skip rules: too short, or rebroadcast/best-of/trailer by title. */
export function shouldSkipEpisode(
  ep: ParsedEpisode,
  minMinutes: number,
): { skip: boolean; reason?: string } {
  if (!ep.audioUrl) {
    return { skip: true, reason: "no audio enclosure" };
  }
  if (ep.durationSeconds != null && ep.durationSeconds < minMinutes * 60) {
    return { skip: true, reason: `under ${minMinutes} min` };
  }
  const matched = SKIP_PATTERNS.find((re) => re.test(ep.title));
  if (matched) return { skip: true, reason: `title matched ${matched}` };
  return { skip: false };
}
