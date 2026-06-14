import { toggleSave } from "@/lib/data/actions";

export function SaveButton({
  briefId,
  saved,
  compact = false,
}: {
  briefId: string;
  saved: boolean;
  compact?: boolean;
}) {
  return (
    <form action={toggleSave}>
      <input type="hidden" name="brief_id" value={briefId} />
      <input type="hidden" name="saved" value={String(saved)} />
      <button
        aria-label={saved ? "Remove from saved" : "Save"}
        className={
          compact
            ? "text-sm text-neutral-400 transition hover:text-foreground"
            : "rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        }
      >
        {saved ? "★ Saved" : "☆ Save"}
      </button>
    </form>
  );
}
