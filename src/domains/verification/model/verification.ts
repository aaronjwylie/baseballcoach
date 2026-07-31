/**
 * Email verification — proving the address a customer typed is one they can
 * actually read, before we let them upload anything.
 *
 * **This is not a login** (CLAUDE.md §2). It creates no account, no password
 * and nothing to sign into; it is a one-time check on one submission. The
 * capability it grants lives in the flow cookie and expires in hours.
 *
 * Why it exists at all: payment used to be the gate on uploading. With payment
 * moved last, something has to stop an anonymous visitor pushing files at us,
 * and it may as well be the thing that also guarantees we can deliver the
 * feedback — a wrong email address is the one failure the customer cannot
 * recover from on their own.
 */
import { z } from "zod";

export const CODE_LENGTH = 6;

/**
 * Ten minutes. Long enough to switch to a mail app and back on a phone,
 * including a slow delivery; short enough that a code left visible on a shared
 * screen stops being useful quickly.
 */
export const CODE_TTL_MINUTES = 10;

/**
 * Five wrong guesses burns the code and forces a resend.
 *
 * A 6-digit code is one in a million per guess, so five attempts is nowhere near
 * enough to brute-force; the cap exists to make automated grinding pointless
 * rather than to protect against a lucky guess.
 */
export const MAX_ATTEMPTS = 5;

/** Only digits, exactly `CODE_LENGTH` of them. */
export const codeSchema = z
  .string()
  .trim()
  .regex(
    new RegExp(`^\\d{${CODE_LENGTH}}$`),
    `Enter the ${CODE_LENGTH}-digit code from your email.`,
  );

/** Why a verification attempt failed — the UI maps these to sentences. */
export type VerificationFailure =
  | "no_code"
  | "expired"
  | "too_many_attempts"
  | "mismatch";

export type VerificationResult =
  | { ok: true }
  | { ok: false; reason: VerificationFailure };

/** One sentence per failure, so the wording lives in one place. */
export const VERIFICATION_MESSAGES: Record<VerificationFailure, string> = {
  no_code: "We haven't sent a code yet. Ask for a new one below.",
  expired: `That code has expired. Codes last ${CODE_TTL_MINUTES} minutes — ask for a new one below.`,
  too_many_attempts:
    "Too many incorrect attempts. Ask for a new code to try again.",
  mismatch: "That code doesn't match. Check the email and try again.",
};
