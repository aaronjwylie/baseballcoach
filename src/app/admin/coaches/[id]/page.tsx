import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/shared/ui";
import { requireRole } from "@/domains/operator";
import { getCoach, EditCoachForm } from "@/domains/coach";

export const metadata: Metadata = {
  title: "Admin — Edit coach",
  robots: { index: false },
};

export default async function EditCoachPage(props: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await props.params;
  const coach = await getCoach(id);
  if (!coach) notFound();

  return (
    <Container className="max-w-2xl">
      <div>
        <Link href="/admin/coaches" className="text-sm text-ink-muted hover:text-ink">
          ← Coaches
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">
          Edit {coach.name}
        </h1>
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <EditCoachForm coach={coach} />
      </div>
    </Container>
  );
}
