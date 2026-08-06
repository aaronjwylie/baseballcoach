"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignTranslatorAction } from "../api/coachActions";

/**
 * Choosing who translates one leg — the translator's `AssignCoachSelect`.
 *
 * Same two lessons that component records, and they apply here for the same
 * reasons: the `<select>` is **controlled** so Save posts the new pick rather
 * than the previous one, and `router.refresh()` follows the action because
 * `revalidatePath` clears the server cache without re-fetching the row already
 * on screen.
 *
 * `leg` is a hidden field rather than two components. The two legs differ only
 * in which rung they move and which folder they produce, and a second copy of
 * this file would be two places to fix the next time a select misbehaves.
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
  const router = useRouter();

  // Nobody to pick means the admin has no translators yet. A dropdown with one
  // disabled placeholder in it reads as broken; saying so reads as a to-do.
  if (!translators.length) {
    return (
      <p className="text-[11px] text-ink-muted">
        No translators yet — add one under Coaches to send this out.
      </p>
    );
  }

  return (
    <form
      action={async (formData) => {
        await assignTranslatorAction(formData);
        router.refresh();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="leg" value={leg} />
      <select
        name="operatorId"
        value={operatorId}
        onChange={(e) => setOperatorId(e.target.value)}
        className="rounded-md border border-line bg-white px-2 py-1 text-sm"
      >
        <option value="" disabled>
          Pick a translator…
        </option>
        {translators.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button type="submit" className="text-xs font-semibold text-accent hover:underline">
        Save
      </button>
    </form>
  );
}
