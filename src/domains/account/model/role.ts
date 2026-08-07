/**
 * Who someone is allowed to be — **the access vocabulary.**
 *
 * A role is stored as a column on the operator row, which is why this lived in
 * `operator` until 2026-08-06. But what a role *decides* is access: which
 * portal you land in, whether you can be given work, what a guard lets through.
 * That is this domain's subject, and the session carries it.
 *
 * `Operator` — the record itself — stays in `operator`. The split is: **what
 * you are allowed to do is here; who you are is there.**
 *
 * The DB enum sits beside this file rather than in `operator`, so that it can
 * derive from `ROLES` without reaching across a domain boundary. `operatorTable`
 * imports it at the declaration plane, which is how tables reach each other
 * uniformly (`_StructureLaw` §5.7).
 */
/**
 * The two operator roles — the vocabulary `userRoleEnum.ts` derives from.
 *
 * A list rather than a bare union so there is one home for the fact. Customers
 * are not a third role and never will be: they don't get a `operators` row at all.
 */
export const ROLES = ["admin", "coach", "translator"] as const;
export type Role = (typeof ROLES)[number];
/**
 * Where each role lands after signing in, and where a wrong-role visitor is sent
 * back to.
 *
 * **A Record, not a ternary.** It was `role === "admin" ? "/admin" : "/coach"`
 * in three places, which meant adding `translator` silently routed them to the
 * coach portal — a portal `proxy.ts` then bounces them out of, so the first
 * translator to sign in would have hit a redirect loop. Nothing failed to
 * compile. This makes a fourth role a compile error instead.
 */
export const HOME_FOR_ROLE: Record<Role, string> = {
  admin: "/admin",
  coach: "/coach",
  translator: "/translator",
};
/**
 * Who can be given a submission.
 *
 * The admin assigns; they are not assigned to. Coaches and translators both
 * take work, which is the only thing that distinguishes them from an admin at
 * this level — and nothing distinguishes them from each other.
 */
export const CAN_BE_ASSIGNED: Record<Role, boolean> = {
  admin: false,
  coach: true,
  translator: true,
};
/** The session cookie payload — minimal, no PII (CLAUDE.md authentication). */
export interface OperatorSession {
  operatorId: string;
  role: Role;
}
/** Return shape of the login server action, for `useActionState`. */
export type LoginState = { error: string } | undefined;
/** Return shape of the change-password server action. */
export type ChangePasswordState = { error: string } | { ok: true } | undefined;
