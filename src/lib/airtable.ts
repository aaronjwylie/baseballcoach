/**
 * Thin Airtable REST client for the Submissions table.
 *
 * The Airtable base is the back-office system of record. Field names here must
 * match the columns configured in the base (see README for the schema).
 */
import { env } from "./env";

const API = "https://api.airtable.com/v0";

/** Lifecycle status of a submission, mirrored as a single-select in Airtable. */
export type SubmissionStatus =
  | "Awaiting Upload" // paid, video not yet uploaded
  | "In Review" // video received, with a coach
  | "Complete"; // feedback delivered

export interface SubmissionFields {
  Email: string;
  "Player Name": string;
  "Player Age"?: string;
  Sport?: string; // e.g. "Hitting" / "Pitching"
  Notes?: string;
  Status: SubmissionStatus;
  "Stripe Session ID"?: string;
  "Mux Upload ID"?: string;
  "Mux Asset ID"?: string;
  "Mux Playback ID"?: string;
  "Feedback Link"?: string;
  "Created At"?: string;
  // Set true once the "feedback ready" email has been sent, so a re-fired
  // Airtable automation doesn't email the customer twice. Optional: if the
  // column doesn't exist, the notify webhook still works (see its route).
  "Feedback Emailed"?: boolean;
}

export interface SubmissionRecord {
  id: string;
  fields: Partial<SubmissionFields>;
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${env.airtableApiKey}`,
    "Content-Type": "application/json",
  };
}

function tableUrl(): string {
  return `${API}/${env.airtableBaseId}/${encodeURIComponent(env.airtableTable)}`;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function createSubmission(
  fields: Partial<SubmissionFields>,
): Promise<SubmissionRecord> {
  const res = await fetch(tableUrl(), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ fields, typecast: true }),
  });
  return handle<SubmissionRecord>(res);
}

export async function updateSubmission(
  id: string,
  fields: Partial<SubmissionFields>,
): Promise<SubmissionRecord> {
  const res = await fetch(`${tableUrl()}/${id}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ fields, typecast: true }),
  });
  return handle<SubmissionRecord>(res);
}

export async function getSubmission(
  id: string,
): Promise<SubmissionRecord | null> {
  const res = await fetch(`${tableUrl()}/${id}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  return handle<SubmissionRecord>(res);
}

/** Airtable formula-escape a value for use inside FIND/comparison. */
function escapeFormulaValue(value: string): string {
  return value.replace(/'/g, "\\'");
}

async function findByFormula(
  formula: string,
  maxRecords = 50,
): Promise<SubmissionRecord[]> {
  const params = new URLSearchParams({
    filterByFormula: formula,
    maxRecords: String(maxRecords),
  });
  params.append("sort[0][field]", "Created At");
  params.append("sort[0][direction]", "desc");
  const res = await fetch(`${tableUrl()}?${params.toString()}`, {
    headers: headers(),
    // Back-office reads should never be cached.
    cache: "no-store",
  });
  const data = await handle<{ records: SubmissionRecord[] }>(res);
  return data.records;
}

export async function findBySessionId(
  sessionId: string,
): Promise<SubmissionRecord | null> {
  const records = await findByFormula(
    `{Stripe Session ID} = '${escapeFormulaValue(sessionId)}'`,
    1,
  );
  return records[0] ?? null;
}

export async function findByUploadId(
  uploadId: string,
): Promise<SubmissionRecord | null> {
  const records = await findByFormula(
    `{Mux Upload ID} = '${escapeFormulaValue(uploadId)}'`,
    1,
  );
  return records[0] ?? null;
}

export async function findByAssetId(
  assetId: string,
): Promise<SubmissionRecord | null> {
  const records = await findByFormula(
    `{Mux Asset ID} = '${escapeFormulaValue(assetId)}'`,
    1,
  );
  return records[0] ?? null;
}

/** Case-insensitive lookup of all submissions for a customer's email. */
export async function findByEmail(
  email: string,
): Promise<SubmissionRecord[]> {
  const normalized = escapeFormulaValue(email.trim().toLowerCase());
  return findByFormula(`LOWER({Email}) = '${normalized}'`);
}
