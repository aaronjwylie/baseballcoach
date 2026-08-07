import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/shared/ui";
import { requireRole } from "@/domains/account";
import {
  listByRole,
  createProfiledOperatorAction,
  OperatorProfileDirectory,
  type Role,
} from "@/domains/operator";

/**
 * Onboarding, one page for all three kinds.
 *
 * The three were nearly identical, which `_StructureLaw` §3a says is the shape
 * to refuse — the difference between adding a coach and adding an admin is one
 * field and one noun. So `kind` is a route segment rather than three files.
 *
 * **Someone holding several kinds appears on several of these pages**, because
 * each list asks *who holds this grant*. It is one person seen from three
 * angles: edit them from any of the three and you have edited them everywhere.
 */
const KINDS = {
  admins: {
    role: "admin" as Role,
    title: "Admins",
    blurb:
      "They run the platform: the queue, assignment, settings, and onboarding. Recording their languages is worth doing — an admin often has to talk to a customer, a coach and a translator in the same afternoon.",
  },
  coaches: {
    role: "coach" as Role,
    title: "Coaches",
    blurb:
      "They review submissions and write the feedback. Their languages decide whether a submission needs translating at all.",
  },
  translators: {
    role: "translator" as Role,
    title: "Translators",
    blurb:
      "They carry a submission between languages — out to the coach, and back to the customer. Needed only when a coach and a customer share none.",
  },
} as const;

type Kind = keyof typeof KINDS;

const isKind = (value: string): value is Kind => value in KINDS;

export async function generateMetadata(props: {
  params: Promise<{ kind: string }>;
}): Promise<Metadata> {
  const { kind } = await props.params;
  return {
    title: isKind(kind) ? `Onboarding — ${KINDS[kind].title}` : "Onboarding",
    robots: { index: false },
  };
}

export default async function OnboardingPage(props: {
  params: Promise<{ kind: string }>;
}) {
  await requireRole("admin");
  const { kind } = await props.params;
  if (!isKind(kind)) notFound();
  const { role, blurb } = KINDS[kind];

  return (
    <Container>
      <h1 className="text-2xl font-bold tracking-tight text-ink">Onboarding</h1>

      <nav className="mt-4 flex gap-1 border-b border-line">
        {(Object.keys(KINDS) as Kind[]).map((key) => (
          <Link
            key={key}
            href={`/admin/onboarding/${key}`}
            aria-current={key === kind ? "page" : undefined}
            className={
              key === kind
                ? "border-b-2 border-ink px-3 py-2 text-sm font-semibold text-ink"
                : "border-b-2 border-transparent px-3 py-2 text-sm text-ink-muted hover:text-ink"
            }
          >
            {KINDS[key].title}
          </Link>
        ))}
      </nav>

      <p className="mt-4 max-w-2xl text-sm text-ink-muted">{blurb}</p>

      <OperatorProfileDirectory
        role={role}
        people={await listByRole(role)}
        addAction={createProfiledOperatorAction.bind(null, role)}
      />
    </Container>
  );
}
