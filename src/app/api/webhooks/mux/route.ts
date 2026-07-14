import { mux } from "@/lib/mux";
import {
  getSubmission,
  findByUploadId,
  updateSubmission,
  type SubmissionRecord,
  type SubmissionFields,
} from "@/lib/airtable";
import { sendUploadReceived } from "@/lib/email";

/**
 * Mux → Airtable glue. When an uploaded asset becomes ready we move the
 * submission to "In Review", stash the asset + playback IDs, and email the
 * customer that their video was received. Errored assets flip status so the
 * client can spot them in Airtable.
 *
 * The submission is located via the asset `passthrough` (its Airtable record
 * ID), falling back to the Mux upload ID. Handlers are idempotent — the
 * received email only fires on the first transition out of "Awaiting Upload".
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

async function locate(data: AssetData): Promise<SubmissionRecord | null> {
  if (data.passthrough) {
    const byId = await getSubmission(data.passthrough);
    if (byId) return byId;
  }
  if (data.upload_id) {
    return findByUploadId(data.upload_id);
  }
  return null;
}

async function handleAssetReady(data: AssetData) {
  const record = await locate(data);
  if (!record) {
    console.warn(`[mux webhook] no submission for asset ${data.id}`);
    return;
  }

  const isFirstTransition = record.fields.Status === "Awaiting Upload";

  const fields: Partial<SubmissionFields> = {
    Status: "In Review",
    "Mux Asset ID": data.id,
  };
  const playbackId = data.playback_ids?.[0]?.id;
  if (playbackId) fields["Mux Playback ID"] = playbackId;

  await updateSubmission(record.id, fields);

  if (isFirstTransition && record.fields.Email) {
    await sendUploadReceived(record.fields.Email, record.fields["Player Name"]);
  }
}

async function handleAssetErrored(data: AssetData) {
  const record = await locate(data);
  if (!record) return;
  await updateSubmission(record.id, {
    Status: "Awaiting Upload",
    Notes: appendNote(
      record.fields.Notes,
      `[system] Mux reported an error processing asset ${data.id}.`,
    ),
  });
}

function appendNote(existing: string | undefined, line: string): string {
  return existing ? `${existing}\n${line}` : line;
}
