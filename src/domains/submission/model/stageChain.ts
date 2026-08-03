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
  /**
   * **Nobody can act on it**, so it never holds the pointer.
   *
   * Two kinds qualify. Off-platform steps we can't observe — a translator
   * downloading the originals. And **records of a send**: an email either went
   * or it didn't, and no button in the portal makes a failed one true.
   *
   * That second kind is why this matters. The pointer is the first unmet
   * non-passive line, and the control hangs off it — so a notification that
   * failed for reasons having nothing to do with the work would sit there
   * unmet forever, **hiding the control on the line below it**. That is
   * exactly what happened: `② arrival → Yuta` failed on a placeholder address
   * and took the whole assign control with it.
   *
   * A line where the send *is* the action — the hand-off — keeps its pointer,
   * because there a person really does press something.
   */
  passive?: boolean;
  /** The control that satisfies it, if a person can. */
  act?: ChainAction;
  /**
   * Every row the trail writes when this line goes wrong, verbatim.
   *
   * The chain said what has to be true and nothing about the other outcome —
   * and the other outcome is the one somebody has to act on. `② arrival → Yuta`
   * failing is what hid the assign control for a day, and no list anywhere said
   * that was a thing that could happen.
   */
  failures?: string[];
  /**
   * What someone is told when this line goes wrong **and nothing is written
   * down** — a refusal at the door, in the words the person actually sees.
   *
   * Its own field rather than a marker inside `failures`, because it is a
   * different kind of fact: an operator reading a submission's history needs to
   * know which silences are meaningful, and a sigil buried in a list is a poor
   * way to say so. Every upload refusal lives here — there is no
   * submission-level event for a file that was never accepted.
   */
  told?: string[];
  /**
   * The rows this line writes when it *works*, verbatim.
   *
   * `what` is the condition in the operator's words; this is what the trail
   * actually prints, and they aren't the same sentence — "Email proven" is the
   * condition, `code accepted — on attempt 3` is the row. Listing summaries
   * beside verbatim failures would make the table lie about half of itself.
   *
   * Absent where the two coincide, or where nothing is written at all.
   */
  records?: string[];
  met: (submission: Submission, facts: ProgressFacts) => boolean;
}

/**
 * Every row a message can leave in the trail, verbatim.
 *
 * **These are the exact strings**, not summaries of them — the whole use of the
 * list is being able to search a trail for a line and find it here, or read it
 * here and know what to look for.
 *
 * `sent` only ever means Resend accepted it; everything below arrives later by
 * webhook. Bounces carry their classification when Resend gives us one, and a
 * shape we don't recognise still records the bounce without it — losing the
 * detail is survivable, losing the bounce is not.
 */
/** What a message writes when it lands: accepted, then confirmed. */
const sendRecords = (label: string) => [label, `${label} delivered`];

const sendFailures = (label: string) => [
  `${label} failed`,
  `${label} bounced — hard`,
  `${label} bounced — soft`,
  `${label} bounced`,
  `${label} complained`,
];

/**
 * What the **customer's** upload is refused with, in their own words. Every one
 * is a refusal at the door, so they belong to `told`, never `failures` — there
 * is no submission-level event for a file that was never accepted.
 *
 * Only the three `/api/upload*` routes run this policy.
 *
 * Two of the limits are operator-tunable, so the numbers here are the seeded
 * defaults; the sentence is what's fixed.
 */
/**
 * What the **operator's and the coach's** uploads say when they go wrong:
 * nothing.
 *
 * `uploadTranslationAction` is a Server Action returning `void`, and the
 * feedback route runs no policy — neither checks size, type or count, and
 * neither has a channel to report a refusal through. A file that fails is a
 * page that refreshes unchanged.
 *
 * Listed rather than left blank because a blank cell reads as "nothing can go
 * wrong here", which is the opposite of true.
 */
const UPLOAD_UNGUARDED = [
  "Nothing — the upload is unvalidated and failures are silent *(not built)*",
];

const UPLOAD_REFUSED = [
  "You can attach up to 5 files.",
  "Files must be under 50 MB.",
  "That file type isn't supported.",
  "That file is empty.",
  "Your session has expired. Please start again.",
];

/** Wrong-code rows, one per attempt — the count is in the note. */
const WRONG_CODE = Array.from(
  { length: 5 },
  (_, i) => `code rejected — wrong code — ${i + 1} of 5 attempts spent`,
);

const sent = (label: string) => (_s: Submission, f: ProgressFacts) =>
  f.emails.get(label) === true;
const has = (kind: FileKind) => (_s: Submission, f: ProgressFacts) =>
  f.files[kind] > 0;
const reached = (status: SubmissionStatus) => (_s: Submission, f: ProgressFacts) =>
  f.reached.has(status);

/**
 * What has to happen **while a submission sits on this rung** — and nothing else.
 *
 * Every rung used to open by restating the condition that got it there: "Coach
 * chosen" closed `new` and opened `assigned`, "Response uploaded" closed
 * `in_review` and opened `awaiting_approval`. The intent was that a rung read as
 * a complete account of itself. What it produced was eleven lines that say a
 * thing twice, and in a flat list — the override's substep dropdown — two
 * identical entries one step apart with no way to tell which is which.
 *
 * So the rule is now strict: **a line earns its place only if its truth can
 * change during this rung.** How the submission arrived is the previous rung's
 * business, and the trail already records it.
 *
 * An email that fires on *entry* does belong here — it is triggered by arriving,
 * and whether it landed is live information while you're looking at the rung.
 * That is why `③ hand-off → coach` sits on `sent_to_coach` rather than beside
 * the button that sent it: the button is an act, the delivery is an outcome, and
 * they are two facts a rung apart.
 *
 * **Two lines still appear at two rungs, and should.** "Handed to the coach" is
 * the way out of both `assigned` and `intake_translated`; "Approved and sent" is
 * the way out of both `awaiting_approval` and `response_translated`. Those are
 * one action reachable by two routes — translate first, or don't — not a fact
 * stated twice.
 */
export const STAGE_CHAIN: Record<SubmissionStatus, ChainLine[]> = {
  draft: [
    { what: "Code sent to the customer", next: "Send the code", from: "①", passive: true, records: [...sendRecords("① code → customer")], failures: [...sendFailures("① code → customer")], met: sent("① code → customer") },
    { what: "Email proven", next: "Prove the email", from: "emailVerifiedAt", act: "waitCustomer", records: ["code accepted", ...Array.from({ length: 4 }, (_, i) => `code accepted — on attempt ${i + 2}`)], failures: [...WRONG_CODE, "code rejected — 5 attempts spent", "code rejected — the window had closed", "code rejected — no code outstanding"], met: (s) => !!s.emailVerifiedAt },
  ],
  awaiting_payment: [
    { what: "At least one file attached", next: "Attach a file", from: "intake", told: [...UPLOAD_REFUSED], met: has("intake") },
    { what: "Payment cleared", next: "Clear payment", from: "paidAt", act: "waitCustomer", failures: ["card declined → customer", ...sendFailures("card declined → customer"), "declined *(not built)* — only the notice is recorded, not the decline"], told: ["Their attempt was scrubbed — the flow returns them to step 1"], met: (s) => !!s.paidAt },
  ],
  new: [
    { what: "Receipt sent to the customer", next: "Send the receipt", from: "②", passive: true, records: [...sendRecords("② receipt → customer")], failures: [...sendFailures("② receipt → customer")], met: sent("② receipt → customer") },
    { what: "Arrival announced", next: "Tell Yuta it arrived", from: "②", passive: true, records: [...sendRecords("② arrival → Yuta")], failures: [...sendFailures("② arrival → Yuta")], met: sent("② arrival → Yuta") },
    { what: "Coach chosen", next: "Pick a coach", from: "assignedCoachId", act: "assign", told: ["Refused — already handed off, so a stale tab can't reassign"], met: (s) => !!s.assignedCoachId },
  ],
  assigned: [
    {
      what: "Coach's languages recorded", next: "Record the coach's languages",
      from: "coaches.languages",
      why: "without them, translation need can't be derived",
      failures: ["None recorded — translation need can't be derived, and the queue says which side is missing"],
      met: (_s, f) => f.coachHasLanguages,
    },
    {
      what: "Sent out for translation, if this coach needs it", next: "Send for translation, if needed",
      from: "rung 5",
      why: "optional — a coach who shares a language skips it",
      act: "sendForTranslation",
      // Never blocks: most submissions skip translation entirely, so treating
      // this as a gate would leave every shared-language row looking unfinished.
      passive: true,
      met: (_s, f) => f.files.intake_translation > 0,
    },
    { what: "Handed to the coach", next: "Hand to the coach", from: "③", act: "handoff", records: [...sendRecords("③ hand-off → coach")], failures: [...sendFailures("③ hand-off → coach")], told: ["Refused — a stale tab tried to reassign after hand-off"], met: sent("③ hand-off → coach") },
  ],
  intake_translating: [
    {
      what: "Originals downloaded", next: "Download the originals",
      from: "off-platform",
      why: "nothing observes this — the upload is the proof",
      passive: true,
      
      met: () => false,
    },
    { what: "Translated files uploaded", next: "Upload the translated files", from: "intake_translation", act: "uploadIntake", told: [...UPLOAD_UNGUARDED], met: has("intake_translation") },
  ],
  intake_translated: [
    { what: "Handed to the coach", next: "Hand to the coach", from: "③", act: "handoff", records: [...sendRecords("③ hand-off → coach")], failures: [...sendFailures("③ hand-off → coach")], told: ["Refused — a stale tab tried to reassign after hand-off"], met: sent("③ hand-off → coach") },
  ],
  sent_to_coach: [
    { what: "Hand-off emailed", next: "Email the hand-off", from: "③", passive: true, records: [...sendRecords("③ hand-off → coach")], failures: [...sendFailures("③ hand-off → coach")], met: sent("③ hand-off → coach") },
    {
      what: "Coach downloaded the files", next: "Coach downloads the files",
      from: "trail · in_review",
      why: "the only evidence the coach actually has it",
      act: "waitCoach",
      failures: ["Gone — the folder was purged before they collected (410)"], told: ["Refused — a different coach asked (403)"],
      met: reached("in_review"),
    },
  ],
  in_review: [
    { what: "Response uploaded", next: "Upload the response", from: "response", act: "waitCoach", told: [...UPLOAD_UNGUARDED], met: has("response") },
  ],
  awaiting_approval: [
    { what: "Yuta and the coach told", next: "Tell Yuta and the coach", from: "⑤", passive: true, records: [...sendRecords("⑤ response submitted → Yuta + coach")], failures: [...sendFailures("⑤ response submitted → Yuta + coach")], met: sent("⑤ response submitted → Yuta + coach") },
    {
      what: "Sent out for translation, if the customer needs it", next: "Send for translation, if needed",
      from: "rung 10",
      why: "optional — skipped when the response is already readable",
      act: "sendForTranslation",
      passive: true,
      met: (_s, f) => f.files.response_translation > 0,
    },
    { what: "Approved and sent", next: "Approve and send", from: "feedbackEmailedAt", act: "approve", records: [...sendRecords("⑥ feedback ready → customer")], failures: [...sendFailures("⑥ feedback ready → customer"), "Refused — there is no response file to send"], met: (s) => !!s.feedbackEmailedAt },
  ],
  response_translating: [
    {
      what: "Response downloaded", next: "Download the response",
      from: "off-platform",
      why: "nothing observes this — the upload is the proof",
      passive: true,
      
      met: () => false,
    },
    { what: "Translation uploaded", next: "Upload the translation", from: "response_translation", act: "uploadResponse", told: [...UPLOAD_UNGUARDED], met: has("response_translation") },
  ],
  response_translated: [
    { what: "Approved and sent", next: "Approve and send", from: "feedbackEmailedAt", act: "approve", records: [...sendRecords("⑥ feedback ready → customer")], failures: [...sendFailures("⑥ feedback ready → customer"), "Refused — there is no response file to send"], met: (s) => !!s.feedbackEmailedAt },
  ],
  complete: [
    { what: "Feedback emailed", next: "Email the feedback", from: "⑥", passive: true, records: [...sendRecords("⑥ feedback ready → customer")], failures: [...sendFailures("⑥ feedback ready → customer")], met: sent("⑥ feedback ready → customer") },
    {
      what: "Customer downloaded it", next: "Customer downloads it",
      from: "collectedAt",
      why: "starts the retention clock — nothing is purged before this",
      act: "waitCustomer",
      failures: ["Gone — an operator purged the folder early (410)"],
      met: (s) => !!s.collectedAt,
    },
  ],
  collected: [
    { what: "Collection announced", next: "Tell Yuta they collected", from: "⑦", passive: true, records: [...sendRecords("⑦ collected → Yuta")], failures: [...sendFailures("⑦ collected → Yuta")], met: sent("⑦ collected → Yuta") },
    { what: "Marked resolved", next: "Mark resolved", from: "trail · resolved", act: "resolve", met: reached("resolved") },
  ],
  resolved: [
    { what: "Thank-you sent", next: "Send the thank-you", from: "⑧", passive: true, records: [...sendRecords("⑧ thank you → customer")], failures: [...sendFailures("⑧ thank you → customer")], met: sent("⑧ thank you → customer") },
    { what: "Deletion warning due", next: "Warning falls due", from: "deletionWarnedAt", act: "waitCron", failures: ["The sweep didn't run — CRON_SECRET unset, and it refuses rather than run unguarded"], met: (s) => !!s.deletionWarnedAt },
  ],
  purge_imminent: [
    { what: "Warning sent", next: "Send the warning", from: "⑨", passive: true, records: [...sendRecords("⑨ deletion warning → customer")], failures: [...sendFailures("⑨ deletion warning → customer"), "Stamped even when the send failed — retrying nightly would turn one miss into seven"], met: sent("⑨ deletion warning → customer") },
    { what: "Files deleted", next: "Delete the files", from: "filesPurgedAt", act: "waitCron", failures: ["Storage refused the delete — the locator stays and the sweep retries *(not built)*"], met: (s) => !!s.filesPurgedAt },
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
