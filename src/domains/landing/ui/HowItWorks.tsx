import { Container } from "@/shared/ui";
import { method } from "../model/copy";
import { SectionHeading } from "./SectionHeading";

/**
 * The process, on the one dark band in the page. The band is doing work: it
 * separates the pitch above from the proof below, and it is where a reader
 * either understands the product in three lines or leaves.
 */
export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-8 bg-ink-soft py-20 text-surface lg:py-28"
    >
      <Container>
        <SectionHeading
          eyebrow={method.eyebrow}
          title={method.title}
          subtitle={method.subtitle}
        />

        <ol className="mt-16 grid gap-6 md:grid-cols-3">
          {method.steps.map((step) => (
            <li
              key={step.step}
              className="rounded-3xl bg-paper-alt px-8 py-9 text-ink"
            >
              <p className="text-3xl font-medium tracking-tight text-ink-soft">
                {step.step}
              </p>
              <h3 className="mt-4 text-[28px] font-medium leading-tight tracking-tight">
                {step.title}
              </h3>
              <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
