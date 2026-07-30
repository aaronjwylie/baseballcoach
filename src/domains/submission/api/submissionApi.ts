/**
 * Submission queries — everything the app does to the `submissions` table.
 *
 * Callers get a domain `Submission`; nobody outside this file (and its row
 * mapper) sees a Drizzle row or a column name.
 */
import { desc, eq } from "drizzle-orm";
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
  if (patch.videoUrl !== undefined) v.videoUrl = patch.videoUrl;
  if (patch.feedbackUrl !== undefined) v.feedbackUrl = patch.feedbackUrl;
  if (patch.assignedCoachId !== undefined) v.assignedCoachId = patch.assignedCoachId;
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
      status: input.status ?? "awaiting_upload",
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

/** All submissions for a customer's email (they're stored lowercased). */
export async function findByCustomerEmail(
  email: string,
): Promise<Submission[]> {
  const rows = await db
    .select()
    .from(submissions)
    .where(eq(submissions.customerEmail, email.trim().toLowerCase()))
    .orderBy(desc(submissions.submittedAt));
  return rows.map(fromRow);
}

/** The whole queue, newest first — the admin portal's read. */
export async function listSubmissions(): Promise<Submission[]> {
  const rows = await db
    .select()
    .from(submissions)
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
