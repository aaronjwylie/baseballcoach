/**
 * What happens once a payment has actually cleared.
 *
 * Written once because **two callers reach this point**: the Stripe webhook, and
 * the browser confirming its own PaymentIntent on the way to the success screen.
 * Whichever wins the race does the work; the other finds `justPaid` false and
 * does nothing (ADR 003).
 *
 * Best-effort, like every send in the app: a failing email never throws into a
 * webhook, because Stripe retries any non-2xx and a degraded mail provider would
 * become a retry storm against a payment that already succeeded (ADR 004).
 */
import { env } from "@/shared/config/env";
import { listSubmissionFiles } from "@/domains/submission";
import { site } from "@/shared/config/site";
import type { PaidResult } from "../model/fulfillment";
import { sendSubmissionReceipt } from "./paymentEmail";

export async function completePayment({
  submission,
  justPaid,
}: PaidResult): Promise<void> {
  if (!justPaid) return;
  if (!submission.customerEmail) return;

  const files = await listSubmissionFiles(submission.id);

  await sendSubmissionReceipt(submission.customerEmail, {
    playerName: submission.playerName,
    amountCents: submission.stripeAmount ?? site.price.amountCents,
    currency: site.price.currency,
    files,
    statusUrl: `${env.siteUrl}/status`,
  });
}
