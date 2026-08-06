"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignCoachAction } from "../api/coachActions";

/**
 * The coach-assignment control on the admin queue.
 *
 * Two things a plain `<form action={serverAction}>` got wrong here:
 *
 * 1. **Controlled, not `defaultValue`.** An uncontrolled `<select>` in a
 *    Server-Action form didn't reliably carry the user's new pick across the
 *    submit re-render, so Save posted the *previous* coach id and the row looked
 *    unchanged. Holding the choice in state fixes what gets submitted.
 * 2. **`router.refresh()` after the action.** `revalidatePath` clears the server
 *    cache, but the current page keeps serving its cached RSC until a real
 *    navigation — so the row showed the old coach until a manual refresh. The
 *    explicit refresh re-fetches the row we're looking at.
 */
export function AssignCoachSelect({
  submissionId,
  assignedCoachId,
  coachTable,
}: {
  submissionId: string;
  assignedCoachId?: string | null;
  coachTable: { id: string; name: string }[];
}) {
  const [coachId, setCoachId] = useState(assignedCoachId ?? "");
  const router = useRouter();

  return (
    <form
      action={async (formData) => {
        await assignCoachAction(formData);
        router.refresh();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="submissionId" value={submissionId} />
      <select
        name="coachId"
        value={coachId}
        onChange={(e) => setCoachId(e.target.value)}
        className="rounded-md border border-line bg-white px-2 py-1 text-sm"
      >
        <option value="" disabled>
          Assign…
        </option>
        {coachTable.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button type="submit" className="text-xs font-semibold text-accent hover:underline">
        Save
      </button>
    </form>
  );
}
