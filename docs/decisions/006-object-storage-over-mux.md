# 006 — Vercel Blob over Mux for download-only review

**Status:** Accepted (2026-07-29) · Supersedes Mux in CLAUDE.md §4/§7 and retires
[ADR 002](002-passthrough-holds-record-id.md)

## Problem

The coach reviews footage by **downloading the file and scrubbing it locally**
(QuickTime / Coach's Eye), frame by frame — that's how the "frame-by-frame
breakdown" the product sells actually gets made. Nobody reviews off a browser
stream.

But Mux is a **streaming** platform. As built, an uploaded asset yields only
`https://stream.mux.com/{playbackId}.m3u8` (HLS) — not a file. There is **no
download link** unless we additionally enable static renditions (MP4). So today
we pay Mux for two things we don't use — transcoding and adaptive streaming — to
produce a playback URL the coach never opens, and still owe extra work to get the
one artifact we need: a downloadable file.

Mux's real value (codec normalization, HLS, a slick uploader) is aimed at a
viewing product. Ours is a *hand the coach the raw file* product.

## Options considered

**A. Keep Mux, enable MP4 static renditions.** One-line change, but keeps paying
Mux **encoding + storage + delivery** (~$25–30/mo at ~100 vids/mo, dominated by
$0.04/min encoding) for value we don't use, plus a whole vendor + webhook.

**B. Cloudflare R2.** Cheapest — zero egress, ~$3/mo at MVP — and most private,
but adds Cloudflare as a vendor and we build the uploader + any resumable logic.

**C. UploadThing.** Fast to ship, resumable handled, but adds a client-owned
vendor and download-metered pricing.

**D. Vercel Blob.** First-party Vercel object storage (`@vercel/blob`): client
uploads built in, multipart for large files, a direct URL per file with
`content-disposition` for download. Storage + data-transfer pricing, **no
encoding** — ~$3–6/mo at MVP volume.

### Cost shape (⚠️ estimates, ~100 vids/mo @ 200 MB, verify live pricing)

| | Mux | Vercel Blob | R2 |
| --- | --- | --- | --- |
| Encoding | ~$20/mo | — | — |
| Storage | ~$1–2/mo | ~$0.50/mo | ~$0.30/mo |
| Egress / transfer | few $ | ~$2–4/mo | **$0** |
| **Ballpark** | **~$25–30/mo** | **~$3–6/mo** | **~$3/mo** |

Mux is expensive because it charges for a transcode/stream engine this workflow
never touches. Store-and-serve (Blob/R2) is the right-shaped bill.

## Decision

**Use Vercel Blob.** Not Mux.

Blob is store-and-serve, which is exactly the need, and is **4–8× cheaper than
Mux** at MVP volume with no encoding line. Decisive factor over R2: **zero new
vendor.** We're already on Vercel — same account, dashboard, billing, and SDK, no
extra credentials for the client to own alongside Stripe/Airtable/Resend. The
lean-MVP northstar values that simplicity over the few dollars R2's zero-egress
model would save at this scale.

**R2 stays the documented exit** if download volume ever makes Blob's data
transfer the dominant cost — the storage abstraction should be thin enough that
switching is a driver change, not a rewrite.

## Consequences

- **Upload path:** `uploadApi.ts` mints a Blob client-upload token instead of a
  Mux direct upload; `UploadPanel.tsx` drops `@mux/mux-uploader-react` for the
  `@vercel/blob` client upload.
- **Webhook removed:** no transcode step to await, so `webhooks/mux` goes away —
  Blob's `onUploadCompleted` callback (or a small complete endpoint) flips the row
  to "New" and stores the blob key/URL. Simpler than today.
- **Schema migration** on the admin's live base: the three `Mux …` columns become a
  `Video URL` (coach-facing download link) + optional `Video Key`. **Fold into
  the Step-1 naming sweep** so it's one migration of the live base, not two —
  same discipline as [ADR 005](005-stripe-elements-over-checkout.md). Coordinate
  before real customers land.
- **`passthrough` (ADR 002) retired:** the record-ID linkage moves to the
  upload-token payload / complete-callback.
- **Coach link:** store the Blob URL directly, or front it with `/api/video/[id]`
  that checks the row and redirects — keeps the Airtable link stable and lets us
  swap drivers later without touching the base.
- **Env vars:** drop all `MUX_*`; add `BLOB_READ_WRITE_TOKEN`. Remove `@mux/*`
  deps; add `@vercel/blob`.
- **Go-live doc simplifies:** one fewer account for the client to own and one
  fewer webhook to re-point ([OPERATIONS.md](../../OPERATIONS.md)).
- **Sequencing:** not in CLAUDE.md §0's list. Slots alongside the Sprint-3
  (upload) work; the schema change rides the naming-sweep migration.
