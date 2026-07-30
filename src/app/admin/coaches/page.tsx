import type { Metadata } from "next";
import { Container } from "@/shared/ui";
import { requireRole } from "@/domains/account";
import { listCoaches, AddCoachForm } from "@/domains/coach";
import { AdminNav } from "../AdminNav";

export const metadata: Metadata = {
  title: "Admin — Coaches",
  robots: { index: false },
};

export default async function AdminCoachesPage() {
  await requireRole("admin");
  const coaches = await listCoaches();

  return (
    <section className="py-10">
      <Container>
        <AdminNav active="coaches" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink">Coaches</h1>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {coaches.length} coach{coaches.length === 1 ? "" : "es"}
            </h2>
            <ul className="mt-3 space-y-3">
              {coaches.length === 0 && (
                <li className="rounded-2xl border border-line bg-white p-5 text-sm text-ink-muted">
                  No coaches yet — add one on the right.
                </li>
              )}
              {coaches.map((c) => (
                <li key={c.id} className="rounded-2xl border border-line bg-white p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">{c.name}</span>
                    <span
                      className={`text-xs font-semibold ${c.isActive ? "text-emerald-600" : "text-ink-muted"}`}
                    >
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-ink-muted">
                    {c.specialties.length ? c.specialties.join(", ") : "No specialties set"}
                    {c.languages.length ? ` · ${c.languages.join(", ")}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-line bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Add a coach
            </h2>
            <div className="mt-4">
              <AddCoachForm />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
