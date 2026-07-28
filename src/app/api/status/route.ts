import { NextResponse } from "next/server";
import { findByCustomerEmail } from "@/integrations/airtable/submissions";
import type { SubmissionStatus } from "@/types/submission";

/**
 * Email-as-identity status lookup.
 *
 * The email is never verified, so this returns only non-sensitive, customer-
 * authored data keyed on the exact address entered. Internal fields — Stripe
 * and Mux IDs, internal notes, the amount paid — are deliberately not mapped
 * across. Adding a field to `PublicSubmission` means deciding it's safe to hand
 * to anyone who can guess an email address.
 *
 * TODO(2026-07-28, Ben): rate limit to 5 requests per IP per minute
 * (CLAUDE.md Sprint 5). Without it this endpoint enumerates customers.
 */
export interface PublicSubmission {
  submissionId?: number;
  playerName: string;
  focus?: string;
  status: SubmissionStatus;
  submittedAt?: string;
  feedbackVideoUrl?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: { customerEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const customerEmail = (body.customerEmail ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(customerEmail)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const submissions = await findByCustomerEmail(customerEmail);

    const publicSubmissions: PublicSubmission[] = submissions.map(
      (submission) => ({
        submissionId: submission.submissionId,
        playerName: submission.playerName || "Player",
        focus: submission.focus,
        status: submission.status,
        submittedAt: submission.submittedAt,
        // The feedback link is only theirs to see once the review is finished.
        feedbackVideoUrl:
          submission.status === "Complete"
            ? submission.feedbackVideoUrl
            : undefined,
      }),
    );

    return NextResponse.json({ submissions: publicSubmissions });
  } catch (err) {
    console.error("[status] lookup failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 502 },
    );
  }
}
