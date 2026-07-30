"use server";
/**
 * Login / logout — the account domain's verbs.
 *
 * Server Actions, so credentials are handled only on the server. Login verifies
 * against Postgres, sets the session cookie, and redirects to the role's portal.
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { setSessionCookie, clearSessionCookie } from "@/shared/auth";
import { verifyCredentials } from "./userApi";
import type { LoginState, OperatorSession } from "../model/user";

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
    userId: operator.id,
    role: operator.role,
  } satisfies OperatorSession);

  redirect(operator.role === "admin" ? "/admin" : "/coach");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
