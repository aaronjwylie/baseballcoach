/**
 * Attaching files to a submission.
 *
 * Two paths in, one record out:
 *
 * - **direct** (prod): the browser uploads straight to Blob with a short-lived
 *   token, then calls back here with the locator to register. `registerUpload`
 *   is that callback, and it re-checks that the locator really sits inside this
 *   submission's folder — the browser supplies it, so it cannot be trusted.
 * - **proxied** (dev): the bytes come through our own route and
 *   `storeUploadedFile` saves them via the storage seam.
 *
 * Both end at `addSubmissionFile`, so the row is written in one place whichever
 * way the bytes arrived.
 */
import { storage, submissionFileKey, submissionFolder } from "@/shared/storage";
import { addSubmissionFile, type SubmissionFile } from "@/domains/submission";
import { resolveContentType } from "../model/fileTypes";

/** The proxied path: we hold the bytes, so we save them ourselves. */
export async function storeUploadedFile(
  submissionId: string,
  filename: string,
  bytes: Uint8Array,
  browserContentType: string | undefined,
): Promise<SubmissionFile> {
  const contentType = resolveContentType(filename, browserContentType);
  const key = submissionFileKey(submissionId, filename);
  const fileUrl = await storage.save(key, bytes, contentType);

  return addSubmissionFile({
    submissionId,
    filename,
    contentType,
    sizeBytes: bytes.byteLength,
    fileUrl,
  });
}

/**
 * The direct path: the bytes are already in Blob, we record where.
 *
 * Returns null if the locator doesn't belong to this submission. That check is
 * the whole reason this isn't a straight insert — without it, a caller holding
 * a valid flow cookie could register *any* URL, including another customer's
 * object, and the coach portal would happily serve it to them.
 */
export async function registerUpload(
  submissionId: string,
  input: {
    fileUrl: string;
    pathname: string;
    filename: string;
    contentType?: string;
    sizeBytes: number;
  },
): Promise<SubmissionFile | null> {
  const folder = submissionFolder(submissionId);
  if (!input.pathname.startsWith(`${folder}/`)) return null;
  if (!isUnderOurStore(input.fileUrl, input.pathname)) return null;

  return addSubmissionFile({
    submissionId,
    filename: input.filename,
    contentType: resolveContentType(input.filename, input.contentType),
    sizeBytes: input.sizeBytes,
    fileUrl: input.fileUrl,
  });
}

/**
 * The locator must be an https Blob URL whose path ends in the pathname we just
 * authorized. Blob may append a random suffix, so this is a prefix match on the
 * final segment rather than an equality check.
 */
function isUnderOurStore(fileUrl: string, pathname: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(fileUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (!parsed.hostname.endsWith(".blob.vercel-storage.com")) return false;

  const folder = pathname.slice(0, pathname.lastIndexOf("/"));
  return parsed.pathname.startsWith(`/${folder}/`);
}
