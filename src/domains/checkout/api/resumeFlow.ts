/**
 * Where an arriving customer should be put down.
 *
 * **Only a completed payment survives a page load** (Yuta, 2026-07-30). A cold
 * load — first visit, refresh, re-opened tab — starts a fresh attempt, because
 * until the money clears a submission is a scratch pad and scrubbing it is fair
 * game. The abandoned row is discarded when the next attempt begins, and the
 * retention sweep catches anything left behind.
 *
 * A **paid** submission resolves to `done` instead. That is not an exception to
 * the rule, it *is* the rule — and it's also what makes the 3-D Secure return
 * trip safe: `/api/payment/return` marks the submission paid *before* it
 * redirects here, so the customer comes back on a cold load to a submission that
 * has already earned its retention. A payment can never be scrubbed out from
 * under someone who has just been charged.
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

  // Paid: show the confirmation, rebuilt from the record.
  if (submission && isPaid(submission)) {
    const files = await listSubmissionFiles(submission.id);
    return {
      ...base,
      step: "done",
      email: submission.customerEmail,
      playerName: submission.playerName,
      files: files.map(toClientFile),
      uploadFolder: submissionFolder(submission.id),
    };
  }

  // Anything else starts over. The stale row (if any) is discarded when the
  // next attempt is submitted — see `startSubmissionAction`.
  return { ...base, step: "details", uploadFolder: "" };
}

function toClientFile(file: SubmissionFile) {
  return { id: file.id, filename: file.filename, sizeBytes: file.sizeBytes };
}
