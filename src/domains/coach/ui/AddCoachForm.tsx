"use client";

import { useActionState } from "react";
import { Button, Field, inputClass } from "@/shared/ui";
import { FOCUS_OPTIONS } from "@/domains/submission/model/submission";
import { createCoachAction, type CoachFormState } from "../api/coachActions";

export function AddCoachForm() {
  const [state, action, pending] = useActionState<CoachFormState, FormData>(
    createCoachAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-4">
      {state && "error" in state && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </p>
      )}
      {state && "ok" in state && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Coach added.
        </p>
      )}

      <Field label="Name">
        <input name="name" required className={inputClass} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required autoComplete="off" className={inputClass} />
      </Field>
      <Field label="Temporary password" hint="At least 8 characters. The coach can change it later.">
        <input name="password" type="password" required minLength={8} className={inputClass} />
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">Specialties</legend>
        <div className="flex flex-wrap gap-3">
          {FOCUS_OPTIONS.map((focus) => (
            <label key={focus} className="flex items-center gap-1.5 text-sm text-ink-muted">
              <input type="checkbox" name="specialties" value={focus} />
              {focus}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Languages" hint="Comma-separated, e.g. English, Japanese">
        <input name="languages" placeholder="English, Japanese" className={inputClass} />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add coach"}
      </Button>
    </form>
  );
}
