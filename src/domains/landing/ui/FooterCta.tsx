import Link from "next/link";
import { ButtonLink, Container } from "@/shared/ui";
import { site } from "@/shared/config/site";

/** The second ask, for anyone who scrolled past the first. */
export function FooterCta() {
  return (
    <section className="bg-surface">
      <Container className="py-20 text-center sm:py-24">
        <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Ready to level up?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">
          Get personalized feedback from professional coaches in Japan, back in{" "}
          {site.turnaroundDays}.
        </p>
        <div className="mt-8">
          <ButtonLink href="/start" size="lg">
            Submit a video →
          </ButtonLink>
        </div>
        <p className="mt-5 text-sm text-ink-muted">
          Already sent one?{" "}
          <Link href="/status" className="text-accent underline">
            Check your status
          </Link>
        </p>
      </Container>
    </section>
  );
}
