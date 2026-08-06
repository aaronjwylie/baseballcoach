import { NextResponse } from "next/server";
import { getCoach } from "@/domains/operator";
import { storage } from "@/shared/storage";

/**
 * A coach's public photo, by coach id.
 *
 * No auth — it's marketing shown on the public site — but the bytes live in a
 * private blob, so we stream them here rather than hand out the storage URL.
 * Cached briefly, since a photo changes rarely.
 */
export const maxDuration = 60;

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const coach = await getCoach(id);
  if (!coach?.imageUrl) return new Response("Not found", { status: 404 });

  const opened = await storage.open(coach.imageUrl);
  if (opened.redirectTo) return NextResponse.redirect(opened.redirectTo);

  return new Response(opened.stream, {
    headers: {
      "Content-Type": opened.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      ...(opened.size ? { "Content-Length": String(opened.size) } : {}),
    },
  });
}
