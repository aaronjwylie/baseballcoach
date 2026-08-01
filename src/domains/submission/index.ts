/**
 * The submission domain — one customer's request for video feedback.
 *
 * The noun every other domain orbits: the flow opens one, verification unlocks
 * it, upload attaches files to it, payment pays for it, feedback completes it.
 * This slice imports none of them.
 *
 * Server-only: the barrel re-exports database code, so a client component
 * imports `model/…` directly rather than from here (structure.md §3b).
 */
export {
  FOCUS_OPTIONS,
  PAID_STATUSES,
  SUBMISSION_STATUSES,
  isPaid,
  type AppWrittenStatus,
  type Focus,
  type NewSubmission,
  type Submission,
  type SubmissionPatch,
  type SubmissionStatus,
} from "./model/submission";

export {
  formatFileSize,
  isAvailable,
  type NewSubmissionFile,
  type SubmissionFile,
} from "./model/submissionFile";

export {
  toPublicSubmission,
  type PublicSubmission,
} from "./model/publicSubmission";

export {
  customerEmailSchema,
  lookupSchema,
  parseLookupInput,
  parseSubmissionInput,
  submissionInputSchema,
  type LookupInput,
  type ParseResult,
  type SubmissionInput,
  type SubmissionInputDraft,
} from "./model/submissionInput";

export {
  archiveSubmission,
  assignSubmissionCoach,
  createSubmission,
  deleteSubmission,
  findByCoach,
  findByCustomerEmail,
  findByStripePaymentId,
  findAbandonedDue,
  findResolvedDue,
  getSubmission,
  listSubmissions,
  lookupPublicSubmissions,
  markSubmissionInReview,
  unarchiveSubmission,
  updateSubmission,
} from "./api/submissionApi";

export {
  addSubmissionFile,
  clearFileLocators,
  countSubmissionFiles,
  deleteSubmissionFile,
  getSubmissionFile,
  listFeedbackFiles,
  listFilesForSubmissions,
  listSubmissionFiles,
  type FileKind,
} from "./api/submissionFileApi";

export {
  FLOW_MAX_AGE_S,
  clearFlowSession,
  readFlowSession,
  setFlowSession,
  touchFlowSession,
} from "./api/flowSession";

export { StatusLookup } from "./ui/StatusLookup";
export { SubmissionFileList } from "./ui/SubmissionFileList";
