import { Container } from "@/shared/ui";
import { faqHeading, faqs } from "../model/copy";
import { SectionHeading } from "./SectionHeading";

/**
 * The objections.
 *
 * Native `<details>` rather than a scripted accordion — keyboard accessible,
 * findable by in-page search, and working before JavaScript loads. A custom
 * accordion would be more code for less.
 *
 * The wireframe draws every row with its answer showing *and* a ⊕ button. Both
 * can't be true at once, and a plus means "there is more here", so the rows
 * start closed and the plus rotates into an ×. Worth confirming with Audrey.
 */
export function Faq() {
  return (
    <section id="faq" className="scroll-mt-8 bg-surface py-20 lg:py-28">
      <Container className="max-w-4xl">
        <SectionHeading
          eyebrow={faqHeading.eyebrow}
          title={faqHeading.title}
          align="center"
        />

        <div className="mt-14 space-y-5">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-3xl bg-paper-alt px-8 py-7 sm:px-10"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6">
                <h3 className="text-2xl font-medium tracking-tight sm:text-[28px]">
                  {faq.q}
                </h3>
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-2xl font-medium leading-none transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>

              {"items" in faq ? (
                <ul className="mt-4 space-y-1 text-[15px] text-ink-soft">
                  {faq.items.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span aria-hidden>•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
                  {faq.answer}
                </p>
              )}
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
