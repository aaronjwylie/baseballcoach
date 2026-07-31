import Link from "next/link";
import { Button } from "@/shared/ui";
import { logout } from "@/domains/account";

/** Top nav shared by the admin pages — links + sign out. */
export function AdminNav({
  active,
}: {
  active: "submissions" | "coaches" | "settings";
}) {
  const cls = (key: string) =>
    key === active ? "font-semibold text-ink" : "text-ink-muted hover:text-ink";

  return (
    <div className="flex items-center justify-between">
      <nav className="flex items-center gap-5 text-sm">
        <span className="font-bold text-ink">Baseball Sensei</span>
        <Link href="/admin" className={cls("submissions")}>
          Submissions
        </Link>
        <Link href="/admin/coaches" className={cls("coaches")}>
          Coaches
        </Link>
        <Link href="/admin/settings" className={cls("settings")}>
          Settings
        </Link>
      </nav>
      <form action={logout}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </div>
  );
}
