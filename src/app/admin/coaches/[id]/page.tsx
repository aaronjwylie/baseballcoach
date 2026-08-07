import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/shared/ui";
import { getCoach, updateCoachAction, OperatorProfileForm } from "@/domains/operator";
import { requireRole } from "@/domains/account";

export const metadata: Metadata = {
  title: "Admin — Edit coach",
  robots: { index: false },
};

export default async function EditCoachPage(props: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await props.params;
  /*
    Looked up **by role**, so a coach's id opened under /admin/translators is a
    404 rather than a translator's edit form pointed at the wrong person.
  */
  const person = await getCoach(id);
  if (!person) notFound();

  return (
    <Container className="max-w-2xl">
      <div>
        <Link href="/admin/coaches" className="text-sm text-ink-muted hover:text-ink">
          ← Coaches
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">
          Edit {person.name}
        </h1>
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <OperatorProfileForm role="coach" action={updateCoachAction} existing={person} />
      </div>
    </Container>
  );
}
