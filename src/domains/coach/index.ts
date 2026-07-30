/**
 * The coach domain — the people who review submissions, and the admin verbs for
 * managing them and assigning work.
 */
export { listCoaches, getCoachByUserId, createCoach } from "./api/coachApi";
export {
  createCoachAction,
  assignCoachAction,
  type CoachFormState,
} from "./api/coachActions";
export { AddCoachForm } from "./ui/AddCoachForm";
export type { Coach, NewCoach } from "./model/coach";
