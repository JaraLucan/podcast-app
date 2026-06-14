import { getLatestBriefs } from "@/lib/data/queries";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 1800;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Public RSS feed of the latest published briefs (distribution + SEO).
export async function GET() {
  const briefs = await getLatestBriefs(50).catch(() => []);

  const items = briefs
    .map((b) => {
      const url = `${BASE}/b/${b.show.slug}/${b.episode.slug}`;
      const pub = b.publishedAt
        ? new Date(b.publishedAt).toUTCString()
        : new Date().toUTCString();
      return `    <item>
      <title>${esc(b.episode.title)} — ${esc(b.show.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pub}</pubDate>
      <description>${esc(b.tldr ?? "")}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>PodBrief — Latest briefs</title>
    <link>${BASE}</link>
    <description>Short written briefs of the top tech &amp; finance podcasts.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
