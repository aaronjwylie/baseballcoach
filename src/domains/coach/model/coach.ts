/**
 * The coach — the person who reviews a submission. Distinct from the operator
 * `users` row that logs them in: a Coach *has a* user (`userId`), plus the
 * profile the admin manages (name, specialties, languages, active).
 */
import type { Focus } from "@/domains/submission";

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

/**
 * Does this coach need the files translated?
 *
 * The platform is English — there is no multilingual UI and none is planned
 * (CLAUDE.md §2) — so a customer's files are English by construction, and the
 * question reduces to whether *this* coach reads it. That's what makes the
 * answer derivable at assignment instead of something Yuta has to remember.
 *
 * **Unknown is not the same as no.** A coach with no languages recorded returns
 * null rather than true: prompting for a translation on the strength of a blank
 * field would nag on every submission until someone filled it in, and a prompt
 * that's usually wrong is one people learn to dismiss. The admin surfaces the
 * gap instead.
 */
export function needsTranslation(
  coach: Pick<Coach, "languages">,
): boolean | null {
  if (coach.languages.length === 0) return null;
  return !coach.languages.some((language) => /english/i.test(language));
}
