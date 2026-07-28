/** Landing-page glyphs. Inline SVG — no icon dependency for two shapes. */

export function CheckIcon({ small = false }: { small?: boolean }) {
  const size = small ? "h-4 w-4" : "h-6 w-6";
  return (
    <span
      className={`mt-0.5 flex ${small ? "h-5 w-5" : "h-8 w-8"} shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent`}
    >
      <svg className={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M20 6 9 17l-5-5"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function PlusIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
