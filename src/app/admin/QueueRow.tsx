"use client";

import { useState, type ReactNode } from "react";
import { StatusRail } from "@/domains/submission/ui/StatusRail";
import { StageChain } from "@/domains/submission/ui/StageChain";
import type { ChainState } from "@/domains/submission/model/stageChain";
import type { SubmissionEvent } from "@/domains/submission/api/submissionEventApi";

/**
 * One row of the queue: the rail collapsed, everything else a click away.
 *
 * **The rail replaces the status badge rather than joining it**, which is what
 * pays for the pill's height — a row carrying both is taller than one where the
 * bar carries the badge. Files, the coach control and the override all move into
 * the expanded panel, so the collapsed row lands thinner than the table it
 * replaced while saying considerably more.
 *
 * Client-side only for the open/closed state. Everything it renders is computed
 * on the server and passed in; the controls arrive as nodes because they're
 * bound to Server Actions the row knows nothing about.
 */
export function QueueRow({
  playerName,
  shortId,
  meta,
  facts,
  flag,
  rail,
  stage,
  control,
  folders,
  details,
  events,
  override,
}: {
  playerName: string;
  /** First eight characters of the uuid — the handle people actually say. */
  shortId: string;
  /** Focus · file count · customer — the one quiet line under the name. */
  meta: string;
  /** The right-hand summary: who has it, how long it's been sitting. */
  facts: ReactNode;
  /** The thing that wants attention, if anything does. */
  flag?: string;
  rail: { status: Parameters<typeof StatusRail>[0]["status"]; needsTranslation: boolean };
  stage: ChainState[];
  control?: ReactNode;
  folders: ReactNode;
  details: ReactNode;
  events: SubmissionEvent[];
  override: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-line last:border-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid w-full grid-cols-[minmax(0,200px)_1fr_minmax(0,150px)_30px] items-center gap-4 px-4 py-2.5 text-left hover:bg-paper-alt focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink max-[860px]:grid-cols-[1fr_30px]"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">{playerName}</span>
          <span className="mt-px block truncate text-[11.5px] text-ink-muted">
            <span className="font-mono text-ink-soft">{shortId}</span>
            {meta ? ` · ${meta}` : ""}
          </span>
        </span>

        <span className="pt-0.5 max-[860px]:col-span-2">
          <StatusRail status={rail.status} needsTranslation={rail.needsTranslation} />
        </span>

        <span className="text-right text-[11.5px] text-ink-muted max-[860px]:text-left">
          {facts}
          {flag ? <span className="block font-semibold text-amber-700">{flag}</span> : null}
        </span>

        <span
          aria-hidden
          className={`justify-self-end text-ink-muted transition-transform ${open ? "rotate-90 text-ink" : ""}`}
        >
          ›
        </span>
      </button>

      {open && (
        <div className="bg-paper-alt px-4 pb-5">
          <div className="grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-6 pt-4 max-[860px]:grid-cols-1">
            <div>
              <Label>Then, in order</Label>
              <StageChain stage={stage} control={control} />
            </div>
            <div>
              <Label>Files — four folders</Label>
              {folders}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-6 border-t border-line pt-3 max-[860px]:grid-cols-1">
            <div>
              <Label>This submission</Label>
              {details}
              <div className="mt-3">{override}</div>
            </div>
            <div>
              <Label>Trail</Label>
              <Trail events={events} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
      {children}
    </div>
  );
}

/**
 * Everything that happened, newest last.
 *
 * Status moves and sends share one list on purpose — reading them apart makes
 * "the status says delivered but the email never went" a two-place comparison,
 * which is exactly the failure this view exists to surface. A send that didn't
 * land is the one thing here drawn in a colour.
 */
function Trail({ events }: { events: SubmissionEvent[] }) {
  if (events.length === 0) {
    return <p className="text-[11.5px] italic text-ink-muted">Nothing recorded yet.</p>;
  }
  return (
    <ol className="list-none p-0">
      {events.map((e) => (
        <li
          key={e.id}
          className="grid grid-cols-[1fr_auto] gap-3 py-0.5 text-[11.5px] text-ink-soft"
        >
          <span className="min-w-0 truncate">
            {e.kind === "status" ? (
              <span className="font-mono text-ink">{e.status}</span>
            ) : (
              <span className={e.ok ? "text-ink-soft" : "font-semibold text-rose-700"}>
                {e.ok ? "✓" : "✗"} {e.label}
              </span>
            )}
            {e.note ? <span className="text-ink-muted"> — {e.note}</span> : null}
          </span>
          <span className="tabular-nums text-ink-muted">{formatWhen(e.at)}</span>
        </li>
      ))}
    </ol>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
