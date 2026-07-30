import Link from "next/link";
import { Container } from "@/shared/ui";
import { site } from "@/shared/config/site";
import { Logo } from "@/shared/layout/Logo";
import { navLinks } from "@/shared/layout/navLinks";

/**
 * Two bands, per the approved wireframe: the wordmark and section links on ink,
 * then a lighter strip carrying the legal line.
 *
 * "Check status" is ours, not the wireframe's. A customer who has already paid
 * has no account to log into — by design — so this link and the email lookup
 * behind it are their only route back to a submission. Leaving it out to match
 * the mockup would strand them.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer>
      <div className="bg-ink text-surface">
        <Container className="flex flex-col items-center justify-center gap-8 py-14 text-center sm:flex-row sm:gap-14">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>

          <nav className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[15px] transition-opacity hover:opacity-70 lg:text-[17px]"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/status"
              className="text-[15px] transition-opacity hover:opacity-70 lg:text-[17px]"
            >
              Check status
            </Link>
          </nav>
        </Container>
      </div>

      <div className="bg-ink-soft text-surface">
        <Container className="flex flex-col gap-2 py-7 text-[15px] sm:flex-row sm:items-center sm:gap-14">
          <Link href="/terms" className="transition-opacity hover:opacity-70">
            terms and conditions
          </Link>
          <p>
            © {year} {site.name}
            {" · "}Vancouver &amp; Tokyo
          </p>
        </Container>
      </div>
    </footer>
  );
}
