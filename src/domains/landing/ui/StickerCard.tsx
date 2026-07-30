import type { ReactNode } from "react";

/**
 * The tilted card the wireframe lays over the hero image and the coach photo —
 * the one gesture in an otherwise square layout, and the reason the page reads
 * as a scrapbook rather than a template.
 *
 * The tilt is decoration, so it is dropped below `sm`: on a phone the cards
 * stack full-width, where a rotation would only cost horizontal room and clip
 * against the viewport edge.
 */
export function StickerCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl bg-paper-alt px-8 py-7 shadow-sm sm:-rotate-[7deg] ${className}`}
    >
      {children}
    </div>
  );
}
