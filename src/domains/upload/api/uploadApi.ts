/**
 * Mux direct uploads — the upload domain's outbound I/O.
 *
 * The video goes browser → Mux and never touches our server. What we mint here
 * is permission: a one-time upload URL, issued only against a verified paid
 * session.
 */
import { mux } from "@/shared/mux/client";
import { env } from "@/shared/config/env";

/** How long a customer has to finish an upload before the URL expires. */
const UPLOAD_TIMEOUT_SECONDS = 3600;

/**
 * Create a direct-upload URL for a submission.
 *
 * `passthrough` carries the Airtable record ID, which is how the Mux webhook
 * finds the row when the asset is ready — a direct record fetch rather than a
 * formula search. See ADR 002.
 */
export async function createDirectUpload(
  submissionId: string,
): Promise<{ uploadUrl: string; uploadId: string }> {
  const upload = await mux().video.uploads.create({
    cors_origin: env.siteUrl,
    timeout: UPLOAD_TIMEOUT_SECONDS,
    new_asset_settings: {
      playback_policies: ["public"],
      passthrough: submissionId,
    },
  });

  if (!upload.url) {
    throw new Error("Mux did not return an upload URL");
  }
  return { uploadUrl: upload.url, uploadId: upload.id };
}
