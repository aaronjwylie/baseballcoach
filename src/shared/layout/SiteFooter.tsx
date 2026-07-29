import Link from "next/link";
import { Container } from "@/shared/ui";
import { site } from "@/shared/config/site";

/**
 * Slim footer, per the reference wireframe: a copyright line and a short link
 * row, nothing more.
 *
 * The wireframe lists Status · Privacy · Contact. Privacy has no page yet —
 * see the landing slice doc; it's a real gap for a site taking payments, and a
 * link to nowhere would be worse than its absence.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper-alt">
      <Container className="flex flex-col items-center justify-between gap-4 py-6 text-sm text-ink-muted sm:flex-row">
        <p>
          © {site.name}. Every review is done by a real coach.
        </p>
        <nav className="flex items-center gap-6">
          <Link href="/status" className="transition-colors hover:text-ink">
            Status
          </Link>
          <a
            href={`mailto:${site.email}`}
            className="transition-colors hover:text-ink"
          >
            Contact
          </a>
        </nav>
      </Container>
    </footer>
  );
}
