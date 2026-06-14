import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <div className="text-5xl font-semibold tracking-tight">404</div>
      <p className="mt-3 text-sm text-neutral-500">
        We couldn&apos;t find that page. It may have moved or never existed.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        Back home
      </Link>
    </main>
  );
}
