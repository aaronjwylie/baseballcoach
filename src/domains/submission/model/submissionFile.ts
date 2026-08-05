/**
 * One stored file, either direction, as the app sees it.
 *
 * Replaced the single `videoUrl` field on `Submission` when the flow moved to
 * multi-file uploads. A submission may now carry a clip, a couple of stills, and
 * a coach's old report together, and the receipt email lists them by name.
 *
 * **The four folders live in `kind`.** `intake` is what the customer sent,
 * `response` is what the coach wrote back, and each has a translated
 * counterpart the admin uploads — stored *beside* the original, never replacing it.
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

/** The four folders, as one union. `./fileKindEnum.ts` derives the DB type from it. */
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

/**
 * Which language set someone receives — the choice the admin makes at steps 8 and 13.
 *
 * Not a property of the files, but of a **send**: it records what we handed to a
 * particular person on a particular day. Kept as data rather than a UI state
 * because "what did we actually give them?" is asked later, and re-deriving it
 * from which files exist now would answer a different question.
 */
export const FILE_SETS = ["original", "translation", "both"] as const;

export type FileSet = (typeof FILE_SETS)[number];

/**
 * Turn a side plus a choice into the kinds that make it up.
 *
 * The one place the four folders map onto the two radios. Both sends use it, so
 * "English only" can't mean one thing for the coach and another for the
 * customer, and a fifth kind can't be added without this function being the
 * place that decides where it belongs.
 */
export function kindsForSet(
  side: "intake" | "response",
  set: FileSet,
): FileKind[] {
  const original: FileKind = side === "intake" ? "intake" : "response";
  const translation: FileKind =
    side === "intake" ? "intake_translation" : "response_translation";

  if (set === "original") return [original];
  if (set === "translation") return [translation];
  return [original, translation];
}

/**
 * Which sets are worth offering, given what actually exists.
 *
 * A radio listing options that resolve to nothing is a trap, so a submission
 * with no translation offers no choice at all — the caller hides the control
 * rather than disabling it. "Both" only appears when there are genuinely two
 * things to choose between.
 */
export function availableSets(kinds: readonly FileKind[]): FileSet[] {
  const side = kinds.some(isIntakeKind) ? "intake" : "response";
  const hasOriginal = kinds.includes(kindsForSet(side, "original")[0]);
  const hasTranslation = kinds.includes(kindsForSet(side, "translation")[0]);

  if (hasOriginal && hasTranslation) return ["original", "translation", "both"];
  if (hasTranslation) return ["translation"];
  if (hasOriginal) return ["original"];
  return [];
}

function isIntakeKind(kind: FileKind): boolean {
  return SIDE_OF[kind] === "intake";
}

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
