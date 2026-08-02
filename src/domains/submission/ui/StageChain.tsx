"use client";

import type { ReactNode } from "react";
import type { ChainState } from "../model/stageChain";

/**
 * What has to happen at the rung a submission is sitting on, and what's left.
 *
 * **Met lines recede rather than bolding up.** Inverted from the usual on
 * purpose: what's done needs no attention, so the eye should land on what's
 * outstanding.
 *
 * The control for the stage is passed in and rendered **on the outstanding
 * line** rather than in a button bar below. A bar makes you read the status,
 * work out what it implies, then find the matching button; here the thing you
 * read and the thing you press are the same thing, and they can't drift.
 */
export function StageChain({
  stage,
  control,
}: {
  stage: ChainState[];
  /** Rendered inside the line the submission is waiting on. */
  control?: ReactNode;
}) {
  return (
    <ol className="mt-2 list-none p-0">
      {stage.map((line, i) => (
        <li
          key={line.what}
          className={`grid grid-cols-[15px_1fr] items-start gap-2 py-1 text-[12.5px] leading-snug ${
            line.met ? "text-ink-muted" : "text-ink"
          }`}
        >
          <span
            className={`pt-px font-mono text-[11px] ${
              line.met ? "text-emerald-600" : line.now ? "text-ink" : "text-band"
            }`}
          >
            {line.met ? "✓" : String(i + 1).padStart(2, "0")}
          </span>
          <span>
            <span className={line.now ? "font-semibold" : undefined}>{line.what}</span>
            <span className="mt-px block text-[11px] font-normal text-ink-muted">
              {line.from}
              {line.why ? ` — ${line.why}` : ""}
            </span>
            {line.now && control ? <div className="mt-2">{control}</div> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
