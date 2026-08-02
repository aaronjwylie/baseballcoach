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
  noteCoachCollected,
} from "./api/coachApi";
export {
  createCoachAction,
  updateCoachAction,
  assignCoachAction,
  notifyCoachAction,
  type CoachFormState,
} from "./api/coachActions";
export { AddCoachForm } from "./ui/AddCoachForm";
export { EditCoachForm } from "./ui/EditCoachForm";
export { AssignCoachSelect } from "./ui/AssignCoachSelect";
export type { Coach, NewCoach } from "./model/coach";
