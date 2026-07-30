import Link from "next/link";
import { ButtonLink, Container } from "@/shared/ui";
import { Logo } from "@/shared/layout/Logo";
import { navLinks } from "@/shared/layout/navLinks";

/**
 * The dark bar the approved wireframe opens with — full-bleed ink, the wordmark
 * and section links on the left, the one call to action on the right.
 *
 * **Not sticky**, which is a change. The wireframe draws it a little over 200px
 * tall; pinning that to the top would eat a fifth of a laptop viewport on every
 * scroll. The page carries its CTA in the hero, the pricing card, the use-case
 * section and the final band, so nothing is lost by letting the header go.
 *
 * The section links collapse below `md` rather than becoming a hamburger — on a
 * page this short, scrolling *is* the navigation, and a menu button would be
 * more machinery than the page earns. The CTA stays visible at every width,
 * because that's the one thing a phone visitor needs to reach.
 */
export function SiteHeader() {
  return (
    <header className="bg-ink text-surface">
      <Container className="flex items-center justify-between gap-6 py-6 lg:py-[74px]">
        <div className="flex items-center gap-10 lg:gap-14">
          <Link href="/" aria-label="Home" className="shrink-0">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-8 md:flex lg:gap-10">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[15px] transition-opacity hover:opacity-70 lg:text-[17px]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <ButtonLink href="/start" variant="onDark" className="shrink-0">
          Submit a video
        </ButtonLink>
      </Container>
    </header>
  );
}
