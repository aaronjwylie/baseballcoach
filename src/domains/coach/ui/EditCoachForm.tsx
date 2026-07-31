"use client";

import { useActionState } from "react";
import { Button, Field, inputClass } from "@/shared/ui";
import { FOCUS_OPTIONS } from "@/domains/submission/model/submission";
import { updateCoachAction, type CoachFormState } from "../api/coachActions";
import type { Coach } from "../model/coach";

export function EditCoachForm({ coach }: { coach: Coach }) {
  const [state, action, pending] = useActionState<CoachFormState, FormData>(
    updateCoachAction,
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
          Saved.
        </p>
      )}

      <input type="hidden" name="coachId" value={coach.id} />

      <Field label="Name">
        <input name="name" defaultValue={coach.name} required className={inputClass} />
      </Field>

      <Field label="Email" hint="Their login for the coach portal">
        <input
          type="email"
          name="email"
          defaultValue={coach.email}
          required
          className={inputClass}
        />
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">Specialties</legend>
        <div className="flex flex-wrap gap-3">
          {FOCUS_OPTIONS.map((focus) => (
            <label key={focus} className="flex items-center gap-1.5 text-sm text-ink-muted">
              <input
                type="checkbox"
                name="specialties"
                value={focus}
                defaultChecked={coach.specialties.includes(focus)}
              />
              {focus}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Languages" hint="Comma-separated">
        <input
          name="languages"
          defaultValue={coach.languages.join(", ")}
          className={inputClass}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="isActive" defaultChecked={coach.isActive} />
        Active — can be assigned new submissions
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
