import { NextResponse } from "next/server";
import { setSignedCookie } from "@/shared/auth";
import { clientIdentifier, rateLimit } from "@/shared/lib";
import { parseLookupInput } from "@/domains/submission";
import {
  FEEDBACK_CODE_COOKIE,
  FEEDBACK_CODE_TTL_S,
  issueFeedbackViewCode,
} from "@/domains/feedback";

/**
 * Send a feedback access code to a customer's inbox.
 *
 * Always answers `{ ok: true }`, whether or not the email has feedback — the
 * response must not confirm which addresses exist, and a code only actually
 * lands when there's a completed review to reveal. Rate-limited, because this
 * puts mail in someone else's inbox.
 */
const LIMIT = { limit: 5, windowSeconds: 60 };

export async function POST(request: Request) {
  const limit = rateLimit(`fbcode:${clientIdentifier(request)}`, LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = parseLookupInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const pending = await issueFeedbackViewCode(parsed.customerEmail);
    if (pending) {
      await setSignedCookie(FEEDBACK_CODE_COOKIE, pending, FEEDBACK_CODE_TTL_S);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[status/feedback/code] failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 502 },
    );
  }
}
