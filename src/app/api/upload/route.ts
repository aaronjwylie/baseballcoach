import { NextResponse } from "next/server";
import { authorizeUpload, checkFile, storeUploadedFile } from "@/domains/upload";

/**
 * The **development** upload path: bytes through us, onto local disk.
 *
 * Production does not use this. Vercel caps a serverless request body at about
 * 4.5 MB, so a real video cannot arrive this way — there, the browser uploads
 * straight to Blob (`/api/upload/blob` + `/api/upload/complete`). Which path the
 * browser takes is decided by `storage.supportsDirectUpload`, not by guessing.
 *
 * The gate is `authorizeUpload`: a flow cookie naming a submission, a verified
 * email, and room under the file limit. Same gate as the direct path.
 */
export async function POST(request: Request) {
  const decision = await authorizeUpload();
  if (!decision.ok) {
    return NextResponse.json(
      { error: decision.refusal.error },
      { status: decision.refusal.status },
    );
  }
  const { permit } = decision;

  const url = new URL(request.url);
  const filename = url.searchParams.get("filename")?.trim();
  if (!filename) {
    return NextResponse.json({ error: "Missing filename." }, { status: 400 });
  }

  try {
    const bytes = new Uint8Array(await request.arrayBuffer());

    const refusal = checkFile(permit, filename, bytes.byteLength);
    if (refusal) {
      return NextResponse.json(
        { error: refusal.error },
        { status: refusal.status },
      );
    }

    const file = await storeUploadedFile(
      permit.submission.id,
      filename,
      bytes,
      request.headers.get("content-type") ?? undefined,
    );

    return NextResponse.json({
      file: {
        id: file.id,
        filename: file.filename,
        sizeBytes: file.sizeBytes,
      },
    });
  } catch (err) {
    console.error("[upload] failed:", err);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 502 },
    );
  }
}
