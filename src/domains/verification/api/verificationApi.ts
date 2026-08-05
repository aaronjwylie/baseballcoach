/**
 * Issuing and checking the 6-digit code.
 *
 * The only place the app touches the verification columns on `submissions`.
 * **The code itself is never stored** — only a bcrypt hash of it, the same
 * treatment an operator password gets. A leaked database snapshot therefore
 * doesn't hand over live codes.
 */
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { submissions } from "@/domains/submission/model/submissionsTable";
import { noteVerification, recordSubmissionEvent } from "@/domains/submission";
import {
  CODE_LENGTH,
  CODE_TTL_MINUTES,
  MAX_ATTEMPTS,
  type VerificationResult,
} from "../model/verification";

/**
 * A uniformly random code, zero-padded.
 *
 * `randomInt` from `node:crypto`, not `Math.random()`: the value gates access to
 * a submission, and `Math.random()` is predictable from prior outputs.
 */
function generateCode(): string {
  const max = 10 ** CODE_LENGTH;
  return String(randomInt(0, max)).padStart(CODE_LENGTH, "0");
}

/**
 * Mint a code for a submission and return it for sending.
 *
 * Returning the plaintext is deliberate and is the only moment it exists: the
 * caller hands it straight to the email and drops it. Issuing resets the attempt
 * counter, so asking for a fresh code is the documented way out of a lockout.
 */
export async function issueCode(submissionId: string): Promise<string | null> {
  const code = generateCode();
  const hash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  const [row] = await db
    .update(submissions)
    .set({
      verificationCodeHash: hash,
      verificationExpiresAt: expiresAt,
      verificationAttempts: 0,
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, submissionId))
    .returning({ id: submissions.id });

  return row ? code : null;
}

/**
 * Check a code and, on success, mark the email verified and open the submission
 * for uploads.
 *
 * The attempt counter increments **before** the comparison, so a caller who
 * disconnects mid-request still spends their attempt — otherwise the cap would
 * be trivially bypassed by aborting each losing request.
 */
export async function verifyCode(
  submissionId: string,
  code: string,
): Promise<VerificationResult> {
  const [row] = await db
    .select({
      hash: submissions.verificationCodeHash,
      expiresAt: submissions.verificationExpiresAt,
      attempts: submissions.verificationAttempts,
      verifiedAt: submissions.emailVerifiedAt,
      status: submissions.status,
    })
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);

  // No row means no submission: there is nothing to leave a breadcrumb on.
  if (!row) return { ok: false, reason: "no_code" };

  /*
    Already through. Not an error, and deliberately not recorded — a customer
    who reloads step 2 would otherwise stamp a fresh "code accepted" every time,
    burying the real one under duplicates of itself.
  */
  if (row.verifiedAt) return { ok: true };

  if (!row.hash || !row.expiresAt) {
    await noteVerification(submissionId, false, "no code outstanding");
    return { ok: false, reason: "no_code" };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    await noteVerification(submissionId, false, "the window had closed");
    return { ok: false, reason: "expired" };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await noteVerification(submissionId, false, `${MAX_ATTEMPTS} attempts spent`);
    return { ok: false, reason: "too_many_attempts" };
  }

  await db
    .update(submissions)
    .set({ verificationAttempts: row.attempts + 1 })
    .where(eq(submissions.id, submissionId));

  const matches = await bcrypt.compare(code, row.hash);
  if (!matches) {
    // The count *after* this attempt, which is what the reader wants: "3 of 5
    // spent" answers "how much rope is left" without arithmetic.
    const spent = row.attempts + 1;
    await noteVerification(
      submissionId,
      false,
      `wrong code — ${spent} of ${MAX_ATTEMPTS} attempts spent`,
    );
    return { ok: false, reason: "mismatch" };
  }

  // Only a draft advances. A submission already paid for must not be walked
  // backwards into `awaiting_payment` by a replayed verification.
  const nextStatus = row.status === "draft" ? "awaiting_payment" : row.status;

  // This slice owns the verification columns and writes them directly rather
  // than through `updateSubmission`, so the status change here has to stamp the
  // trail itself — otherwise a customer's verification is the one transition
  // missing from the history. Both writes share a transaction so the row and its
  // event cannot disagree, and the event is recorded only when the guarded
  // update actually moved the status.
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(submissions)
      .set({
        emailVerifiedAt: new Date(),
        // Clearing the hash makes the code single-use.
        verificationCodeHash: null,
        verificationExpiresAt: null,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(and(eq(submissions.id, submissionId), eq(submissions.status, row.status)))
      .returning({ id: submissions.id });

    if (updated.length > 0) {
      // Inside the transaction, so the breadcrumb and the rung cannot disagree
      // — and only when the guarded update actually took, or a lost race would
      // record an acceptance that never happened.
      await noteVerification(
        submissionId,
        true,
        row.attempts > 0 ? `on attempt ${row.attempts + 1}` : undefined,
        tx,
      );
      if (nextStatus !== row.status) {
        await recordSubmissionEvent(submissionId, nextStatus, undefined, tx);
      }
    }
  });

  return { ok: true };
}

/** Whether this submission's email has been proven. The upload gate's question. */
export async function isEmailVerified(submissionId: string): Promise<boolean> {
  const [row] = await db
    .select({ verifiedAt: submissions.emailVerifiedAt })
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);
  return !!row?.verifiedAt;
}
