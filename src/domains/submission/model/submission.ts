/**
 * The submission domain model — the vocabulary the whole app speaks.
 *
 * Knows nothing about storage. The Postgres column names live in
 * `./submissions.ts`; the row↔domain mapping lives in `api/submissionRow.ts`.
 * If storage ever moves, this file doesn't change.
 *
 * **The vocabularies here are the source.** `./submissionStatusEnum.ts` and
 * `./focusEnum.ts` derive their values from `SUBMISSION_STATUSES` and
 * `FOCUS_OPTIONS` below, so a word is spelled once and storage follows. Not the
 * reverse — a model reading its own words back out of the schema would make the
 * first line of this docblock a lie.
 *
 * One name per concept: a property here is spelled the same way in the form,
 * the API, and the UI.
 *
 * **A submission carries a pack of files, not one video.** Its uploads are rows
 * in `submissionFiles` (see `./submissionFile.ts`); nothing here holds a single
 * locator, and phrasing anything as "the video" is how the old one-column model
 * crept back in.
 */

/**
 * The languages either side can declare.
 *
 * Two, because that's what the business is: parents in English, coaches in
 * Japanese, and the ones in the middle. Kept as free text in the column rather
 * than an enum so a third can be added by typing it, and compared
 * case-insensitively so "english" and "English" are the same claim.
 */
export const LANGUAGES = ["English", "Japanese"] as const;

export type Language = (typeof LANGUAGES)[number];

/**
 * Does this pairing need a translator?
 *
 * **Intersect the two sets. Empty means translate.** Symmetric, one rule, and it
 * handles what the old one couldn't: the old rule assumed the customer's side —
 * *the platform is English, so translate when the coach doesn't read English* —
 * which derived nothing useful for a Japanese-speaking parent sending to a
 * Japanese coach.
 *
 * **Overlap of any size means no.** If the two share a language they can
 * communicate; which one they use is then a choice, not a service we provide.
 *
 * **Null means we can't tell**, and is not the same as `false`. Either side
 * having declared nothing makes the intersection meaningless, and prompting on
 * the strength of a blank field would nag on every submission until someone
 * filled it in — a prompt that's usually wrong is one people learn to dismiss.
 *
 * It is a **prompt, not a gate**. The translation rungs are optional and
 * operator-driven, so this only has to be right enough to raise the question;
 * the admin can send anything for translation regardless. That's what lets the rule
 * stay this simple — the edge cases are exactly what an operator is for.
 *
 * A caveat worth knowing: strictly it's the *files* that have a language, not
 * the people. A bilingual parent may submit Japanese footage. Person-language is
 * a proxy, and a good one, but it is a proxy — which is another reason this
 * prompts rather than decides.
 */
export function needsTranslation(
  customer: readonly string[] | undefined,
  coach: readonly string[] | undefined,
): boolean | null {
  const theirs = normalise(customer);
  const ours = normalise(coach);
  if (theirs.size === 0 || ours.size === 0) return null;
  for (const language of theirs) if (ours.has(language)) return false;
  return true;
}

function normalise(languages: readonly string[] | undefined): Set<string> {
  return new Set(
    (languages ?? []).map((l) => l.trim().toLowerCase()).filter(Boolean),
  );
}

/** What the player wants coached. `./focusEnum.ts` derives the DB type from it. */
import type { FileSet } from "./submissionFile";

export const FOCUS_OPTIONS = [
  "Hitting",
  "Pitching",
  "Fielding",
  "Catching",
  "Other",
] as const;

export type Focus = (typeof FOCUS_OPTIONS)[number];

/**
 * The submission lifecycle — **the ladder**. Sixteen rungs, in order.
 *
 * Every meaningful transition has a status, and every status is stamped in
 * `submission_events`. The canonical account of what each one means, who moves
 * it, and which email fires is
 * [`_SubmissionDocumentation.md` §2](../_SubmissionDocumentation.md).
 *
 * **It is a path with branches, not a progress bar.** Four rungs are only
 * touched when a submission needs translating; a coach who reads English takes
 * `assigned → sent_to_coach` and `awaiting_approval → complete` directly.
 * Anything rendering this as a linear track will be wrong for most submissions.
 *
 * The vocabulary is **intake / response** — what the customer sent, what the
 * coach wrote (`_NomenclatureLaw.md` §3). Statuses are **participles** (what has
 * happened); the matching file kinds are **nouns** (what a file is), so
 * `intake_translated` the status never reads as `intake_translation` the kind.
 *
 * | rung | reached when |
 * | --- | --- |
 * | `draft` | step 1 — player details captured |
 * | `awaiting_payment` | step 2 — the email is proven; uploads may begin |
 * | `new` | step 4 — **the payment cleared.** The boundary |
 * | `assigned` | step 5 — a coach is chosen, and translation need becomes derivable |
 * | `intake_translating` | step 6 — the customer's files have gone out for translation |
 * | `intake_translated` | step 7 — the translated set is back and stored |
 * | `sent_to_coach` | step 8 — emailed with the chosen language set, not yet picked up |
 * | `in_review` | step 9 — **the coach actually has the files** |
 * | `awaiting_approval` | step 10 — a response exists; the customer can't see it |
 * | `response_translating` | step 11 — the response has gone out for translation |
 * | `response_translated` | step 12 — the translated version is back and stored |
 * | `complete` | step 13 — released to the customer |
 * | `collected` | step 14 — **the customer downloaded it.** The retention clock starts |
 * | `resolved` | step 15 — the admin closed it; the thank-you has gone |
 * | `purge_imminent` | step 16 — deletion is a week out; the customer has been warned |
 * | `purged` | step 17 — the bytes are gone; the record is permanent |
 */
export const SUBMISSION_STATUSES = [
  "draft",
  "awaiting_payment",
  "new",
  "assigned",
  "intake_translating",
  "intake_translated",
  "sent_to_coach",
  "in_review",
  "awaiting_approval",
  "response_translating",
  "response_translated",
  "complete",
  "collected",
  "resolved",
  "purge_imminent",
  "purged",
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Statuses the customer-facing flow itself writes. */
export type AppWrittenStatus = Extract<
  SubmissionStatus,
  "draft" | "awaiting_payment" | "new"
>;

/** Statuses that mean money has changed hands. */
/**
 * Has money changed hands by this point?
 *
 * **A Record, not a list, deliberately** — adding a status to
 * `SUBMISSION_STATUSES` without answering this question is now a compile error.
 *
 * It was a list, and that cost us: `awaiting_approval` was added to the
 * lifecycle without being added here, which silently meant a *paid* submission
 * sitting on the admin's desk read as unpaid. Six call sites believe `isPaid`, and
 * two of them act destructively on a `false` — `discardUnpaidSubmission` would
 * have deleted it outright, and `markSubmissionPaid` would have treated a
 * redelivered Stripe webhook as a fresh payment, walking the status backwards
 * over the coach's work and sending a second receipt. Nothing failed loudly;
 * the list just quietly stopped being complete.
 */
const PAID_AT_STATUS: Record<SubmissionStatus, boolean> = {
  draft: false,
  awaiting_payment: false,
  // Everything from `new` onward has been paid for. The ladder only branches
  // after step 4, so every rung added since is trivially true — but the Record
  // makes answering mandatory rather than assumed.
  new: true,
  assigned: true,
  intake_translating: true,
  intake_translated: true,
  sent_to_coach: true,
  in_review: true,
  awaiting_approval: true,
  response_translating: true,
  response_translated: true,
  complete: true,
  collected: true,
  resolved: true,
  purge_imminent: true,
  purged: true,
};

export const PAID_STATUSES: readonly SubmissionStatus[] =
  SUBMISSION_STATUSES.filter((status) => PAID_AT_STATUS[status]);

export function isPaid(submission: Pick<Submission, "status">): boolean {
  return PAID_AT_STATUS[submission.status];
}

/**
 * Does a coach's response exist yet?
 *
 * True from `awaiting_approval` — the coach has delivered — even though the
 * customer can't see it until the admin releases it. That gap is the whole point of
 * the approval gate, so "a response exists" and "the customer may have it" are
 * two different questions with two different predicates.
 */
const HAS_RESPONSE_AT_STATUS: Record<SubmissionStatus, boolean> = {
  draft: false,
  awaiting_payment: false,
  new: false,
  assigned: false,
  intake_translating: false,
  intake_translated: false,
  sent_to_coach: false,
  in_review: false,
  awaiting_approval: true,
  response_translating: true,
  response_translated: true,
  complete: true,
  collected: true,
  resolved: true,
  purge_imminent: true,
  purged: true,
};

export function hasResponse(submission: Pick<Submission, "status">): boolean {
  return HAS_RESPONSE_AT_STATUS[submission.status];
}

/**
 * May the customer see the response?
 *
 * True from `complete` onward — step 13 is the moment it reaches them, and
 * nothing later takes that back. **This is what `status === "complete"` used to
 * mean**, and the reason it can no longer be written that way: a customer who
 * downloads moves the submission to `collected`, and a literal comparison would
 * have silently revoked their own access the instant they used it.
 *
 * Released is about *permission*, not availability. A `purged` submission is
 * still released; its files are simply gone, which `/api/files/[id]` answers
 * with 410 rather than 404 — "you may have this, but it no longer exists" is a
 * different sentence from "this was never yours".
 */
const RELEASED_AT_STATUS: Record<SubmissionStatus, boolean> = {
  draft: false,
  awaiting_payment: false,
  new: false,
  assigned: false,
  intake_translating: false,
  intake_translated: false,
  sent_to_coach: false,
  in_review: false,
  awaiting_approval: false,
  response_translating: false,
  response_translated: false,
  complete: true,
  collected: true,
  resolved: true,
  purge_imminent: true,
  purged: true,
};

export function isReleased(submission: Pick<Submission, "status">): boolean {
  return RELEASED_AT_STATUS[submission.status];
}

/**
 * Is this on a coach's desk — theirs to act on?
 *
 * `assigned` is included because the admin may assign before emailing, and the coach
 * seeing it early is harmless. It stops at `awaiting_approval`: once they've
 * delivered, the work is the admin's.
 */
const WITH_COACH_AT_STATUS: Record<SubmissionStatus, boolean> = {
  draft: false,
  awaiting_payment: false,
  new: false,
  assigned: true,
  // Translation happens between assignment and hand-off; the coach has nothing
  // to do yet, but the row is legitimately theirs.
  intake_translating: true,
  intake_translated: true,
  sent_to_coach: true,
  in_review: true,
  awaiting_approval: false,
  response_translating: false,
  response_translated: false,
  complete: false,
  collected: false,
  resolved: false,
  purge_imminent: false,
  purged: false,
};

export function isWithCoach(submission: Pick<Submission, "status">): boolean {
  return WITH_COACH_AT_STATUS[submission.status];
}

/**
 * Whose court is the ball in?
 *
 * Not the same question as "who is assigned" — a submission can belong to a
 * coach for days while everyone is actually waiting on the admin to approve it, or on
 * a customer to download. The queue's job is to say *who is holding this up*, and
 * the assigned coach is only sometimes the answer.
 *
 * `translator` is a role rather than a person: translation happens off-platform,
 * so nobody in the database is doing it. Naming the role anyway is the point —
 * "waiting on the translator" is actionable in a way "assigned to Yuki" isn't
 * when Yuki hasn't been sent anything yet.
 *
 * `system` means a clock, not a person. Nobody should chase it.
 *
 * A `Record`, so a new rung can't be added without deciding who is waiting.
 */
export type Court = "customer" | "admin" | "coach" | "translator" | "system";

const COURT_AT_STATUS: Record<SubmissionStatus, Court> = {
  // Filling in the form, reading the code, uploading, paying.
  draft: "customer",
  awaiting_payment: "customer",
  // Paid and unassigned — the queue is waiting on the admin to pick someone.
  new: "admin",
  // Assigned, but not yet handed over: still the admin's move, whether that means
  // sending it on or sending it out to be translated.
  assigned: "admin",
  intake_translating: "translator",
  // The translation is back; the hand-off is the admin's again.
  intake_translated: "admin",
  // Emailed. Now genuinely the coach's, and the rung exists to make the
  // difference between "told" and "started" visible.
  sent_to_coach: "coach",
  in_review: "coach",
  // Delivered — nothing reaches the customer until the admin releases it.
  awaiting_approval: "admin",
  response_translating: "translator",
  response_translated: "admin",
  // Released. The clock doesn't start until they collect, so it's their move.
  complete: "customer",
  // Collected — the only thing left is the admin closing it.
  collected: "admin",
  // Closed. Everything after this is a scheduled sweep, not a person.
  resolved: "system",
  purge_imminent: "system",
  purged: "system",
};

export function whoseCourt(submission: Pick<Submission, "status">): Court {
  return COURT_AT_STATUS[submission.status];
}

/**
 * A submission, as the app sees it. `id` is the row's uuid — the app's handle
 * on it and the key every other domain links by. Optional fields are genuinely
 * optional (null in the DB → undefined here).
 */
export interface Submission {
  id: string;

  // Who
  customerEmail: string;
  playerName: string;
  playerAge?: number;
  focus?: Focus;

  // What they told us, and what we tell ourselves
  customerNotes?: string;
  /** What the customer reads. Empty means not declared, not English. */
  languages?: string[];
  internalNotes?: string;

  // Where it is
  status: SubmissionStatus;
  submittedAt?: string;
  completedAt?: string;
  // Set when an operator archives a completed submission — hides it from the
  // active queue ("All") and files it under the Archived view.
  archivedAt?: string;

  // Email verification — the gate on uploading, since payment comes later
  emailVerifiedAt?: string;

  // Payment (Stripe holds the money; we keep the id + amount in cents)
  stripePaymentId?: string;
  stripeAmount?: number;
  paidAt?: string;

  // The coach's response — a storage locator, served via /api/feedback/[id].
  // The customer's own uploads are rows in `submissionFiles`, not a field here.
  feedbackUrl?: string;
  /** What the coach was sent at step 8, and the customer at step 13. */
  coachFileSet?: FileSet;
  customerFileSet?: FileSet;

  // When the retention sweep deleted the customer's uploaded bytes
  filesPurgedAt?: string;

  // Coaching
  assignedOperatorId?: string;
  feedbackEmailedAt?: string;
  /**
   * Last write of any kind — **what the abandonment sweep measures from.**
   *
   * Surfaced because an operator looking at an unpaid row wants to know how long
   * it has been quiet, and because "gone quiet" is the actual retention rule for
   * anything before payment. It is not the same as `submittedAt`: verifying an
   * email or having a card declined both move it, which is how a customer still
   * working avoids being reaped.
   */
  updatedAt?: string;
  /** First collection — the retention clock's anchor. */
  collectedAt?: string;
  deletionWarnedAt?: string;
}

/** Everything required to open a submission at step 1. */
export interface NewSubmission {
  customerEmail: string;
  playerName: string;
  playerAge?: number;
  focus?: Focus;
  customerNotes?: string;
  languages?: string[];
  status?: SubmissionStatus;
  stripePaymentId?: string;
  stripeAmount?: number;
}

/** Fields the app may update on an existing submission. */
export type SubmissionPatch = Partial<Omit<Submission, "id" | "submittedAt">>;

/**
 * What both language questions offer: one of the two, or both.
 *
 * **Shared by the customer's form and the coach's**, because it feeds one rule
 * that reads both sides — two vocabularies would let the halves drift into
 * spellings that can never intersect.
 *
 * It replaced free entry on each side. A text box can be left empty, and empty
 * is the one input `needsTranslation` can't answer: it returns `null`, and the
 * queue reports a missing declaration instead of routing the submission. Three
 * options with one always selected makes that state unreachable from a form.
 *
 * The cost is that a third language needs a code change rather than typing it
 * into a box. Worth it while `LANGUAGES` is two.
 */
export const LANGUAGE_CHOICES = ["English", "Japanese", "both"] as const;

export type LanguageChoice = (typeof LANGUAGE_CHOICES)[number];

export function languagesForChoice(choice: LanguageChoice): string[] {
  return choice === "both" ? [...LANGUAGES] : [choice];
}

/**
 * Read a posted choice, falling back to the caller's default.
 *
 * The fallback is what makes "nothing" unreachable from the server's side too:
 * a missing or tampered field lands on a real answer rather than writing the
 * empty array the radios exist to prevent. The default differs by side —
 * English for a customer, Japanese for a coach — so it's a parameter, not a
 * constant here.
 */
export function readLanguageChoice(
  value: unknown,
  fallback: LanguageChoice,
): LanguageChoice {
  const given = String(value ?? "");
  return (LANGUAGE_CHOICES as readonly string[]).includes(given)
    ? (given as LanguageChoice)
    : fallback;
}

/**
 * Which radio to preselect for an existing record.
 *
 * Anything the three options can't express — a blank column, or a language we
 * no longer offer — shows as the fallback, and **saving the form would write
 * that over what's there**. Acceptable only because `LANGUAGES` is these two
 * and every existing row was backfilled to one of them.
 */
export function choiceForLanguages(
  languages: readonly string[] | undefined,
  fallback: LanguageChoice,
): LanguageChoice {
  const set = new Set((languages ?? []).map((l) => l.trim().toLowerCase()));
  const en = set.has("english");
  const ja = set.has("japanese");
  if (en && ja) return "both";
  if (en) return "English";
  if (ja) return "Japanese";
  return fallback;
}

/**
 * How each rung reads to a person.
 *
 * Beside the ladder rather than inside a component, because **two surfaces show
 * it**: the queue's pill and the trail underneath it. When they came from
 * different places the same rung read two ways on one screen — the pill saying
 * one thing and the breadcrumb below it saying `awaiting_payment`.
 *
 * Exhaustive over the enum, so a new rung is a compile error here too.
 *
 * One word each, so sixteen of them read as one process rather than sixteen
 * sentences. The rung says *where*; the line under it says what's owed.
 */
export const RUNG_LABEL: Record<SubmissionStatus, string> = {
  draft: "Draft",
  awaiting_payment: "Upload",
  new: "New",
  assigned: "Assigned",
  intake_translating: "Translating",
  intake_translated: "Translated",
  sent_to_coach: "Sent",
  in_review: "Reviewing",
  awaiting_approval: "Submitted",
  response_translating: "Translating",
  response_translated: "Translated",
  complete: "Delivered",
  collected: "Collected",
  resolved: "Resolved",
  purge_imminent: "Deleting",
  purged: "Purged",
};

/**
 * The label with its position, for a flat list.
 *
 * **Four rungs share two names** — a submission translates twice, once each
 * way, and "Translating" is the honest word both times. On the rail that reads
 * fine because position carries the difference; in a dropdown it is two
 * identical options. The number restores what the rail shows spatially.
 */
export function numberedRungLabel(status: SubmissionStatus): string {
  return `${SUBMISSION_STATUSES.indexOf(status) + 1} · ${RUNG_LABEL[status]}`;
}
