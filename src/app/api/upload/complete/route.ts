import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeUpload, checkFile, registerUpload } from "@/domains/upload";

/**
 * Record a file the browser uploaded straight to Blob.
 *
 * The browser reports where the object landed, so **none of it is trusted**:
 * the gate runs again, the size and type are re-checked against the operator's
 * limits, and `registerUpload` refuses any locator that isn't inside this
 * submission's own folder. The worst a tampered payload can do is fail.
 */
const bodySchema = z.object({
  fileUrl: z.string().url().max(2048),
  pathname: z.string().min(1).max(1024),
  filename: z.string().min(1).max(255),
  contentType: z.string().max(255).optional(),
  sizeBytes: z.number().int().positive(),
});

export async function POST(request: Request) {
  const decision = await authorizeUpload();
  if (!decision.ok) {
    return NextResponse.json(
      { error: decision.refusal.error },
      { status: decision.refusal.status },
    );
  }
  const { permit } = decision;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload details." }, { status: 400 });
  }

  const refusal = checkFile(permit, parsed.data.filename, parsed.data.sizeBytes);
  if (refusal) {
    return NextResponse.json({ error: refusal.error }, { status: refusal.status });
  }

  try {
    const file = await registerUpload(permit.submission.id, parsed.data);
    if (!file) {
      return NextResponse.json(
        { error: "That upload doesn't belong to this submission." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      file: {
        id: file.id,
        filename: file.filename,
        sizeBytes: file.sizeBytes,
      },
    });
  } catch (err) {
    console.error("[upload/complete] failed:", err);
    return NextResponse.json(
      { error: "We couldn't save that file. Please try again." },
      { status: 502 },
    );
  }
}
