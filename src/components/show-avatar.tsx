/* eslint-disable @next/next/no-img-element */

export function ShowAvatar({
  title,
  imageUrl,
  size = 40,
}: {
  title: string;
  imageUrl: string | null;
  size?: number;
}) {
  const dim = { width: size, height: size };
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={title}
        style={dim}
        className="shrink-0 rounded-md object-cover"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div
      style={dim}
      className="flex shrink-0 items-center justify-center rounded-md bg-neutral-200 text-sm font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
    >
      {title.slice(0, 1).toUpperCase()}
    </div>
  );
}
