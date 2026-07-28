import type { ReactNode } from "react";

/** Shared input styling — one home for what a text input looks like. */
export const inputClass =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/30";

/**
 * A labelled form field.
 *
 * The label wraps the control so it's clickable without needing matching ids.
 * When `error` is set it replaces the hint rather than stacking beneath it —
 * two lines of small text under one input is noise, and the error is the more
 * urgent of the two.
 */
export function Field({
  label,
  hint,
  optional,
  error,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-ink">
        {label}
        {optional && (
          <span className="text-xs font-normal text-ink-muted">(optional)</span>
        )}
      </span>
      {children}
      {error ? (
        // role="alert" so a screen reader announces it when it appears, rather
        // than the user finding it only on a re-read of the whole form.
        <span role="alert" className="mt-1.5 block text-xs text-rose-600">
          {error}
        </span>
      ) : (
        hint && (
          <span className="mt-1.5 block text-xs text-ink-muted">{hint}</span>
        )
      )}
    </label>
  );
}
