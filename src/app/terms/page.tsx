import type { Metadata } from "next";
import { Container } from "@/shared/ui";
import { site } from "@/shared/config/site";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description: `The terms covering a ${site.name} video review.`,
  robots: { index: false },
};

/**
 * The wireframe's footer links here, so the link resolves rather than 404s.
 *
 * ⚠️ **This is a placeholder, not legal copy.** It states plainly what the
 * product does and what a customer is buying, and says so — a page that *looked*
 * like finished terms while being written by nobody qualified would be worse
 * than an obvious stub. `noindex` until it's real.
 *
 * TODO(2026-07-30, Ben): replace with terms and a privacy policy reviewed by
 * someone qualified, before the site takes live payments. A site taking money
 * and storing video of minors needs both.
 */
export default function TermsPage() {
  return (
    <section className="py-20 lg:py-28">
      <Container className="max-w-2xl">
        <h1 className="text-[40px] font-medium leading-tight tracking-tight sm:text-5xl">
          Terms and conditions
        </h1>

        <p className="mt-8 rounded-3xl bg-paper-alt px-7 py-6 text-[15px] leading-relaxed text-ink-soft">
          These terms are still being drafted. What follows describes how the
          service works today; it is not a substitute for the reviewed terms that
          will replace this page before launch.
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-ink-soft">
          <section>
            <h2 className="text-xl font-medium text-ink">What you&rsquo;re buying</h2>
            <p className="mt-3">
              One review, by one coach, of the files you attach to a single
              submission — video, images, or documents — for {site.price.label}{" "}
              {site.price.unit}. There is no subscription and no recurring
              charge. Payment is taken once, at checkout, by Stripe.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium text-ink">What you receive</h2>
            <p className="mt-3">
              A personal response from your coach, delivered within{" "}
              {site.turnaround} of your files reaching us. We email you the
              moment it&rsquo;s ready, and it stays available at the link in that
              email.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium text-ink">Your files</h2>
            <p className="mt-3">
              We store the files you upload so the coach assigned to your
              submission can review them. They are not published, and they are
              not shared outside the coaching team. If the player is a minor, the
              files should be submitted by a parent or guardian. Your uploads are
              deleted after your review is delivered; the coach&rsquo;s response
              stays available at the link we email you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium text-ink">Getting in touch</h2>
            <p className="mt-3">
              Questions about a submission or a charge:{" "}
              <a href={`mailto:${site.email}`} className="underline">
                {site.email}
              </a>
              .
            </p>
          </section>
        </div>
      </Container>
    </section>
  );
}
