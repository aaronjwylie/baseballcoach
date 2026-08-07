import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/shared/ui";
import { requireRole } from "@/domains/account";
import {
  getByRole,
  rolesFor,
  updateProfiledOperatorAction,
  OperatorProfileForm,
  OperatorRoleToggles,
  type Role,
} from "@/domains/operator";

export const metadata: Metadata = {
  title: "Admin — Edit operator",
  robots: { index: false },
};

const ROLE_FOR: Record<string, Role> = {
  admins: "admin",
  coaches: "coach",
  translators: "translator",
};

/**
 * One person, reached through whichever list you found them in.
 *
 * `kind` is here so the breadcrumb goes back where you came from, and so a
 * mistyped id is a 404 rather than someone else's form — the lookup is **by
 * role**, so a coach's id opened under `/translators` does not resolve.
 *
 * The person you edit is the same person on every list they appear in. The role
 * toggles below are how they get onto, or off, another one.
 */
export default async function EditOperatorPage(props: {
  params: Promise<{ kind: string; id: string }>;
}) {
  await requireRole("admin");
  const { kind, id } = await props.params;
  const role = ROLE_FOR[kind];
  if (!role) notFound();

  const person = await getByRole(id, role);
  if (!person) notFound();
  const held = await rolesFor(id);

  return (
    <Container className="max-w-2xl">
      <div>
        <Link
          href={`/admin/onboarding/${kind}`}
          className="text-sm text-ink-muted hover:text-ink"
        >
          ← {kind.charAt(0).toUpperCase() + kind.slice(1)}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">
          Edit {person.name}
        </h1>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Roles
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          One person can be more than one kind. Adding a role puts them on that
          list and lets them be assigned that kind of work.
        </p>
        <div className="mt-4">
          <OperatorRoleToggles operatorId={id} held={held} />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <OperatorProfileForm
          role={role}
          action={updateProfiledOperatorAction.bind(null, role)}
          existing={person}
        />
      </div>
    </Container>
  );
}
