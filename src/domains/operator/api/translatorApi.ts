/**
 * Translators — the people who carry a submission between languages.
 *
 * Its own file because it is its own role, even though the rows are the ones
 * `operatorProfileApi` reads for a coach as well. Before this existed,
 * `listTranslators()` lived in `coachApi.ts`: a file named for one role holding
 * the other, which is the one-stem violation `_NomenclatureLaw.md` §2 exists to
 * catch. It lasted about a day.
 *
 * Deliberately thin. A translator has no bio to show and no photo on the
 * landing page — the profile fields a coach uses for the public site are simply
 * unused here — so there is nothing yet that a coach's own file doesn't already
 * do generically.
 */
import { listByRole, getByRole } from "./operatorProfileApi";
import type { Coach } from "../model/coach";

/** Everyone who can be given a leg of the translation. */
export function listTranslators(): Promise<Coach[]> {
  return listByRole("translator");
}

/** One translator by id — null if that id belongs to a coach or the admin. */
export function getTranslator(id: string): Promise<Coach | null> {
  return getByRole(id, "translator");
}
