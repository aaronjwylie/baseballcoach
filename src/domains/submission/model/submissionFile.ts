/**
 * One stored file, either direction, as the app sees it.
 *
 * Replaced the single `videoUrl` field on `Submission` when the flow moved to
 * multi-file uploads. A submission may now carry a clip, a couple of stills, and
 * a coach's old report together, and the receipt email lists them by name.
 *
 * **The four folders live in `kind`.** `intake` is what the customer sent,
 * `response` is what the coach wrote back, and each has a translated
 * counterpart Yuta uploads — stored *beside* the original, never replacing it.
 *
 * Kinds are **nouns** (`_NomenclatureLaw.md` §2): a kind says *what this file
 * is*, while a status says *what has happened*. That's why the kind is
 * `intake_translation` and the matching status is `intake_translated` — one
 * stem, two axes, and neither reads as the other.
 *
 * `fileUrl` is the storage locator — a local key in dev, a Blob URL in prod,
 * the same shape as `feedbackUrl`. It goes **undefined** once the retention
 * sweep deletes the bytes; the record survives so the portal and the receipt can
 * still say what was sent. `isAvailable` is the honest way to ask.
 */

/** The four folders, as one union. Matches the `file_kind` enum. */
export const FILE_KINDS = [
  "intake",
  "intake_translation",
  "response",
  "response_translation",
] as const;

export type FileKind = (typeof FILE_KINDS)[number];

/**
 * Which side of the workflow a kind belongs to — the question nearly every
 * caller actually asks, since "show me the customer's files" means both the
 * originals and their translation.
 *
 * A Record, not a list, so a fifth kind can't be added without deciding.
 */
const SIDE_OF: Record<FileKind, "intake" | "response"> = {
  intake: "intake",
  intake_translation: "intake",
  response: "response",
  response_translation: "response",
};

export const INTAKE_KINDS: readonly FileKind[] = FILE_KINDS.filter(
  (kind) => SIDE_OF[kind] === "intake",
);

export const RESPONSE_KINDS: readonly FileKind[] = FILE_KINDS.filter(
  (kind) => SIDE_OF[kind] === "response",
);

/** True for a file the customer sent us, translated or not. */
export function isIntake(file: Pick<SubmissionFile, "kind">): boolean {
  return SIDE_OF[file.kind] === "intake";
}

/** True for a file the coach wrote back, translated or not. */
export function isResponse(file: Pick<SubmissionFile, "kind">): boolean {
  return SIDE_OF[file.kind] === "response";
}

export interface SubmissionFile {
  id: string;
  submissionId: string;
  /** The name the customer's device gave it — display only, never a path. */
  filename: string;
  contentType: string;
  sizeBytes: number;
  fileUrl?: string;
  /** Which of the four folders this file sits in. */
  kind: FileKind;
  uploadedAt?: string;
}

/** What the app records once bytes are safely in storage. */
export interface NewSubmissionFile {
  submissionId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  fileUrl: string;
}

/** False once the sweep has removed the bytes. */
export function isAvailable(file: SubmissionFile): boolean {
  return !!file.fileUrl;
}

/**
 * Human-readable size. Binary units, one decimal past a kilobyte — "48.3 MB"
 * reads better next to an upload limit expressed in whole megabytes than
 * "50642944 bytes" does.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}
