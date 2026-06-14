import { ImageResponse } from "next/og";

import { getPublicBrief } from "@/lib/data/queries";

export const alt = "PodBrief";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({
  params,
}: {
  params: { showSlug: string; episodeSlug: string };
}) {
  const { showSlug, episodeSlug } = params;
  const brief = await getPublicBrief(showSlug, episodeSlug).catch(() => null);

  const showTitle = brief?.show.title ?? "PodBrief";
  const episodeTitle =
    brief?.episode.title ?? "The top tech & finance podcasts, in 3-minute briefs";
  const tldr = brief?.tldr ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0a",
          color: "#fafafa",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 30, color: "#a3a3a3", fontWeight: 600 }}>
          {showTitle}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1 }}>
            {episodeTitle.slice(0, 120)}
          </div>
          {tldr && (
            <div style={{ fontSize: 28, color: "#d4d4d4", lineHeight: 1.4 }}>
              {tldr.slice(0, 160)}
            </div>
          )}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#fafafa" }}>
          PodBrief · {brief ? "3-min read" : "podbrief"}
        </div>
      </div>
    ),
    { ...size },
  );
}
