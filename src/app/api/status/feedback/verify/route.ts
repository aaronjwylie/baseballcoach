import { NextResponse } from "next/server";
import { z } from "zod";
import { clearSignedCookie, readSignedCookie } from "@/shared/auth";
import { clientIdentifier, rateLimit } from "@/shared/lib";
import {
  FEEDBACK_CODE_COOKIE,
  verifyFeedbackViewCode,
  type PendingFeedbackCode,
} from "@/domains/feedback";

/**
 * Check an access code and, on a match, return **the customer's whole view** —
 * their submissionTable and any feedback ready to download.
 *
 * The bcrypt check is the whole gate, so the endpoint is rate-limited to keep a
 * 6-digit code out of brute-force range within its 10-minute life. A miss
 * returns a generic error; the caller can retry until the cookie expires.
 */
const LIMIT = { limit: 8, windowSeconds: 60 };

const bodySchema = z.object({
  customerEmail: z.string().email().max(320),
  code: z.string().trim().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const limit = rateLimit(`fbverify:${clientIdentifier(request)}`, LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter the 6-digit code from your email." },
      { status: 400 },
    );
  }

  try {
    const pending = await readSignedCookie<PendingFeedbackCode>(
      FEEDBACK_CODE_COOKIE,
    );
    const access = await verifyFeedbackViewCode(
      pending,
      parsed.data.customerEmail,
      parsed.data.code,
    );
    if (!access) {
      return NextResponse.json(
        { error: "That code didn't match. Check it and try again." },
        { status: 400 },
      );
    }
    // Single-use: a matched code is spent.
    await clearSignedCookie(FEEDBACK_CODE_COOKIE);
    // The whole view, not just the downloads: the code proved the inbox, and
    // both belong to whoever controls it.
    return NextResponse.json(access);
  } catch (err) {
    console.error("[status/feedback/verify] failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 502 },
    );
  }
}
