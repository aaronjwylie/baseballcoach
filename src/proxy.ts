/**
 * Proxy (Next 16's renamed Middleware) — the optimistic auth gate.
 *
 * Reads the session cookie off the request and does *coarse* routing only:
 * bounce anonymous users off the portal, bounce signed-in users off /login, and
 * keep each role in its own portal. The real, secure checks live in the account
 * DAL (`requireSession` / `requireRole`), run per page — this is just a fast
 * pre-filter, never the only defence (Next.js authentication guide).
 *
 * Imports `shared/auth/token` directly (not the barrel) to avoid pulling
 * `next/headers` into the proxy bundle.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/shared/auth/token";
import type { OperatorSession } from "@/domains/account";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySessionToken<OperatorSession>(
    req.cookies.get(SESSION_COOKIE)?.value,
  );

  const isPortal =
    pathname.startsWith("/admin") || pathname.startsWith("/coach");

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
  matcher: ["/admin/:path*", "/coach/:path*", "/login"],
};
