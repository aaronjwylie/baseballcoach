import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/shared/ui";
import {
  requireRole,
  getTranslator,
  updateTranslatorAction,
  OperatorProfileForm,
} from "@/domains/operator";

export const metadata: Metadata = {
  title: "Admin — Edit translator",
  robots: { index: false },
};

export default async function EditTranslatorPage(props: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await props.params;
  /*
    Looked up **by role**, so a coach's id opened under /admin/translators is a
    404 rather than a translator's edit form pointed at the wrong person.
  */
  const person = await getTranslator(id);
  if (!person) notFound();

  return (
    <Container className="max-w-2xl">
      <div>
        <Link href="/admin/translators" className="text-sm text-ink-muted hover:text-ink">
          ← Translators
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">
          Edit {person.name}
        </h1>
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <OperatorProfileForm role="translator" action={updateTranslatorAction} existing={person} />
      </div>
    </Container>
  );
}
