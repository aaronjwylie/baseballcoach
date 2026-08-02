"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  SUBMISSION_STATUSES,
  type SubmissionStatus,
} from "@/domains/submission/model/submission";

/**
 * The operator override — purge a folder now, or put a submission back.
 *
 * The pipeline runs forward on its own; this is the handle for when it
 * shouldn't. Deliberately **one general handle rather than per-stage undo
 * buttons**: eleven specific affordances are eleven things nobody remembers
 * exist, and the case that actually arrives is never quite the one that was
 * anticipated.
 *
 * Folded shut by default. It's the only destructive control on the page, and a
 * control that deletes files should take a deliberate click to reach.
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
    <div className="mt-2 space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <div className="flex items-baseline justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
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

      <form
        className="flex flex-wrap items-center gap-2"
        action={(fd) => run(purgeAction, fd)}
      >
        <input type="hidden" name="submissionId" value={submissionId} />
        <label className="text-[11px] text-ink-muted">
          Delete now:
          <select
            name="kind"
            defaultValue="intake"
            className="ml-1.5 rounded border border-line bg-white px-1.5 py-0.5 text-[11px]"
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
          className="rounded-md border border-rose-400 px-2 py-0.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
        >
          Purge folder
        </button>
      </form>

      {canReset && (
        <form
          className="flex flex-wrap items-center gap-2"
          action={(fd) => run(resetAction, fd)}
        >
          <input type="hidden" name="submissionId" value={submissionId} />
          <label className="text-[11px] text-ink-muted">
            Move back to:
            <select
              name="status"
              defaultValue={status}
              className="ml-1.5 rounded border border-line bg-white px-1.5 py-0.5 text-[11px]"
            >
              {SUBMISSION_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <input
            name="reason"
            placeholder="why (optional)"
            className="w-32 rounded border border-line bg-white px-1.5 py-0.5 text-[11px]"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-line bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-muted hover:text-ink disabled:opacity-50"
          >
            Reset status
          </button>
        </form>
      )}

      <p className="text-[11px] text-ink-muted">
        Both are recorded against the submission with your name on them.
      </p>
    </div>
  );
}
