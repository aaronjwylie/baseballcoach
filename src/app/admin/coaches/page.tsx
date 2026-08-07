import type { Metadata } from "next";
import { Container } from "@/shared/ui";
import { listCoaches, createCoachAction, OperatorProfileDirectory } from "@/domains/operator";
import { requireRole } from "@/domains/account";

export const metadata: Metadata = {
  title: "Admin — Coaches",
  robots: { index: false },
};

export default async function AdminCoachesPage() {
  await requireRole("admin");
  return (
    <Container>
      <h1 className="text-2xl font-bold tracking-tight text-ink">Coaches</h1>
      <OperatorProfileDirectory
        role="coach"
        people={await listCoaches()}
        addAction={createCoachAction}
      />
    </Container>
  );
}
