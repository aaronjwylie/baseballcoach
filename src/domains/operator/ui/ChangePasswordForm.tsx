"use client";

import { useActionState } from "react";
import { Button, Field, inputClass } from "@/shared/ui";
import { changePasswordAction } from "../api/auth";
import type { ChangePasswordState } from "../model/operator";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
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
          Password changed.
        </p>
      )}

      <Field label="Current password">
        <input
          name="current"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </Field>
      <Field label="New password" hint="At least 8 characters">
        <input
          name="next"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>
      <Field label="Confirm new password">
        <input
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
