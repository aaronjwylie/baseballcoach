import { Container } from "@/shared/ui";
import { faqs } from "../model/copy";
import { SectionHeading } from "./SectionHeading";
import { ChevronIcon } from "./icons";

/**
 * Native <details> rather than a scripted accordion — it's keyboard accessible,
 * findable by in-page search, and works before JavaScript loads. A custom
 * accordion would be more code for less.
 */
export function Faq() {
  return (
    <section
      id="faq"
      className="scroll-mt-16 border-b border-line bg-paper-alt py-20 sm:py-24"
    >
      <Container className="max-w-2xl">
        <SectionHeading title="Frequently asked questions" />
        <div className="mt-12 space-y-2">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-lg border border-line bg-surface px-5 py-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-ink">
                {faq.q}
                <ChevronIcon />
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
