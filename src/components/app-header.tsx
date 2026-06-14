import Link from "next/link";

import { isAdmin } from "@/lib/auth/admin";

const LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/shows", label: "Catalog" },
  { href: "/saved", label: "Saved" },
];

export async function AppHeader() {
  const admin = await isAdmin();

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-background/80 backdrop-blur dark:border-neutral-800">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
        <Link href="/feed" className="font-semibold tracking-tight">
          PodBrief
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-neutral-500 transition hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          {admin && (
            <Link href="/admin" className="text-neutral-500 hover:text-foreground">
              Admin
            </Link>
          )}
          <Link
            href="/settings"
            className="text-neutral-500 transition hover:text-foreground"
          >
            Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}
