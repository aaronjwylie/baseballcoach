import { ButtonLink, Container } from "@/shared/ui";
import { site } from "@/shared/config/site";
import { pricing } from "../model/copy";
import { SectionHeading } from "./SectionHeading";

/**
 * The ask, on a full-bleed band so the number can't be scrolled past.
 *
 * The price is read from `site.price` — the same field the PaymentIntent is
 * built from — so the figure on this card and the amount Stripe charges cannot
 * disagree.
 */
export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-8 bg-band py-20 lg:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <SectionHeading
          eyebrow={pricing.eyebrow}
          title={pricing.title}
          align="center"
        />

        <div className="rounded-3xl bg-paper-alt px-8 py-12 text-center sm:px-14">
          <p className="text-5xl font-medium tracking-tight lg:text-[56px]">
            {site.price.label}
          </p>
          <p className="mt-1 text-3xl font-medium tracking-tight lg:text-[40px]">
            {site.price.unit}
          </p>

          <ul className="mx-auto mt-7 inline-block text-left text-[17px] text-ink-soft">
            {pricing.included.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span aria-hidden>•</span>
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-col items-center gap-4">
            <ButtonLink href="/start" variant="outline" size="lg">
              Submit a video
            </ButtonLink>
            <ButtonLink href="/contact" variant="outline" size="lg">
              Questions? Reach out
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
