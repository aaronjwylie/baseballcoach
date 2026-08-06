import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/shared/ui";
import { requireSession, getOperatorById, ChangePasswordForm } from "@/domains/operator";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false },
};

export default async function AccountPage() {
  const session = await requireSession();
  const operator = await getOperatorById(session.operatorId);
  const home = session.role === "admin" ? "/admin" : "/coach";

  return (
    <section className="py-10">
      <Container className="max-w-md">
        <Link href={home} className="text-sm text-ink-muted hover:text-ink">
          ← Back to portal
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">Account</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {operator?.email} · {operator?.role}
        </p>

        <div className="mt-6 rounded-2xl border border-line bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Change password
          </h2>
          <div className="mt-4">
            <ChangePasswordForm />
          </div>
        </div>
      </Container>
    </section>
  );
}
