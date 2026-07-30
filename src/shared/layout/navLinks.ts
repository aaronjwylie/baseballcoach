/**
 * The site's section links, written once and read by both the header and the
 * footer — the wireframe shows the same five in both, and two copies of one
 * list is exactly how a renamed section goes missing from one of them.
 */
export const navLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#coaches", label: "Coaches" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
] as const;
