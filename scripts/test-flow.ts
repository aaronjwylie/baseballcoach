/**
 * Walk the whole customer flow server-side, without a browser.
 *
 *   npm run flow
 *
 * The flow is now four steps — details, email verification, upload, payment —
 * and the middle two can't be exercised by hand in dev: the verification code
 * only exists inside an email that `RESEND_API_KEY` may not be configured to
 * send, and a real upload needs a file picker. This drives the same domain
 * functions the actions and routes call, in the same order, and asserts what
 * each one should have changed.
 *
 * ## What this cannot check
 *
 * The cookie plumbing — `authorizeUpload` reading the flow session, the Blob
 * client-token handshake, the Stripe card fields. Those need a real browser and
 * a real request. Everything below the actions is covered here.
 */
import "./loadEnv";
import { storage } from "@/shared/storage";
import {
  countSubmissionFiles,
  createSubmission,
  getSubmission,
  listSubmissionFiles,
  updateSubmission,
} from "@/domains/submission";
import { issueCode, verifyCode } from "@/domains/verification";
import { getSettings } from "@/domains/settings";
import { runRetentionSweep, storeUploadedFile } from "@/domains/upload";
import { storeFeedback, approveAndComplete } from "@/domains/feedback";
import { db, submissions as submissionsTable } from "@/shared/db";
import { eq as eqFn } from "drizzle-orm";

const pass = (msg: string) => console.log(`   ✓ ${msg}`);
const fail = (msg: string) => {
  console.log(`   ✗ ${msg}`);
  process.exitCode = 1;
};
const check = (ok: boolean, msg: string) => (ok ? pass(msg) : fail(msg));

async function main() {
  console.log(`\nBaseball Sensei — customer flow probe\n${"─".repeat(48)}`);
  console.log(`storage driver: ${storage.supportsDirectUpload ? "blob (direct)" : "local disk (proxied)"}`);

  const settings = await getSettings();
  console.log(
    `settings: ${settings.maxFilesPerSubmission} files × ${settings.maxFileSizeMb} MB · ` +
      `retain ${settings.retainResolvedHours}h resolved / ${settings.retainUnpaidHours}h unpaid`,
  );

  // ── 1 · step one: the draft ─────────────────────────────────────────────
  console.log(`\n1 · step 1 — player details`);
  const email = `flow-probe-${Date.now()}@seed.test`;
  const submission = await createSubmission({
    customerEmail: email,
    playerName: "Flow Probe",
    playerAge: 13,
    focus: "Hitting",
    customerNotes: "Created by scripts/test-flow.ts",
  });
  check(submission.status === "draft", `opens as draft (${submission.id})`);
  check(!submission.emailVerifiedAt, "starts unverified");

  // ── 2 · step two: the code ──────────────────────────────────────────────
  console.log(`\n2 · step 2 — email verification`);
  const code = await issueCode(submission.id);
  check(!!code && /^\d{6}$/.test(code), `issued a 6-digit code (${code})`);

  const wrong = await verifyCode(submission.id, "000000");
  check(
    !wrong.ok && wrong.reason === "mismatch",
    "a wrong code is rejected as a mismatch",
  );

  const right = await verifyCode(submission.id, code!);
  check(right.ok, "the real code is accepted");

  const verified = await getSubmission(submission.id);
  check(!!verified?.emailVerifiedAt, "emailVerifiedAt is set");
  check(
    verified?.status === "awaiting_payment",
    `status advanced to awaiting_payment (got "${verified?.status}")`,
  );

  const replay = await verifyCode(submission.id, code!);
  check(replay.ok, "re-verifying is a no-op rather than an error");

  // ── 3 · step three: the files ───────────────────────────────────────────
  console.log(`\n3 · step 3 — uploads`);
  await storeUploadedFile(
    submission.id,
    "swing-side.mp4",
    new TextEncoder().encode("probe video bytes"),
    "video/mp4",
  );
  await storeUploadedFile(
    submission.id,
    "contact-point.png",
    new TextEncoder().encode("probe image bytes"),
    "image/png",
  );

  const files = await listSubmissionFiles(submission.id);
  check(files.length === 2, `two files recorded (${files.length})`);
  check(
    files.every((f) => !!f.fileUrl),
    "both carry a storage locator",
  );
  check(
    (await countSubmissionFiles(submission.id)) === 2,
    "the count the upload gate reads agrees",
  );

  // ── 4 · step four: payment ──────────────────────────────────────────────
  console.log(`\n4 · step 4 — payment`);
  const paid = await updateSubmission(submission.id, {
    status: "new",
    stripePaymentId: `pi_flow_probe_${Date.now()}`,
    stripeAmount: 8000,
    paidAt: new Date().toISOString(),
  });
  check(paid.status === "new", "reaching `new` puts it in the coach queue");
  check(!!paid.paidAt, "paidAt is stamped");

  // ── 5 · retention: the resolved rule ────────────────────────────────────
  console.log(`\n5 · retention sweep`);
  const beforeSweep = await runRetentionSweep();
  check(
    beforeSweep.resolvedPurged === 0,
    `a fresh paid submission is not swept (${beforeSweep.resolvedPurged} purged)`,
  );

  // Deliver the way the portal does: the coach uploads (→ awaiting_approval),
  // then Yuta approves (→ complete). Assert the approval stamps completedAt —
  // an earlier version set the status without the timestamp, so a completed
  // submission was never due for sweeping.
  await storeFeedback(
    submission.id,
    "feedback.mp4",
    new TextEncoder().encode("probe feedback bytes"),
    "video/mp4",
  );
  await approveAndComplete(submission.id);
  const completed = await getSubmission(submission.id);
  check(
    !!completed?.completedAt,
    "completing via the coach + approval path stamps completedAt",
  );

  // Backdate it past the retention window and sweep again.
  const longAgo = new Date(
    Date.now() - (settings.retainResolvedHours + 1) * 3600_000,
  ).toISOString();
  await updateSubmission(submission.id, { completedAt: longAgo });

  const afterSweep = await runRetentionSweep();
  check(
    afterSweep.resolvedPurged >= 1,
    `a long-completed submission is swept (${afterSweep.resolvedPurged} purged, ${afterSweep.filesDeleted} files)`,
  );

  const swept = await listSubmissionFiles(submission.id);
  check(swept.length === 2, "the file records survive the sweep");
  check(
    swept.every((f) => !f.fileUrl),
    "but their locators are cleared",
  );
  const sweptSubmission = await getSubmission(submission.id);
  check(!!sweptSubmission?.filesPurgedAt, "filesPurgedAt is stamped");
  check(
    !!sweptSubmission?.feedbackUrl,
    "the coach's feedback file survives the sweep",
  );

  // ── 6 · abandoned: nothing unpaid is retained ──────────────────────────
  console.log(`\n6 · abandoned submissions leave nothing behind`);
  const orphan = await createSubmission({
    customerEmail: `flow-orphan-${Date.now()}@seed.test`,
    playerName: "Orphan Probe",
    status: "awaiting_payment",
  });
  await storeUploadedFile(
    orphan.id,
    "orphan.mp4",
    new TextEncoder().encode("orphan bytes"),
    "video/mp4",
  );
  // Backdate it past the unpaid window.
  await updateSubmission(orphan.id, {
    status: "awaiting_payment",
    completedAt: undefined,
  });
  await db
    .update(submissionsTable)
    .set({
      submittedAt: new Date(
        Date.now() - (settings.retainUnpaidHours + 1) * 3600_000,
      ),
    })
    .where(eqFn(submissionsTable.id, orphan.id));

  const abandoned = await runRetentionSweep();
  check(
    abandoned.abandonedDiscarded >= 1,
    `an abandoned submission is discarded (${abandoned.abandonedDiscarded})`,
  );
  check(
    (await getSubmission(orphan.id)) === null,
    "and its record is GONE, not merely purged",
  );

  const idempotent = await runRetentionSweep();
  check(
    idempotent.resolvedPurged === 0,
    "a second sweep is a no-op",
  );

  console.log(
    `\n${"─".repeat(48)}\n${process.exitCode ? "FAILED — see ✗ above" : "All checks passed."}\n`,
  );
}

// Exit explicitly, like the seed script: the postgres pool holds the event loop
// open, so a probe that just returns would hang instead of finishing.
main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error("\nProbe crashed:", err);
    process.exit(1);
  });
