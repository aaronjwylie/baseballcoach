/**
 * Submission queries — everything the app does to the `submissions` table.
 *
 * Callers get a domain `Submission`; nobody outside this file (and its row
 * mapper) sees a Drizzle row or a column name. The customer's uploaded files
 * are a separate table with its own module, `submissionFileApi.ts`.
 */
import { and, desc, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db, submissions } from "@/shared/db";
import {
  SUBMISSION_STATUSES,
  isReleased,
  type NewSubmission,
  type Submission,
  type SubmissionPatch,
} from "../model/submission";
import {
  toPublicSubmission,
  type PublicSubmission,
} from "../model/publicSubmission";
import { fromRow } from "./submissionRow";
import { recordSubmissionEvent } from "./submissionEventApi";

/**
 * Domain patch → Drizzle update values.
 *
 * Explicit rather than a spread because the domain carries ISO-string timestamps
 * while the columns are `Date`, and only set keys are included so a partial
 * update never nulls a column by accident.
 */
function toUpdateValues(
  patch: SubmissionPatch,
): Partial<typeof submissions.$inferInsert> {
  const v: Partial<typeof submissions.$inferInsert> = {};
  if (patch.customerEmail !== undefined) v.customerEmail = patch.customerEmail.trim().toLowerCase();
  if (patch.playerName !== undefined) v.playerName = patch.playerName;
  if (patch.playerAge !== undefined) v.playerAge = patch.playerAge;
  if (patch.focus !== undefined) v.focus = patch.focus;
  if (patch.customerNotes !== undefined) v.customerNotes = patch.customerNotes;
  if (patch.languages !== undefined) v.languages = patch.languages;
  if (patch.internalNotes !== undefined) v.internalNotes = patch.internalNotes;
  if (patch.status !== undefined) v.status = patch.status;
  if (patch.stripePaymentId !== undefined) v.stripePaymentId = patch.stripePaymentId;
  if (patch.stripeAmount !== undefined) v.stripeAmount = patch.stripeAmount;
  if (patch.feedbackUrl !== undefined) v.feedbackUrl = patch.feedbackUrl;
  if (patch.coachFileSet !== undefined) v.coachFileSet = patch.coachFileSet;
  if (patch.customerFileSet !== undefined) v.customerFileSet = patch.customerFileSet;
  if (patch.assignedCoachId !== undefined) v.assignedCoachId = patch.assignedCoachId;
  if (patch.emailVerifiedAt !== undefined) v.emailVerifiedAt = new Date(patch.emailVerifiedAt);
  if (patch.paidAt !== undefined) v.paidAt = new Date(patch.paidAt);
  if (patch.completedAt !== undefined) v.completedAt = new Date(patch.completedAt);
  if (patch.filesPurgedAt !== undefined) v.filesPurgedAt = new Date(patch.filesPurgedAt);
  if (patch.feedbackEmailedAt !== undefined) {
    v.feedbackEmailedAt = new Date(patch.feedbackEmailedAt);
  }
  if (patch.collectedAt !== undefined) v.collectedAt = new Date(patch.collectedAt);
  if (patch.deletionWarnedAt !== undefined) {
    v.deletionWarnedAt = new Date(patch.deletionWarnedAt);
  }
  return v;
}

/**
 * Create a submission, and open its trail.
 *
 * The first rung is an event like any other: a history that begins at the second
 * transition can't answer "when did this start", which is the question most often
 * asked of a stalled submission.
 */
export async function createSubmission(
  input: NewSubmission,
): Promise<Submission> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(submissions)
      .values({
        customerEmail: input.customerEmail.trim().toLowerCase(),
        playerName: input.playerName,
        playerAge: input.playerAge,
        focus: input.focus,
        customerNotes: input.customerNotes,
        languages: input.languages ?? [],
        status: input.status ?? "draft",
        stripePaymentId: input.stripePaymentId,
        stripeAmount: input.stripeAmount,
      })
      .returning();

    await recordSubmissionEvent(row.id, row.status, undefined, tx);
    return fromRow(row);
  });
}

/**
 * The one write path — and therefore the one place a transition is stamped.
 *
 * Every status change in the app funnels through here, so the trail is written
 * *here* rather than at each caller. A caller that forgets to log would leave a
 * status nobody can account for, and there is no way to notice that later.
 *
 * The read-before-write costs one extra query, and only when the patch carries a
 * status. It buys the difference between "this transition happened" and "someone
 * asked for this status again" — a redelivered webhook, or a double-clicked
 * button, sets the same value and must not appear in the history as a second
 * event.
 *
 * Both statements share a transaction: `submissions.status` and its trail cannot
 * disagree, even if the process dies between them.
 *
 * `note` is carried for the operator overrides, which owe an explanation.
 */
export async function updateSubmission(
  id: string,
  patch: SubmissionPatch,
  note?: string,
): Promise<Submission> {
  return db.transaction(async (tx) => {
    const previous =
      patch.status === undefined
        ? undefined
        : (
            await tx
              .select({ status: submissions.status })
              .from(submissions)
              .where(eq(submissions.id, id))
              .limit(1)
          )[0]?.status;

    const [row] = await tx
      .update(submissions)
      .set({ ...toUpdateValues(patch), updatedAt: new Date() })
      .where(eq(submissions.id, id))
      .returning();

    if (patch.status !== undefined && patch.status !== previous) {
      await recordSubmissionEvent(id, patch.status, note, tx);
    }

    return fromRow(row);
  });
}

/**
 * Delete a submission outright. `submissionFiles` rows cascade with it.
 *
 * Only for submissions that were never paid for — the guard lives in
 * `discardUnpaidSubmission`, which is the only thing that should call this.
 */
export async function deleteSubmission(id: string): Promise<void> {
  await db.delete(submissions).where(eq(submissions.id, id));
}

/** Assign a coach and move the submission to `assigned`. Admin action. */
export async function assignSubmissionCoach(
  submissionId: string,
  coachId: string,
): Promise<Submission> {
  return updateSubmission(submissionId, {
    assignedCoachId: coachId,
    status: "assigned",
  });
}

/**
 * Hand the work to the coach: `assigned` → `sent_to_coach`. Admin action.
 *
 * **Not `in_review`.** The coach has been emailed, not started — and the gap
 * between those two is the one Yuta needs to see, because it's the only place a
 * submission stalls on a person rather than on the system. `in_review` is now
 * earned by the coach actually collecting the files.
 */
export async function markSubmissionSentToCoach(
  id: string,
): Promise<Submission> {
  return updateSubmission(id, { status: "sent_to_coach" });
}

/**
 * The coach has the files — `sent_to_coach` → `in_review`.
 *
 * **Idempotent, and deliberately narrow.** Only a submission we actually sent
 * can be picked up; a re-download changes nothing, and an admin opening the same
 * file doesn't count as the coach starting work. Returns the submission when
 * this was the *first* collection, null otherwise, so the caller knows whether
 * to notify — the same `justPaid` shape the payment path uses, and for the same
 * reason: two callers race, one of them should send the email.
 */
export async function markCoachCollected(
  id: string,
): Promise<Submission | null> {
  const submission = await getSubmission(id);
  if (!submission || submission.status !== "sent_to_coach") return null;
  return updateSubmission(id, { status: "in_review" });
}

/**
 * The customer has their feedback — `complete` → `collected`.
 *
 * **This is what starts the retention clock**, which is why it can only happen
 * once and only from `complete`. A customer who downloads again a week later
 * must not push the deletion date out, or nothing is ever swept.
 *
 * Returns the submission on the first collection, null afterwards.
 */
export async function markCustomerCollected(
  id: string,
): Promise<Submission | null> {
  const submission = await getSubmission(id);
  if (!submission || submission.status !== "complete") return null;
  return updateSubmission(id, {
    status: "collected",
    // The clock's anchor. Set with the status so the two can never disagree
    // about when the countdown began.
    collectedAt: new Date().toISOString(),
  });
}

/**
 * File a completed submission out of the active queue, or bring it back.
 *
 * `archivedAt` is its own dimension, not a status — the submission stays
 * `complete`; the timestamp just moves it to the Archived view. Direct writes
 * because a patch can't express "set back to null" (unarchive).
 */
export async function archiveSubmission(id: string): Promise<Submission> {
  const [row] = await db
    .update(submissions)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(submissions.id, id))
    .returning();
  return fromRow(row);
}

export async function unarchiveSubmission(id: string): Promise<Submission> {
  const [row] = await db
    .update(submissions)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(submissions.id, id))
    .returning();
  return fromRow(row);
}

export async function getSubmission(id: string): Promise<Submission | null> {
  const [row] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, id))
    .limit(1);
  return row ? fromRow(row) : null;
}

export async function findByStripePaymentId(
  paymentId: string,
): Promise<Submission | null> {
  const [row] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.stripePaymentId, paymentId))
    .limit(1);
  return row ? fromRow(row) : null;
}

/**
 * A customer's submissions (their email is stored lowercased).
 *
 * `draft` rows are excluded: an abandoned first step is not something a customer
 * should see listed as a submission, and it carries no useful status.
 */
export async function findByCustomerEmail(
  email: string,
): Promise<Submission[]> {
  const rows = await db
    .select()
    .from(submissions)
    .where(eq(submissions.customerEmail, email.trim().toLowerCase()))
    .orderBy(desc(submissions.submittedAt));
  return rows.filter((row) => row.status !== "draft").map(fromRow);
}

/**
 * The queue, newest first — the admin portal's read.
 *
 * Drafts are left out. A row that never got past step 1 is noise in a work
 * queue, and the retention sweep will clear it.
 */
export async function listSubmissions(): Promise<Submission[]> {
  const rows = await db
    .select()
    .from(submissions)
    /*
      **Everything, including the scratch pads.**

      This filtered to paid submissions on the reasoning that an unfinished
      attempt isn't work. True, but it isn't the same as "not worth seeing": a
      row sitting at `draft` is someone filling in the form *right now*, and at
      this volume that's the most interesting thing on the page. Hiding it also
      made the queue silent during a QA run, which is when you least want it to
      be.

      They age out on their own — the abandonment sweep deletes them outright,
      row and files — so nothing accumulates. The queue's tabs separate them from
      the paid work rather than a query doing it invisibly.

      It was also a hardcoded list of five statuses, written when the ladder had
      seven rungs, which silently stopped matching when it grew to sixteen and
      hid everything from `sent_to_coach` onward. Whatever this returns should be
      derived or unfiltered — never a list someone has to remember to update.
    */
    .orderBy(desc(submissions.submittedAt));
  return rows.map(fromRow);
}

/** Submissions assigned to one coach, newest first — the coach portal's read. */
export async function findByCoach(coachId: string): Promise<Submission[]> {
  const rows = await db
    .select()
    .from(submissions)
    .where(eq(submissions.assignedCoachId, coachId))
    .orderBy(desc(submissions.submittedAt));
  return rows.map(fromRow);
}

/** The status-lookup read: a customer's submissions, trimmed to what's safe.
 * Feedback files are deliberately not exposed here — delivery rides on the
 * signed link in the customer's email, not on this email lookup. */
/**
 * A customer's submissions, sanitised for their own eyes.
 *
 * ⚠️ **Sensitive — call only behind proof of the inbox.** It carries a child's
 * first name, a focus and a date, keyed on an email address that is trivially
 * guessable. There used to be an open `POST /api/status` in front of this; it
 * was removed on 2026-08-01, because gating the *page* while leaving the
 * *endpoint* open would have been theatre.
 *
 * The two callers that may use it: the capability link (the link itself is the
 * proof) and the code-verified lookup.
 */
export async function lookupPublicSubmissions(
  email: string,
): Promise<PublicSubmission[]> {
  const submissionsForEmail = await findByCustomerEmail(email);
  return submissionsForEmail.map(toPublicSubmission);
}

/**
 * Completed submissions whose uploads are due for deletion.
 *
 * The customer has their feedback and the coach is done, so the *files* go while
 * the *record* stays — the receipt and the portal still need to say what was
 * sent. `filesPurgedAt` excludes rows already handled, so the sweep is
 * idempotent and a second run in the same window is a no-op.
 */
export async function findResolvedDue(
  collectedBefore: Date,
  deliveredBefore: Date,
): Promise<Submission[]> {
  const rows = await db
    .select()
    .from(submissions)
    .where(
      and(
        isNull(submissions.filesPurgedAt),
        inArray(submissions.status, RELEASED_STATUSES),
        /*
          Two clocks, and the later one wins.

          A submission that was collected is due `retainCollectedDays` after
          *that* — never before, so nothing is deleted out from under a customer
          who hasn't fetched it. One that was never collected has no such anchor
          and would otherwise live forever, so it falls back to
          `retainDeliveredDays` from delivery.

          Expressed as "collected and old enough, OR never collected and
          delivered long enough ago" — which is the same thing as whichever-is-
          later, without needing a computed column to sort on.
        */
        or(
          and(
            isNotNull(submissions.collectedAt),
            lt(submissions.collectedAt, collectedBefore),
          ),
          and(
            isNull(submissions.collectedAt),
            isNotNull(submissions.completedAt),
            lt(submissions.completedAt, deliveredBefore),
          ),
        ),
      ),
    );
  return rows.map(fromRow);
}

/**
 * Released submissions approaching deletion that haven't been warned yet.
 *
 * The one genuinely *scheduled* effect in the system. Everything else the sweep
 * does is derivable from state — "delete what's due" needs no memory — but "warn
 * a week out" is a one-off that must fire exactly once, which is what
 * `deletionWarnedAt` is for. Without it this would send every night for seven
 * nights.
 *
 * Only submissions with a collection clock are warned. One that was never
 * collected is running on the backstop, and warning someone about files they
 * never came for would be the first they'd heard of any of it.
 */
export async function findWarningDue(
  collectedBefore: Date,
): Promise<Submission[]> {
  const rows = await db
    .select()
    .from(submissions)
    .where(
      and(
        isNull(submissions.filesPurgedAt),
        isNull(submissions.deletionWarnedAt),
        inArray(submissions.status, RELEASED_STATUSES),
        isNotNull(submissions.collectedAt),
        lt(submissions.collectedAt, collectedBefore),
      ),
    );
  return rows.map(fromRow);
}

/**
 * The rungs a submission can be sitting on once it has reached the customer.
 *
 * Derived from the same `isReleased` predicate the rest of the app uses, rather
 * than listed here — a literal list is exactly what went stale when `collected`
 * was added, and a sweep that quietly stops matching is a sweep nobody notices
 * has stopped.
 */
const RELEASED_STATUSES = SUBMISSION_STATUSES.filter((status) =>
  isReleased({ status }),
);

/**
 * Submissions that were never paid for and have gone quiet.
 *
 * **These are deleted outright, not purged** — nothing was ever bought, so there
 * is no history worth keeping and a kept row is just noise in the queue. That's
 * the difference from `findResolvedDue`, and it's why they're separate reads
 * rather than one query with a flag.
 *
 * `limit` exists because the caller may be a customer request rather than a cron
 * job: cleaning up is worth a few milliseconds of someone's page load, but not
 * an unbounded one.
 *
 * **Measured from `updatedAt`, not `submittedAt`** — "gone quiet" is about the
 * last sign of life, not about when they started. Verifying an email or having a
 * card declined both touch the row, so a customer who goes to find another card
 * doesn't come back to a deleted upload. Against `submittedAt` the clock ran
 * from creation regardless, which reaped people who were still working.
 */
export async function findAbandonedDue(
  before: Date,
  limit = 25,
): Promise<Submission[]> {
  const rows = await db
    .select()
    .from(submissions)
    .where(
      and(
        inArray(submissions.status, ["draft", "awaiting_payment"]),
        lt(submissions.updatedAt, before),
      ),
    )
    .orderBy(submissions.updatedAt)
    .limit(limit);
  return rows.map(fromRow);
}
