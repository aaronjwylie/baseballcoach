"use client";

import { useActionState } from "react";
import { Button, Field, inputClass } from "@/shared/ui";
import { FOCUS_OPTIONS, choiceForLanguages } from "@/domains/submission/model/submission";
import { LanguageChoiceField } from "@/domains/submission/ui/LanguageChoiceField";
import { DEFAULT_LANGUAGE_CHOICE } from "../model/operatorProfile";
import type { OperatorProfile } from "../model/operatorProfile";
import type { OperatorProfileFormState } from "../api/operatorProfileActions";

/**
 * Add or edit someone who can be given work — **one form, both roles.**
 *
 * There was an `AddCoachForm` and an `EditCoachForm`, and phase 5 was going to
 * add an `AddTranslatorForm` and an `EditTranslatorForm` beside them: four
 * files, three of them copies. `_StructureLaw.md` §3b says take the third file
 * over the second like kind, so there is one of each and the role is a prop.
 *
 * **The roles genuinely differ in two fields**, and that difference is the only
 * thing `role` decides here: a coach has a bio and a photo because a coach
 * appears on the public site, and a translator has neither because a translator
 * does not. Everything else — name, login, specialties, languages — is the same
 * question asked of the same table.
 *
 * `mode` decides add-versus-edit rather than a second component, for the same
 * reason: the two differ by whether the password is required and whether
 * "active" can be turned off, which is two conditionals, not two files.
 */
export function OperatorProfileForm({
  role,
  action: submitAction,
  existing,
}: {
  role: "coach" | "translator";
  action: (
    state: OperatorProfileFormState,
    formData: FormData,
  ) => Promise<OperatorProfileFormState>;
  /** Absent when adding; the person being edited otherwise. */
  existing?: OperatorProfile;
}) {
  const [state, action, pending] = useActionState<OperatorProfileFormState, FormData>(
    submitAction,
    undefined,
  );
  const editing = existing !== undefined;
  // Only a coach is shown publicly, so only a coach is asked for the two fields
  // that exist for the public site.
  const isPublic = role === "coach";
  const noun = role === "coach" ? "Coach" : "Translator";

  return (
    <form action={action} className="space-y-4">
      {state && "error" in state && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </p>
      )}
      {state && "ok" in state && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {editing ? "Saved." : `${noun} added.`}
        </p>
      )}

      {editing && <input type="hidden" name="operatorId" value={existing.id} />}

      <Field label="Name">
        <input
          name="name"
          defaultValue={existing?.name}
          required
          className={inputClass}
        />
      </Field>

      <Field label="Email" hint={`Their login for the ${role} portal`}>
        <input
          name="email"
          type="email"
          defaultValue={existing?.email}
          required
          autoComplete="off"
          className={inputClass}
        />
      </Field>

      <Field
        label={editing ? "New password" : "Temporary password"}
        hint={
          editing
            ? "Leave blank to keep the current one."
            : `At least 8 characters. The ${role} can change it later.`
        }
      >
        <input
          name="password"
          type="password"
          required={!editing}
          minLength={8}
          autoComplete="new-password"
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
                defaultChecked={existing?.specialties.includes(focus)}
              />
              {focus}
            </label>
          ))}
        </div>
      </fieldset>

      <LanguageChoiceField
        label="Languages"
        hint={
          isPublic
            ? "What this coach reads. A submission is translated when it shares none with the customer."
            : "What this translator works between."
        }
        defaultChoice={
          existing
            ? choiceForLanguages(existing.languages, DEFAULT_LANGUAGE_CHOICE)
            : DEFAULT_LANGUAGE_CHOICE
        }
      />

      {isPublic && (
        <>
          <Field label="Bio" hint="A short blurb for the public site.">
            <textarea
              name="bio"
              rows={3}
              defaultValue={existing?.bio ?? ""}
              className={inputClass}
            />
          </Field>

          <Field
            label="Photo"
            hint={
              editing
                ? "JPG or PNG. Leave blank to keep the current one."
                : "JPG or PNG, shown on the public site."
            }
          >
            <input name="image" type="file" accept="image/*" className={inputClass} />
          </Field>
        </>
      )}

      {editing && (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="isActive" defaultChecked={existing.isActive} />
          Active — can sign in and be assigned work
        </label>
      )}

      <Button type="submit" disabled={pending}>
        {pending
          ? editing
            ? "Saving…"
            : "Adding…"
          : editing
            ? "Save changes"
            : `Add ${role}`}
      </Button>
    </form>
  );
}
