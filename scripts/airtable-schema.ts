/**
 * Build, migrate, and verify the Airtable table from `submissionTableSpec.ts`.
 *
 *   npm run schema -- --inspect     what the base has vs. what the app expects
 *   npm run schema -- --create      build the table in an empty base
 *   npm run schema -- --migrate     rename/add fields on an old-schema base
 *
 * **Dry run by default.** Nothing is written until you add `--apply`, and the
 * base id is printed first either way.
 *
 * ## What this can and can't do
 *
 * Airtable's Meta API can create tables, create fields, and **rename** fields.
 * It **cannot convert a field's type** — text→number, text→single-select. Those
 * are three clicks each in the UI and the script tells you exactly which ones
 * are outstanding, so `--inspect` is the checklist.
 *
 * That limit is why renaming is safe: a rename keeps the data, so the risky part
 * of the migration is the handful of conversions you do deliberately by hand.
 *
 * ## The PAT needs four scopes
 *
 *   schema.bases:read · schema.bases:write · data.records:read · data.records:write
 *
 * The first two are only needed by this script. If you'd rather not grant write
 * access to schema, run `--inspect` (needs only `schema.bases:read`) and do the
 * changes it lists by hand.
 */
import "./loadEnv";
import {
  COMPUTED_TYPES,
  LEGACY_RENAMES,
  LEGACY_RETIRED,
  PREFERRED_PRIMARY,
  SUBMISSION_FIELDS,
  type FieldSpec,
} from "@/domains/submission/api/submissionTableSpec";
import { env } from "@/shared/config/env";

const META = "https://api.airtable.com/v0/meta";

interface LiveField {
  id: string;
  name: string;
  type: string;
  options?: Record<string, unknown>;
}
interface LiveTable {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: LiveField[];
}

let applying = false;

async function api<T>(
  path: string,
  init?: { method: string; body: unknown },
): Promise<T> {
  const res = await fetch(`${META}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${env.airtableApiKey}`,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Airtable ${res.status} on ${init?.method ?? "GET"} ${path}\n${text}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

async function fetchTables(): Promise<LiveTable[]> {
  const { tables } = await api<{ tables: LiveTable[] }>(
    `/bases/${env.airtableBaseId}/tables`,
  );
  return tables;
}

function findTable(tables: LiveTable[]): LiveTable | undefined {
  return tables.find(
    (t) => t.name.toLowerCase() === env.airtableTable.toLowerCase(),
  );
}

/** The Meta API payload for one field. */
function fieldPayload(spec: FieldSpec) {
  return {
    name: spec.name,
    type: spec.type,
    description: spec.description,
    ...(spec.options ? { options: spec.options } : {}),
  };
}

function choiceNames(options: Record<string, unknown> | undefined): string[] {
  const choices = options?.choices;
  if (!Array.isArray(choices)) return [];
  return choices
    .map((c) => (c && typeof c === "object" && "name" in c ? String(c.name) : ""))
    .filter(Boolean);
}

// ---------------------------------------------------------------- inspect

async function inspect() {
  const tables = await fetchTables();
  const table = findTable(tables);

  if (!table) {
    console.log(`✗ No table named "${env.airtableTable}" in this base.`);
    console.log(`  Tables present: ${tables.map((t) => t.name).join(", ") || "(none)"}`);
    console.log(`\n  → Empty base? Run:  npm run schema -- --create --apply`);
    return;
  }

  console.log(`Table "${table.name}" — ${table.fields.length} field(s)\n`);

  const byName = new Map(table.fields.map((f) => [f.name, f]));
  const ok: string[] = [];
  const wrongType: { spec: FieldSpec; live: LiveField }[] = [];
  const missing: FieldSpec[] = [];
  const badChoices: { spec: FieldSpec; live: LiveField; absent: string[] }[] = [];

  for (const spec of SUBMISSION_FIELDS) {
    const live = byName.get(spec.name);
    if (!live) {
      missing.push(spec);
      continue;
    }
    if (live.type !== spec.type) {
      wrongType.push({ spec, live });
      continue;
    }
    if (spec.type === "singleSelect") {
      const want = choiceNames(spec.options);
      const have = choiceNames(live.options);
      const absent = want.filter((w) => !have.includes(w));
      if (absent.length) {
        badChoices.push({ spec, live, absent });
        continue;
      }
    }
    ok.push(spec.name);
  }

  const legacyPresent = LEGACY_RENAMES.filter((r) => byName.has(r.from));
  const retiredPresent = LEGACY_RETIRED.filter((n) => byName.has(n));
  const unknown = table.fields
    .map((f) => f.name)
    .filter(
      (n) =>
        !SUBMISSION_FIELDS.some((s) => s.name === n) &&
        !LEGACY_RENAMES.some((r) => r.from === n) &&
        !LEGACY_RETIRED.includes(n),
    );

  if (ok.length) console.log(`✓ correct (${ok.length}): ${ok.join(" · ")}\n`);

  if (legacyPresent.length) {
    console.log("→ needs renaming (safe, data is preserved — `--migrate` does this):");
    for (const r of legacyPresent) console.log(`    ${r.from}  →  ${r.to}`);
    console.log();
  }

  if (missing.length) {
    const manual = missing.filter((s) => COMPUTED_TYPES.includes(s.type));
    const automatic = missing.filter((s) => !COMPUTED_TYPES.includes(s.type));

    if (automatic.length) {
      console.log("→ missing (`--migrate --apply` creates these):");
      for (const s of automatic) console.log(`    ${s.name}  (${s.type})`);
      console.log();
    }

    if (manual.length) {
      console.log(
        "⚠ MISSING, AND THE API CANNOT CREATE THEM — Airtable computes these types.",
      );
      console.log("  Add by hand: Airtable → + at the right of the header row.\n");
      for (const s of manual) {
        const label = s.breaksWithout ? "REQUIRED" : "optional";
        console.log(`    [${label}] "${s.name}" — type "${s.type}"`);
        if (s.breaksWithout) console.log(`               ${s.breaksWithout}`);
      }
      console.log();
    }
  }

  if (wrongType.length) {
    console.log("⚠ WRONG TYPE — the API can't convert these. Change by hand in Airtable:");
    for (const { spec, live } of wrongType) {
      console.log(`    ${spec.name}: is "${live.type}", needs "${spec.type}"`);
    }
    console.log();
  }

  if (badChoices.length) {
    console.log("⚠ MISSING SELECT OPTIONS — `--migrate` adds these:");
    for (const { spec, absent } of badChoices) {
      console.log(`    ${spec.name}: ${absent.join(" · ")}`);
    }
    console.log();
  }

  if (retiredPresent.length) {
    console.log(`· retired columns still present (delete last, by hand): ${retiredPresent.join(" · ")}`);
  }
  if (unknown.length) {
    console.log(`· extra columns the app ignores (harmless): ${unknown.join(" · ")}`);
  }

  const blocking = wrongType.length + missing.length + legacyPresent.length + badChoices.length;
  console.log(
    blocking === 0
      ? "\n✓ This base matches what the app expects."
      : `\n${blocking} item(s) outstanding.`,
  );
}

// ----------------------------------------------------------------- create

async function create() {
  const tables = await fetchTables();
  if (findTable(tables)) {
    console.log(
      `✗ "${env.airtableTable}" already exists. Use --migrate, or --inspect to see what's off.`,
    );
    return;
  }

  // Airtable refuses computed types in a create-table call, so the table is
  // built from the plain fields first and the computed ones added after.
  const computed = SUBMISSION_FIELDS.filter((f) => COMPUTED_TYPES.includes(f.type));
  const plain = SUBMISSION_FIELDS.filter((f) => !COMPUTED_TYPES.includes(f.type));

  // The primary field is whichever plain field we've nominated; the rest keep
  // spec order behind it.
  const primary = plain.find((f) => f.name === PREFERRED_PRIMARY) ?? plain[0];
  const ordered = [primary, ...plain.filter((f) => f !== primary)];

  console.log(`Would create "${env.airtableTable}":`);
  console.log(`\n  ${ordered.length} field(s) in the create call —`);
  for (const f of ordered) {
    console.log(`    ${f.name}  (${f.type})${f === primary ? "   ← primary" : ""}`);
  }
  console.log(`\n  ${computed.length} computed field(s) added straight after —`);
  for (const f of computed) console.log(`    ${f.name}  (${f.type})`);

  if (!applying) return dryRunNotice();

  const table = await api<LiveTable>(`/bases/${env.airtableBaseId}/tables`, {
    method: "POST",
    body: {
      name: env.airtableTable,
      description:
        "Customer video-review submissions. Schema owned by the app — see OPERATIONS.md §4.",
      fields: ordered.map(fieldPayload),
    },
  });
  console.log(`\n✓ created table ${table.id} with ${ordered.length} field(s)`);

  // Computed fields, one at a time so a refusal names itself rather than
  // sinking the whole batch.
  const manual: FieldSpec[] = [];
  for (const spec of computed) {
    try {
      await api(`/bases/${env.airtableBaseId}/tables/${table.id}/fields`, {
        method: "POST",
        body: fieldPayload(spec),
      });
      console.log(`✓ added ${spec.name} (${spec.type})`);
    } catch (err) {
      manual.push(spec);
      console.warn(`! ${spec.name}: ${String(err).split("\n").slice(-1)[0]}`);
    }
    await sleep(220);
  }

  if (manual.length) {
    console.log("\n⚠ Airtable wouldn't create these through the API. Add by hand:");
    for (const spec of manual) {
      console.log(`    "${spec.name}" — field type "${spec.type}"`);
    }
    console.log("  (Airtable → + at the right of the header row → pick the type.)");
  }

  console.log("\nThen verify:  npm run schema -- --inspect");
}

// ---------------------------------------------------------------- migrate

async function migrate() {
  const tables = await fetchTables();
  const table = findTable(tables);
  if (!table) {
    console.log(
      `✗ No table named "${env.airtableTable}". Empty base? Use --create instead.`,
    );
    return;
  }

  const byName = new Map(table.fields.map((f) => [f.name, f]));
  const base = `/bases/${env.airtableBaseId}/tables/${table.id}`;
  const planned: string[] = [];

  // 1 · Renames. Safe — Airtable keeps the data.
  for (const { from, to } of LEGACY_RENAMES) {
    const live = byName.get(from);
    if (!live || byName.has(to)) continue;
    planned.push(`rename  ${from} → ${to}`);
    if (applying) {
      await api(`${base}/fields/${live.id}`, { method: "PATCH", body: { name: to } });
      console.log(`  ✓ renamed ${from} → ${to}`);
      await sleep(220);
    }
  }

  // 2 · Missing fields.
  for (const spec of SUBMISSION_FIELDS) {
    const stillNamedLegacy = LEGACY_RENAMES.some(
      (r) => r.to === spec.name && byName.has(r.from),
    );
    if (byName.has(spec.name) || stillNamedLegacy) continue;

    planned.push(`create  ${spec.name} (${spec.type})`);
    if (applying) {
      try {
        await api(`${base}/fields`, { method: "POST", body: fieldPayload(spec) });
        console.log(`  ✓ created ${spec.name}`);
      } catch (err) {
        console.warn(`  ! ${spec.name}: ${String(err).split("\n")[0]}`);
      }
      await sleep(220);
    }
  }

  // 3 · Select options that exist as fields but lack choices.
  for (const spec of SUBMISSION_FIELDS) {
    if (spec.type !== "singleSelect") continue;
    const live = byName.get(spec.name);
    if (!live || live.type !== "singleSelect") continue;

    const have = choiceNames(live.options);
    const absent = choiceNames(spec.options).filter((c) => !have.includes(c));
    if (!absent.length) continue;

    planned.push(`options ${spec.name} += ${absent.join(", ")}`);
    if (applying) {
      try {
        await api(`${base}/fields/${live.id}`, {
          method: "PATCH",
          body: {
            options: { choices: [...have.map((name) => ({ name })), ...absent.map((name) => ({ name }))] },
          },
        });
        console.log(`  ✓ ${spec.name} += ${absent.join(", ")}`);
      } catch (err) {
        console.warn(`  ! ${spec.name}: ${String(err).split("\n")[0]}`);
      }
      await sleep(220);
    }
  }

  if (planned.length === 0) {
    console.log("Nothing to do — no renames or missing fields.");
  } else if (!applying) {
    console.log("Plan:");
    for (const p of planned) console.log(`    ${p}`);
    dryRunNotice();
  }

  console.log("\nStill by hand (the API can't convert field types):");
  console.log("  · run  npm run schema -- --inspect  for the exact list");
  console.log("  · move any [system] lines from Customer Notes to Internal Notes");
  console.log(`  · delete the retired columns last: ${LEGACY_RETIRED.join(" · ")}`);
}

function dryRunNotice() {
  console.log("\n  DRY RUN — nothing was written. Add --apply to execute.");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function reportAndExit(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("environment variable")) {
    console.error(`\n✗ ${message}`);
    console.error("  Add it to .env.local — see .env.example.\n");
  } else if (/401|403|NOT_AUTHORIZED|INVALID_PERMISSIONS/i.test(message)) {
    console.error(`\n✗ ${message}`);
    console.error(
      "\n  The token is missing a scope. This script needs:\n" +
        "    schema.bases:read · schema.bases:write\n" +
        "  Add them at https://airtable.com/create/tokens and make sure the\n" +
        "  token is granted access to THIS base.\n",
    );
  } else {
    console.error(`\n✗ ${message}\n`);
  }
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  applying = argv.includes("--apply");

  console.log(`base ${env.airtableBaseId} · table "${env.airtableTable}"`);
  console.log(applying ? "MODE: APPLY — this writes.\n" : "MODE: dry run\n");

  if (argv.includes("--create")) return create();
  if (argv.includes("--migrate")) return migrate();
  if (argv.includes("--inspect")) return inspect();

  console.log(
    [
      "Usage: npm run schema -- <command> [--apply]",
      "",
      "  --inspect    compare the live base against what the app expects",
      "  --create     build the table in an empty base",
      "  --migrate    rename and add fields on an old-schema base",
      "",
      "Dry run unless --apply is given.",
    ].join("\n"),
  );
}

main().catch(reportAndExit);
