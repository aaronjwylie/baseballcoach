import { ButtonLink, Container } from "@/shared/ui";
import { site } from "@/shared/config/site";

/**
 * The hook. Centered and narrow, per the reference wireframe — one column, one
 * ask, no competing action.
 *
 * The CTA goes straight to `/start`, not to an anchor. The wireframe scrolls to
 * #pricing because a static mockup has nowhere else to go; here the whole point
 * is to enter the paid flow.
 */
export function Hero() {
  return (
    <section id="hero" className="border-b border-line bg-paper-alt">
      <Container className="py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-accent">
            Remote coaching from Japan
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.15] tracking-tight text-ink sm:text-5xl">
            {site.tagline}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-ink-soft">
            {site.subhead}
          </p>
          <div className="mt-9">
            <ButtonLink href="/start" size="lg">
              Submit a video →
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-ink-muted">
            Feedback within {site.turnaroundDays} · {site.price.label}{" "}
            {site.price.unit} · no subscription
          </p>
        </div>
      </Container>
    </section>
  );
}
