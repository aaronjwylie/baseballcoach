/**
 * The `operator` domain barrel — operator identity: who can log in, and the
 * guards that protect the portal.
 *
 * Server-only members (dal, userApi, auth actions) and the `LoginForm` client
 * component are both re-exported here for Server Component consumers. Client
 * components must import `LoginForm` — and only `LoginForm` — so they don't pull
 * the server-only db/bcrypt code; it imports the `login` action directly.
 */
export { LoginForm } from "./ui/LoginForm";
export { ChangePasswordForm } from "./ui/ChangePasswordForm";
export { RequestResetForm } from "./ui/RequestResetForm";
export { ResetPasswordForm } from "./ui/ResetPasswordForm";
export { login, logout, changePasswordAction } from "./api/auth";
export { getSession, requireSession, requireRole } from "./api/dal";
export { getOperatorById, listAdminEmails } from "./api/operatorApi";
/*
  `operatorCredentialApi` is deliberately absent.

  Its four functions were all exported here and none of them was ever imported
  from outside this domain — `auth`, `coachApi` and `passwordResetApi` reach
  them relatively, as neighbours. Leaving them on the barrel published a
  password-setting function to the whole app on the strength of nobody having
  called it yet.
*/
export type {
  Role,
  Operator,
  OperatorSession,
  LoginState,
  ChangePasswordState,
} from "./model/operator";

/*
  The coach surface, absorbed when `domains/coach` dissolved (ADR 018 §5). A
  coach is an operator with a profile, so its queries were reading this
  domain's tables from another folder — a dependency violation that only
  existed because `coach` used to own a table.
*/
export {
  listCoaches,
  getCoachByOperatorId,
  getCoach,
  createCoach,
  updateCoach,
  noteCoachCollected,
} from "./api/coachApi";
export { listTranslators, getTranslator } from "./api/translatorApi";
export { assignTranslatorAction } from "./api/translatorActions";
export {
  createProfiledOperatorAction,
  updateProfiledOperatorAction,
  type OperatorProfileFormState,
} from "./api/operatorProfileActions";
export { getAssignee } from "./api/operatorProfileApi";
export {
  createCoachAction,
  updateCoachAction,
  assignCoachAction,
  notifyCoachAction,
} from "./api/coachActions";
export { AddCoachForm } from "./ui/AddCoachForm";
export { EditCoachForm } from "./ui/EditCoachForm";
export { AssignCoachSelect } from "./ui/AssignCoachSelect";
export { AssignTranslatorSelect } from "./ui/AssignTranslatorSelect";
export type { OperatorProfile, NewOperatorProfile } from "./model/operatorProfile";
export type { OperatorProfilePatch } from "./api/operatorProfileApi";
