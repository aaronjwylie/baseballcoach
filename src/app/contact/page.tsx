import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/shared/ui";
import { site } from "@/shared/config/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with ${site.name} about a submission or a question before you buy.`,
};

/**
 * The wireframe's header, footer, and pricing card all point at Contact, so the
 * page exists. It is deliberately a mailto and not a form: a contact form needs
 * a route, validation, spam handling, and somewhere for the message to land,
 * and none of that is worth building before anyone has written in.
 *
 * TODO(2026-07-30, Ben): `site.email` is still hello@example.com — this page is
 * a dead end until Yuta's real address and a verified Resend domain are set.
 */
export default function ContactPage() {
  return (
    <section className="py-20 lg:py-28">
      <Container className="max-w-xl text-center">
        <h1 className="text-[40px] font-medium leading-tight tracking-tight sm:text-5xl">
          Get in touch
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">
          Questions before you send a clip, or something not right with a review
          you&rsquo;ve already had back? Email us and a person will answer.
        </p>

        <p className="mt-8 text-xl font-medium">
          <a href={`mailto:${site.email}`} className="underline">
            {site.email}
          </a>
        </p>

        <p className="mt-10 text-sm text-ink-soft">
          Already sent a video?{" "}
          <Link href="/status" className="underline">
            Check your status
          </Link>{" "}
          — it&rsquo;s usually the fastest answer.
        </p>
      </Container>
    </section>
  );
}
