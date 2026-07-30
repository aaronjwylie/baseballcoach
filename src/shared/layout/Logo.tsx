import { site } from "@/shared/config/site";

/**
 * The wordmark, and nothing else.
 *
 * The approved wireframe sets the brand in type alone — the diamond-and-seams
 * glyph the previous design carried is gone from both the header and the
 * footer. Colour is inherited, because the mark appears in white on the dark
 * bands and would otherwise need overriding in both places.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`text-2xl font-medium tracking-tight lg:text-[30px] ${className}`}
    >
      {site.name}
    </span>
  );
}
