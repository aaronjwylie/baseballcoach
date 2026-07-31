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
}

/** What the admin submits to add a coach. */
export interface NewCoach {
  name: string;
  email: string;
  password: string;
  specialties: Focus[];
  languages: string[];
}
