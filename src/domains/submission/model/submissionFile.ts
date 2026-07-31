/**
 * One file a customer uploaded, as the app sees it.
 *
 * Replaced the single `videoUrl` field on `Submission` when the flow moved to
 * multi-file uploads. A submission may now carry a clip, a couple of stills, and
 * a coach's old report together, and the receipt email lists them by name.
 *
 * `fileUrl` is the storage locator — a local key in dev, a Blob URL in prod,
 * the same shape as `feedbackUrl`. It goes **undefined** once the retention
 * sweep deletes the bytes; the record survives so the portal and the receipt can
 * still say what was sent. `isAvailable` is the honest way to ask.
 */

export interface SubmissionFile {
  id: string;
  submissionId: string;
  /** The name the customer's device gave it — display only, never a path. */
  filename: string;
  contentType: string;
  sizeBytes: number;
  fileUrl?: string;
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
