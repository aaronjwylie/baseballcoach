/**
 * Attaching a video to a submission.
 *
 * The file comes in through our own upload route (browser → us → storage),
 * unlike the old Mux direct-upload. We save it via the `shared/storage` seam
 * (local disk in dev, Blob in prod) and move the submission to `new`.
 */
import { storage, videoKey } from "@/shared/storage";
import { updateSubmission, type Submission } from "@/domains/submission";

export async function storeVideo(
  submissionId: string,
  filename: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<Submission> {
  const key = videoKey(submissionId, filename);
  const videoUrl = await storage.save(key, bytes, contentType);
  return updateSubmission(submissionId, { videoUrl, status: "new" });
}
