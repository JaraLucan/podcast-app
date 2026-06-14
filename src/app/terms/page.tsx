import Link from "next/link";

export const metadata = {
  title: "Terms & Editorial Policy",
  description: "Terms of use and PodBrief's editorial and copyright posture.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        PodBrief
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        Terms &amp; Editorial Policy
      </h1>
      <p className="mt-2 text-sm text-neutral-400">Last updated: June 2026</p>

      <div className="mt-8 space-y-6 text-neutral-700 dark:text-neutral-300">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            What PodBrief is
          </h2>
          <p className="mt-2 text-sm leading-relaxed">
            PodBrief publishes short, original written summaries of publicly
            available podcast episodes. Briefs are transformative editorial
            works written in our own words. We do not host, rehost, or replay
            podcast audio — every brief links prominently to the original
            episode so you can listen to the full conversation.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            For creators
          </h2>
          <p className="mt-2 text-sm leading-relaxed">
            We treat shows as partners. Briefs quote sparingly (at most one
            short quotation per brief) and are designed to drive listeners to
            your episode. If you&apos;re a creator and would like your show
            removed, email{" "}
            <a href="mailto:takedown@podbrief.app" className="underline">
              takedown@podbrief.app
            </a>{" "}
            and we&apos;ll unpublish all briefs for your show promptly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Your account</h2>
          <p className="mt-2 text-sm leading-relaxed">
            You&apos;re responsible for activity under your account. We may
            suspend accounts that abuse the service. The service is provided
            &quot;as is&quot; without warranties.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Takedowns:{" "}
            <a href="mailto:takedown@podbrief.app" className="underline">
              takedown@podbrief.app
            </a>{" "}
            · General:{" "}
            <a href="mailto:hello@podbrief.app" className="underline">
              hello@podbrief.app
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
