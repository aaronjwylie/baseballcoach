import { mux } from "@/lib/mux";
import {
  getSubmission,
  findByMuxUploadId,
  updateSubmission,
} from "@/integrations/airtable/submissions";
import type { Submission, SubmissionPatch } from "@/types/submission";
import { sendUploadReceived } from "@/lib/email";

/**
 * Mux → Airtable glue. When an uploaded asset becomes ready we move the
 * submission to "New" — uploaded, needs a coach — stash the asset and playback
 * IDs, and email the customer that their video arrived. Errored assets go back
 * to "Awaiting Upload" with a note, so Yuta can spot them in the base.
 *
 * The submission is located via the asset `passthrough`, which holds its
 * Airtable record ID (ADR 002), falling back to the Mux upload ID. Handlers are
 * idempotent — the received email only fires on the first transition out of
 * "Awaiting Upload".
 */
export async function POST(request: Request) {
  const body = await request.text();

  let event;
  try {
    event = await mux().webhooks.unwrap(body, request.headers);
  } catch (err) {
    console.error("[mux webhook] signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "video.asset.ready":
        await handleAssetReady(event.data);
        break;
      case "video.asset.errored":
        await handleAssetErrored(event.data);
        break;
      default:
        // Ignore the many other Mux event types.
        break;
    }
  } catch (err) {
    console.error(`[mux webhook] handler error for ${event.type}:`, err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

interface AssetData {
  id: string;
  passthrough?: string;
  upload_id?: string;
  playback_ids?: Array<{ id: string }>;
}

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

  const isFirstTransition = submission.status === "Awaiting Upload";

  const patch: SubmissionPatch = {
    status: "New",
    muxAssetId: data.id,
  };
  const playbackId = data.playback_ids?.[0]?.id;
  if (playbackId) patch.muxPlaybackId = playbackId;

  await updateSubmission(submission.id, patch);

  if (isFirstTransition && submission.customerEmail) {
    await sendUploadReceived(submission.customerEmail, submission.playerName);
  }
}

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
