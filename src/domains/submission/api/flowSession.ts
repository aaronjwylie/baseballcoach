/**
 * The customer's handle on their own in-progress submission.
 *
 * Payment used to be the gate on uploading — the upload route verified a
 * succeeded PaymentIntent, so nobody could store a file without paying. Payment
 * is now the *last* step, so that gate is gone and this replaces it: a signed,
 * httpOnly cookie naming the one submission this browser started.
 *
 * **This is not a customer account** (CLAUDE.md §2). There is no password, no
 * profile, nothing to sign into, and it expires in hours. It is a capability
 * for one submission, and the browser cannot forge or edit it — the payload is
 * signed with AUTH_SECRET.
 *
 * It deliberately carries **only the submission id**. Whether the email has been
 * verified lives on the row (`emailVerifiedAt`), so there is one home for that
 * fact and a stale cookie can never claim a verification that didn't happen.
 *
 * **Ten minutes, and it slides.** Every action the customer takes re-issues the
 * cookie, so the clock measures *idleness*, not total time — which matters
 * because uploading a 50 MB clip on hotel wifi can legitimately take longer than
 * the whole window. An absolute ten minutes would expire people mid-upload.
 *
 * It was six hours; Yuta asked for ten minutes (2026-07-30) so an abandoned
 * half-finished submission doesn't greet the next person on a shared machine.
 * The sliding behaviour is what makes that short window survivable.
 */
import { readSignedCookie, setSignedCookie, clearSignedCookie } from "@/shared/auth";

const FLOW_COOKIE = "bs_flow";

/** Idle timeout. Refreshed by `touchFlowSession` on every action. */
export const FLOW_MAX_AGE_S = 60 * 10;

interface FlowPayload {
  submissionId: string;
}

export async function setFlowSession(submissionId: string): Promise<void> {
  return setSignedCookie(FLOW_COOKIE, { submissionId }, FLOW_MAX_AGE_S);
}

/**
 * Push the expiry back, if there's still a live session.
 *
 * Called by anything the customer actively does. Deliberately a no-op when the
 * cookie has already expired — reviving a dead session would defeat the point.
 *
 * Only usable where cookies can be written: Server Actions and Route Handlers.
 * A Server Component render cannot, which is why simply *looking* at the page
 * doesn't extend the window.
 */
export async function touchFlowSession(): Promise<void> {
  const submissionId = await readFlowSession();
  if (submissionId) await setFlowSession(submissionId);
}

/** The submission this browser is working on, or null. */
export async function readFlowSession(): Promise<string | null> {
  const payload = await readSignedCookie<FlowPayload>(FLOW_COOKIE);
  return payload?.submissionId ?? null;
}

export async function clearFlowSession(): Promise<void> {
  return clearSignedCookie(FLOW_COOKIE);
}
