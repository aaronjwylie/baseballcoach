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
 * Six hours: long enough to find the code, dig out the clips, and pay, without
 * leaving an upload capability lying around on a shared machine overnight.
 */
import { readSignedCookie, setSignedCookie, clearSignedCookie } from "@/shared/auth";

const FLOW_COOKIE = "bs_flow";
const FLOW_MAX_AGE_S = 60 * 60 * 6;

interface FlowPayload {
  submissionId: string;
}

export async function setFlowSession(submissionId: string): Promise<void> {
  return setSignedCookie(FLOW_COOKIE, { submissionId }, FLOW_MAX_AGE_S);
}

/** The submission this browser is working on, or null. */
export async function readFlowSession(): Promise<string | null> {
  const payload = await readSignedCookie<FlowPayload>(FLOW_COOKIE);
  return payload?.submissionId ?? null;
}

export async function clearFlowSession(): Promise<void> {
  return clearSignedCookie(FLOW_COOKIE);
}
