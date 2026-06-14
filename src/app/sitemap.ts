import type { MetadataRoute } from "next";

import { getPublishedBriefParams } from "@/lib/data/queries";
import { createPublicClient } from "@/lib/supabase/public";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient();

  const [{ data: shows }, briefs] = await Promise.all([
    supabase.from("shows").select("slug, updated_at").eq("is_active", true),
    getPublishedBriefParams().catch(() => []),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/shows`, changeFrequency: "weekly", priority: 0.8 },
  ];

  const showRoutes: MetadataRoute.Sitemap = (shows ?? []).map((s) => ({
    url: `${BASE}/shows/${s.slug}`,
    lastModified: s.updated_at ?? undefined,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const briefRoutes: MetadataRoute.Sitemap = briefs.map((b) => ({
    url: `${BASE}/b/${b.showSlug}/${b.episodeSlug}`,
    lastModified: b.publishedAt ?? undefined,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...showRoutes, ...briefRoutes];
}
