/**
 * The four steps between "I want feedback" and "you've been charged".
 *
 * The order **is** the product decision, and this is where it's made — the
 * indicator, the flow's state machine, and the resume logic all read it, so
 * adding or reordering a step is one edit rather than four.
 *
 * Why this order: verification sits second because everything after it depends
 * on us being able to reach the customer, and finding out the address was wrong
 * *after* taking money is the one failure they can't fix themselves. Payment
 * sits last so nobody pays for a submission whose upload then fails
 * (ADR 009).
 *
 * Client-safe: no server imports.
 */

export const CHECKOUT_STEPS = [
  { key: "details", label: "Player details" },
  { key: "verify", label: "Verify email" },
  { key: "upload", label: "Upload files" },
  { key: "pay", label: "Payment" },
] as const;

export type CheckoutStep = (typeof CHECKOUT_STEPS)[number]["key"];

/**
 * The four steps, plus the state after them.
 *
 * `done` is not a step — it has no indicator position and nothing follows it —
 * but it *is* somewhere the flow can be resumed into, which is why it belongs
 * in this union rather than as a boolean elsewhere. A customer who paid via
 * 3-D Secure comes back to a fresh page load and must land here.
 */
export type FlowStep = CheckoutStep | "done";

export const TOTAL_STEPS = CHECKOUT_STEPS.length;

/** 1-based position, for "Step 2 of 4". */
export function stepNumber(step: CheckoutStep): number {
  return CHECKOUT_STEPS.findIndex((s) => s.key === step) + 1;
}

export function stepLabel(step: CheckoutStep): string {
  return CHECKOUT_STEPS.find((s) => s.key === step)?.label ?? "";
}
