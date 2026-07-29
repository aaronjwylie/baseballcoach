"use client";

import { useState } from "react";
import { PlayerInfoForm } from "./PlayerInfoForm";
import { PaymentPanel } from "./PaymentPanel";
import type { CreatedIntent } from "../api/paymentApi";

interface Step {
  intent: CreatedIntent;
  playerName: string;
}

/**
 * The two-step submission flow: player details, then payment.
 *
 * **Both steps live on one route**, which is a deliberate departure from
 * CLAUDE.md §5's separate `/submit` and `/submit/payment` pages. Two reasons:
 *
 * 1. The client secret stays in memory. Splitting the steps across routes means
 *    passing it through a URL or session storage — needless exposure for a value
 *    that only this component needs.
 * 2. It's the point of Elements. ADR 005 chose Elements so payment feels like
 *    part of the product rather than an errand; a full page navigation between
 *    "your details" and "pay" reintroduces exactly the seam we paid to remove.
 *
 * Going back is non-destructive: the abandoned PaymentIntent is simply never
 * confirmed, and Stripe expires it on its own.
 */
export function SubmitFlow() {
  const [step, setStep] = useState<Step | null>(null);

  if (step) {
    return (
      <PaymentPanel
        intent={step.intent}
        playerName={step.playerName}
        onBack={() => setStep(null)}
      />
    );
  }

  return (
    <PlayerInfoForm
      onIntentCreated={(intent, playerName) => setStep({ intent, playerName })}
    />
  );
}
