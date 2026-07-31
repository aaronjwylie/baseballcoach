/**
 * Proxy (Next 16's renamed Middleware) — two jobs:
 *
 * 1. **Site gate** (optional): site-wide HTTP Basic Auth to hide the whole thing
 *    while it's being built. Active only when BASIC_AUTH_USER + BASIC_AUTH_PASSWORD
 *    are set; clear them (and redeploy) to lift it. It runs on every page but
 *    NOT on `/api` (the matcher excludes it), so webhooks and uploads still work.
 *
 * 2. **Operator auth gate** (optimistic): bounce anonymous users off the portal,
 *    bounce signed-in users off /login, keep each role in its own portal. The
 *    real, secure checks live in the account DAL, run per page.
 *
 * Imports `shared/auth/token` directly (not the barrel) to avoid pulling
 * `next/headers` into the proxy bundle.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/shared/auth/token";
import { env } from "@/shared/config/env";
import type { OperatorSession } from "@/domains/account";

/** HTTP Basic Auth over the whole site. Returns a 401 challenge, or null to pass. */
function siteGate(req: NextRequest): NextResponse | null {
  const user = env.basicAuthUser;
  const pass = env.basicAuthPassword;
  if (!user || !pass) return null; // gate disabled

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const [u, p] = decodeBasic(header);
    if (u === user && p === pass) return null; // authorized
  }
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Baseball Sensei"' },
  });
}

function decodeBasic(header: string): [string, string] {
  try {
    const decoded = atob(header.slice("Basic ".length));
    const i = decoded.indexOf(":");
    return i < 0 ? [decoded, ""] : [decoded.slice(0, i), decoded.slice(i + 1)];
  } catch {
    return ["", ""];
  }
}

export async function proxy(req: NextRequest) {
  const gate = siteGate(req);
  if (gate) return gate;

  const { pathname } = req.nextUrl;
  const isPortal =
    pathname.startsWith("/admin") || pathname.startsWith("/coach");

  // Public pages have nothing more to check once the site gate has passed.
  if (!isPortal && pathname !== "/login") return NextResponse.next();

  const session = await verifySessionToken<OperatorSession>(
    req.cookies.get(SESSION_COOKIE)?.value,
  );

  if (isPortal && !session) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (session) {
    const home = session.role === "admin" ? "/admin" : "/coach";
    if (pathname === "/login") {
      return NextResponse.redirect(new URL(home, req.nextUrl));
    }
    if (pathname.startsWith("/admin") && session.role !== "admin") {
      return NextResponse.redirect(new URL("/coach", req.nextUrl));
    }
    if (pathname.startsWith("/coach") && session.role !== "coach") {
      return NextResponse.redirect(new URL("/admin", req.nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on every page, but not on API routes or static assets — so the site
  // gate never blocks webhooks/uploads or breaks asset loading.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
