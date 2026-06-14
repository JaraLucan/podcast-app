export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-3 w-32 rounded bg-neutral-200 dark:bg-neutral-800" />
            </div>
            <div className="mt-4 h-5 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="mt-3 h-3 w-full rounded bg-neutral-100 dark:bg-neutral-900" />
            <div className="mt-2 h-3 w-5/6 rounded bg-neutral-100 dark:bg-neutral-900" />
          </div>
        ))}
      </div>
    </div>
  );
}
