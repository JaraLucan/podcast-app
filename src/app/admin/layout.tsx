import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";

export const metadata = { title: "Admin" };

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/briefs", label: "Held briefs" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/shows", label: "Shows" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
      <div className="mb-8 flex items-center justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <Link href="/admin" className="text-lg font-semibold tracking-tight">
          PodBrief <span className="text-neutral-400">admin</span>
        </Link>
        <nav className="flex gap-4 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-neutral-500 hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
          <Link href="/feed" className="text-neutral-500 hover:text-foreground">
            ← App
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
