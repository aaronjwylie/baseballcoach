import { PortalBar } from "../_portal/PortalBar";

const ADMIN_LINKS = [
  { href: "/admin", label: "Submissions" },
  { href: "/admin/operators", label: "Operators" },
  { href: "/admin/settings", label: "Settings" },
];

/**
 * The admin portal shell: the top bar once, then the page. Auth stays on each
 * page (`requireRole` close to the data), so this layout is purely the frame.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PortalBar home="/admin" links={ADMIN_LINKS} />
      <div className="py-8">{children}</div>
    </>
  );
}
