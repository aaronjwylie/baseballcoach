import type { ReactNode } from "react";

/**
 * The metrics every pill in the queue shares.
 *
 * Exported as a class rather than kept inside `Pill` because the status rail
 * builds its own absolutely-positioned pill and can't use the component. Two
 * pills sitting on one row must agree on height to the pixel, and the only way
 * to guarantee that is for both to read the same string.
 */
export const pillClass =
  "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold";

/** Small pill label used for eyebrows and status chips. */
export function Pill({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${className}`}
    >
      {children}
    </span>
  );
}
