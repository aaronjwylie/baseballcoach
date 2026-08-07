/**
 * The forgot-password flow's engine.
 *
 * The reset link carries a signed token bound to the current password hash, so
 * it's **single-use without a schema change**: setting a new password changes
 * the hash, and the spent token's binding no longer matches. Short-lived (one
 * hour), and signed with AUTH_SECRET like the session, so it can't be forged.
 */
import { signSession, verifySessionToken } from "@/shared/auth/token";
import { env } from "@/shared/config/env";
import { findOperatorByEmail } from "./operatorApi";
import {
  passwordFingerprint,
  setOperatorPassword,
} from "@/domains/account";
import { sendPasswordResetEmail } from "./resetEmail";

const RESET_MAX_AGE_S = 60 * 60; // one hour
const PURPOSE = "pwreset";

interface ResetPayload {
  sub: string;
  ph: string;
  purpose: string;
}

/**
 * Email a reset link if the address belongs to an operator. Resolves the same
 * way whether or not it does, so a caller can never learn which addresses have
 * accounts.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  const operator = await findOperatorByEmail(clean);
  if (!operator) return;

  const fingerprint = await passwordFingerprint(operator.id);
  if (!fingerprint) return;

  const token = await signSession(
    { sub: operator.id, ph: fingerprint, purpose: PURPOSE },
    RESET_MAX_AGE_S,
  );
  const link = `${env.siteUrl}/reset-password?token=${encodeURIComponent(token)}`;
  await sendPasswordResetEmail(clean, link);
}

export type ResetOutcome = { ok: true } | { ok: false; error: string };

const STALE =
  "This reset link is invalid, already used, or expired. Request a new one.";

export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<ResetOutcome> {
  const payload = await verifySessionToken<ResetPayload>(token);
  if (!payload || payload.purpose !== PURPOSE) return { ok: false, error: STALE };

  // A mismatch means the password already changed since the link was issued —
  // the link is single-use and this one is spent. A missing operator lands in
  // the same branch, which is the safe direction for a null to fall.
  const fingerprint = await passwordFingerprint(payload.sub);
  if (fingerprint !== payload.ph) return { ok: false, error: STALE };

  await setOperatorPassword(payload.sub, newPassword);
  return { ok: true };
}
