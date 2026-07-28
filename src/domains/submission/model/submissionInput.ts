/**
 * Validation for the player info collected before payment.
 *
 * Property names match the domain model in `src/types/submission.ts` — the form
 * field, this payload, the Stripe metadata key, and the Airtable column all use
 * the same word for the same thing.
 *
 * TODO(2026-07-28, Ben): replace with a Zod schema shared between this route
 * and the client form (CLAUDE.md §11, realignment Step 3). The hand-rolled
 * checks below are the current behaviour, not the target.
 */
import { FOCUS_OPTIONS, type Focus } from "../model/submission";

/**
 * Values ride on Stripe metadata, which caps each entry at 500 characters.
 * Notes are the only field that could realistically approach it.
 */
const MAX_NOTES_LENGTH = 500;
const MAX_EMAIL_LENGTH = 254;
const MAX_PLAYER_NAME_LENGTH = 120;
const MIN_PLAYER_AGE = 4;
const MAX_PLAYER_AGE = 99;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Is this a plausible email address?
 *
 * One home for the question — the checkout form and the status lookup both ask
 * it, and two regexes would drift into accepting different things.
 */
export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value) && value.length <= MAX_EMAIL_LENGTH;
}

export interface SubmissionInput {
  customerEmail: string;
  playerName: string;
  playerAge?: number;
  focus?: Focus;
  customerNotes?: string;
}

export type ParseResult =
  | { ok: true; value: SubmissionInput }
  | { ok: false; error: string };

export function parseSubmissionInput(
  raw: Record<string, unknown>,
): ParseResult {
  const text = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";

  const customerEmail = text(raw.customerEmail).toLowerCase();
  if (!isValidEmail(customerEmail)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const playerName = text(raw.playerName);
  if (playerName.length < 1) {
    return { ok: false, error: "Please enter the player's name." };
  }
  if (playerName.length > MAX_PLAYER_NAME_LENGTH) {
    return { ok: false, error: "That name is too long." };
  }

  const playerAge = parseAge(text(raw.playerAge));
  if (playerAge === "invalid") {
    return { ok: false, error: "Please enter the player's age as a number." };
  }

  const rawFocus = text(raw.focus);
  const focus = (FOCUS_OPTIONS as readonly string[]).includes(rawFocus)
    ? (rawFocus as Focus)
    : undefined;

  const customerNotes =
    text(raw.customerNotes).slice(0, MAX_NOTES_LENGTH) || undefined;

  return {
    ok: true,
    value: { customerEmail, playerName, playerAge, focus, customerNotes },
  };
}

/**
 * Age is optional, so an empty value is fine — but a value that *was* supplied
 * and isn't a plausible age is a typo worth surfacing rather than silently
 * dropping, since the coach uses it to pitch their feedback.
 */
function parseAge(raw: string): number | undefined | "invalid" {
  if (raw.length === 0) return undefined;

  const age = Number(raw);
  if (!Number.isFinite(age)) return "invalid";

  const whole = Math.round(age);
  if (whole < MIN_PLAYER_AGE || whole > MAX_PLAYER_AGE) return "invalid";

  return whole;
}
