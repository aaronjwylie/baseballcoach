import type { Metadata } from "next";
import { Container } from "@/shared/ui";
import { requireRole } from "@/domains/account";
import { getSettings, SettingsForm } from "@/domains/settings";
import { AdminNav } from "../AdminNav";

export const metadata: Metadata = {
  title: "Admin — Settings",
  robots: { index: false },
};

export default async function AdminSettingsPage() {
  await requireRole("admin");
  const settings = await getSettings();

  return (
    <section className="py-10">
      <Container>
        <AdminNav active="settings" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Upload limits and how long files are kept. These take effect
          immediately — no deploy needed.
        </p>

        <div className="mt-6 max-w-xl rounded-2xl border border-line bg-white p-6">
          <SettingsForm settings={settings} />
        </div>
      </Container>
    </section>
  );
}
