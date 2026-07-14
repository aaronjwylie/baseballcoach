import { NextResponse } from "next/server";
import { findByEmail } from "@/lib/airtable";

/**
 * Email-as-identity status lookup. Returns a sanitized list of the caller's
 * submissions — never internal fields (Stripe/Mux IDs, coach assignment).
 * Email is not verified, so we only ever expose non-sensitive, self-authored
 * data keyed on the exact address entered.
 */
export interface PublicSubmission {
  playerName: string;
  focus?: string;
  status: "Awaiting Upload" | "In Review" | "Complete";
  createdAt?: string;
  feedbackLink?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const records = await findByEmail(email);
    const submissions: PublicSubmission[] = records.map((record) => {
      const f = record.fields;
      return {
        playerName: f["Player Name"] ?? "Player",
        focus: f.Sport,
        status: f.Status ?? "Awaiting Upload",
        createdAt: f["Created At"],
        // Only expose the feedback link once the review is complete.
        feedbackLink:
          f.Status === "Complete" ? f["Feedback Link"] : undefined,
      };
    });
    return NextResponse.json({ submissions });
  } catch (err) {
    console.error("[status] lookup failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 502 },
    );
  }
}
