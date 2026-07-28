import { Container } from "@/shared/ui";
import { faqs } from "../model/copy";
import { SectionHeading } from "./SectionHeading";
import { PlusIcon } from "./icons";

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-24">
      <Container className="max-w-3xl">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />
        <div className="mt-12 divide-y divide-line border-y border-line">
          {faqs.map((faq) => (
            <details key={faq.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-ink">
                {faq.q}
                <span className="shrink-0 text-ink-muted transition-transform group-open:rotate-45">
                  <PlusIcon />
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
