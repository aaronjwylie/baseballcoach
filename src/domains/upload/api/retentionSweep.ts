/**
 * Deleting uploaded files once they've served their purpose.
 *
 * Two rules, both on operator-tunable clocks, and both **relative to the
 * submission's own timestamps** — never to a wall-clock schedule:
 *
 * - **resolved** — a completed review's source files go `retainResolvedHours`
 *   after *it* completed. The coach is done with them and the customer has their
 *   feedback.
 * - **abandoned** — an unpaid submission's files go `retainUnpaidHours` after
 *   *it* was opened. This is the cost of taking files before taking money
 *   (ADR 009): without it, anyone can park storage on us for free, forever.
 *
 * The cron cadence is a separate question from the rule. The job only *notices*
 * that a window elapsed when it runs, so a daily job made "24 hours after
 * completion" mean 24–48 hours in practice. It runs hourly (`vercel.json`),
 * which narrows that to 24–25. Running more often is cheap — the sweep skips
 * rows it has already purged, so an extra run is one query.
 *
 * **The coach's feedback file is never swept.** The customer's only route to it
 * is the link in their email, and that link has to keep working; deleting it a
 * day after completion would break the delivery the whole product exists for.
 *
 * The *records* survive too — `submissionFiles` rows keep name, size and type,
 * with the locator cleared. The portal and the receipt can still say what was
 * sent; only the bytes are gone. `filesPurgedAt` makes a second run a no-op.
 */
import { storage } from "@/shared/storage";
import { getSettings } from "@/domains/settings";
import {
  clearFileLocators,
  findSweepable,
  listSubmissionFiles,
  updateSubmission,
} from "@/domains/submission";

export interface SweepReport {
  submissionsSwept: number;
  filesDeleted: number;
  failures: number;
}

export async function runRetentionSweep(): Promise<SweepReport> {
  const settings = await getSettings();
  const now = Date.now();

  const resolvedBefore = new Date(now - settings.retainResolvedHours * 3600_000);
  const unpaidBefore = new Date(now - settings.retainUnpaidHours * 3600_000);

  const due = await findSweepable(resolvedBefore, unpaidBefore);

  const report: SweepReport = {
    submissionsSwept: 0,
    filesDeleted: 0,
    failures: 0,
  };

  for (const submission of due) {
    const files = await listSubmissionFiles(submission.id);

    for (const file of files) {
      if (!file.fileUrl) continue;
      try {
        await storage.remove(file.fileUrl);
        report.filesDeleted += 1;
      } catch (err) {
        // Keep going: one unreachable object must not strand the rest of the
        // sweep. The submission is still marked, because the locator is cleared
        // either way — a file we can't delete is one we've already lost track of.
        report.failures += 1;
        console.error(`[sweep] could not delete ${file.fileUrl}:`, err);
      }
    }

    await clearFileLocators(submission.id);
    await updateSubmission(submission.id, {
      filesPurgedAt: new Date().toISOString(),
    });
    report.submissionsSwept += 1;
  }

  return report;
}
