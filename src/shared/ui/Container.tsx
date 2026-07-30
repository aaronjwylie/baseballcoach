import type { ReactNode } from "react";

/**
 * Centered page container with consistent horizontal padding.
 *
 * The measurements come from the approved wireframe: content runs edge to edge
 * at 60px gutters on a 1440 canvas, which is wider than the 1152 this used to
 * cap at. The two-column sections need that width to hold their image column
 * without squeezing the copy beside it.
 */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-[60px] ${className}`}
    >
      {children}
    </div>
  );
}
