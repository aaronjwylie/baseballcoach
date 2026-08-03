/**
 * The chain — what has to happen *within* the rung a submission is sitting on.
 *
 * The ladder says where a submission is; this says how far through that place it
 * has got, and what is outstanding. Together they're the "then, in order" column
 * of [`_SubmissionDocumentation.md` §2](../_SubmissionDocumentation.md), reduced
 * to what the database can actually answer.
 *
 * **Every line carries its own `met` predicate.** A checklist that has to be
 * ticked by a human is a checklist that goes stale the first busy week, so
 * nothing here is a flag someone sets — each line asks the row, the files, or
 * the trail. That constrains what can be listed, which is the point: if it can't
 * be observed, it doesn't belong on a progress view pretending to observe it.
 *
 * **Passive lines never hold the pointer.** Yuta translating on his laptop can't
 * be watched, so treating it as a gate would leave a row showing nothing to do
 * while an upload was plainly outstanding. Such a line still renders — it's part
 * of the story — but the next actionable line is what the row is waiting on.
 *
 * Pure and client-safe: no database, no `process.env`. A `"use client"`
 * component imports this directly rather than the slice barrel.
 */
import type { Submission, SubmissionStatus } from "./submission";
import type { FileKind } from "./submissionFile";

/** What the server gathers once so every line can be answered without a query. */
export interface ProgressFacts {
  /** How many files sit in each of the four folders. */
  files: Record<FileKind, number>;
  /** Whether the assigned coach has any languages recorded. */
  coachHasLanguages: boolean;
  /** Rungs this submission has actually passed through, from the trail. */
  reached: ReadonlySet<SubmissionStatus>;
  /** Messages we tried to send, and whether they landed. */
  emails: ReadonlyMap<string, boolean>;
}

/**
 * What a line offers to do about itself.
 *
 * The control lives *on* the outstanding line rather than in a button bar: a bar
 * makes you read the status, work out what it implies, then find the matching
 * button. Naming the action here means what you read and what you press cannot
 * drift apart.
 */
export type ChainAction =
  | "assign"
  | "handoff"
  | "approve"
  | "resolve"
  | "sendForTranslation"
  | "uploadIntake"
  | "uploadResponse"
  | "waitCustomer"
  | "waitCoach"
  | "waitCron";

export interface ChainLine {
  /** What has to be true, in the operator's words. Past voice — a condition met. */
  what: string;
  /**
   * The same line before it happens — terse, and in the other voice.
   *
   * `what` is a condition met; this is the thing to do. Same register, same
   * length: "Payment cleared" against "Clear payment". A greyed-out past-tense
   * line still reads as something that occurred, and a full sentence beside a
   * column of clipped ones reads as a different kind of entry altogether.
   */
  next: string;
  /** How we know — the field, the file, or the event. Shown small. */
  from: string;
  /** Why it matters, where that isn't obvious. */
  why?: string;
  /** Unobservable, so it never holds the pointer. */
  passive?: boolean;
  /** The control that satisfies it, if a person can. */
  act?: ChainAction;
  met: (submission: Submission, facts: ProgressFacts) => boolean;
}

const sent = (label: string) => (_s: Submission, f: ProgressFacts) =>
  f.emails.get(label) === true;
const has = (kind: FileKind) => (_s: Submission, f: ProgressFacts) =>
  f.files[kind] > 0;
const reached = (status: SubmissionStatus) => (_s: Submission, f: ProgressFacts) =>
  f.reached.has(status);

export const STAGE_CHAIN: Record<SubmissionStatus, ChainLine[]> = {
  draft: [
    { what: "Player details captured", next: "Capture player details", from: "playerName · focus", met: (s) => !!s.playerName },
    { what: "Email proven", next: "Prove the email", from: "emailVerifiedAt", act: "waitCustomer", met: (s) => !!s.emailVerifiedAt },
  ],
  awaiting_payment: [
    { what: "Email proven", next: "Prove the email", from: "emailVerifiedAt", met: (s) => !!s.emailVerifiedAt },
    { what: "At least one file attached", next: "Attach a file", from: "intake", met: has("intake") },
    { what: "Payment cleared", next: "Clear payment", from: "paidAt", act: "waitCustomer", met: (s) => !!s.paidAt },
  ],
  new: [
    { what: "Payment cleared", next: "Clear payment", from: "paidAt", met: (s) => !!s.paidAt },
    { what: "Receipt sent to the customer", next: "Send the receipt", from: "②", met: sent("② receipt → customer") },
    { what: "Arrival announced", next: "Tell Yuta it arrived", from: "②", met: sent("② arrival → Yuta") },
    { what: "Coach chosen", next: "Pick a coach", from: "assignedCoachId", act: "assign", met: (s) => !!s.assignedCoachId },
  ],
  assigned: [
    { what: "Coach chosen", next: "Pick a coach", from: "assignedCoachId", met: (s) => !!s.assignedCoachId },
    {
      what: "Coach's languages recorded", next: "Record the coach's languages",
      from: "coaches.languages",
      why: "without them, translation need can't be derived",
      met: (_s, f) => f.coachHasLanguages,
    },
    {
      what: "Sent out for translation, if this coach needs it", next: "Send for translation, if needed",
      from: "rung 5",
      why: "optional — an English-reading coach skips it",
      act: "sendForTranslation",
      // Never blocks: most submissions skip translation entirely, so treating
      // this as a gate would leave every English-coach row looking unfinished.
      passive: true,
      met: (_s, f) => f.files.intake_translation > 0,
    },
    { what: "Handed to the coach", next: "Hand to the coach", from: "③", act: "handoff", met: sent("③ hand-off → coach") },
  ],
  intake_translating: [
    {
      what: "Originals downloaded", next: "Download the originals",
      from: "off-platform",
      why: "nothing observes this — the upload is the proof",
      passive: true,
      met: () => false,
    },
    { what: "Translated files uploaded", next: "Upload the translated files", from: "intake_translation", act: "uploadIntake", met: has("intake_translation") },
  ],
  intake_translated: [
    { what: "Translated set stored", next: "Store the translated set", from: "intake_translation", met: has("intake_translation") },
    { what: "Handed to the coach", next: "Hand to the coach", from: "③", act: "handoff", met: sent("③ hand-off → coach") },
  ],
  sent_to_coach: [
    { what: "Hand-off emailed", next: "Email the hand-off", from: "③", met: sent("③ hand-off → coach") },
    {
      what: "Coach downloaded the files", next: "Coach downloads the files",
      from: "trail · in_review",
      why: "the only evidence the coach actually has it",
      act: "waitCoach",
      met: reached("in_review"),
    },
  ],
  in_review: [
    { what: "Coach has the files", next: "Coach opens the files", from: "trail · in_review", met: reached("in_review") },
    { what: "Response uploaded", next: "Upload the response", from: "response", act: "waitCoach", met: has("response") },
  ],
  awaiting_approval: [
    { what: "Response uploaded", next: "Upload the response", from: "response", met: has("response") },
    { what: "Yuta and the coach told", next: "Tell Yuta and the coach", from: "⑤", met: sent("⑤ response submitted → Yuta + coach") },
    {
      what: "Sent out for translation, if the customer needs it", next: "Send for translation, if needed",
      from: "rung 10",
      why: "optional — skipped when the response is already readable",
      act: "sendForTranslation",
      passive: true,
      met: (_s, f) => f.files.response_translation > 0,
    },
    { what: "Approved and sent", next: "Approve and send", from: "feedbackEmailedAt", act: "approve", met: (s) => !!s.feedbackEmailedAt },
  ],
  response_translating: [
    {
      what: "Response downloaded", next: "Download the response",
      from: "off-platform",
      why: "nothing observes this — the upload is the proof",
      passive: true,
      met: () => false,
    },
    { what: "Translation uploaded", next: "Upload the translation", from: "response_translation", act: "uploadResponse", met: has("response_translation") },
  ],
  response_translated: [
    { what: "Translation stored", next: "Store the translation", from: "response_translation", met: has("response_translation") },
    { what: "Approved and sent", next: "Approve and send", from: "feedbackEmailedAt", act: "approve", met: (s) => !!s.feedbackEmailedAt },
  ],
  complete: [
    { what: "Feedback emailed", next: "Email the feedback", from: "⑥", met: sent("⑥ feedback ready → customer") },
    { what: "Delivery stamped", next: "Stamp delivery", from: "completedAt", met: (s) => !!s.completedAt },
    {
      what: "Customer downloaded it", next: "Customer downloads it",
      from: "collectedAt",
      why: "starts the retention clock — nothing is purged before this",
      act: "waitCustomer",
      met: (s) => !!s.collectedAt,
    },
  ],
  collected: [
    { what: "Customer has it", next: "Customer opens it", from: "collectedAt", met: (s) => !!s.collectedAt },
    { what: "Collection announced", next: "Tell Yuta they collected", from: "⑦", met: sent("⑦ collected → Yuta") },
    { what: "Marked resolved", next: "Mark resolved", from: "trail · resolved", act: "resolve", met: reached("resolved") },
  ],
  resolved: [
    { what: "Marked resolved", next: "Mark resolved", from: "trail · resolved", met: reached("resolved") },
    { what: "Thank-you sent", next: "Send the thank-you", from: "⑧", met: sent("⑧ thank you → customer") },
    { what: "Deletion warning due", next: "Warning falls due", from: "deletionWarnedAt", act: "waitCron", met: (s) => !!s.deletionWarnedAt },
  ],
  purge_imminent: [
    { what: "Warning sent", next: "Send the warning", from: "⑨", met: sent("⑨ deletion warning → customer") },
    { what: "Files deleted", next: "Delete the files", from: "filesPurgedAt", act: "waitCron", met: (s) => !!s.filesPurgedAt },
  ],
  purged: [
    { what: "Bytes removed from storage", next: "Remove the bytes", from: "filesPurgedAt", met: (s) => !!s.filesPurgedAt },
    { what: "Locators cleared", next: "Clear the locators", from: "fileUrl = null", met: (s) => !!s.filesPurgedAt },
    { what: "Record kept — permanently", next: "Keep the record", from: "the row survives", met: () => true },
  ],
};

/**
 * A resolved line, ready to render — **and deliberately serialisable.**
 *
 * Not `ChainLine` with a flag bolted on: that would carry the `met` predicate
 * across the server/client boundary, which React refuses (a function can't be
 * serialised into the payload). Resolving to plain data here is also the right
 * shape regardless — the client renders what it's told and has no business
 * re-deciding whether a line is met.
 */
export interface ChainState {
  what: string;
  /** The future-voice reading, for the one line still outstanding. */
  next: string;
  from: string;
  why?: string;
  act?: ChainAction;
  met: boolean;
  /** The one line the submission is actually waiting on. */
  now: boolean;
}

/**
 * Resolve the chain for a submission's current rung.
 *
 * `now` is the first **unmet and non-passive** line — the thing to act on. When
 * every line is met the stage is done and nothing is highlighted, which is the
 * honest reading of a rung waiting on a transition that hasn't fired.
 */
export function describeStage(
  submission: Submission,
  facts: ProgressFacts,
): ChainState[] {
  const lines = STAGE_CHAIN[submission.status];
  const met = lines.map((line) => line.met(submission, facts));
  const now = lines.findIndex((line, i) => !met[i] && !line.passive);
  return lines.map((line, i) => ({
    what: line.what,
    next: line.next,
    from: line.from,
    why: line.why,
    act: line.act,
    met: met[i],
    now: i === now,
  }));
}
