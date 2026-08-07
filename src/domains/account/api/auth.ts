"use server";
/**
 * Login / logout — the operator domain's verbs.
 *
 * Server Actions, so credentials are handled only on the server. Login verifies
 * against Postgres, sets the session cookie, and redirects to the role's portal.
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { setSessionCookie, clearSessionCookie } from "@/shared/auth";
import { changePassword } from "./credentialApi";
import { verifyCredentials } from "./loginApi";
import { requireSession } from "./dal";
import {
  HOME_FOR_ROLE,
  type ChangePasswordState,
  type LoginState,
  type OperatorSession,
  portalsFor,
} from "../model/session";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const operator = await verifyCredentials(
    parsed.data.email,
    parsed.data.password,
  );
  if (!operator) return { error: "Invalid email or password." };

  await setSessionCookie({
    operatorId: operator.id,
    roles: operator.roles,
  } satisfies OperatorSession);

  /*
    One kind goes straight in; several get the chooser.

    Guessing on their behalf was the alternative, and it is wrong for the person
    it most affects: someone who both runs the platform and coaches is doing one
    of those two jobs on any given login, and only they know which.
  */
  const mine = portalsFor(operator.roles);
  redirect(mine.length === 1 ? HOME_FOR_ROLE[mine[0]] : "/portal");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await requireSession();

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }
  if (next !== confirm) {
    return { error: "The new passwords don't match." };
  }

  const ok = await changePassword(session.operatorId, current, next);
  if (!ok) return { error: "Your current password is incorrect." };

  return { ok: true };
}
