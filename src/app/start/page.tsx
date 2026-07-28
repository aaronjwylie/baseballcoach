import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/shared/ui";
import { site } from "@/shared/config/site";
import { StartForm } from "@/domains/payment";

export const metadata: Metadata = {
  title: "Get started",
  description: `Tell us about the player and check out to send your video for review.`,
};

export default function StartPage() {
  return (
    <section className="py-14 sm:py-20">
      <Container className="max-w-xl">
        <div className="text-center">
          <div className="text-sm font-semibold uppercase tracking-wide text-accent">
            Step 1 of 2
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Tell us about the player
          </h1>
          <p className="mt-4 text-ink-muted">
            A few quick details, then secure checkout. You&apos;ll upload the
            video right after — {site.price.label} {site.price.unit}.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-line bg-white p-6 sm:p-8">
          <Suspense>
            <StartForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-ink-muted">
          Payments are handled securely by Stripe. We never see your card
          details.
        </p>
      </Container>
    </section>
  );
}
