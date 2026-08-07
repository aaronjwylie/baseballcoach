/**
 * Translators — the people who carry a submission between languages.
 *
 * The peer of `coachApi`, and deliberately its mirror: both are thin, both call
 * `operatorProfileApi` for everything they share, and neither imports the
 * other. If these two files drift apart in size again, the shared part has
 * moved back into one of them — `_StructureLaw.md` §3a.
 *
 * There is genuinely less here, and one thing that is genuinely absent: a
 * translator's collection is stamped but not announced, because the admin is
 * waiting on a coach to start rather than on a translation leg. That absence is
 * argued in `coachApi.noteCoachCollected` rather than left to be noticed.
 */
import { listAssignable, getByRole, createProfiledOperator, updateProfiledOperator } from "./operatorProfileApi";
import type { OperatorProfile, NewOperatorProfile } from "../model/operatorProfile";
import type { OperatorProfilePatch } from "./operatorProfileApi";

export function listTranslators(): Promise<OperatorProfile[]> {
  // Assignable, not merely holding the role — a paused translator is off this
  // list and still on the admin's roster.
  return listAssignable("translator");
}

/** One translator by id — null if that id belongs to a coach or the admin. */
export function getTranslator(id: string): Promise<OperatorProfile | null> {
  return getByRole(id, "translator");
}

export function createTranslator(input: NewOperatorProfile): Promise<OperatorProfile> {
  return createProfiledOperator("translator", input);
}

export function updateTranslator(
  id: string,
  patch: OperatorProfilePatch,
): Promise<OperatorProfile> {
  return updateProfiledOperator(id, "translator", patch);
}
