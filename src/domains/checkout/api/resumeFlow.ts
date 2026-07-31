/**
 * Where an arriving customer should be put down.
 *
 * The flow lives on one route, so `/start` has to answer "which step?" on every
 * request. The answer comes from the submission's own state, never from the URL
 * — which is what makes a refresh, a re-opened tab, or a redirect back from
 * 3-D Secure land exactly where the customer left off instead of at the top.
 *
 * A paid submission resolves to `done` rather than to a fresh form. That is what
 * makes the 3-D Secure return trip work: the customer comes back on a cold page
 * load with no client state at all, and the confirmation is rebuilt from the
 * submission the flow cookie still names. "Send another" is what lets go of it.
 */
import { storage, submissionFolder } from "@/shared/storage";
import { getSettings } from "@/domains/settings";
import {
  getSubmission,
  isPaid,
  listSubmissionFiles,
  readFlowSession,
  type SubmissionFile,
} from "@/domains/submission";
import type { SubmissionInputDraft } from "@/domains/submission";
import type { FlowStep } from "../model/steps";

export interface FlowResumeState {
  step: FlowStep;
  email: string;
  playerName: string;
  details?: Partial<SubmissionInputDraft>;
  files: { id: string; filename: string; sizeBytes: number }[];
  uploadMode: "blob" | "proxy";
  uploadFolder: string;
  maxFileSizeMb: number;
  maxFiles: number;
}

export async function resolveFlowState(): Promise<FlowResumeState> {
  const settings = await getSettings();
  const base = {
    email: "",
    playerName: "",
    files: [] as FlowResumeState["files"],
    uploadMode: (storage.supportsDirectUpload ? "blob" : "proxy") as
      | "blob"
      | "proxy",
    maxFileSizeMb: settings.maxFileSizeMb,
    maxFiles: settings.maxFilesPerSubmission,
  };

  const submissionId = await readFlowSession();
  const submission = submissionId ? await getSubmission(submissionId) : null;

  if (!submission) return { ...base, step: "details", uploadFolder: "" };

  const details: Partial<SubmissionInputDraft> = {
    customerEmail: submission.customerEmail,
    playerName: submission.playerName,
    playerAge: submission.playerAge ? String(submission.playerAge) : "",
    focus: submission.focus ?? "",
    customerNotes: submission.customerNotes ?? "",
  };

  const shared = {
    ...base,
    email: submission.customerEmail,
    playerName: submission.playerName,
    details,
    uploadFolder: submissionFolder(submission.id),
  };

  const files = await listSubmissionFiles(submission.id);

  // Already paid — the confirmation, with enough detail to be meaningful. The
  // flow cookie survives payment precisely so this page can be rebuilt after a
  // redirect; "Send another" is what lets go of it.
  if (isPaid(submission)) {
    return { ...shared, step: "done", files: files.map(toClientFile) };
  }

  // Not yet proven they can read their email — back to the code.
  if (!submission.emailVerifiedAt) return { ...shared, step: "verify" };

  return { ...shared, step: "upload", files: files.map(toClientFile) };
}

function toClientFile(file: SubmissionFile) {
  return { id: file.id, filename: file.filename, sizeBytes: file.sizeBytes };
}
