import { NextResponse } from "next/server";
import { lookupPublicSubmissions, parseLookupInput } from "@/domains/submission";
import { clientIdentifier, rateLimit } from "@/shared/lib";

/**
 * Email-as-identity status lookup.
 *
 * HTTP only. What's safe to expose is decided by `PublicSubmission` in the
 * submission domain — deliberately not here, because that's a security
 * decision rather than a serialization one.
 */

/**
 * The endpoint takes an unverified email and says whether it has submissions,
 * so without a limit it enumerates customers. Five per minute is generous for
 * a human checking their own status and useless for a scraper.
 *
 * See `shared/lib/rateLimit.ts` for what this does and does not protect
 * against — it's a speed bump, and knowingly so.
 */
const LOOKUP_LIMIT = { limit: 5, windowSeconds: 60 };

export async function POST(request: Request) {
  const limit = rateLimit(
    `status:${clientIdentifier(request)}`,
    LOOKUP_LIMIT,
  );
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many lookups. Please wait a moment and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
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
    const submissions = await lookupPublicSubmissions(parsed.customerEmail);
    return NextResponse.json({ submissions });
  } catch (err) {
    console.error("[status] lookup failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 502 },
    );
  }
}
