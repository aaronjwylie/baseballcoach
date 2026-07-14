/**
 * Shared shape + validation for the player info collected before checkout.
 * This info rides along on Stripe Checkout `metadata` and is later written
 * into the Airtable row, so keep field values within Stripe's 500-char limit.
 */

export const FOCUS_OPTIONS = [
  "Hitting",
  "Pitching",
  "Fielding",
  "Catching",
  "Other",
] as const;

export type Focus = (typeof FOCUS_OPTIONS)[number];

export interface SubmissionInput {
  email: string;
  playerName: string;
  playerAge?: string;
  focus?: Focus;
  notes?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate and normalize a raw payload (from JSON or FormData) into a
 * SubmissionInput. Returns either the clean value or a field error message.
 */
export function parseSubmission(
  raw: Record<string, unknown>,
): { ok: true; value: SubmissionInput } | { ok: false; error: string } {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const email = str(raw.email).toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const playerName = str(raw.playerName);
  if (playerName.length < 1 || playerName.length > 120) {
    return { ok: false, error: "Please enter the player's name." };
  }

  const playerAge = str(raw.playerAge).slice(0, 20) || undefined;

  const rawFocus = str(raw.focus);
  const focus = (FOCUS_OPTIONS as readonly string[]).includes(rawFocus)
    ? (rawFocus as Focus)
    : undefined;

  const notes = str(raw.notes).slice(0, 500) || undefined;

  return { ok: true, value: { email, playerName, playerAge, focus, notes } };
}
