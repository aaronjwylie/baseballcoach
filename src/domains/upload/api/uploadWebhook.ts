/**
 * Mux's inbound half — verifying its events and acting on them.
 *
 * This is where a video becomes a submission's video: the asset and playback
 * ids get stored, the status moves to "New", and the customer is told.
 */
import { mux } from "@/shared/mux/client";
import {
  findByMuxUploadId,
  getSubmission,
  updateSubmission,
  type Submission,
  type SubmissionPatch,
} from "@/domains/submission";
import { sendVideoReceived } from "./uploadEmail";

/** The asset fields we use. Mux sends far more. */
interface AssetData {
  id: string;
  passthrough?: string;
  upload_id?: string;
  playback_ids?: Array<{ id: string }>;
}

export interface MuxEvent {
  type: string;
  data: AssetData;
}

/**
 * Verify a webhook delivery and return the event, or null if it isn't genuine.
 * Needs the raw body and the original headers — the SDK reads the signature
 * header itself.
 */
export async function verifyMuxWebhook(
  rawBody: string,
  headers: Headers,
): Promise<MuxEvent | null> {
  try {
    return (await mux().webhooks.unwrap(rawBody, headers)) as MuxEvent;
  } catch (err) {
    console.error("[mux webhook] signature verification failed:", err);
    return null;
  }
}

/** Act on a verified event. Unhandled types are a no-op — Mux sends many. */
export async function handleMuxEvent(event: MuxEvent): Promise<void> {
  switch (event.type) {
    case "video.asset.ready":
      await handleAssetReady(event.data);
      break;
    case "video.asset.errored":
      await handleAssetErrored(event.data);
      break;
    default:
      break;
  }
}

/**
 * Find the submission this asset belongs to.
 *
 * `passthrough` holds the Airtable record id, so the happy path is a direct
 * fetch by id rather than a formula search (ADR 002). The upload-id lookup is
 * a fallback that has not been observed to trigger.
 */
async function locate(data: AssetData): Promise<Submission | null> {
  if (data.passthrough) {
    const byId = await getSubmission(data.passthrough);
    if (byId) return byId;
  }
  if (data.upload_id) {
    return findByMuxUploadId(data.upload_id);
  }
  return null;
}

async function handleAssetReady(data: AssetData) {
  const submission = await locate(data);
  if (!submission) {
    console.warn(`[mux webhook] no submission for asset ${data.id}`);
    return;
  }

  // Idempotency: a redelivered webhook finds the row already moved on, so the
  // email fires only on the first transition out of "Awaiting Upload".
  const isFirstTransition = submission.status === "Awaiting Upload";

  const patch: SubmissionPatch = { status: "New", muxAssetId: data.id };
  const playbackId = data.playback_ids?.[0]?.id;
  if (playbackId) patch.muxPlaybackId = playbackId;

  await updateSubmission(submission.id, patch);

  if (isFirstTransition && submission.customerEmail) {
    await sendVideoReceived(submission.customerEmail, submission.playerName);
  }
}

/**
 * A failed asset goes back to "Awaiting Upload" — the customer's next action is
 * identical to someone who never uploaded, so a distinct error status would add
 * a queue state with no distinct handling. The note carries the detail.
 */
async function handleAssetErrored(data: AssetData) {
  const submission = await locate(data);
  if (!submission) return;

  // System messages go to Internal Notes, never Customer Notes — the customer's
  // own words stay untouched so they can be forwarded to a coach as written.
  await updateSubmission(submission.id, {
    status: "Awaiting Upload",
    internalNotes: appendNote(
      submission.internalNotes,
      `[system] Mux reported an error processing asset ${data.id}.`,
    ),
  });
}

function appendNote(existing: string | undefined, line: string): string {
  return existing ? `${existing}\n${line}` : line;
}
