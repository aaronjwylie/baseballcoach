"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Container } from "@/shared/ui";
// Import the server action from its "use server" module directly, NOT the
// domain barrel — the barrel also re-exports the DAL and Postgres client, which
// a client component would drag into the browser bundle (CLAUDE.md §12).
import { logout } from "@/domains/operator/api/auth";

/**
 * The operator portal's top bar — one full-width band shared by the admin and
 * coach layouts, so the nav can't drift between them or get trapped inside a
 * page's narrow form column (which is exactly what it used to do).
 *
 * `active` is derived from the path rather than passed per page: the section
 * links use a prefix match so `/admin/coachTable/:id` still lights up "Coaches",
 * while the two portal homes (`/admin`, `/coach`) match exactly so they don't
 * light up on every child route.
 */
export function PortalBar({
  home,
  links = [],
}: {
  home: string;
  links?: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" || href === "/coach"
      ? pathname === href
      : pathname.startsWith(href);

  return (
    <div className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Link href={home} className="text-lg font-bold tracking-tight text-ink">
            Baseball Sensei
          </Link>
          {links.length > 0 && (
            <nav className="hidden items-center gap-5 text-sm sm:flex">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    isActive(link.href)
                      ? "font-semibold text-ink"
                      : "text-ink-muted hover:text-ink"
                  }
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Link href="/account" className="text-sm text-ink-muted hover:text-ink">
            Account
          </Link>
          <form action={logout}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </Container>
    </div>
  );
}
