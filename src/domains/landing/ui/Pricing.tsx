import { ButtonLink, Container } from "@/shared/ui";
import { site } from "@/shared/config/site";
import { included } from "../model/copy";
import { SectionHeading } from "./SectionHeading";
import { CheckIcon } from "./icons";

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Pricing"
          title="Simple, per-video pricing"
          subtitle="Pay once, per review. Send another whenever you're ready."
        />
        <div className="mx-auto mt-14 max-w-md">
          <div className="overflow-hidden rounded-3xl border border-line bg-paper">
            <div className="bg-ink px-8 py-8 text-center text-white">
              <div className="text-sm font-medium uppercase tracking-wide text-white/60">
                Single video review
              </div>
              <div className="mt-3 flex items-baseline justify-center gap-1">
                <span className="text-5xl font-bold">{site.price.label}</span>
                <span className="text-white/60">
                  {" "}
                  {site.price.currency.toUpperCase()}
                </span>
              </div>
              <div className="mt-1 text-sm text-white/60">
                {site.price.unit}
              </div>
            </div>
            <ul className="space-y-3 px-8 py-8">
              {included.map((item) => (
                <li key={item.title} className="flex items-start gap-3 text-sm">
                  <CheckIcon small />
                  <span className="text-ink-soft">{item.title}</span>
                </li>
              ))}
            </ul>
            <div className="px-8 pb-8">
              <ButtonLink href="/start" size="lg" className="w-full">
                Get started
              </ButtonLink>
              <p className="mt-3 text-center text-xs text-ink-muted">
                Secure checkout via Stripe · No account required
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
