/**
 * The coach — the person who reviews a submission. Distinct from the operator
 * `users` row that logs them in: a Coach *has a* user (`userId`), plus the
 * profile the admin manages (name, specialties, languages, active).
 */
/*
  The slice's *model*, not its barrel. `Focus` was type-only and erased at
  compile; `LANGUAGES` is a value, and importing it from the barrel would drag
  the Postgres-backed queries behind it into every client bundle that renders a
  coach form.
*/
import { LANGUAGES, type Focus } from "@/domains/submission/model/submission";

export interface Coach {
  id: string;
  userId: string;
  /** The coach's login, from the joined `users` row. */
  email: string;
  name: string;
  specialties: Focus[];
  languages: string[];
  isActive: boolean;
  /** Storage locator for the coach's photo; absent until one is uploaded. */
  imageUrl?: string;
  /** A short public bio blurb. */
  bio?: string;
}

/** What the admin submits to add a coach. */
export interface NewCoach {
  name: string;
  email: string;
  password: string;
  specialties: Focus[];
  languages: string[];
  bio?: string;
}

/*
 * `needsTranslation` used to live here, asking only whether *this coach* reads
 * English. It assumed the customer's side, which worked while the platform was
 * the only English speaker in the room and derived nothing useful the moment a
 * Japanese-speaking parent appeared.
 *
 * The rule is symmetric now — intersect both declared sets, empty means
 * translate — so it belongs with the submission, which is the thing that holds
 * both sides. See `domains/submission/model/submission.ts`.
 */

/**
 * What the coach form offers: one of two languages, or both.
 *
 * A free-text list let a coach be saved with **no languages at all**, and a
 * coach with none is the one case the translation rule can't answer — it
 * returns `null` and the queue says "no languages recorded" instead of routing
 * the submission. The choice is the fix: three options, one always selected, so
 * the unanswerable state can't be entered.
 *
 * Both is a real answer, not a convenience. A bilingual coach reads whatever
 * the customer declared, and is the case a rule written as "do the sets match?"
 * rather than "do they overlap?" gets wrong.
 */
export const LANGUAGE_CHOICES = ["Japanese", "English", "both"] as const;

export type LanguageChoice = (typeof LANGUAGE_CHOICES)[number];

/** Japanese, because the coaches are in Japan. */
export const DEFAULT_LANGUAGE_CHOICE: LanguageChoice = "Japanese";

export function languagesForChoice(choice: LanguageChoice): string[] {
  return choice === "both" ? [...LANGUAGES] : [choice];
}

/**
 * Read the posted choice, falling back to the default.
 *
 * The fallback is what makes "nothing" unreachable from the server's side too —
 * a missing or tampered field lands on Japanese rather than writing the empty
 * array the form exists to prevent.
 */
export function readLanguageChoice(value: FormDataEntryValue | null): LanguageChoice {
  const given = String(value ?? "");
  return (LANGUAGE_CHOICES as readonly string[]).includes(given)
    ? (given as LanguageChoice)
    : DEFAULT_LANGUAGE_CHOICE;
}

/**
 * Which radio to preselect when editing an existing coach.
 *
 * Anything the three options can't express — a blank column, or a language we
 * no longer offer — shows as the default, and **saving the form would write
 * that over what's there**. Acceptable only because `LANGUAGES` is these two
 * and every existing row was backfilled to one of them; revisit it the day a
 * third language exists.
 */
export function choiceForLanguages(languages: readonly string[]): LanguageChoice {
  const set = new Set(languages.map((l) => l.trim().toLowerCase()));
  const en = set.has("english");
  const ja = set.has("japanese");
  if (en && ja) return "both";
  if (en) return "English";
  if (ja) return "Japanese";
  return DEFAULT_LANGUAGE_CHOICE;
}
