import type { ReactNode } from "react";

/**
 * The small ink rectangle the wireframe uses for every label — section
 * eyebrows, the hero's claim strip, the coach's stat blocks.
 *
 * It is not `shared/ui/Pill`: that one is a full-radius chip used for status in
 * the app, and this one is a 4px rectangle used for emphasis on the pitch.
 * Same idea, different shape and different reader — kept apart on purpose.
 */
export function Chip({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded bg-ink px-4 py-1.5 text-[11px] font-semibold uppercase leading-tight tracking-[0.09em] text-surface ${className}`}
    >
      {children}
    </span>
  );
}
