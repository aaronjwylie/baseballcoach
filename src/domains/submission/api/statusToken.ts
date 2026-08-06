/**
 * The status capability — an unguessable link straight to a customer's
 * submissionTable.
 *
 * **The link is the proof.** It only ever reaches an address that verified
 * itself at step 2 *and* paid at step 4, so holding it is stronger evidence than
 * anything the status page could ask for afterwards. Typing an email into a form
 * proves nothing at all — which is exactly why the two doors are different: the
 * link goes straight in, the typed address gets a 6-digit code.
 *
 * Signed and **purpose-bound**, so an operator session, a flow cookie, or a
 * feedback token can't stand in for it.
 *
 * It carries the **email**, not a submission id, because that's what the status
 * page is a view of: everything this customer has ever sent. The alternative — a
 * link per submission — would mean a customer with three reviews needing three
 * links to see three rows.
 *
 * Long-lived, deliberately. A customer digs out a months-old receipt precisely
 * when they've lost track of something, which is the worst moment to be told the
 * link has expired. What it can show is bounded by what the submissionTable
 * themselves still hold: once the sweep runs, the rows remain and the downloads
 * answer 410.
 */
import { signSession, verifySessionToken } from "@/shared/auth";

const STATUS_TOKEN_MAX_AGE_S = 60 * 60 * 24 * 365; // one year

interface StatusTokenPayload {
  /** The customer's email, already lowercased by the caller. */
  sub: string;
  purpose: "status";
}

export function signStatusToken(email: string): Promise<string> {
  return signSession(
    { sub: email.trim().toLowerCase(), purpose: "status" },
    STATUS_TOKEN_MAX_AGE_S,
  );
}

/**
 * The email this token speaks for, or null if it isn't a valid status token —
 * missing, forged, expired, or minted for a different purpose.
 */
export async function verifyStatusToken(
  token: string | undefined | null,
): Promise<string | null> {
  const payload = await verifySessionToken<StatusTokenPayload>(token);
  if (!payload || payload.purpose !== "status" || !payload.sub) return null;
  return payload.sub;
}
