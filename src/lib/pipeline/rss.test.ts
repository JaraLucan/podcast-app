import { describe, expect, it } from "vitest";

import { parseDuration, parseFeed, shouldSkipEpisode } from "./rss";

describe("parseDuration", () => {
  it("parses HH:MM:SS", () => {
    expect(parseDuration("1:02:03")).toBe(3723);
  });
  it("parses MM:SS", () => {
    expect(parseDuration("62:03")).toBe(3723);
  });
  it("parses bare seconds", () => {
    expect(parseDuration("3723")).toBe(3723);
  });
  it("returns null for garbage", () => {
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration(undefined)).toBeNull();
  });
});

describe("shouldSkipEpisode", () => {
  const base = {
    guid: "g",
    title: "A normal long episode",
    description: null,
    audioUrl: "http://x/a.mp3",
    publishedAt: null,
    link: null,
  };

  it("skips episodes under the minute threshold", () => {
    const r = shouldSkipEpisode({ ...base, durationSeconds: 300 }, 10);
    expect(r.skip).toBe(true);
  });

  it("skips rebroadcasts by title", () => {
    const r = shouldSkipEpisode(
      { ...base, title: "Best of 2024: Highlights", durationSeconds: 3600 },
      10,
    );
    expect(r.skip).toBe(true);
  });

  it("keeps normal long episodes", () => {
    const r = shouldSkipEpisode({ ...base, durationSeconds: 3600 }, 10);
    expect(r.skip).toBe(false);
  });
});

describe("parseFeed", () => {
  const xml = `<?xml version="1.0"?>
  <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
    <channel>
      <title>Test Show</title>
      <itunes:image href="https://img/show.jpg"/>
      <item>
        <title>Episode One</title>
        <guid isPermaLink="false">ep-1</guid>
        <description>First episode</description>
        <enclosure url="https://cdn/ep1.mp3" type="audio/mpeg" length="123"/>
        <pubDate>Tue, 10 Jun 2025 10:00:00 GMT</pubDate>
        <itunes:duration>1:30:00</itunes:duration>
      </item>
    </channel>
  </rss>`;

  it("extracts show and episode fields", () => {
    const feed = parseFeed(xml);
    expect(feed.showTitle).toBe("Test Show");
    expect(feed.showImage).toBe("https://img/show.jpg");
    expect(feed.episodes).toHaveLength(1);
    const ep = feed.episodes[0];
    expect(ep.guid).toBe("ep-1");
    expect(ep.title).toBe("Episode One");
    expect(ep.audioUrl).toBe("https://cdn/ep1.mp3");
    expect(ep.durationSeconds).toBe(5400);
    expect(ep.publishedAt).not.toBeNull();
  });
});
