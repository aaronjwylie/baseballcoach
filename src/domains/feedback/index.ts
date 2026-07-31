/**
 * The feedback domain — the coach's response coming back.
 *
 * Two steps: the coach uploads their file (`storeFeedback`), which parks the
 * submission at `awaiting_approval`; then Yuta reviews and `approveAndComplete`s
 * it, which marks it complete and emails the customer their download link.
 */
export { sendFeedbackReady } from "./api/feedbackEmail";
export { storeFeedback, approveAndComplete } from "./api/feedbackApi";
export { UploadFeedback } from "./ui/UploadFeedback";
