/**
 * The feedback domain — the coach's response coming back.
 *
 * A coach uploads their feedback file and marks the submission complete from the
 * coach portal, which stores the file and emails the customer. For now this
 * slice owns the "feedback ready" email; the send is wired from the coach
 * portal's complete action.
 */
export { sendFeedbackReady } from "./api/feedbackEmail";
