import Link from "next/link";
import { Container, ButtonLink } from "@/components/ui";
import { Logo } from "@/components/logo";

const navLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#coaches", label: "Coaches" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/status"
            className="hidden text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:inline"
          >
            Check status
          </Link>
          <ButtonLink href="/start">Get started</ButtonLink>
        </div>
      </Container>
    </header>
  );
}
