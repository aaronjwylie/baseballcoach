import type { Metadata } from "next";
import { Container } from "@/shared/ui";
import {
  requireRole,
  listTranslators,
  createTranslatorAction,
  OperatorProfileDirectory,
} from "@/domains/operator";

export const metadata: Metadata = {
  title: "Admin — Translators",
  robots: { index: false },
};

export default async function AdminTranslatorsPage() {
  await requireRole("admin");
  return (
    <Container>
      <h1 className="text-2xl font-bold tracking-tight text-ink">Translators</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Needed only when a coach and a customer share no language — the
        submission is sent out and comes back translated before either side
        sees it.
      </p>
      <OperatorProfileDirectory
        role="translator"
        people={await listTranslators()}
        addAction={createTranslatorAction}
      />
    </Container>
  );
}
