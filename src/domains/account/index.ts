/**
 * The `account` domain barrel — operator identity: who can log in, and the
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
export {
  verifyCredentials,
  getOperatorById,
  createOperator,
  changePassword,
  setUserPassword,
} from "./api/userApi";
export type {
  Role,
  Operator,
  OperatorSession,
  LoginState,
  ChangePasswordState,
} from "./model/user";
