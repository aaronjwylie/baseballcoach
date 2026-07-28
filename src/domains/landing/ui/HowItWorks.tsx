import { Container } from "@/shared/ui";
import { howItWorks } from "../model/copy";
import { SectionHeading } from "./SectionHeading";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="How it works"
          title="From phone video to pro feedback in three steps"
          subtitle="No app to download, no account to manage. Film it, send it, and get a coach's breakdown back within days."
        />
        <ol className="mt-14 grid gap-8 md:grid-cols-3">
          {howItWorks.map((step) => (
            <li
              key={step.step}
              className="relative rounded-2xl border border-line bg-white p-7"
            >
              <span className="text-4xl font-bold text-accent/25">
                {step.step}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-ink">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
