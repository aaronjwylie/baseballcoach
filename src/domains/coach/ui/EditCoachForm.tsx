"use client";

import { useActionState } from "react";
import { Button, Field, inputClass } from "@/shared/ui";
import { FOCUS_OPTIONS } from "@/domains/submission/model/submission";
import { choiceForLanguages } from "../model/coach";
import { LanguageChoiceField } from "./LanguageChoiceField";
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

      <Field
        label="New password"
        hint="Leave blank to keep their current one · min 8 characters"
      >
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
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

      <LanguageChoiceField defaultChoice={choiceForLanguages(coach.languages)} />

      <Field label="Bio" hint="A short blurb for the public site.">
        <textarea
          name="bio"
          rows={3}
          defaultValue={coach.bio ?? ""}
          className={inputClass}
        />
      </Field>

      <Field label="Photo" hint="JPG or PNG. Leave blank to keep the current one.">
        {coach.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/coach-image/${coach.id}`}
            alt={`${coach.name}'s photo`}
            className="mb-2 h-24 w-24 rounded-lg object-cover"
          />
        )}
        <input name="image" type="file" accept="image/*" className={inputClass} />
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
