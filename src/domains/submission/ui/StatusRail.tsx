"use client";

import { pillClass } from "@/shared/ui";
import {
  SUBMISSION_STATUSES,
  type SubmissionStatus,
} from "../model/submission";

/**
 * The ladder as sixteen dots, with the current rung named above it.
 *
 * **It replaces the status column rather than joining it.** That's what pays for
 * the pill's height: a row that shows a badge *and* a progress bar is taller than
 * one where the bar carries the badge.
 *
 * Optional rungs are drawn as a detour, not a gap. A submission whose coach reads
 * English never touches four of them, and without that distinction every such row
 * looks permanently incomplete.
 *
 * Imports the model directly, not the slice barrel — the barrel re-exports
 * Postgres code and this is a client component.
 */

/** Operator-facing names. The customer's lookup collapses these; this doesn't. */
const RUNG_LABEL: Record<SubmissionStatus, string> = {
  draft: "Draft",
  awaiting_payment: "Awaiting payment",
  new: "New — needs a coach",
  assigned: "Assigned",
  intake_translating: "Files out for translation",
  intake_translated: "Files translated",
  sent_to_coach: "Sent — not picked up",
  in_review: "In review",
  awaiting_approval: "Coach submitted",
  response_translating: "Response out for translation",
  response_translated: "Response translated",
  complete: "Sent — not collected",
  collected: "Collected",
  resolved: "Resolved",
  purge_imminent: "Deleting in 7 days",
  purged: "Files purged",
};

/** The four rungs only a submission needing translation touches. */
const OPTIONAL: ReadonlySet<SubmissionStatus> = new Set([
  "intake_translating",
  "intake_translated",
  "response_translating",
  "response_translated",
]);

/** The one rung that wants the eye. */
const WARN: ReadonlySet<SubmissionStatus> = new Set(["purge_imminent"]);

export function StatusRail({
  status,
  needsTranslation,
  label,
}: {
  status: SubmissionStatus;
  /** Fades the optional rungs on a submission that will never touch them. */
  needsTranslation: boolean;
  /**
   * Overrides the rung's name in the pill.
   *
   * One rung genuinely covers two steps — `awaiting_payment` spans uploading
   * *and* paying — so its own name tells only half the story. The caller knows
   * which half applies; the rail doesn't, and shouldn't have to.
   */
  label?: string;
}) {
  const at = SUBMISSION_STATUSES.indexOf(status);
  const pos = (i: number) => (i / (SUBMISSION_STATUSES.length - 1)) * 100;
  // Keep the pill on canvas at the extremes; the stem still points true.
  const pillLeft = Math.min(Math.max(pos(at), 9), 91);
  const warn = WARN.has(status);

  return (
    <div
      className="relative h-11"
      aria-label={`Step ${at + 1} of 16: ${label ?? RUNG_LABEL[status]}`}
    >
      <span
        className={`${pillClass} absolute top-0 -translate-x-1/2 ${
          warn
            ? "border-amber-600 bg-white text-amber-700"
            : "border-ink bg-ink text-white"
        }`}
        style={{ left: `${pillLeft}%` }}
      >
        {label ?? RUNG_LABEL[status]}
      </span>
      <span
        className={`absolute top-[21px] h-[9px] w-px -translate-x-1/2 ${warn ? "bg-amber-600" : "bg-ink"}`}
        style={{ left: `${pos(at)}%` }}
      />
      <div className="absolute inset-x-0 top-9 flex h-[9px] items-center justify-between">
        {/* the hairline the dots sit on — one process, not sixteen events */}
        <span className="absolute inset-x-[3px] top-1/2 h-px bg-line" />
        {SUBMISSION_STATUSES.map((rung, i) => {
          const optional = OPTIONAL.has(rung);
          const past = i < at;
          const now = i === at;
          return (
            <span
              key={rung}
              title={RUNG_LABEL[rung]}
              className={[
                "relative flex-none rounded-full",
                now ? "h-[9px] w-[9px] outline outline-[3px] outline-white" : "h-[7px] w-[7px]",
                now
                  ? warn
                    ? "bg-amber-600"
                    : "bg-ink"
                  : past
                    ? optional
                      ? "bg-white ring-2 ring-inset ring-band"
                      : "bg-band"
                    : "bg-white ring-1 ring-inset " + (optional ? "ring-band" : "ring-line"),
                optional && !needsTranslation ? "opacity-35" : "",
              ].join(" ")}
            />
          );
        })}
      </div>
    </div>
  );
}
