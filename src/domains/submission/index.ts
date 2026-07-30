/**
 * The submission domain — a paid request for video feedback.
 *
 * The noun every other domain orbits: payment creates one, upload attaches a
 * video to one, feedback completes one. This slice imports none of them.
 */
export {
  FOCUS_OPTIONS,
  SUBMISSION_STATUSES,
  type AppWrittenStatus,
  type Focus,
  type NewSubmission,
  type Submission,
  type SubmissionPatch,
  type SubmissionStatus,
} from "./model/submission";

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
  createSubmission,
  findByCoach,
  findByCustomerEmail,
  findByStripePaymentId,
  getSubmission,
  listSubmissions,
  lookupPublicSubmissions,
  updateSubmission,
} from "./api/submissionApi";

export { StatusLookup } from "./ui/StatusLookup";
