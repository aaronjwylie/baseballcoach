"use client";

import { useActionState } from "react";
import { Button, Field, inputClass } from "@/shared/ui";
import type { PlatformSettings } from "../model/settings";
import {
  updateSettingsAction,
  type SettingsFormState,
} from "../api/settingsActions";

/**
 * The admin's four knobs.
 *
 * `defaultValue` rather than controlled state: the server component above owns
 * the current values and re-renders on save, so holding a second copy in React
 * would only give the two a chance to disagree.
 */
export function SettingsForm({ settings }: { settings: PlatformSettings }) {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(
    updateSettingsAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-5">
      {state && "error" in state && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </p>
      )}
      {state && "ok" in state && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Settings saved.
        </p>
      )}

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Pricing
        </legend>

        <Field
          label="Price per review ($ CAD)"
          hint="What the customer pays at checkout. Shown across the site and charged by Stripe."
        >
          <input
            name="priceDollars"
            type="number"
            min={1}
            max={10000}
            step="0.01"
            required
            defaultValue={(settings.priceCents / 100).toFixed(2)}
            className={inputClass}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Upload limits
        </legend>

        <Field
          label="Largest file (MB)"
          hint="Applies to each file, not the total. A phone clip is usually 20–80 MB."
        >
          <input
            name="maxFileSizeMb"
            type="number"
            min={1}
            max={2000}
            required
            defaultValue={settings.maxFileSizeMb}
            className={inputClass}
          />
        </Field>

        <Field
          label="Files per submission"
          hint="How many files one customer may attach before checkout."
        >
          <input
            name="maxFilesPerSubmission"
            type="number"
            min={1}
            max={20}
            required
            defaultValue={settings.maxFilesPerSubmission}
            className={inputClass}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Retention
        </legend>

        <Field
          label="Delete uploads this long after a review completes (hours)"
          hint="Only the customer's uploads. The coach's feedback file is never swept — the customer's download link depends on it."
        >
          <input
            name="retainResolvedHours"
            type="number"
            min={1}
            max={8760}
            required
            defaultValue={settings.retainResolvedHours}
            className={inputClass}
          />
        </Field>

        <Field
          label="Delete uploads this long after an unpaid submission starts (hours)"
          hint="Covers abandoned checkouts — files uploaded by someone who never paid."
        >
          <input
            name="retainUnpaidHours"
            type="number"
            min={1}
            max={8760}
            required
            defaultValue={settings.retainUnpaidHours}
            className={inputClass}
          />
        </Field>
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
