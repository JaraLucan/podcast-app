import { cache } from "react";

import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type {
  BriefNumber,
  KeyMoment,
  Show,
  ShowCategory,
} from "@/lib/types/database";

// ── Shapes the UI consumes ──────────────────────────────────────────────────
export type BriefListItem = {
  id: string;
  tldr: string | null;
  takeaways: string[];
  numbers: BriefNumber[];
  keyMoments: KeyMoment[];
  whyItMatters: string | null;
  publishedAt: string | null;
  episode: {
    id: string;
    title: string;
    slug: string | null;
    durationSeconds: number | null;
    youtubeUrl: string | null;
    audioUrl: string | null;
    publishedAt: string | null;
  };
  show: {
    title: string;
    slug: string;
    imageUrl: string | null;
    category: ShowCategory | null;
    websiteUrl: string | null;
    publisher: string | null;
  };
  isRead: boolean;
  isSaved: boolean;
  note?: string | null;
};

const BRIEF_SELECT =
  "id, tldr, takeaways, numbers, key_moments, why_it_matters, published_at, " +
  "episodes!inner(id, title, slug, duration_seconds, youtube_url, audio_url, published_at, show_id, " +
  "shows!inner(title, slug, image_url, category, website_url, publisher))";

type RawBrief = {
  id: string;
  tldr: string | null;
  takeaways: string[] | null;
  numbers: BriefNumber[] | null;
  key_moments: KeyMoment[] | null;
  why_it_matters: string | null;
  published_at: string | null;
  episodes: {
    id: string;
    title: string;
    slug: string | null;
    duration_seconds: number | null;
    youtube_url: string | null;
    audio_url: string | null;
    published_at: string | null;
    show_id: string;
    shows: {
      title: string;
      slug: string;
      image_url: string | null;
      category: ShowCategory | null;
      website_url: string | null;
      publisher: string | null;
    };
  };
};

function mapBrief(
  raw: RawBrief,
  readSet: Set<string>,
  saveSet: Set<string>,
): BriefListItem {
  const ep = raw.episodes;
  return {
    id: raw.id,
    tldr: raw.tldr,
    takeaways: raw.takeaways ?? [],
    numbers: raw.numbers ?? [],
    keyMoments: raw.key_moments ?? [],
    whyItMatters: raw.why_it_matters,
    publishedAt: raw.published_at,
    episode: {
      id: ep.id,
      title: ep.title,
      slug: ep.slug,
      durationSeconds: ep.duration_seconds,
      youtubeUrl: ep.youtube_url,
      audioUrl: ep.audio_url,
      publishedAt: ep.published_at,
    },
    show: {
      title: ep.shows.title,
      slug: ep.shows.slug,
      imageUrl: ep.shows.image_url,
      category: ep.shows.category,
      websiteUrl: ep.shows.website_url,
      publisher: ep.shows.publisher,
    },
    isRead: readSet.has(raw.id),
    isSaved: saveSet.has(raw.id),
  };
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

async function userBriefSets(userId: string) {
  const supabase = await createClient();
  const [{ data: reads }, { data: saves }] = await Promise.all([
    supabase.from("reads").select("brief_id").eq("user_id", userId),
    supabase.from("saves").select("brief_id").eq("user_id", userId),
  ]);
  return {
    readSet: new Set((reads ?? []).map((r) => r.brief_id)),
    saveSet: new Set((saves ?? []).map((s) => s.brief_id)),
  };
}

export type FeedFilter = "all" | "unread" | "saved";

/** Personalized feed: published briefs from followed shows. */
export async function getFeed(
  filter: FeedFilter,
  limit = 30,
  offset = 0,
): Promise<{ items: BriefListItem[]; followsCount: number }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { items: [], followsCount: 0 };

  const { data: follows } = await supabase
    .from("follows")
    .select("show_id")
    .eq("user_id", user.id);
  const showIds = (follows ?? []).map((f) => f.show_id);
  if (showIds.length === 0) return { items: [], followsCount: 0 };

  const { readSet, saveSet } = await userBriefSets(user.id);

  let query = supabase
    .from("briefs")
    .select(BRIEF_SELECT)
    .not("published_at", "is", null)
    .in("episodes.show_id", showIds)
    .order("published_at", { ascending: false });

  if (filter === "saved") {
    const savedIds = [...saveSet];
    if (savedIds.length === 0) return { items: [], followsCount: showIds.length };
    query = query.in("id", savedIds);
  }

  const { data } = await query.range(offset, offset + limit - 1);
  let items = ((data ?? []) as unknown as RawBrief[]).map((r) =>
    mapBrief(r, readSet, saveSet),
  );
  if (filter === "unread") items = items.filter((b) => !b.isRead);

  return { items, followsCount: showIds.length };
}

/** Saved briefs with the user's notes. */
export async function getSaved(): Promise<BriefListItem[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data: saves } = await supabase
    .from("saves")
    .select("brief_id, note")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const ids = (saves ?? []).map((s) => s.brief_id);
  if (ids.length === 0) return [];
  const noteById = new Map((saves ?? []).map((s) => [s.brief_id, s.note]));

  const { data } = await supabase
    .from("briefs")
    .select(BRIEF_SELECT)
    .in("id", ids)
    .not("published_at", "is", null);

  const { readSet, saveSet } = await userBriefSets(user.id);
  return ((data ?? []) as unknown as RawBrief[])
    .map((r) => ({ ...mapBrief(r, readSet, saveSet), note: noteById.get(r.id) }))
    .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}

/** Public reader: one published brief by show + episode slug. */
export async function getBrief(
  showSlug: string,
  episodeSlug: string,
): Promise<BriefListItem | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("briefs")
    .select(BRIEF_SELECT)
    .eq("episodes.slug", episodeSlug)
    .eq("episodes.shows.slug", showSlug)
    .not("published_at", "is", null)
    .maybeSingle();

  if (!data) return null;

  const user = await getCurrentUser();
  const sets = user
    ? await userBriefSets(user.id)
    : { readSet: new Set<string>(), saveSet: new Set<string>() };
  return mapBrief(data as unknown as RawBrief, sets.readSet, sets.saveSet);
}

/** Cookie-less brief fetch for the public ISR reader page. */
export async function getPublicBrief(
  showSlug: string,
  episodeSlug: string,
): Promise<BriefListItem | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("briefs")
    .select(BRIEF_SELECT)
    .eq("episodes.slug", episodeSlug)
    .eq("episodes.shows.slug", showSlug)
    .not("published_at", "is", null)
    .maybeSingle();
  if (!data) return null;
  return mapBrief(data as unknown as RawBrief, new Set(), new Set());
}

/** Latest published briefs across all shows (landing page + RSS feed). */
export async function getLatestBriefs(limit = 6): Promise<BriefListItem[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("briefs")
    .select(BRIEF_SELECT)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as RawBrief[]).map((r) =>
    mapBrief(r, new Set(), new Set()),
  );
}

/** All published brief slug pairs (sitemap + static params). */
export async function getPublishedBriefParams(): Promise<
  { showSlug: string; episodeSlug: string; publishedAt: string | null }[]
> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("briefs")
    .select("published_at, episodes!inner(slug, shows!inner(slug))")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(2000);

  type Row = {
    published_at: string | null;
    episodes: { slug: string | null; shows: { slug: string } };
  };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.episodes.slug)
    .map((r) => ({
      showSlug: r.episodes.shows.slug,
      episodeSlug: r.episodes.slug as string,
      publishedAt: r.published_at,
    }));
}

/** Recent published briefs for a show (show detail page). */
export async function getShowBriefs(
  showId: string,
  limit = 12,
): Promise<BriefListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("briefs")
    .select(BRIEF_SELECT)
    .eq("episodes.show_id", showId)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(limit);

  const user = await getCurrentUser();
  const sets = user
    ? await userBriefSets(user.id)
    : { readSet: new Set<string>(), saveSet: new Set<string>() };
  return ((data ?? []) as unknown as RawBrief[]).map((r) =>
    mapBrief(r, sets.readSet, sets.saveSet),
  );
}

// ── Shows / catalog ─────────────────────────────────────────────────────────
export async function getCatalog(): Promise<Show[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shows")
    .select("*")
    .eq("is_active", true)
    .eq("dmca_hold", false)
    .order("featured", { ascending: false })
    .order("title");
  return data ?? [];
}

export async function getShowBySlug(slug: string): Promise<Show | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shows")
    .select("*")
    .eq("slug", slug)
    .eq("dmca_hold", false)
    .maybeSingle();
  return data;
}

export async function getFollowedShowIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return new Set();
  const { data } = await supabase
    .from("follows")
    .select("show_id")
    .eq("user_id", user.id);
  return new Set((data ?? []).map((f) => f.show_id));
}

export async function getProfile() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return data;
}
