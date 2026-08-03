/**
 * Walk a submission through every rung, twice — once with translation, once
 * without — and check what actually happened at each.
 *
 * `npm run flow` proves the customer's half. This proves **the half nobody has
 * walked**: assignment, hand-off, both collection stamps, resolve, the deletion
 * warning and the purge. All of it shipped in a day and none of it had been
 * exercised end to end by a person.
 *
 * It drives the **real domain functions**, not the database — `markCoachCollected`
 * rather than an UPDATE — so the guards, the trail and the emails all run. What
 * it skips is the HTTP and cookie layer above them, which `npm run flow` and a
 * browser already cover.
 *
 * **Every rung is asserted, not just reached.** A simulation that only walks the
 * happy path tells you the statuses can be set, which was never in doubt. The
 * interesting checks are the refusals: collecting before a hand-off, resolving
 * before collection, sweeping something the customer hasn't seen.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/simulate.ts
 */
import "./loadEnv";
import { eq } from "drizzle-orm";
import {
  db,
  submissions as submissionsTable,
  coaches as coachesTable,
  users as usersTable,
} from "@/shared/db";
import {
  addSubmissionFile,
  assignSubmissionCoach,
  createSubmission,
  deleteSubmission,
  getSubmission,
  hasResponse,
  isPaid,
  isReleased,
  isWithCoach,
  listAllSubmissionFiles,
  listSubmissionEvents,
  markCoachCollected,
  markCustomerCollected,
  markSubmissionSentToCoach,
  needsTranslation,
  updateSubmission,
  whoseCourt,
  type Submission,
  type SubmissionStatus,
} from "@/domains/submission";
import { approveAndComplete, resolveSubmission, sendFeedbackForApproval } from "@/domains/feedback";
import { runRetentionSweep } from "@/domains/upload";
import { getSettings } from "@/domains/settings";

const day = 24 * 3600_000;
let pass = 0;
let fail = 0;

function check(ok: boolean, what: string) {
  if (ok) { pass += 1; console.log(`   ✓ ${what}`); }
  else { fail += 1; console.log(`   ✗ ${what}`); }
}

async function at(id: string): Promise<Submission> {
  const s = await getSubmission(id);
  if (!s) throw new Error(`submission ${id} vanished`);
  return s;
}

/** Assert the rung, and that every predicate agrees with it. */
async function rung(
  id: string,
  expected: SubmissionStatus,
  court: ReturnType<typeof whoseCourt>,
) {
  const s = await at(id);
  check(s.status === expected, `${expected.padEnd(21)} (got ${s.status})`);
  check(whoseCourt(s) === court, `   court is ${court}`);
  return s;
}

async function walk(label: string, translating: boolean) {
  console.log(`\n━━ ${label} ━━`);
  /*
    The sim owns its coach rather than picking one out of the seed.

    Whether the translation path runs is now decided by intersecting the
    customer's declared languages with the coach's, so a walk that borrows
    whichever coach happens to be seeded is asserting a rule about data it
    doesn't control — and it fails on a database where nobody has a
    Japanese-only coach, which is most of them.
  */
  const coach = await ensureCoach(
    translating ? "Sim Coach (JA only)" : "Sim Coach (EN)",
    translating ? ["Japanese"] : ["English"],
  );

  // ── rung 1: draft ────────────────────────────────────────────────────
  const s = await createSubmission({
    customerEmail: `sim-${Date.now()}@example.com`,
    playerName: `Sim ${label}`,
    playerAge: 14,
    focus: "Hitting",
    languages: ["English"],
  });
  await rung(s.id, "draft", "customer");
  // The rule the whole translation path hangs off: two declared sets, intersected.
  check(
    needsTranslation((await at(s.id)).languages, coach.languages) === translating,
    `   language check says translation is ${translating ? "" : "not "}needed`,
  );
  check(!isPaid(await at(s.id)), "   nothing is paid at draft");

  // ── rung 2: uploading (verify, attach, pay) ──────────────────────────
  await updateSubmission(s.id, {
    status: "awaiting_payment",
    emailVerifiedAt: new Date().toISOString(),
  });
  await rung(s.id, "awaiting_payment", "customer");

  for (let n = 0; n < 2; n += 1) {
    await addSubmissionFile({
      submissionId: s.id,
      filename: `clip-${n + 1}.mp4`,
      contentType: "video/mp4",
      sizeBytes: 42_000_000,
      fileUrl: `sim/${s.id}/clip-${n + 1}.mp4`,
    });
  }
  check((await listAllSubmissionFiles(s.id)).length === 2, "   two intake files attached");

  // The guards that matter *before* payment.
  check((await markCoachCollected(s.id)) === null, "   a coach can't collect an unsent submission");
  check((await markCustomerCollected(s.id)) === null, "   a customer can't collect an unreleased one");

  await updateSubmission(s.id, {
    status: "new",
    paidAt: new Date().toISOString(),
    stripeAmount: 8500,
    stripePaymentId: `pi_sim_${Date.now()}`,
  });

  // ── rung 3: new ──────────────────────────────────────────────────────
  const paid = await rung(s.id, "new", "admin");
  check(isPaid(paid), "   isPaid flips at the boundary");

  // ── rung 4: assigned ─────────────────────────────────────────────────
  await assignSubmissionCoach(s.id, coach.id);
  const assigned = await rung(s.id, "assigned", "admin");
  check(isWithCoach(assigned), "   it's on the coach's desk");

  // ── rungs 5–6: translation, only when the coach needs it ─────────────
  if (translating) {
    await updateSubmission(s.id, { status: "intake_translating" });
    await rung(s.id, "intake_translating", "translator");
    await addSubmissionFile(
      { submissionId: s.id, filename: "clip-1-JA.mp4", contentType: "video/mp4", sizeBytes: 42_000_000, fileUrl: `sim/${s.id}/ja.mp4` },
      "intake_translation",
    );
    await updateSubmission(s.id, { status: "intake_translated" });
    await rung(s.id, "intake_translated", "admin");
  } else {
    console.log("   — skips 5–6: this coach reads English");
  }

  // ── rung 7: sent_to_coach ────────────────────────────────────────────
  await updateSubmission(s.id, { coachFileSet: translating ? "translation" : "original" });
  await markSubmissionSentToCoach(s.id);
  await rung(s.id, "sent_to_coach", "coach");
  check((await at(s.id)).coachFileSet !== undefined, "   what the coach was sent is recorded");

  // ── rung 8: in_review, earned by a download ──────────────────────────
  const collectedByCoach = await markCoachCollected(s.id);
  check(collectedByCoach?.status === "in_review", "   the coach's download earns in_review");
  check((await markCoachCollected(s.id)) === null, "   a re-download changes nothing");
  await rung(s.id, "in_review", "coach");

  // ── rung 9: awaiting_approval ────────────────────────────────────────
  check((await sendFeedbackForApproval(s.id)) === null, "   can't deliver with no response file");
  await addSubmissionFile(
    { submissionId: s.id, filename: "review.mp4", contentType: "video/mp4", sizeBytes: 88_000_000, fileUrl: `sim/${s.id}/review.mp4` },
    "response",
  );
  await sendFeedbackForApproval(s.id);
  const delivered = await rung(s.id, "awaiting_approval", "admin");
  check(hasResponse(delivered), "   a response exists");
  check(!isReleased(delivered), "   but the customer can't see it");
  check(!delivered.completedAt, "   and no clock has started");

  // ── rungs 10–11: the response's translation ──────────────────────────
  if (translating) {
    await updateSubmission(s.id, { status: "response_translating" });
    await rung(s.id, "response_translating", "translator");
    await addSubmissionFile(
      { submissionId: s.id, filename: "review-EN.mp4", contentType: "video/mp4", sizeBytes: 88_000_000, fileUrl: `sim/${s.id}/review-en.mp4` },
      "response_translation",
    );
    await updateSubmission(s.id, { status: "response_translated" });
    await rung(s.id, "response_translated", "admin");
    // No moving it back: approving from `response_translated` is exactly what a
    // translated submission has to do, and pretending otherwise hid a real bug.
  }

  // ── rung 12: complete ────────────────────────────────────────────────
  await approveAndComplete(s.id, translating ? "translation" : "original");
  const released = await rung(s.id, "complete", "customer");
  check(isReleased(released), "   released to the customer");
  check(!!released.completedAt && !released.collectedAt, "   delivered, but the clock waits for collection");

  // Nothing is due before they collect.
  const early = await runRetentionSweep();
  check((await at(s.id)).status === "complete", `   not swept before collection (${early.resolvedPurged} purged)`);

  // ── rung 13: collected ───────────────────────────────────────────────
  const collected = await markCustomerCollected(s.id);
  check(collected?.status === "collected", "   the customer's download starts the clock");
  check(!!collected?.collectedAt, "   collectedAt is stamped");
  check((await markCustomerCollected(s.id)) === null, "   a re-download can't restart it");
  await rung(s.id, "collected", "admin");

  // ── rung 14: resolved ────────────────────────────────────────────────
  const settings = await getSettings();
  await resolveSubmission(s.id, settings.retainCollectedDays);
  await rung(s.id, "resolved", "system");

  // ── rung 15: purge_imminent — the warning ────────────────────────────
  await db.update(submissionsTable)
    .set({ collectedAt: new Date(Date.now() - (settings.retainCollectedDays - 2) * day) })
    .where(eq(submissionsTable.id, s.id));
  const warned = await runRetentionSweep();
  check(warned.warningsSent >= 1, `   the warning fires before the purge (${warned.warningsSent})`);
  await rung(s.id, "purge_imminent", "system");
  check(!!(await at(s.id)).deletionWarnedAt, "   and is stamped so it can't send twice");
  check((await listAllSubmissionFiles(s.id)).some((f) => f.fileUrl), "   nothing deleted yet");

  // ── rung 16: purged ──────────────────────────────────────────────────
  await db.update(submissionsTable)
    .set({ collectedAt: new Date(Date.now() - (settings.retainCollectedDays + 1) * day) })
    .where(eq(submissionsTable.id, s.id));
  const swept = await runRetentionSweep();
  check(swept.resolvedPurged >= 1, `   purged (${swept.filesDeleted} files)`);
  await rung(s.id, "purged", "system");

  const files = await listAllSubmissionFiles(s.id);
  check(files.length > 0, `   every file record survives (${files.length})`);
  check(files.every((f) => !f.fileUrl), "   every locator is cleared");
  check(!!(await at(s.id)).filesPurgedAt, "   the sweep is stamped");
  check(isReleased(await at(s.id)), "   still released — purged is about bytes, not permission");

  // ── the trail ────────────────────────────────────────────────────────
  const events = await listSubmissionEvents(s.id);
  const rungs = events.filter((e) => e.kind === "status").map((e) => e.status);
  const mails = events.filter((e) => e.kind === "email");
  const expected = translating ? 16 : 12;
  check(rungs.length === expected, `   ${rungs.length} rungs recorded (expected ${expected})`);
  check(new Set(rungs).size === rungs.length, "   no rung recorded twice");
  console.log(`   trail: ${rungs.join(" → ")}`);
  console.log(`   emails: ${mails.length ? mails.map((m) => m.label).join(", ") : "none — RESEND_API_KEY unset locally"}`);

  await deleteSubmission(s.id);
  check((await listSubmissionEvents(s.id)).length === 0, "   deleting cascades the trail");
}

/** A coach with exactly these languages, created once and reused. */
async function ensureCoach(name: string, languages: string[]) {
  const [existing] = await db
    .select()
    .from(coachesTable)
    .where(eq(coachesTable.name, name));
  if (existing) {
    if (existing.languages.join() !== languages.join()) {
      const [fixed] = await db
        .update(coachesTable)
        .set({ languages })
        .where(eq(coachesTable.id, existing.id))
        .returning();
      return fixed;
    }
    return existing;
  }
  const [user] = await db
    .insert(usersTable)
    .values({
      email: `${name.toLowerCase().replace(/[^a-z]+/g, "-")}@sim.local`,
      passwordHash: "x",
      role: "coach",
    })
    .returning();
  const [created] = await db
    .insert(coachesTable)
    .values({ userId: user.id, name, languages, specialties: ["Hitting"] })
    .returning();
  return created;
}

/**
 * The intersection rule itself, before any walk exercises it.
 *
 * A full walk only ever proves the two shapes it happens to use. These are the
 * cases that separate *overlap* from *equality* and *unknown* from *no* — the
 * three ways this rule can be written wrong while still passing a happy path.
 */
function checkLanguageRule() {
  console.log("\n━━ the intersection rule ━━");
  const cases: [string[], string[], boolean | null, string][] = [
    [["English"], ["English"], false, "same single language"],
    [["English"], ["Japanese"], true, "no overlap"],
    [["Japanese"], ["Japanese"], false, "Japanese both sides — the case the old coach-only rule got wrong"],
    [["English"], ["English", "Japanese"], false, "bilingual coach overlaps — sets differ, and that's fine"],
    [["English", "Japanese"], ["Japanese"], false, "bilingual customer overlaps"],
    [["English"], [], null, "coach hasn't declared — unknown, not no"],
    [[], ["English"], null, "customer hasn't declared — unknown, not no"],
    [["english"], ["English"], false, "case and spacing don't make a mismatch"],
  ];
  for (const [customer, coach, want, what] of cases) {
    check(needsTranslation(customer, coach) === want, `${String(want).padEnd(5)} — ${what}`);
  }
}

async function main() {
  console.log("Simulating the whole ladder — both paths, real domain functions.");
  checkLanguageRule();
  await walk("English-reading coach — skips translation", false);
  await walk("Japanese-only coach — full translation path", true);

  console.log(`\n${"─".repeat(56)}`);
  console.log(fail === 0 ? `All ${pass} checks passed.` : `FAILED — ${fail} of ${pass + fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nsimulation threw:", err);
  process.exit(1);
});
