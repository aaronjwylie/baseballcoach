# 006 — Object storage over Mux for download-only review

**Status:** Proposed (2026-07-29, Aaron) · **Needs Ben's call** · Would supersede
Mux in CLAUDE.md §4/§7 and [ADR 002](002-passthrough-holds-record-id.md)

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

## Options

**A. Keep Mux, enable MP4 static renditions.** One-line asset-settings change;
each asset gets a downloadable MP4. But we keep paying Mux encoding + storage +
delivery (~$20+/mo at MVP volume) for value we don't use, and keep a whole vendor
+ webhook in the flow.

**B. Cloudflare R2** (S3-compatible object storage). Browser PUTs to a presigned
URL; coach downloads via a presigned GET.

**C. UploadThing** (Next.js-native upload service over S3). Ships a React
uploader and returns a file URL.

(Plain **AWS S3** is option B with per-GB egress fees on every download — R2 is
strictly cheaper for a download-heavy flow, so it's not carried forward.)

### B vs C — the real decision

| | **Cloudflare R2** | **UploadThing** |
| --- | --- | --- |
| **Cost @ MVP** (~100 vids/mo, 200 MB) | ~$0.30/mo storage, **zero egress** — downloads are free | Free tier (~2 GB), then usage-based; downloads count |
| **Cost at scale** | Egress stays free — scales cheapest | Grows with storage **and** download volume |
| **Integration effort** | Medium — `@aws-sdk/client-s3` + presigner, CORS, our own uploader | **Low** — SDK + `<UploadButton>`, presigning handled |
| **Upload UX** | We build it (plain input or `react-dropzone`) | Polished uploader, progress, retries included |
| **Large / flaky uploads** | Single presigned PUT (fine <5 GB); resumable = we build multipart | Chunked/resumable handled for us |
| **Vendor count for client** | Replaces Mux with Cloudflare — **net zero** new vendors (client already uses Cloudflare-class infra for DNS) | **Adds** a vendor + subscription the client owns alongside Stripe/Airtable/Resend |
| **Download link control** | Full — presigned expiry, private bucket, our `/api/video/[id]` redirect | Files served from their URL; access control is coarser |
| **Lock-in** | None — standard S3 API, portable to S3/B2/anywhere | Their SDK + service |
| **Ops burden** | Rotate R2 keys; manage a bucket | Almost none |

**Short version:** R2 is cheapest, most private, and adds no vendor — at the cost
of us writing the uploader and (if we want it) resumable logic. UploadThing is
fastest to ship and handles upload robustness for us — at the cost of a new
client-owned vendor and download-volume-sensitive pricing.

## Recommendation

**Replace Mux with object storage (not option A).** Between the two, I lean
**R2**: it fits the lean-cost northstar, keeps videos private behind presigned
links, and doesn't hand the client another subscription. **UploadThing** is the
right pick *if* we value shipping speed and built-in resumable uploads over the
few dollars and the extra vendor — a legitimate MVP trade. **Ben to decide.**

## Consequences (either B or C)

- **Upload path:** `uploadApi.ts` mints a presigned PUT (R2) / upload token (UT)
  instead of a Mux direct upload; `UploadPanel.tsx` drops
  `@mux/mux-uploader-react`.
- **Webhook removed:** no transcode step to await, so `webhooks/mux` likely goes
  away — the client pings a small endpoint on upload-complete to flip the row to
  "New" and store the object key. Simpler than today.
- **Schema migration** on Yuta's live base: the three `Mux …` columns become a
  `Video Key` + a coach-facing **download link**. Fold this into the Step-1
  naming sweep so it's one migration, not two — same discipline as [ADR
  005](005-stripe-elements-over-checkout.md).
- **Coach link:** a `/api/video/[id]` route that checks the row and 302s to a
  fresh presigned GET — keeps the Airtable link stable and private, no bare
  public objects.
- **`passthrough` (ADR 002)** no longer applies; the record-ID linkage moves to
  the presign request / complete-callback.
- **Env vars:** drop `MUX_*`; add R2 creds (`R2_ACCOUNT_ID`, key, secret, bucket)
  **or** `UPLOADTHING_TOKEN`. Remove `@mux/*` deps.
- **Go-live doc simplifies:** one fewer account for the client to own and one
  fewer webhook to re-point ([OPERATIONS.md](../../OPERATIONS.md)).
- **Sequencing:** this isn't in CLAUDE.md §0's list. If accepted, it slots
  alongside the Sprint-3 (upload) work rather than being ripped out mid-realign.

## Question for Ben

R2 (cheapest, private, no new vendor, we build the uploader) vs UploadThing
(fastest, resumable built in, adds a client vendor)? Once you pick, I'll write
the implementation plan against the naming-sweep migration.
