/**
 * The payment domain — paying for a review.
 *
 * All verb: there is no Payment record of our own. Stripe holds the money and
 * the truth about it; what we persist is a submission carrying the payment's id.
 */
export {
  createCheckoutSession,
  getPaidSession,
} from "./api/checkoutApi";
export { sendPaymentConfirmation } from "./api/paymentEmail";
export { ensureSubmission, submissionFromSession } from "./model/fulfillment";
export { StartForm } from "./ui/StartForm";
