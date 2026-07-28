/**
 * The submission domain — a paid request for video feedback.
 *
 * The noun every other domain orbits: payment creates one, upload attaches
 * video to one, feedback completes one. This slice imports none of them.
 */
export {
  FOCUS_OPTIONS,
  SUBMISSION_STATUSES,
  playbackUrl,
  type AppWrittenStatus,
  type Focus,
  type Submission,
  type SubmissionPatch,
  type SubmissionStatus,
} from "./model/submission";

export {
  toPublicSubmission,
  type PublicSubmission,
} from "./model/publicSubmission";

export {
  isValidEmail,
  parseSubmissionInput,
  type ParseResult,
  type SubmissionInput,
} from "./model/submissionInput";

export {
  createSubmission,
  findByCustomerEmail,
  findByMuxAssetId,
  findByMuxUploadId,
  findByStripePaymentId,
  getSubmission,
  lookupPublicSubmissions,
  updateSubmission,
} from "./api/submissionApi";

export { StatusLookup } from "./ui/StatusLookup";
