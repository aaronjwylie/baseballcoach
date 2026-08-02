/**
 * The feedback capability token — an unguessable link to one submission's
 * feedback.
 *
 * The customer isn't logged in, and the status lookup identifies them by an
 * **unverified** email. So the feedback delivery cannot ride on that lookup, or
 * anyone who guessed an address could collect a stranger's review. Instead the
 * "your feedback is ready" email carries this signed token; only the holder of
 * the link reaches the files. It's the same URL-as-capability idea as an
 * unguessable id, but signed — it can't be forged, and it's bound to `purpose`
 * so an operator or flow token can't stand in for it.
 *
 * Long-lived on purpose: feedback files are never swept, so the deliverable the
 * customer paid for stays reachable from the email for a year.
 */
import { signSession, verifySessionToken } from "@/shared/auth";

const FEEDBACK_TOKEN_MAX_AGE_S = 60 * 60 * 24 * 365; // one year

interface FeedbackTokenPayload {
  sub: string; // submission id
  purpose: "feedback";
}

export function signFeedbackToken(submissionId: string): Promise<string> {
  return signSession(
    { sub: submissionId, purpose: "feedback" },
    FEEDBACK_TOKEN_MAX_AGE_S,
  );
}

/** The submission id the token grants access to, or null if it's not a valid
 * feedback token (missing, forged, expired, or the wrong purpose). */
export async function verifyFeedbackToken(
  token: string | undefined | null,
): Promise<string | null> {
  const payload = await verifySessionToken<FeedbackTokenPayload>(token);
  if (!payload || payload.purpose !== "feedback" || !payload.sub) return null;
  return payload.sub;
}
