import { followShow, unfollowShow } from "@/lib/data/actions";

export function FollowButton({
  showId,
  following,
}: {
  showId: string;
  following: boolean;
}) {
  return (
    <form action={following ? unfollowShow : followShow}>
      <input type="hidden" name="show_id" value={showId} />
      <button
        className={
          following
            ? "rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-600 transition hover:border-red-300 hover:text-red-600 dark:border-neutral-700 dark:text-neutral-300"
            : "rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        }
      >
        {following ? "Following" : "Follow"}
      </button>
    </form>
  );
}
