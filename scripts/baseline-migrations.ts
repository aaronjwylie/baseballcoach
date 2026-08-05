/**
 * Baseline a squashed migration history — tell the database the new single
 * migration is already applied, without running it.
 *
 * ## The problem this solves
 *
 * Squashing seventeen migrations into one leaves a database that *has* the
 * schema but has never heard of the file describing it. Drizzle decides what to
 * apply by timestamp alone (`pg-core/dialect.js`):
 *
 *     if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis)
 *
 * It never compares hashes to decide what to skip. A squash written today is
 * newer than everything in `__drizzle_migrations`, so drizzle reads it as
 * pending and runs `CREATE TYPE …` against types that already exist. Postgres
 * errors, `migrate-on-deploy.mjs` fails the build, and the deploy is blocked
 * until someone works out why.
 *
 * The fix is to rewrite the ledger, not the schema.
 *
 * ## Why this is a script and not a SQL snippet in a runbook
 *
 * The hash is `sha256` of the migration file's exact bytes. Pasted by hand it is
 * a 64-character opportunity to be wrong, and wrong here means the squash runs
 * on the next deploy — the failure this exists to prevent. Computing it from the
 * file is the only version that can't drift when the file is regenerated.
 *
 * ## What it refuses to do
 *
 * It will not baseline a database whose schema doesn't already match the squash.
 * The tables and enums the file creates are parsed out of the SQL and checked
 * for existence first; if any are missing, the honest answer is that this
 * migration has real work to do and should be *run*, not marked done. Baselining
 * there would silently skip a schema change and leave the code broken against a
 * database nobody would think to suspect.
 *
 * ## Usage
 *
 *     npm run db:baseline           # dry run — reports, changes nothing
 *     npm run db:baseline -- --apply
 *
 * Dry run is the default because the mutation is destructive to the ledger and
 * this is normally pointed at production.
 */
import "./loadEnv";
import crypto from "node:crypto";
import fs from "node:fs";
import postgres from "postgres";

const MIGRATIONS_DIR = "drizzle";
const SCHEMA = "drizzle";
const TABLE = "__drizzle_migrations";

const apply = process.argv.includes("--apply");

/** Mirrors `drizzle.config.ts` — migrations want a direct session, not the pooler. */
const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL;
if (!url) {
  console.error("No POSTGRES_URL_NON_POOLING or DATABASE_URL — nothing to connect to.");
  process.exit(1);
}

/** The one migration the journal now describes, and the hash drizzle will compute for it. */
function readSquash() {
  const journal = JSON.parse(
    fs.readFileSync(`${MIGRATIONS_DIR}/meta/_journal.json`, "utf8"),
  ) as { entries: { tag: string; when: number }[] };

  if (journal.entries.length !== 1) {
    console.error(
      `Journal has ${journal.entries.length} entries, not 1. This script baselines a\n` +
        `squashed history; with a normal history there is nothing to baseline —\n` +
        `run \`npm run db:migrate\`.`,
    );
    process.exit(1);
  }

  const { tag, when } = journal.entries[0];
  // Read as bytes→string exactly as drizzle does, so the hash matches byte for byte.
  const sql = fs.readFileSync(`${MIGRATIONS_DIR}/${tag}.sql`).toString();

  return {
    tag,
    when,
    sql,
    hash: crypto.createHash("sha256").update(sql).digest("hex"),
    // Parsed from the SQL rather than hardcoded, so a regenerated squash with a
    // seventh table can't quietly pass a check written against six.
    tables: [...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]),
    types: [...sql.matchAll(/CREATE TYPE "public"\."([^"]+)"/g)].map((m) => m[1]),
  };
}

async function main() {
  const squash = readSquash();
  const sql = postgres(url!, { max: 1, prepare: false });

  try {
    console.log(`\n  migration   ${squash.tag}`);
    console.log(`  hash        ${squash.hash}`);
    console.log(`  created_at  ${squash.when}`);
    console.log(`  declares    ${squash.tables.length} tables, ${squash.types.length} enums\n`);

    const ledgerExists = await sql`
      SELECT to_regclass(${`${SCHEMA}.${TABLE}`}) IS NOT NULL AS present
    `;
    if (!ledgerExists[0].present) {
      console.error(
        `  ${SCHEMA}.${TABLE} does not exist — this database has never been\n` +
          `  migrated. Nothing to baseline: run \`npm run db:migrate\` and let the\n` +
          `  squash apply normally.`,
      );
      process.exit(1);
    }

    const rows = await sql<{ hash: string; created_at: string }[]>`
      SELECT hash, created_at FROM ${sql(SCHEMA)}.${sql(TABLE)} ORDER BY created_at
    `;

    // Already done — say so and change nothing, so this is safe to re-run and
    // safe to leave in a deploy checklist someone follows twice.
    if (
      rows.length === 1 &&
      rows[0].hash === squash.hash &&
      Number(rows[0].created_at) === squash.when
    ) {
      console.log("  Already baselined. No changes needed.\n");
      return;
    }

    if (rows.length === 0) {
      console.error(
        "  The ledger is empty, so there is no history to replace. Run\n" +
          "  `npm run db:migrate` instead — the squash should genuinely apply.",
      );
      process.exit(1);
    }

    const last = Number(rows[rows.length - 1].created_at);
    console.log(`  ledger holds ${rows.length} applied migration(s), latest ${last}`);
    if (last >= squash.when) {
      console.error(
        `\n  The newest applied migration (${last}) is not older than the squash\n` +
          `  (${squash.when}). Drizzle would already consider the squash applied, so\n` +
          `  something is off — investigate before touching the ledger.`,
      );
      process.exit(1);
    }

    // The precondition that actually matters: the schema must already be what
    // the squash describes, or marking it applied hides real work.
    const presentTables = (
      await sql<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `
    ).map((r) => r.tablename);
    const presentTypes = (
      await sql<{ typname: string }[]>`
        SELECT t.typname FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typtype = 'e'
      `
    ).map((r) => r.typname);

    const missingTables = squash.tables.filter((t) => !presentTables.includes(t));
    const missingTypes = squash.types.filter((t) => !presentTypes.includes(t));

    if (missingTables.length || missingTypes.length) {
      console.error(
        `\n  REFUSING — the database does not already match the squash.\n` +
          (missingTables.length ? `  missing tables: ${missingTables.join(", ")}\n` : "") +
          (missingTypes.length ? `  missing enums:  ${missingTypes.join(", ")}\n` : "") +
          `\n  Baselining would mark real schema work as done and leave the code\n` +
          `  running against a database missing it. Run the migration instead.`,
      );
      process.exit(1);
    }
    console.log(`  schema matches: all ${squash.tables.length} tables and ${squash.types.length} enums present`);

    const backup = `${TABLE}_backup_${squash.when}`;
    const backupExists = await sql`
      SELECT to_regclass(${`${SCHEMA}.${backup}`}) IS NOT NULL AS present
    `;
    if (backupExists[0].present) {
      console.error(
        `\n  ${SCHEMA}.${backup} already exists. Refusing to overwrite an earlier\n` +
          `  backup — inspect it, then drop it if it is genuinely stale.`,
      );
      process.exit(1);
    }

    if (!apply) {
      console.log(
        `\n  DRY RUN. With --apply this would:\n` +
          `    1. copy ${rows.length} row(s) to ${SCHEMA}.${backup}\n` +
          `    2. delete them from ${SCHEMA}.${TABLE}\n` +
          `    3. insert one row: ${squash.hash.slice(0, 16)}… / ${squash.when}\n` +
          `  all in one transaction, verified before commit.\n`,
      );
      return;
    }

    await sql.begin(async (tx) => {
      await tx`CREATE TABLE ${tx(SCHEMA)}.${tx(backup)} AS SELECT * FROM ${tx(SCHEMA)}.${tx(TABLE)}`;
      await tx`DELETE FROM ${tx(SCHEMA)}.${tx(TABLE)}`;
      await tx`
        INSERT INTO ${tx(SCHEMA)}.${tx(TABLE)} (hash, created_at)
        VALUES (${squash.hash}, ${squash.when})
      `;

      // Verify inside the transaction so a surprise rolls back rather than ships.
      const after = await tx<{ hash: string; created_at: string }[]>`
        SELECT hash, created_at FROM ${tx(SCHEMA)}.${tx(TABLE)}
      `;
      if (
        after.length !== 1 ||
        after[0].hash !== squash.hash ||
        Number(after[0].created_at) !== squash.when
      ) {
        throw new Error(
          `verification failed — ledger holds ${after.length} row(s) after the swap`,
        );
      }
    });

    console.log(
      `\n  Baselined.\n` +
        `    ${rows.length} row(s) backed up to ${SCHEMA}.${backup}\n` +
        `    ledger now holds the squash alone\n` +
        `\n  \`drizzle-kit migrate\` is now a no-op against this database.\n` +
        `  To undo: DELETE FROM ${SCHEMA}.${TABLE};\n` +
        `           INSERT INTO ${SCHEMA}.${TABLE} SELECT * FROM ${SCHEMA}.${backup};\n`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("\n  Failed — nothing was committed.\n", error);
  process.exit(1);
});
