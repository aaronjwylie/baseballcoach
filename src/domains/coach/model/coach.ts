/**
 * The coach — the person who reviews a submission.
 *
 * A **view over two rows** since ADR 018: the `operator` that logs them in, and
 * the `operatorProfile` that says what they cover. Not a record of its own any
 * more, which is why `id` here is the operator's id — one person, one
 * identifier, whichever way you arrived at them.
 */
import type { Focus, LanguageChoice } from "@/domains/submission/model/submission";

export interface Coach {
  /** The operator's id. A coach *is* an operator, so there is only the one. */
  id: string;
  /** Their login, from the operator row. */
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
 * Japanese, because the coaches are in Japan — the one thing about the choice
 * that is a coach fact rather than a language fact. The vocabulary itself lives
 * in `domains/submission`, beside the rule that consumes it.
 */
export const DEFAULT_LANGUAGE_CHOICE: LanguageChoice = "Japanese";
