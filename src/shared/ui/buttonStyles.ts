/**
 * Shared button styling, so `Button` and `ButtonLink` can't drift apart.
 * They render different elements for different reasons — a link navigates, a
 * button acts — but they are the same control to the eye. Principle #8.
 */
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const SIZES = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
} as const;

/**
 * Primary is **ink, not accent**, matching the reference wireframe: the blue is
 * reserved for step numbers and specialty tags, so the call to action stays the
 * darkest thing on the page and nothing competes with it.
 */
const VARIANTS = {
  primary: "bg-ink text-surface hover:bg-ink-soft",
  accent: "bg-accent text-surface hover:bg-accent-dark",
  outline: "border border-line bg-surface text-ink hover:bg-paper-alt",
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
