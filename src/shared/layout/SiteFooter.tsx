import Link from "next/link";
import { Container } from "@/shared/ui";
import { Logo } from "@/shared/layout/Logo";
import { site } from "@/shared/config/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-sm text-sm text-ink-muted">{site.tagline}</p>
        </div>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-soft">
          <Link href="/#how-it-works" className="hover:text-ink">
            How it works
          </Link>
          <Link href="/#pricing" className="hover:text-ink">
            Pricing
          </Link>
          <Link href="/status" className="hover:text-ink">
            Check status
          </Link>
          <a href={`mailto:${site.email}`} className="hover:text-ink">
            Contact
          </a>
        </nav>
      </Container>
      <div className="border-t border-line">
        <Container className="py-5 text-xs text-ink-muted">
          © {site.name}. Every review is done by a real coach.
        </Container>
      </div>
    </footer>
  );
}
