/**
 * Submission queries — everything the app does to the `submissions` table.
 *
 * Callers get a domain `Submission`; nobody outside this file (and its row
 * mapper) sees a Drizzle row or a column name. The customer's uploaded files
 * are a separate table with its own module, `submissionFileApi.ts`.
 */
import { and, desc, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
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
 * Re-open a draft with edited details.
 *
 * A customer who goes back from the verification step to fix a typo in their
 * email must land on an *unverified* submission — otherwise changing the address
 * after verifying would leave a row verified against an email nobody proved.
 */
export async function updateDraftDetails(
  id: string,
  input: NewSubmission,
): Promise<Submission> {
  const [row] = await db
    .update(submissions)
    .set({
      customerEmail: input.customerEmail.trim().toLowerCase(),
      playerName: input.playerName,
      playerAge: input.playerAge ?? null,
      focus: input.focus ?? null,
      customerNotes: input.customerNotes ?? null,
      status: "draft",
      emailVerifiedAt: null,
      verificationCodeHash: null,
      verificationExpiresAt: null,
      verificationAttempts: 0,
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, id))
    .returning();
  return fromRow(row);
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
    .where(inArray(submissions.status, ["new", "assigned", "in_review", "complete"]))
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
  return submissionsForEmail.map(toPublicSubmission);
}

/**
 * Submissions whose uploaded files are due for deletion — the retention sweep's
 * read. Two rules, both operator-tunable, evaluated against cutoffs the caller
 * computes from the current settings:
 *
 * - **resolved**: completed longer ago than `resolvedBefore`;
 * - **abandoned**: never paid for, opened longer ago than `unpaidBefore`.
 *
 * Rows already swept (`filesPurgedAt` set) are excluded, so the sweep is
 * idempotent and a second run in the same window is a no-op.
 */
export async function findSweepable(
  resolvedBefore: Date,
  unpaidBefore: Date,
): Promise<Submission[]> {
  const rows = await db
    .select()
    .from(submissions)
    .where(
      and(
        isNull(submissions.filesPurgedAt),
        or(
          and(
            eq(submissions.status, "complete"),
            isNotNull(submissions.completedAt),
            lt(submissions.completedAt, resolvedBefore),
          ),
          and(
            inArray(submissions.status, ["draft", "awaiting_payment"]),
            lt(submissions.submittedAt, unpaidBefore),
          ),
        ),
      ),
    );
  return rows.map(fromRow);
}
