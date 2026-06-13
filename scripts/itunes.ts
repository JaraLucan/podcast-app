/** Resolve a podcast's real RSS feed + artwork via the free iTunes Search API. */

export type ItunesResult = {
  collectionName?: string;
  artistName?: string;
  feedUrl?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  collectionViewUrl?: string;
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function resolveFeed(search: string): Promise<ItunesResult | null> {
  const url = `https://itunes.apple.com/search?media=podcast&entity=podcast&limit=1&term=${encodeURIComponent(
    search,
  )}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PodBrief-Seeder/1.0" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: ItunesResult[] };
    return json.results?.[0] ?? null;
  } catch {
    return null;
  }
}
