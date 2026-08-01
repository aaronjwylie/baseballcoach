/**
 * Submission queries — everything the app does to the `submissions` table.
 *
 * Callers get a domain `Submission`; nobody outside this file (and its row
 * mapper) sees a Drizzle row or a column name. The customer's uploaded files
 * are a separate table with its own module, `submissionFileApi.ts`.
 */
import { and, desc, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { db, submissions } from "@/shared/db";
import type {
  NewSubmission,
  Submission,
  SubmissionPatch,
} from "../model/submission";
import {
  toPublicSubmission,
  type PublicSubmission,
} from "../model/publicSubmission";
import { fromRow } from "./submissionRow";
import { listFeedbackFiles } from "./submissionFileApi";

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
  if (patch.internalNotes !== undefined) v.internalNotes = patch.internalNotes;
  if (patch.status !== undefined) v.status = patch.status;
  if (patch.stripePaymentId !== undefined) v.stripePaymentId = patch.stripePaymentId;
  if (patch.stripeAmount !== undefined) v.stripeAmount = patch.stripeAmount;
  if (patch.feedbackUrl !== undefined) v.feedbackUrl = patch.feedbackUrl;
  if (patch.assignedCoachId !== undefined) v.assignedCoachId = patch.assignedCoachId;
  if (patch.emailVerifiedAt !== undefined) v.emailVerifiedAt = new Date(patch.emailVerifiedAt);
  if (patch.paidAt !== undefined) v.paidAt = new Date(patch.paidAt);
  if (patch.completedAt !== undefined) v.completedAt = new Date(patch.completedAt);
  if (patch.filesPurgedAt !== undefined) v.filesPurgedAt = new Date(patch.filesPurgedAt);
  if (patch.feedbackEmailedAt !== undefined) {
    v.feedbackEmailedAt = new Date(patch.feedbackEmailedAt);
  }
  return v;
}

export async function createSubmission(
  input: NewSubmission,
): Promise<Submission> {
  const [row] = await db
    .insert(submissions)
    .values({
      customerEmail: input.customerEmail.trim().toLowerCase(),
      playerName: input.playerName,
      playerAge: input.playerAge,
      focus: input.focus,
      customerNotes: input.customerNotes,
      status: input.status ?? "draft",
      stripePaymentId: input.stripePaymentId,
      stripeAmount: input.stripeAmount,
    })
    .returning();
  return fromRow(row);
}

export async function updateSubmission(
  id: string,
  patch: SubmissionPatch,
): Promise<Submission> {
  const [row] = await db
    .update(submissions)
    .set({ ...toUpdateValues(patch), updatedAt: new Date() })
    .where(eq(submissions.id, id))
    .returning();
  return fromRow(row);
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

/** Hand the work to the coach: move `assigned` → `in_review`. Admin action. */
export async function markSubmissionInReview(id: string): Promise<Submission> {
  return updateSubmission(id, { status: "in_review" });
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
    .where(
      inArray(submissions.status, [
        "new",
        "assigned",
        "in_review",
        "awaiting_approval",
        "complete",
      ]),
    )
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

/** The status-lookup read: a customer's submissions, trimmed to what's safe. */
export async function lookupPublicSubmissions(
  email: string,
): Promise<PublicSubmission[]> {
  const submissionsForEmail = await findByCustomerEmail(email);
  return Promise.all(
    submissionsForEmail.map(async (submission) => {
      // Only a completed review has feedback to hand over; skip the query for
      // everything still in flight.
      const feedbackFiles =
        submission.status === "complete"
          ? await listFeedbackFiles(submission.id)
          : [];
      return toPublicSubmission(submission, feedbackFiles);
    }),
  );
}

/**
 * Completed submissions whose uploads are due for deletion.
 *
 * The customer has their feedback and the coach is done, so the *files* go while
 * the *record* stays — the receipt and the portal still need to say what was
 * sent. `filesPurgedAt` excludes rows already handled, so the sweep is
 * idempotent and a second run in the same window is a no-op.
 */
export async function findResolvedDue(before: Date): Promise<Submission[]> {
  const rows = await db
    .select()
    .from(submissions)
    .where(
      and(
        isNull(submissions.filesPurgedAt),
        eq(submissions.status, "complete"),
        isNotNull(submissions.completedAt),
        lt(submissions.completedAt, before),
      ),
    );
  return rows.map(fromRow);
}

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
        lt(submissions.submittedAt, before),
      ),
    )
    .orderBy(submissions.submittedAt)
    .limit(limit);
  return rows.map(fromRow);
}
