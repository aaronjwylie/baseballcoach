/**
 * The coach — the person who reviews a submission. Distinct from the operator
 * `operators` row that logs them in: a Coach *has a* user (`operatorId`), plus the
 * profile the admin manages (name, specialties, languages, active).
 */
import type { Focus, LanguageChoice } from "@/domains/submission/model/submission";

export interface Coach {
  id: string;
  operatorId: string;
  /** The coach's login, from the joined `operators` row. */
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
