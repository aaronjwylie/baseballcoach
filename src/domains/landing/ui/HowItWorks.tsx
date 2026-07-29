import { Container } from "@/shared/ui";
import { howItWorks } from "../model/copy";
import { SectionHeading } from "./SectionHeading";

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-16 border-b border-line bg-surface py-20 sm:py-24"
    >
      <Container>
        <SectionHeading
          title="How it works"
          subtitle="No app to download, no account to manage. Film it, send it, and get a coach's breakdown back."
        />
        <ol className="mt-14 grid gap-10 md:grid-cols-3">
          {howItWorks.map((step, index) => (
            <li key={step.step} className="text-center">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                {index + 1}
              </span>
              <h3 className="mt-4 text-base font-semibold text-ink">
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
