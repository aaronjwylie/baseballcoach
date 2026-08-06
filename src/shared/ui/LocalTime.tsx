"use client";

/**
 * A timestamp in the reader's timezone, not the server's.
 *
 * Server components render in the server's zone — UTC on Vercel — so a stamp
 * formatted there and one formatted in a client component disagree by however
 * many hours the operator is from Greenwich. That's how "Started" read UTC while
 * the trail beside it read local.
 *
 * Marking it client-side is the fix: the browser knows where it is. Hardcoding a
 * zone would only move the problem to whoever isn't in it — and the coachTable are
 * in Japan.
 *
 * `suppressHydrationWarning` is deliberate and is the documented escape hatch
 * for exactly this: the server's HTML *will* differ from the client's, and the
 * client's is the correct one. React keeps it after hydration.
 */
export function LocalTime({
  iso,
  fallback = "—",
}: {
  iso?: string;
  fallback?: string;
}) {
  if (!iso) return <>{fallback}</>;
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })}
    </time>
  );
}
