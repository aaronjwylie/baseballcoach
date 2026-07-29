/**
 * The payment domain — paying for a review.
 *
 * All verb: there is no Payment record of our own. Stripe holds the money and
 * the truth about it; what we persist is a submission carrying the payment's id.
 */
export {
  createPaymentIntent,
  getSucceededPaymentIntent,
  type CreatedIntent,
} from "./api/paymentApi";
export { sendPaymentConfirmation } from "./api/paymentEmail";
export { handleStripeEvent, verifyStripeWebhook } from "./api/paymentWebhook";
export {
  ensureSubmission,
  submissionFromPaymentIntent,
} from "./model/fulfillment";
export { SubmitFlow } from "./ui/SubmitFlow";
