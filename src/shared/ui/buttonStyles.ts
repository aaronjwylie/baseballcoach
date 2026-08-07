/**
 * Shared button styling, so `Button` and `ButtonLink` can't drift apart.
 * They render different elements for different reasons — a link navigates, a
 * button acts — but they are the same control to the eye. Principle #8.
 */
/*
  `active:translate-y-px` is here as well as in `globals.css` because
  `ButtonLink` renders an `<a>`, and the global rule is scoped to `button`. Two
  declarations, two elements — not a duplicate. The alternative was a global
  rule on every anchor, which would have made ordinary prose links press.
*/
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0";

const SIZES = {
  md: "px-6 py-2.5 text-sm",
  lg: "px-7 py-3 text-[15px]",
} as const;

/**
 * Three shapes, one language — the approved wireframe draws every control as a
 * 12px rounded rectangle in ink and white, and never in a second colour.
 *
 * - `outline` is the landing page's call to action: white, ink-bordered.
 * - `primary` stays a solid ink fill for the app's forms, where an outline
 *   button would be too quiet to be the thing you're meant to press.
 * - `onDark` is the same control inverted, for the header and footer bands,
 *   where an ink border would vanish.
 */
const VARIANTS = {
  primary: "bg-ink text-surface hover:bg-ink-soft",
  outline: "border-2 border-ink bg-surface text-ink hover:bg-paper-alt",
  onDark: "bg-surface text-ink hover:bg-paper-alt",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function buttonClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  className = "",
): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}
