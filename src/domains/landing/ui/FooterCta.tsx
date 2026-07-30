import Link from "next/link";
import { ButtonLink, Container } from "@/shared/ui";
import { finalCta } from "../model/copy";

/** The second ask, for anyone who scrolled past the first. */
export function FooterCta() {
  return (
    <section className="bg-band py-24 text-center lg:py-28">
      <Container>
        <h2 className="text-[40px] font-medium leading-tight tracking-tight sm:text-5xl lg:text-[56px]">
          {finalCta.title}
        </h2>
        <p className="mt-3 text-xl sm:text-2xl">{finalCta.subtitle}</p>

        <div className="mt-9">
          <ButtonLink href="/start" variant="outline" size="lg">
            Submit a video
          </ButtonLink>
        </div>

        {/*
          Not in the wireframe, and kept anyway: a customer who has already paid
          has no other route back to their submission — there is no login for
          them by design. Dropping this would strand them.
        */}
        <p className="mt-6 text-sm text-ink-soft">
          Already sent one?{" "}
          <Link href="/status" className="underline">
            Check your status
          </Link>
        </p>
      </Container>
    </section>
  );
}
