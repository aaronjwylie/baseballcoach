/**
 * The feedback domain — the coach's response coming back.
 *
 * A coach uploads their feedback file and marks the submission complete
 * (`storeFeedbackAndComplete`), which stores the file and emails the customer.
 */
export { sendFeedbackReady } from "./api/feedbackEmail";
export { storeFeedbackAndComplete } from "./api/feedbackApi";
export { UploadFeedback } from "./ui/UploadFeedback";
