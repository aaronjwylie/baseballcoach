/**
 * The coach domain — the people who review submissions, and the admin verbs for
 * managing them and assigning work.
 */
export {
  listCoaches,
  getCoachByUserId,
  getCoach,
  createCoach,
  updateCoach,
} from "./api/coachApi";
export {
  createCoachAction,
  updateCoachAction,
  assignCoachAction,
  type CoachFormState,
} from "./api/coachActions";
export { AddCoachForm } from "./ui/AddCoachForm";
export { EditCoachForm } from "./ui/EditCoachForm";
export type { Coach, NewCoach } from "./model/coach";
