import Link from "next/link";
import { OperatorProfileForm } from "./OperatorProfileForm";
import type { OperatorProfile } from "../model/operatorProfile";
import type { OperatorProfileFormState } from "../api/operatorProfileActions";

/**
 * The admin's list of one role, beside the form that adds another.
 *
 * `/admin/coaches` and `/admin/translators` are the same screen with different
 * data, so they are the same component with a different `role` — the third
 * file rather than the second like kind (`_StructureLaw.md` §3b). The two route
 * files stay thin, which is what `app/` is for.
 *
 * A server component: it renders `OperatorProfileForm`, which is the client
 * boundary, and passes the action down rather than importing it — so a route
 * decides *which* role's action runs and this decides only how it looks.
 */
export function OperatorProfileDirectory({
  role,
  people,
  addAction,
}: {
  role: "coach" | "translator";
  people: OperatorProfile[];
  addAction: (
    state: OperatorProfileFormState,
    formData: FormData,
  ) => Promise<OperatorProfileFormState>;
}) {
  const plural = role === "coach" ? "coaches" : "translators";
  const count = `${people.length} ${people.length === 1 ? role : plural}`;

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-2">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          {count}
        </h2>
        <ul className="mt-3 space-y-3">
          {people.length === 0 && (
            <li className="rounded-2xl border border-line bg-white p-5 text-sm text-ink-muted">
              No {plural} yet — add one on the right.
              {role === "translator" && (
                <>
                  {" "}
                  A submission only needs one when the coach and the customer
                  share no language.
                </>
              )}
            </li>
          )}
          {people.map((person) => (
            <li key={person.id} className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-ink">{person.name}</span>
                  <div className="text-sm text-ink-muted">{person.email}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-semibold ${person.isActive ? "text-emerald-600" : "text-ink-muted"}`}
                  >
                    {person.isActive ? "Active" : "Inactive"}
                  </span>
                  <Link
                    href={`/admin/${plural}/${person.id}`}
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    Edit
                  </Link>
                </div>
              </div>
              <div className="mt-1 text-sm text-ink-muted">
                {/*
                  Languages are what decides whether a submission needs
                  translating at all, so an empty set is worth saying out loud
                  rather than rendering as a blank — the rule silently does
                  nothing until someone fills them in.
                */}
                {person.specialties.length
                  ? person.specialties.join(", ")
                  : "No specialties set"}
                {person.languages.length
                  ? ` · ${person.languages.join(", ")}`
                  : " · no languages recorded"}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-line bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Add a {role}
        </h2>
        <div className="mt-4">
          <OperatorProfileForm role={role} action={addAction} />
        </div>
      </div>
    </div>
  );
}
