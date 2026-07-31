# 011 — The browser uploads straight to Blob

**Status:** Accepted (2026-07-30, Ben). Fixes a latent production bug found while
building [ADR 009](009-upload-before-payment.md).

## Problem

`/api/upload` read the whole file through a Next.js route handler
(`await request.arrayBuffer()`), then handed the bytes to the storage seam.

**On Vercel that cannot work.** A serverless function's request body is capped at
roughly 4.5 MB. A phone video is 20–200 MB. The route worked perfectly in
development, where `next dev` has no such cap and the local-disk driver is
sitting on the same machine — so the failure was invisible until a real customer
on real infrastructure tried to send a real video.

Nothing had caught it because nobody had uploaded a large file to a deployed
build. It is exactly the class of bug that only appears in production.

## Decision

**In production the browser uploads directly to Vercel Blob**, using a
short-lived client token our server issues:

1. `upload()` (from `@vercel/blob/client`) asks `/api/upload/blob` for a token.
2. That route runs the full upload gate, checks the proposed pathname is inside
   *this* submission's folder, and scopes the token to the allowed content types
   and the operator's size limit.
3. The bytes go browser → Blob. Our function never sees them.
4. The browser calls `/api/upload/complete`, which re-checks everything and
   records the file.

**In development the old proxied path stays**, because there is no Blob store to
upload to. Which path the browser takes is decided by `supportsDirectUpload` on
the storage driver — the seam already existed (ADR 006), so this added a property
to it rather than a branch in the callers.

## Why not `onUploadCompleted`

The SDK offers a callback Vercel invokes when an upload finishes, which is the
documented place to write the database row. It is not used here: Vercel calls it
from its own network, which cannot reach a developer's laptop. Recording the file
there would work in production and silently fail in dev — the same shape of bug
this ADR exists to fix. The browser calls us back instead, and
`registerUpload` treats the reported locator as untrusted: it must be an https
Blob URL inside the submission's own folder, or it's refused.

## Consequences

- **Dev and prod take different code paths.** Mitigated by keeping both behind
  one `uploadFile()` call and one server-side gate, and by `npm run flow`, which
  exercises the storage seam directly.
- **Real progress reporting**, which the multi-file card UI needs. `fetch` still
  cannot report upload progress, so the dev path uses `XMLHttpRequest`; the Blob
  path uses the SDK's `onUploadProgress`.
- **Large files get multipart** (over 8 MB), so a phone changing cell towers
  retries a part instead of losing the whole upload.
- **The submission id is now visible to the customer's own browser**, since it
  forms the upload folder. That grants nothing: the flow cookie is the
  capability, and the id was already exposed by the status lookup.
