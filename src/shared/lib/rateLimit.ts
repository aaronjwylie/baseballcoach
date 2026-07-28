/**
 * A small in-memory rate limiter.
 *
 * ## Read this before trusting it
 *
 * **This is a speed bump, not a wall**, and the reason is worth understanding
 * rather than discovering later.
 *
 * State lives in the memory of one serverless instance. Vercel runs several
 * concurrently and recycles them freely, so a determined caller spread across
 * instances gets roughly `limit × instances`, and a cold start resets the
 * window entirely. It reliably stops a script hammering one endpoint in a loop,
 * which is the actual threat at this scale; it does not stop a distributed or
 * patient attacker.
 *
 * The honest fix is shared state — Upstash Redis is the usual choice and has a
 * free tier. That's a new third-party service, so it's a scope decision for Ben
 * (CLAUDE.md §14), not something to add quietly. Until traffic justifies it,
 * this is the deliberate trade: real protection against the realistic threat,
 * openly documented as partial. *(PRINCIPLES #10 — honest degradation.)*
 */

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Buckets live for one window and are swept lazily on write, so an idle process
 * doesn't hold memory for callers who never return.
 */
const buckets = new Map<string, Window>();

/** Sweep expired buckets whenever the map grows past this. */
const SWEEP_THRESHOLD = 1000;

export interface RateLimitResult {
  ok: boolean;
  /** Requests left in the current window. */
  remaining: number;
  /** Seconds until the window resets — the value for `Retry-After`. */
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

/**
 * Record a hit against `key` and report whether it's allowed.
 *
 * A fixed window, not a sliding one: simpler, and the difference only matters
 * to a caller timing requests around the boundary — who is, by definition,
 * already better served by the Redis upgrade above.
 */
export function rateLimit(
  key: string,
  { limit, windowSeconds }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  if (buckets.size > SWEEP_THRESHOLD) sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: windowSeconds };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((existing.resetAt - now) / 1000),
  );

  return {
    ok: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds,
  };
}

function sweep(now: number): void {
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Best-effort client identity for rate limiting.
 *
 * `x-forwarded-for` is a client-supplied header and trivially spoofed in
 * general — but on Vercel the platform overwrites it at the edge, so the
 * left-most entry is the real peer. Anywhere without that guarantee, this is
 * advisory only.
 *
 * Falls back to a shared bucket when no header is present (local dev), which
 * means every local caller shares one limit. That's correct: better to be
 * conservative than to hand out a free pass keyed on nothing.
 */
export function clientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
