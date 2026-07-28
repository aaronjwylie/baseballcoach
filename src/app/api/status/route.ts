import { NextResponse } from "next/server";
import { isValidEmail, lookupPublicSubmissions } from "@/domains/submission";

/**
 * Email-as-identity status lookup.
 *
 * HTTP only. What's safe to expose is decided by `PublicSubmission` in the
 * submission domain — deliberately not here, because that's a security
 * decision rather than a serialization one.
 *
 * TODO(2026-07-28, Ben): rate limit to 5 requests per IP per minute
 * (CLAUDE.md Sprint 5). Without it this endpoint enumerates customers.
 */
export async function POST(request: Request) {
  let body: { customerEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const customerEmail = (body.customerEmail ?? "").trim().toLowerCase();
  if (!isValidEmail(customerEmail)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const submissions = await lookupPublicSubmissions(customerEmail);
    return NextResponse.json({ submissions });
  } catch (err) {
    console.error("[status] lookup failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 502 },
    );
  }
}
