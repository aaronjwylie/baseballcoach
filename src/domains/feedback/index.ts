/**
 * The feedback domain — the coach's response coming back, now multi-file.
 *
 * The coach attaches one or more files (each a `feedback` row in
 * `submission_files`), then `sendFeedbackForApproval` parks the submission at
 * `awaiting_approval` for Yuta; `approveAndComplete` marks it complete and emails
 * the customer that their feedback is ready.
 */
export { sendFeedbackReady } from "./api/feedbackEmail";
export { signFeedbackToken, verifyFeedbackToken } from "./api/feedbackToken";
export {
  FEEDBACK_CODE_COOKIE,
  FEEDBACK_CODE_TTL_S,
  issueFeedbackViewCode,
  verifyFeedbackViewCode,
  type FeedbackGroup,
  type PendingFeedbackCode,
} from "./api/feedbackViewCode";
export {
  saveFeedbackFile,
  recordFeedbackFile,
  sendFeedbackForApproval,
  approveAndComplete,
} from "./api/feedbackApi";
export { FeedbackUpload } from "./ui/FeedbackUpload";
