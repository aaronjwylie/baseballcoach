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
  hasResponse,
  isPaid,
  isReleased,
  isWithCoach,
  type AppWrittenStatus,
  type Focus,
  type NewSubmission,
  type Submission,
  type SubmissionPatch,
  type SubmissionStatus,
  whoseCourt,
  type Court,
  LANGUAGES,
  needsTranslation,
  type Language,
} from "./model/submission";

export {
  STAGE_CHAIN,
  describeStage,
  type ChainAction,
  type ChainLine,
  type ChainState,
  type ProgressFacts,
} from "./model/stageChain";

export {
  FILE_KINDS,
  INTAKE_KINDS,
  RESPONSE_KINDS,
  formatFileSize,
  isAvailable,
  isIntake,
  isResponse,
  type FileKind,
  type NewSubmissionFile,
  type SubmissionFile,
  FILE_SETS,
  availableSets,
  kindsForSet,
  type FileSet,
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
  markCoachCollected,
  markCustomerCollected,
  markSubmissionSentToCoach,
  unarchiveSubmission,
  updateSubmission,
  findWarningDue,
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
  listFilesByFolder,
  listFilesByKinds,
  clearFileLocator,
  clearAllFileLocators,
  listAllSubmissionFiles,
} from "./api/submissionFileApi";

export { signStatusToken, verifyStatusToken } from "./api/statusToken";

export {
  listProgressFacts,
  listSubmissionEvents,
  noteEmailSent,
  recordSubmissionEvent,
  type SubmissionEvent,
  type SubmissionEventKind,
  bounceOf,
  noteEmailOutcome,
  type BounceKind,
  type EmailOutcome,
} from "./api/submissionEventApi";

export {
  FLOW_MAX_AGE_S,
  clearFlowSession,
  readFlowSession,
  setFlowSession,
  touchFlowSession,
} from "./api/flowSession";

export { StatusList } from "./ui/StatusList";
export { StatusLookup } from "./ui/StatusLookup";
export { SubmissionFileList } from "./ui/SubmissionFileList";
