import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BriefReader } from "@/components/brief-reader";
import { MarkReadOnView } from "@/components/mark-read-on-view";
import { getPublicBrief, getPublishedBriefParams } from "@/lib/data/queries";

// Public, SEO-facing reader. ISR: regenerate at most every 10 minutes.
export const revalidate = 600;
export const dynamicParams = true;

type Params = Promise<{ showSlug: string; episodeSlug: string }>;

export async function generateStaticParams() {
  const params = await getPublishedBriefParams().catch(() => []);
  return params.slice(0, 200).map((p) => ({
    showSlug: p.showSlug,
    episodeSlug: p.episodeSlug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { showSlug, episodeSlug } = await params;
  const brief = await getPublicBrief(showSlug, episodeSlug);
  if (!brief) return { title: "Brief not found" };

  const title = `${brief.episode.title} — ${brief.show.title}`;
  const description =
    brief.tldr ?? `A PodBrief summary of ${brief.episode.title}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ReaderPage({ params }: { params: Params }) {
  const { showSlug, episodeSlug } = await params;
  const brief = await getPublicBrief(showSlug, episodeSlug);
  if (!brief) notFound();

  return (
    <main className="flex-1">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          PodBrief
        </Link>
        <Link
          href="/shows"
          className="text-sm text-neutral-500 hover:text-foreground"
        >
          Browse shows
        </Link>
      </div>
      <BriefReader brief={brief} showSave />
      <MarkReadOnView briefId={brief.id} />
    </main>
  );
}
