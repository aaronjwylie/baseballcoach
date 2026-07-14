import { site } from "@/lib/site";

/** Wordmark with a small baseball-seam diamond glyph. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="shrink-0"
      >
        <rect
          x="12"
          y="1.5"
          width="15"
          height="15"
          rx="3"
          transform="rotate(45 12 1.5)"
          className="fill-accent"
        />
        <path
          d="M8.2 8.2c1.6 1 2.6 2.3 3.8 3.8 1.2 1.5 2.2 2.8 3.8 3.8M15.8 8.2c-1.6 1-2.6 2.3-3.8 3.8-1.2 1.5-2.2 2.8-3.8 3.8"
          stroke="white"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-lg font-bold tracking-tight text-ink">
        {site.name}
      </span>
    </span>
  );
}
