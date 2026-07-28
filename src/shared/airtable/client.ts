/**
 * Airtable REST transport. Knows how to talk to the API; knows nothing about
 * what the records mean — that's `submissions.ts`, via `schema.ts`.
 *
 * Airtable allows 5 requests/second per base. At MVP volume we're nowhere near
 * it, but reads are never cached: this is a back-office system of record and a
 * stale read here means Yuta acts on the wrong information.
 */
import { env } from "@/shared/config/env";

/**
 * A raw Airtable record, before any domain meaning is attached.
 *
 * Domain-less on purpose: this is the shape the API returns for ANY table.
 * Translating `fields` into something meaningful is a domain's job — see
 * `domains/submission/api/submissionSchema.ts`.
 */
export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

const API_BASE = "https://api.airtable.com/v0";

function tableUrl(): string {
  return `${API_BASE}/${env.airtableBaseId}/${encodeURIComponent(env.airtableTable)}`;
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${env.airtableApiKey}`,
    "Content-Type": "application/json",
  };
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Airtable ${response.status}: ${body}`);
  }
  return response.json() as Promise<T>;
}

export async function createRecord(
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const response = await fetch(tableUrl(), {
    method: "POST",
    headers: headers(),
    // typecast lets Airtable coerce our strings into single-selects and
    // numbers rather than rejecting the write outright.
    body: JSON.stringify({ fields, typecast: true }),
  });
  return parse<AirtableRecord>(response);
}

export async function updateRecord(
  id: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const response = await fetch(`${tableUrl()}/${id}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ fields, typecast: true }),
  });
  return parse<AirtableRecord>(response);
}

export async function getRecord(id: string): Promise<AirtableRecord | null> {
  const response = await fetch(`${tableUrl()}/${id}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (response.status === 404) return null;
  return parse<AirtableRecord>(response);
}

/**
 * Escape a value for interpolation into an Airtable formula.
 *
 * Formulas are strings, so anything user-supplied is an injection surface.
 * Backslash first — escaping it after the quotes would double-escape the
 * backslashes we just added.
 */
export function escapeFormulaValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export interface QueryOptions {
  maxRecords?: number;
  sortBy?: { column: string; direction: "asc" | "desc" };
}

export async function queryRecords(
  formula: string,
  options: QueryOptions = {},
): Promise<AirtableRecord[]> {
  const params = new URLSearchParams({
    filterByFormula: formula,
    maxRecords: String(options.maxRecords ?? 50),
  });

  if (options.sortBy) {
    params.append("sort[0][field]", options.sortBy.column);
    params.append("sort[0][direction]", options.sortBy.direction);
  }

  const response = await fetch(`${tableUrl()}?${params.toString()}`, {
    headers: headers(),
    cache: "no-store",
  });
  const data = await parse<{ records: AirtableRecord[] }>(response);
  return data.records;
}
