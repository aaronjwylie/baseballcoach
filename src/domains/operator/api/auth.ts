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
import { verifyCredentials, changePassword } from "./operatorApi";
import { requireSession } from "./dal";
import {
  HOME_FOR_ROLE,
  type ChangePasswordState,
  type LoginState,
  type OperatorSession,
} from "../model/operator";

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
    role: operator.role,
  } satisfies OperatorSession);

  redirect(HOME_FOR_ROLE[operator.role]);
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
