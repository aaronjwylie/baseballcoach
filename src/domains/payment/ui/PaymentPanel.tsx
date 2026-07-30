"use client";

import { useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/shared/ui";
import { site } from "@/shared/config/site";
import { stripePublishableKey } from "@/shared/config/publicEnv";
import type { CreatedIntent } from "../api/paymentApi";

/**
 * Step two — paying, on our own page.
 *
 * `loadStripe` is called once at module scope, not per render: it injects a
 * script tag, and re-invoking it per mount would add another.
 */
const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;

export function PaymentPanel({
  intent,
  playerName,
  onBack,
}: {
  intent: CreatedIntent;
  playerName: string;
  onBack: () => void;
}) {
  // A missing publishable key is a deployment mistake, not a customer error.
  // Say so plainly rather than rendering an empty box.
  if (!stripePromise) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
      >
        Payments aren&apos;t configured — NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is
        missing. This is a setup problem on our side, not yours.
      </p>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: intent.clientSecret,
        // Match the site rather than accepting Stripe's defaults — the whole
        // reason for Elements over hosted Checkout (ADR 005).
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#2c2c2a",
            colorText: "#2c2c2a",
            colorDanger: "#b4232c",
            borderRadius: "8px",
            fontFamily: "inherit",
          },
        },
      }}
    >
      <PaymentFields
        intent={intent}
        playerName={playerName}
        onBack={onBack}
      />
    </Elements>
  );
}

/**
 * Inside the Elements provider, so the Stripe hooks are available.
 */
function PaymentFields({
  intent,
  playerName,
  onBack,
}: {
  intent: CreatedIntent;
  playerName: string;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setBusy(true);
    setError(null);

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Only used when the method needs a redirect (3-D Secure, wallets).
        // Stripe appends payment_intent to it on the way back.
        return_url: `${window.location.origin}/upload`,
      },
      // Stay on the page for plain cards; redirect only when the method demands
      // it. Without this, every payment would bounce through a return trip.
      redirect: "if_required",
    });

    if (stripeError) {
      // Card declines and validation problems are the customer's to fix, and
      // Stripe's messages are already written for them.
      setError(stripeError.message ?? "That payment didn't go through.");
      setBusy(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      // Hand off to the upload step. The webhook is creating the row in
      // parallel; whichever arrives first wins (ADR 003), so no waiting.
      window.location.assign(
        `/upload?payment_intent=${encodeURIComponent(paymentIntent.id)}`,
      );
      return;
    }

    // Anything else — `processing`, `requires_action` without a redirect — is
    // not a failure and not a success. Don't claim either.
    setError(
      "Your payment is still processing. We'll email you as soon as it clears.",
    );
    setBusy(false);
  }

  const amount = (intent.amountCents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: intent.currency.toUpperCase(),
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* The order summary a hosted checkout page wouldn't let us write. */}
      <div className="rounded-lg border border-line bg-paper-alt p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-soft">
            Video review — {playerName}
          </span>
          <span className="font-semibold text-ink">{amount}</span>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          One-time payment · feedback in {site.turnaround}
        </p>
      </div>

      <PaymentElement />

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={busy || !stripe || !elements}
        className="w-full"
      >
        {busy ? "Processing…" : `Pay ${amount}`}
      </Button>

      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        className="w-full text-center text-sm text-ink-muted underline hover:text-ink disabled:opacity-50"
      >
        Back to player details
      </button>

      <p className="text-center text-xs text-ink-muted">
        Payments are processed by Stripe. We never see your card details.
      </p>
    </form>
  );
}
