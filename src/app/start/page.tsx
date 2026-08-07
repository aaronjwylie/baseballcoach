import type { Metadata } from "next";
import { ButtonLink, Container } from "@/shared/ui";
import { site, formatPrice } from "@/shared/config/site";
import { getSettings } from "@/domains/settings";
import { resolveFlowState } from "@/domains/checkout";
import { CheckoutFlow } from "@/domains/checkout";

export const metadata: Metadata = {
  title: "Get started",
  description:
    "Tell us about the player, verify your email, upload your clips, and check out.",
};

/**
 * Sentences for the one thing that can go wrong outside the flow's own control:
 * coming back from a redirect payment that we then couldn't confirm.
 */
const PAYMENT_NOTICE: Record<string, string> = {
  failed:
    "We couldn't confirm that payment. If you were charged, email us and we'll sort it out — don't pay again.",
  missing: "That payment didn't come back with a reference. Please try again.",
};

/**
 * The whole customer flow, on one route.
 *
 * **Always starts at step 1.** There is no resume: `resolveFlowState` reads no
 * cookie and returns only the operator's limits and which upload path this
 * environment supports. A refresh, a re-opened tab, or a shared machine all get
 * a clean form.
 *
 * `?paid=1` is the exception, and it isn't a resume — it's where
 * `/api/payment/return` sends a customer after a redirect payment it has already
 * confirmed and cleared the cookie for. It renders a standalone confirmation
 * that reads no state at all.
 *
 * Dynamic because the settings come from the database, not because of any
 * session.
 */
export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; paid?: string }>;
}) {
  const [state, params, settings] = await Promise.all([
    resolveFlowState(),
    searchParams,
    getSettings(),
  ]);

  if (params.paid === "1") {
    return (
      <section className="py-14 sm:py-20">
        <Container className="max-w-xl text-center">
          <div
            aria-hidden
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-paper-alt text-2xl"
          >
            ✓
          </div>
          <h1 className="mt-6 text-3xl font-medium tracking-tight text-ink sm:text-4xl">
            Payment received
          </h1>
          <p className="mt-4 text-ink-soft">
            Your submission is in and paid for. A receipt is on its way to your
            inbox, listing everything you sent.
          </p>
          <p className="mt-2 text-ink-soft">
            A coach will send a personal video walkthrough — we&rsquo;ll email you
            the moment it&rsquo;s ready.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <ButtonLink href="/status" variant="outline">
              Check your status
            </ButtonLink>
            <ButtonLink href="/start" variant="outline">
              Send another
            </ButtonLink>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className="py-14 sm:py-20">
      <Container className="max-w-xl">
        <div className="text-center">
          <h1 className="text-3xl font-medium tracking-tight text-ink sm:text-4xl">
            Send your clips for review
          </h1>
          <p className="mt-4 text-ink-soft">
            {formatPrice(settings.priceCents)} {site.price.unit} · attach your clips, and any
            stills or documents that help. Personal feedback from a professional
            coach in {site.turnaround}, and you pay at the end — once your files
            are safely in.
          </p>
        </div>

        <div className="mt-10 rounded-3xl bg-paper-alt p-6 sm:p-8">
          <CheckoutFlow
            uploadMode={state.uploadMode}
            maxFileSizeMb={state.maxFileSizeMb}
            maxFiles={state.maxFiles}
            paymentNotice={
              params.payment ? PAYMENT_NOTICE[params.payment] : undefined
            }
          />
        </div>

        <p className="mt-6 text-center text-xs text-ink-muted">
          Payments are handled securely by Stripe. We never see your card
          details.
        </p>
      </Container>
    </section>
  );
}
