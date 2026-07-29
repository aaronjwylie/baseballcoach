import { ButtonLink, Container } from "@/shared/ui";
import { site } from "@/shared/config/site";
import { included } from "../model/copy";
import { SectionHeading } from "./SectionHeading";
import { CheckIcon } from "./icons";

/**
 * One card, one price, one action.
 *
 * The reference wireframe folds "what you get" into this card rather than
 * giving it a section of its own — the value proposition lands hardest next to
 * the number. That's why there's no standalone WhatYouGet section any more.
 */
export function Pricing() {
  return (
    <section
      id="pricing"
      className="scroll-mt-16 border-b border-line bg-surface py-20 sm:py-24"
    >
      <Container>
        <SectionHeading
          title="Simple, upfront pricing"
          subtitle="Pay once, per review. Send another whenever you're ready."
        />
        <div className="mx-auto mt-14 max-w-sm rounded-xl border border-line bg-paper-alt p-8 text-center">
          <p className="text-sm text-ink-soft">Per video submission</p>
          <p className="mt-2 text-4xl font-semibold text-ink">
            {site.price.label}
            <span className="ml-1.5 text-base font-normal text-ink-muted">
              {site.price.currency.toUpperCase()}
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Single payment · no subscription
          </p>

          <ul className="mt-7 space-y-3 text-left">
            {included.map((item) => (
              <li key={item.title} className="flex items-start gap-2.5">
                <CheckIcon />
                <span className="text-sm text-ink-soft">{item.title}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <ButtonLink href="/start" size="lg" className="w-full">
              Submit a video
            </ButtonLink>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Secure checkout via Stripe · no account required
          </p>
        </div>
      </Container>
    </section>
  );
}
