import Link from "next/link";
import { ButtonLink, Container } from "@/shared/ui";
import { Logo } from "@/shared/layout/Logo";

const navLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#coaches", label: "Coaches" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

/**
 * Sticky nav, per the reference wireframe.
 *
 * The section links collapse below `md` rather than becoming a hamburger — on a
 * page this short, scrolling *is* the navigation, and a menu button would be
 * more machinery than the page earns. The CTA stays visible at every width,
 * because that's the one thing a phone visitor needs to reach.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-ink-soft transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/status"
            className="hidden text-sm text-ink-soft transition-colors hover:text-ink sm:inline"
          >
            Check status
          </Link>
          <ButtonLink href="/start">Get feedback</ButtonLink>
        </div>
      </Container>
    </header>
  );
}
