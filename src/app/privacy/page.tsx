import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
  description: "How PodBrief handles your data.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        PodBrief
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-neutral-400">Last updated: June 2026</p>

      <div className="prose-podbrief mt-8 space-y-6 text-neutral-700 dark:text-neutral-300">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            What we collect
          </h2>
          <p className="mt-2 text-sm leading-relaxed">
            To run your account we store your email address, the shows you
            follow, which briefs you&apos;ve read, and any briefs and notes you
            save. That&apos;s it. We do not sell your data or share it with
            advertisers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
          <p className="mt-2 text-sm leading-relaxed">
            If analytics are enabled, we use a privacy-friendly, cookieless
            analytics tool that does not track you across sites or build a
            personal profile.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Your rights
          </h2>
          <p className="mt-2 text-sm leading-relaxed">
            You can delete your account at any time from{" "}
            <Link href="/settings" className="underline">
              Settings
            </Link>
            . Deleting your account permanently removes your profile, follows,
            reads, and saves.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Questions about your data? Email{" "}
            <a href="mailto:privacy@podbrief.com" className="underline">
              privacy@podbrief.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
