"use client";

import { useState } from "react";
import { assignCoachAction } from "../api/coachActions";

/**
 * The coach-assignment control on the admin queue.
 *
 * Controlled (`value`/`onChange`) rather than an uncontrolled `defaultValue` on
 * purpose: an uncontrolled `<select>` in a Server-Action form doesn't reliably
 * carry the user's new pick across React's submit re-render, so Save was posting
 * the *previous* coach id — the assignment looked like it "reverted." Holding the
 * choice in state makes the submitted value always match what's on screen.
 */
export function AssignCoachSelect({
  submissionId,
  assignedCoachId,
  coaches,
}: {
  submissionId: string;
  assignedCoachId?: string | null;
  coaches: { id: string; name: string }[];
}) {
  const [coachId, setCoachId] = useState(assignedCoachId ?? "");

  return (
    <form action={assignCoachAction} className="flex items-center gap-2">
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
        {coaches.map((c) => (
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
