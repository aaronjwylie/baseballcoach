/**
 * Deleting files once they've served their purpose.
 *
 * Two rules that do **genuinely different things**, on operator-tunable clocks,
 * both relative to the submission's own timestamps — never to a wall clock:
 *
 * | | resolved | abandoned |
 * | --- | --- | --- |
 * | who | a completed review | never paid for |
 * | clock | `retainResolvedHours` after **its** `completedAt` | `retainUnpaidHours` after **its** `submittedAt` |
 * | files | deleted | deleted |
 * | record | **kept**, locator cleared | **deleted outright** |
 *
 * The asymmetry is the point. A paid submission's history matters — the receipt
 * and the portal still have to say what was sent. Nothing was ever bought in the
 * abandoned case, so there is no history to preserve and a kept row is just
 * noise in the queue. **Only payment earns retention** (Yuta, 2026-07-30).
 *
 * **The coach's feedback file is never swept.** The customer's only route to what
 * they bought is the link in their email, and that link has to keep working.
 *
 * The cron cadence is a separate question from the rules. The job only *notices*
 * an elapsed window when it runs, so a daily job makes "24 hours after
 * completion" mean 24–48 in practice. Abandoned submissions don't wait for it —
 * `sweepAbandoned` is also called when a customer starts a new submission, so
 * the flow cleans up after itself under any real traffic.
 */
import { getSettings } from "@/domains/settings";
import {
  clearAllFileLocators,
  findAbandonedDue,
  findResolvedDue,
  findWarningDue,
  listAllSubmissionFiles,
  noteEmailSent,
  updateSubmission,
} from "@/domains/submission";
import { sendDeletionWarning } from "@/domains/feedback";
import { storage } from "@/shared/storage";
import { discardUnpaidSubmission } from "./discardSubmission";

export interface SweepReport {
  /** Completed submissions whose files were removed; the records remain. */
  resolvedPurged: number;
  /** Unpaid submissions deleted outright. */
  abandonedDiscarded: number;
  /** Customers told their files are about to go. */
  warningsSent: number;
  filesDeleted: number;
  failures: number;
}

export async function runRetentionSweep(): Promise<SweepReport> {
  const report: SweepReport = {
    resolvedPurged: 0,
    abandonedDiscarded: 0,
    warningsSent: 0,
    filesDeleted: 0,
    failures: 0,
  };

  const settings = await getSettings();
  const now = Date.now();
  const days = (n: number) => n * 24 * 3600_000;

  /*
    ── warn before deleting ────────────────────────────────────────────────

    Runs *before* the purge, and against a nearer cutoff, so a submission is
    always warned in an earlier sweep than the one that deletes it. Running the
    purge first would let a single night both warn and delete, which is a
    warning in name only.

    The one genuinely scheduled effect in the system: "delete what's due" is
    derivable from state, "warn a week out" is a one-off. `deletionWarnedAt` is
    what stops it firing every night of that week.
  */
  if (settings.warnBeforeDeletionDays > 0) {
    const warnCutoff = new Date(
      now -
        days(settings.retainCollectedDays - settings.warnBeforeDeletionDays),
    );
    for (const submission of await findWarningDue(warnCutoff)) {
      const deletesOn = new Date(
        new Date(submission.collectedAt!).getTime() +
          days(settings.retainCollectedDays),
      );
      try {
        if (submission.customerEmail) {
          const ok = await sendDeletionWarning({
            to: submission.customerEmail,
            playerName: submission.playerName,
            deletesOn,
            daysLeft: settings.warnBeforeDeletionDays,
          });
          void noteEmailSent(
            submission.id,
            "⑨ deletion warning → customer",
            ok,
            // Worth saying out loud in the trail: the stamp lands either way, so
            // a failure here is a customer who will never be warned again.
            ok ? undefined : "stamped regardless — this will not retry",
          );
        }
        // Stamped whether or not the send worked. A warning we couldn't deliver
        // must not retry nightly — that turns one missed email into seven.
        await updateSubmission(submission.id, {
          deletionWarnedAt: new Date().toISOString(),
          status: "purge_imminent",
        });
        report.warningsSent += 1;
      } catch (err) {
        report.failures += 1;
        console.error(`[sweep] warning ${submission.id} failed:`, err);
      }
    }
  }

  /*
    ── purge: forget the bytes, keep the record ────────────────────────────

    **Everything goes together** — the customer's uploads and the coach's
    response alike. That is only safe because the clock starts on collection: we
    never delete anything the customer hasn't already got in hand.

    The rows survive with their locators cleared, so the portal can still say
    what was there, and the submission itself is kept **forever**. Only the
    bytes go.
  */
  const due = await findResolvedDue(
    new Date(now - days(settings.retainCollectedDays)),
    new Date(now - days(settings.retainDeliveredDays)),
  );

  for (const submission of due) {
    const files = await listAllSubmissionFiles(submission.id);

    for (const file of files) {
      if (!file.fileUrl) continue;
      try {
        await storage.remove(file.fileUrl);
        report.filesDeleted += 1;
      } catch (err) {
        // Keep going: one unreachable object must not strand the rest of the
        // sweep. The locator is cleared either way — a file we can't delete is
        // one we've already lost track of.
        report.failures += 1;
        console.error(`[sweep] could not delete ${file.fileUrl}:`, err);
      }
    }

    await clearAllFileLocators(submission.id);
    await updateSubmission(submission.id, {
      filesPurgedAt: new Date().toISOString(),
      status: "purged",
    });
    report.resolvedPurged += 1;
  }

  // ── abandoned: leave nothing behind ────────────────────────────────────
  const abandoned = await sweepAbandoned(settings.retainUnpaidHours);
  report.abandonedDiscarded = abandoned.discarded;
  report.filesDeleted += abandoned.filesDeleted;

  return report;
}

/**
 * Discard unpaid submissions that have gone quiet.
 *
 * Split out because it has **two callers**: this sweep, and
 * `startSubmissionAction` — so the flow tidies up after itself the moment
 * anyone else starts a submission, rather than waiting for a cron job. That's
 * what keeps "no retention of something unpaid" true even on a plan where the
 * cron only runs daily.
 *
 * `limit` bounds the work because one of those callers is a customer waiting on
 * a page. Anything left over is picked up by the next call — and the count is
 * returned rather than swallowed, so a persistent backlog is visible in the logs
 * instead of looking like success.
 */
export async function sweepAbandoned(
  retainUnpaidHours: number,
  limit = 25,
): Promise<{ discarded: number; filesDeleted: number; remaining: boolean }> {
  const cutoff = new Date(Date.now() - retainUnpaidHours * 3600_000);
  const due = await findAbandonedDue(cutoff, limit);

  let discarded = 0;
  let filesDeleted = 0;

  for (const submission of due) {
    const files = await listAllSubmissionFiles(submission.id);
    const ok = await discardUnpaidSubmission(submission.id);
    if (ok) {
      discarded += 1;
      filesDeleted += files.filter((f) => f.fileUrl).length;
    }
  }

  const remaining = due.length === limit;
  if (remaining) {
    console.log(
      `[sweep] discarded ${discarded} abandoned submissions and hit the limit of ${limit} — more remain`,
    );
  }

  return { discarded, filesDeleted, remaining };
}
