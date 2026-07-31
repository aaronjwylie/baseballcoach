import type { Metadata } from "next";
import { Container } from "@/shared/ui";
import { site } from "@/shared/config/site";
import { resolveFlowState } from "@/domains/checkout";
import { CheckoutFlow } from "@/domains/checkout/ui/CheckoutFlow";

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
 * Dynamic by necessity: which step to show is read from the flow cookie, so this
 * page cannot be prerendered. `resolveFlowState` answers that question in one
 * place — including which upload path the browser should take, which depends on
 * whether a Blob store is configured.
 */
export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const [state, params] = await Promise.all([
    resolveFlowState(),
    searchParams,
  ]);

  return (
    <section className="py-14 sm:py-20">
      <Container className="max-w-xl">
        <div className="text-center">
          <h1 className="text-3xl font-medium tracking-tight text-ink sm:text-4xl">
            Send a video for review
          </h1>
          <p className="mt-4 text-ink-soft">
            {site.price.label} {site.price.unit} · personal feedback from a
            professional coach in {site.turnaround}. You pay at the end, once
            your files are safely in.
          </p>
        </div>

        <div className="mt-10 rounded-3xl bg-paper-alt p-6 sm:p-8">
          <CheckoutFlow
            initialStep={state.step}
            initialEmail={state.email}
            initialPlayerName={state.playerName}
            initialDetails={state.details}
            initialFiles={state.files}
            uploadMode={state.uploadMode}
            uploadFolder={state.uploadFolder}
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
