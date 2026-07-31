"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Decides whether a page wears the public marketing chrome.
 *
 * The operator portal (`/admin`, `/coach`, `/account`, `/login`) is an internal
 * tool — the "Pricing / FAQ / Submit a video" header belongs to the customer
 * site, not to Yuta managing coaches. Those routes render bare; everything else
 * gets the header and footer.
 *
 * A client gate rather than route groups so the marketing/customer pages stay
 * put — moving them would collide with the flow work in progress. Stays
 * domain-less: it knows route prefixes, nothing about a Submission.
 */
const PORTAL = /^\/(admin|coach|account|login)(\/|$)/;

export function SiteChrome({
  header,
  footer,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (PORTAL.test(pathname)) return <>{children}</>;
  return (
    <>
      {header}
      {children}
      {footer}
    </>
  );
}
