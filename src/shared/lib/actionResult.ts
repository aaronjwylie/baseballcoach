/**
 * What a Server Action tells the person who triggered it.
 *
 * ⟨EVIDENCE — 2026-08-07⟩ The admin actions returned `void` and guarded
 * themselves with **33 silent early returns**. Every refusal — wrong status,
 * already there, not permitted, missing field — looked identical from the
 * outside: the click registered, the action ran, and nothing happened.
 *
 * The worst case was the status override, whose dropdown *defaults to the
 * submission's current status*. Opening it and pressing the button without
 * changing the dropdown hit `if (submission.status === status) return`, so the
 * most likely thing anybody did was the one thing guaranteed to do nothing. It
 * read as a broken button for weeks.
 *
 * **A guard that declines silently is indistinguishable from a bug**, and the
 * person who has to tell them apart is the one with the least information. So an
 * action that can refuse says so, and says why.
 *
 * `undefined` is the initial state — nothing has been attempted yet — which is
 * what `useActionState` starts with.
 */
export type ActionResult = { ok: true } | { error: string } | undefined;

/** Narrowing helpers, so a caller never spells the discriminant by hand. */
export const failed = (r: ActionResult): r is { error: string } =>
  !!r && "error" in r;
export const succeeded = (r: ActionResult): r is { ok: true } =>
  !!r && "ok" in r;
