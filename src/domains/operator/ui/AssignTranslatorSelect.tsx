"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { failed, succeeded, type ActionResult } from "@/shared/lib/actionResult";
import { assignTranslatorAction } from "../api/translatorActions";

/**
 * The translator-assignment control on the admin queue.
 *
 * **`useActionState`, not a hand-rolled pending flag.** The previous version
 * tracked `busy` itself and threw the action's return value away — which was
 * fine while the action returned `void`, and was exactly why a refusal ("this
 * has already gone out to a coach") looked identical to a success: nothing
 * happened and nothing was said. React owns pending now, and the result is
 * rendered.
 *
 * Two things that were already right and stay right:
 *
 * 1. **Controlled, not `defaultValue`.** An uncontrolled `<select>` in a
 *    Server-Action form did not reliably carry the user's new pick across the
 *    submit re-render, so Save posted the *previous* coach id.
 * 2. **`router.refresh()` after a success.** `revalidatePath` clears the server
 *    cache, but the page keeps serving its cached RSC until a real navigation.
 */
export function AssignTranslatorSelect({
  submissionId,
  leg,
  assignedOperatorId,
  translators,
}: {
  submissionId: string;
  leg: "intake_translation" | "feedback_translation";
  assignedOperatorId?: string | null;
  translators: { id: string; name: string }[];
}) {
  const [operatorId, setOperatorId] = useState(assignedOperatorId ?? "");
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    assignTranslatorAction,
    undefined,
  );
  const router = useRouter();

  useEffect(() => {
    if (succeeded(state)) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="space-y-1.5">
      <div className="flex items-center gap-2">
        <input type="hidden" name="submissionId" value={submissionId} />
        <input type="hidden" name="leg" value={leg} />
        <select
          name="operatorId"
          value={operatorId}
          onChange={(e) => setOperatorId(e.target.value)}
          disabled={pending}
          className="rounded-md border border-line bg-white px-2 py-1.5 text-sm disabled:opacity-60"
        >
          <option value="" disabled>
            Pick a translator…
          </option>
          {translators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending || !operatorId}
          className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-accent hover:text-ink disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {failed(state) && (
        <p className="text-[13px] text-rose-700">{state.error}</p>
      )}
    </form>
  );
}
