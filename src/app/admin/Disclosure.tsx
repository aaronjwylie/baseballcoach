import type { ReactNode } from "react";

/**
 * A section that starts closed and opens on click.
 *
 * **Native `<details>`, not `useState`.** The override next to it hand-rolls its
 * open state because it also owns forms and pending flags; these two own
 * nothing, so there is no reason to ship JavaScript for them. `<details>` is
 * keyboard-operable, announced correctly by screen readers, survives without
 * hydration, and cannot desync from what is on screen.
 *
 * One component rather than the same markup twice — `_StructureLaw` §3b, the
 * third file over the second like kind. A third collapsible section costs a
 * line.
 *
 * The summary keeps the `Label` treatment so a closed section reads as the
 * heading it replaces, rather than as a new kind of control.
 */
export function Disclosure({
  label,
  hint,
  children,
}: {
  label: string;
  /** Shown beside the label while closed — what you would see if you opened it. */
  hint?: string;
  children: ReactNode;
}) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted hover:text-ink">
        {/* Rotates on open. `marker:hidden` alone leaves Safari's default. */}
        <span
          aria-hidden
          className="inline-block transition-transform group-open:rotate-90"
        >
          ›
        </span>
        {label}
        {hint && (
          <span className="font-normal normal-case tracking-normal text-ink-muted group-open:hidden">
            · {hint}
          </span>
        )}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
