"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { failed, succeeded, type ActionResult } from "@/shared/lib/actionResult";

/**
 * A one-button form for a row action — notify, complete, resolve, archive,
 * unarchive, send for translation.
 *
 * **It used to swallow the outcome.** The action returned `void`, this awaited
 * it and refreshed, and a refusal was indistinguishable from a success: the
 * button had no pending state, no disabled state, and nothing to say. Six
 * actions with twenty-odd guards between them all failed that way.
 *
 * Now `useActionState` owns the pending flag and the result, and a refusal is
 * rendered next to the button that caused it.
 *
 * `router.refresh()` still follows a success — `revalidatePath` clears the
 * server cache but the page keeps serving its cached RSC until a real
 * navigation, so the row would not move or vanish without it.
 */
export function RowActionForm({
  action,
  submissionId,
  label,
  className,
}: {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  submissionId: string;
  label: string;
  className?: string;
}) {
  const [state, submit, pending] = useActionState<ActionResult, FormData>(
    action,
    undefined,
  );
  const router = useRouter();

  useEffect(() => {
    if (succeeded(state)) router.refresh();
  }, [state, router]);

  return (
    <form action={submit}>
      <input type="hidden" name="submissionId" value={submissionId} />
      <button type="submit" disabled={pending} className={className}>
        {pending ? "Working…" : label}
      </button>
      {failed(state) && (
        <p className="mt-1 max-w-xs text-[13px] text-rose-700">{state.error}</p>
      )}
    </form>
  );
}
