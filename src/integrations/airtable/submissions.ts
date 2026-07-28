/**
 * Submission queries. Everything the app does to the Submissions table goes
 * through here, and everything it gets back is a domain `Submission`.
 *
 * No caller outside this folder should ever see an Airtable record shape or a
 * column name.
 */
import type { Submission, SubmissionPatch } from "@/types/submission";
import {
  createRecord,
  escapeFormulaValue,
  getRecord,
  queryRecords,
  updateRecord,
} from "./client";
import { COLUMN, fromAirtableRecord, toAirtableFields } from "./schema";

/** Newest first — what both Yuta and the customer want to see at the top. */
const NEWEST_FIRST = {
  sortBy: { column: COLUMN.submittedAt, direction: "desc" },
} as const;

export async function createSubmission(
  patch: SubmissionPatch,
): Promise<Submission> {
  return fromAirtableRecord(await createRecord(toAirtableFields(patch)));
}

export async function updateSubmission(
  id: string,
  patch: SubmissionPatch,
): Promise<Submission> {
  return fromAirtableRecord(await updateRecord(id, toAirtableFields(patch)));
}

export async function getSubmission(id: string): Promise<Submission | null> {
  const record = await getRecord(id);
  return record ? fromAirtableRecord(record) : null;
}

async function findOne(
  column: string,
  value: string,
): Promise<Submission | null> {
  const records = await queryRecords(
    `{${column}} = '${escapeFormulaValue(value)}'`,
    { maxRecords: 1 },
  );
  const record = records[0];
  return record ? fromAirtableRecord(record) : null;
}

export function findByStripePaymentId(
  paymentId: string,
): Promise<Submission | null> {
  return findOne(COLUMN.stripePaymentId, paymentId);
}

export function findByMuxUploadId(
  uploadId: string,
): Promise<Submission | null> {
  return findOne(COLUMN.muxUploadId, uploadId);
}

export function findByMuxAssetId(assetId: string): Promise<Submission | null> {
  return findOne(COLUMN.muxAssetId, assetId);
}

/**
 * All submissions for a customer's email.
 *
 * Airtable formula comparison is case-sensitive, and customers don't type their
 * address the same way twice — so both sides are lowercased. Writes are
 * lowercased too, but LOWER() on the stored value costs nothing and protects
 * against anything typed straight into the base by hand.
 */
export async function findByCustomerEmail(
  email: string,
): Promise<Submission[]> {
  const normalized = escapeFormulaValue(email.trim().toLowerCase());
  const records = await queryRecords(
    `LOWER({${COLUMN.customerEmail}}) = '${normalized}'`,
    NEWEST_FIRST,
  );
  return records.map(fromAirtableRecord);
}
