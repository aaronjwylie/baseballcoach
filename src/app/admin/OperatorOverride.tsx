"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  SUBMISSION_STATUSES,
  numberedRungLabel,
  type SubmissionStatus,
} from "@/domains/submission/model/submission";
import { STAGE_CHAIN } from "@/domains/submission/model/stageChain";

/**
 * The operator override — put a submission back, or delete a folder now.
 *
 * The pipeline runs forward on its own; this is the handle for when it
 * shouldn't. Deliberately **one general handle rather than per-stage undo
 * buttons**: eleven specific affordances are eleven things nobody remembers
 * exist, and the case that actually arrives is never quite the one that was
 * anticipated.
 *
 * **Two boxes, ordered by how bad the mistake is.** Moving a status back is
 * recoverable — move it forward again. Deleting files is not, so it sits below
 * in its own red frame rather than beside the thing people came here to do.
 *
 * Imports the *model* directly rather than the domain barrel — this is a
 * `"use client"` file and the barrel re-exports database code.
 */
export function OperatorOverride({
  submissionId,
  status,
  purgeAction,
  resetAction,
}: {
  submissionId: string;
  status: SubmissionStatus;
  purgeAction: (formData: FormData) => Promise<void>;
  resetAction: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<SubmissionStatus>(status);

  // Nothing may come back out of `purged` — the bytes it describes are gone, and
  // a status implying otherwise would make the queue lie about what a customer
  // can still download.
  const canReset = status !== "purged";

  async function run(action: (fd: FormData) => Promise<void>, fd: FormData) {
    setBusy(true);
    await action(fd);
    setBusy(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-ink-muted underline underline-offset-2 hover:text-ink"
      >
        Override…
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Override
        </h4>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] text-ink-muted underline underline-offset-2"
        >
          close
        </button>
      </div>

      {canReset && (
        <form
          className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3"
          action={(fd) => run(resetAction, fd)}
        >
          <input type="hidden" name="submissionId" value={submissionId} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] text-ink-muted">
              Move back to:
              <select
                name="status"
                value={target}
                onChange={(e) => setTarget(e.target.value as SubmissionStatus)}
                className="ml-1.5 rounded border border-line bg-white px-1.5 py-0.5 text-[11px]"
              >
                {SUBMISSION_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {numberedRungLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            {/*
              The substep is **recorded, not enforced.** Only the rung is stored
              — a chain line is derived from the data, so there is no column to
              set it to. What this buys is precision in the trail: "back to
              Assigned" and "back to Assigned, at the hand-off" are different
              intentions, and the second one is the one worth being able to say.
            */}
            <label className="text-[11px] text-ink-muted">
              at:
              <select
                name="substep"
                key={target}
                className="ml-1.5 rounded border border-line bg-white px-1.5 py-0.5 text-[11px]"
              >
                <option value="">the start of the step</option>
                {STAGE_CHAIN[target].map((line) => (
                  <option key={line.what} value={line.what}>
                    {line.what}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              name="reason"
              placeholder="why (optional)"
              className="w-44 rounded border border-line bg-white px-1.5 py-0.5 text-[11px]"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-md border border-line bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-muted hover:text-ink disabled:opacity-50"
            >
              Reset status
            </button>
            <span className="text-[11px] text-ink-muted">
              Recorded against the submission with your name on it.
            </span>
          </div>
        </form>
      )}

      <form
        className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-300 bg-rose-50/60 p-3"
        action={(fd) => run(purgeAction, fd)}
      >
        <input type="hidden" name="submissionId" value={submissionId} />
        <label className="text-[11px] text-rose-800">
          Delete now:
          <select
            name="kind"
            defaultValue="intake"
            className="ml-1.5 rounded border border-rose-200 bg-white px-1.5 py-0.5 text-[11px]"
          >
            <option value="intake">Client</option>
            <option value="intake_translation">Client — translated</option>
            <option value="response">Coach</option>
            <option value="response_translation">Coach — translated</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md border border-rose-400 px-2 py-0.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
        >
          Purge folder
        </button>
        {/* Said out loud, because this is the one control with no way back. */}
        <span className="text-[11px] text-rose-700">
          The bytes go. The file record stays, so the portal can still say what
          was sent.
        </span>
      </form>
    </div>
  );
}
