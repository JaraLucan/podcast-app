import Link from "next/link";

import type { BriefListItem } from "@/lib/data/queries";
import {
  listenMinutes,
  readMinutes,
  relativeTime,
  takeawayText,
} from "@/lib/utils/format";

import { SaveButton } from "./save-button";
import { ShowAvatar } from "./show-avatar";

export function BriefCard({ brief }: { brief: BriefListItem }) {
  const href = `/b/${brief.show.slug}/${brief.episode.slug}`;
  const read = readMinutes(
    [brief.tldr, ...brief.takeaways.map(takeawayText), brief.whyItMatters]
      .filter(Boolean)
      .join(" "),
  );
  const listen = listenMinutes(brief.episode.durationSeconds);

  return (
    <article className="group relative rounded-xl border border-neutral-200 p-5 transition hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700">
      <div className="flex items-center gap-3">
        <ShowAvatar
          title={brief.show.title}
          imageUrl={brief.show.imageUrl}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{brief.show.title}</div>
          <div className="text-xs text-neutral-400">
            {relativeTime(brief.publishedAt)}
          </div>
        </div>
        {!brief.isRead && (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-blue-500"
            aria-label="Unread"
          />
        )}
      </div>

      <Link href={href} className="mt-3 block">
        <h2 className="text-lg font-semibold leading-snug tracking-tight group-hover:underline">
          {brief.episode.title}
        </h2>
        {brief.tldr && (
          <p className="mt-2 line-clamp-3 text-sm text-neutral-600 dark:text-neutral-300">
            {brief.tldr}
          </p>
        )}
      </Link>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-500">
          {read} min read
          {listen ? (
            <span className="text-neutral-400"> · vs {listen} min listen</span>
          ) : null}
        </span>
        <SaveButton briefId={brief.id} saved={brief.isSaved} compact />
      </div>
    </article>
  );
}
