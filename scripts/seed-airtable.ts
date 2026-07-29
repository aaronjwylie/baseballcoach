/**
 * Seed the Airtable base with submissions in any workflow state.
 *
 * Why this exists: without it, putting a row into "In Review" meant completing
 * a real $149 Stripe checkout and uploading a real video. Every backend
 * iteration cost a transaction. This creates the same rows directly.
 *
 *   npm run seed                        one submission in each of the 5 states
 *   npm run seed -- --status New        just that state
 *   npm run seed -- --status New -n 3   three of them
 *   npm run seed -- --list              what this script has created
 *   npm run seed -- --clean             delete everything it created
 *
 * Safety, in order of how much they matter:
 *
 * 1. **It writes to whatever `AIRTABLE_BASE_ID` points at.** The base id is
 *    printed before anything happens — read it. There is no way for a script to
 *    know a base is the client's production one, so this is the only guard that
 *    exists.
 * 2. **Seeded addresses use `@seed.test`.** `.test` is reserved by RFC 2606 and
 *    can never resolve, so a webhook that fires an email during testing cannot
 *    reach a real person. Resend will reject it and log — which is the correct
 *    outcome, not a failure.
 * 3. **Every row is stamped in `Internal Notes`**, so strays are findable by eye
 *    in Airtable even if the state file below is lost.
 *
 * Created record ids are tracked in `.seeded-records.json` (gitignored) so
 * `--clean` is exact rather than a guess. Column names never appear here — the
 * script goes through the domain's own functions, so a schema change carries
 * automatically.
 */
import "./loadEnv";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import {
  SUBMISSION_STATUSES,
  createSubmission,
  getSubmission,
  updateSubmission,
  type SubmissionPatch,
  type SubmissionStatus,
} from "@/domains/submission";
import { env } from "@/shared/config/env";

const STATE_FILE = ".seeded-records.json";
const SEED_MARKER = "[seed] Created by scripts/seed-airtable.ts — safe to delete.";

/** Plausible-looking people, so a seeded base reads like a real one. */
const PLAYERS = [
  { playerName: "Alex Tanaka", playerAge: 14, focus: "Hitting" },
  { playerName: "Mika Osborne", playerAge: 11, focus: "Pitching" },
  { playerName: "Devon Reyes", playerAge: 16, focus: "Fielding" },
  { playerName: "Sam Whitfield", playerAge: 9, focus: "Catching" },
  { playerName: "Jordan Lee", playerAge: 17, focus: "Other" },
] as const;

function loadState(): string[] {
  if (!existsSync(STATE_FILE)) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    console.warn(`[seed] ${STATE_FILE} is unreadable — treating as empty.`);
    return [];
  }
}

function saveState(ids: string[]): void {
  if (ids.length === 0) {
    if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE);
    return;
  }
  writeFileSync(STATE_FILE, `${JSON.stringify(ids, null, 2)}\n`);
}

/**
 * Build a row for a given state, carrying whatever the app would have written
 * by the time a real submission reached it.
 */
function rowFor(status: SubmissionStatus, index: number): SubmissionPatch {
  const player = PLAYERS[index % PLAYERS.length];
  const slug = status.toLowerCase().replace(/\s+/g, "-");

  const row: SubmissionPatch = {
    customerEmail: `seed+${slug}-${index + 1}@seed.test`,
    playerName: player.playerName,
    playerAge: player.playerAge,
    focus: player.focus,
    customerNotes: `Seeded row in "${status}".`,
    internalNotes: SEED_MARKER,
    status,
    stripePaymentId: `cs_test_seed_${slug}_${index + 1}`,
    stripeAmount: 149,
  };

  // Anything past "Awaiting Upload" has a video attached.
  if (status !== "Awaiting Upload") {
    row.muxUploadId = `seed_upload_${slug}_${index + 1}`;
    row.muxAssetId = `seed_asset_${slug}_${index + 1}`;
    // A real Mux sample, so the playback URL in Airtable actually resolves.
    row.muxPlaybackId = "DS00Spx1CV902MCtPj5WknGlR102V5HFkDe";
  }

  // "Complete" needs the coach's link, or the feedback webhook treats it as
  // not-ready and the row can't be used to test that path.
  if (status === "Complete") {
    row.feedbackVideoUrl = "https://www.loom.com/share/seed-placeholder";
  }

  return row;
}

async function seed(statuses: readonly SubmissionStatus[], count: number) {
  const ids = loadState();
  let created = 0;

  for (const status of statuses) {
    for (let i = 0; i < count; i++) {
      const submission = await createSubmission(rowFor(status, ids.length + created));
      ids.push(submission.id);
      created++;
      console.log(
        `  + ${submission.id}  ${status.padEnd(16)} ${submission.customerEmail}`,
      );
      // Airtable allows 5 requests/second per base. Stay well under.
      await sleep(220);
    }
  }

  saveState(ids);
  console.log(`\n[seed] created ${created} row(s). Tracked in ${STATE_FILE}.`);
}

async function list() {
  const ids = loadState();
  if (ids.length === 0) {
    console.log("[seed] nothing tracked.");
    return;
  }

  console.log(`[seed] ${ids.length} tracked row(s):\n`);
  for (const id of ids) {
    const submission = await getSubmission(id);
    if (!submission) {
      console.log(`  ? ${id}  (gone from the base)`);
      continue;
    }
    console.log(
      `  · ${id}  ${submission.status.padEnd(16)} ${submission.customerEmail}`,
    );
    await sleep(220);
  }
}

/**
 * Delete every tracked row.
 *
 * Airtable's REST API has no delete in our client — we only ever needed create,
 * update, and read — so rather than widen the domain's surface for a dev script,
 * this blanks the row and parks it in a terminal state. That leaves it obvious
 * and inert; finish the job with a filtered view in Airtable and select-all.
 */
async function clean() {
  const ids = loadState();
  if (ids.length === 0) {
    console.log("[seed] nothing tracked — nothing to clean.");
    return;
  }

  console.log(`[seed] retiring ${ids.length} tracked row(s)…\n`);
  const failed: string[] = [];

  for (const id of ids) {
    try {
      await updateSubmission(id, {
        customerNotes: undefined,
        internalNotes: `${SEED_MARKER}\n[seed] Retired — delete this row.`,
        status: "Complete",
        feedbackVideoUrl: undefined,
      });
      console.log(`  ~ ${id} retired`);
    } catch (err) {
      failed.push(id);
      console.warn(`  ! ${id} could not be updated: ${String(err)}`);
    }
    await sleep(220);
  }

  saveState(failed);
  console.log(
    `\n[seed] done. In Airtable, filter Internal Notes for "[seed]" and delete.`,
  );
  if (failed.length > 0) {
    console.log(`[seed] ${failed.length} still tracked (update failed).`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]) {
  const has = (flag: string) => argv.includes(flag);
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const rawStatus = value("--status");
  let statuses: readonly SubmissionStatus[] = SUBMISSION_STATUSES;

  if (rawStatus) {
    const match = SUBMISSION_STATUSES.find(
      (s) => s.toLowerCase() === rawStatus.toLowerCase(),
    );
    if (!match) {
      console.error(
        `[seed] unknown status "${rawStatus}".\n       one of: ${SUBMISSION_STATUSES.join(" · ")}`,
      );
      process.exit(1);
    }
    statuses = [match];
  }

  const rawCount = value("-n") ?? value("--count");
  const count = rawCount ? Number(rawCount) : 1;
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    console.error("[seed] --count must be a whole number from 1 to 20.");
    process.exit(1);
  }

  return {
    statuses,
    count,
    mode: has("--clean") ? "clean" : has("--list") ? "list" : "seed",
  } as const;
}

async function main() {
  const { statuses, count, mode } = parseArgs(process.argv.slice(2));

  // Print the target before touching it. This is the only thing standing
  // between a careless run and the client's production base.
  console.log(`[seed] base ${env.airtableBaseId} · table ${env.airtableTable}\n`);

  if (mode === "clean") return clean();
  if (mode === "list") return list();
  return seed(statuses, count);
}

/**
 * Config problems are the most common failure here and deserve a sentence, not
 * a stack trace. `env` already throws naming the missing variable; surface that
 * and point at where it's documented.
 */
function reportAndExit(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("environment variable")) {
    console.error(`\n✗ ${message}`);
    console.error("  Add it to .env.local — see .env.example for what it's for.\n");
  } else {
    console.error(`\n✗ ${message}`);
    if (err instanceof Error && err.stack) {
      console.error(err.stack.split("\n").slice(1, 4).join("\n"));
    }
  }
  process.exit(1);
}

main().catch(reportAndExit);
