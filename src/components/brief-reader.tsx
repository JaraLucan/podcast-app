import Link from "next/link";

import type { BriefListItem } from "@/lib/data/queries";
import {
  formatDate,
  formatTimestamp,
  listenMinutes,
  readMinutes,
  youtubeTimestampUrl,
} from "@/lib/utils/format";

import { SaveButton } from "./save-button";
import { ShareButton } from "./share-button";
import { ShowAvatar } from "./show-avatar";

function Timestamp({
  seconds,
  youtubeUrl,
}: {
  seconds: number;
  youtubeUrl: string | null;
}) {
  const url = youtubeTimestampUrl(youtubeUrl, seconds);
  const label = `[${formatTimestamp(seconds)}]`;
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        {label}
      </a>
    );
  }
  return <span className="font-mono text-sm text-neutral-400">{label}</span>;
}

export function BriefReader({
  brief,
  showSave,
}: {
  brief: BriefListItem;
  showSave: boolean;
}) {
  const listenUrl =
    brief.episode.youtubeUrl ??
    brief.show.websiteUrl ??
    brief.episode.audioUrl ??
    null;
  const read = readMinutes(
    [brief.tldr, ...brief.takeaways, brief.whyItMatters]
      .filter(Boolean)
      .join(" "),
  );
  const listen = listenMinutes(brief.episode.durationSeconds);

  return (
    <article className="mx-auto w-full max-w-2xl px-6 py-8">
      {/* Meta header */}
      <div className="flex items-center gap-3">
        <ShowAvatar
          title={brief.show.title}
          imageUrl={brief.show.imageUrl}
          size={44}
        />
        <div>
          <Link
            href={`/shows/${brief.show.slug}`}
            className="text-sm font-medium hover:underline"
          >
            {brief.show.title}
          </Link>
          <div className="text-xs text-neutral-400">
            {formatDate(brief.episode.publishedAt)}
            {listen ? ` · ${listen} min listen` : ""} · {read} min read
          </div>
        </div>
      </div>

      <h1 className="mt-5 text-pretty text-3xl font-semibold leading-tight tracking-tight">
        {brief.episode.title}
      </h1>

      {/* Listen CTA + actions */}
      <div className="sticky top-0 z-10 -mx-6 mt-5 flex items-center gap-2 border-b border-neutral-200 bg-background/90 px-6 py-3 backdrop-blur dark:border-neutral-800">
        {listenUrl && (
          <a
            href={listenUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            ▶ Listen to the full episode
          </a>
        )}
        {showSave && <SaveButton briefId={brief.id} saved={brief.isSaved} />}
        <ShareButton title={brief.episode.title} />
      </div>

      {/* TL;DR */}
      {brief.tldr && (
        <p className="mt-8 text-lg leading-relaxed text-neutral-800 dark:text-neutral-200">
          {brief.tldr}
        </p>
      )}

      {/* Takeaways */}
      {brief.takeaways.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Key takeaways
          </h2>
          <ul className="mt-3 space-y-3">
            {brief.takeaways.map((t, i) => (
              <li key={i} className="flex gap-3 leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Key moments */}
      {brief.keyMoments.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Key moments
          </h2>
          <ul className="mt-3 space-y-2">
            {brief.keyMoments.map((m, i) => (
              <li key={i} className="flex gap-3 leading-relaxed">
                <Timestamp
                  seconds={m.ts_seconds}
                  youtubeUrl={brief.episode.youtubeUrl}
                />
                <span>{m.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Numbers & predictions */}
      {brief.numbers.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Notable numbers &amp; predictions
          </h2>
          <dl className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-900">
            {brief.numbers.map((n, i) => (
              <div key={i} className="flex items-baseline gap-3 py-2">
                <dt className="font-semibold tabular-nums">{n.value}</dt>
                <dd className="text-sm text-neutral-600 dark:text-neutral-300">
                  {n.label}
                  {n.context ? ` — ${n.context}` : ""}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Why it matters */}
      {brief.whyItMatters && (
        <section className="mt-8 rounded-xl bg-neutral-50 p-5 dark:bg-neutral-900">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Why it matters
          </h2>
          <p className="mt-2 leading-relaxed text-neutral-800 dark:text-neutral-200">
            {brief.whyItMatters}
          </p>
        </section>
      )}

      {/* Creator-relations footer */}
      {listenUrl && (
        <div className="mt-10 border-t border-neutral-200 pt-6 text-center dark:border-neutral-800">
          <a
            href={listenUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-neutral-600 hover:text-foreground"
          >
            Listen to the full conversation on {brief.show.title} →
          </a>
        </div>
      )}
    </article>
  );
}
