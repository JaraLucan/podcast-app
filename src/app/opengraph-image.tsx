import { ImageResponse } from "next/og";

export const alt =
  "PodBrief — the world's top tech & finance podcasts, in 3-minute briefs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 28,
          background: "#0a0a0a",
          color: "#fafafa",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, color: "#a3a3a3" }}>
          PodBrief
        </div>
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>
          The world&apos;s top tech &amp; finance podcasts, in 3-minute briefs.
        </div>
        <div style={{ fontSize: 30, color: "#d4d4d4" }}>
          Read in minutes. Listen when it&apos;s worth it.
        </div>
      </div>
    ),
    { ...size },
  );
}
