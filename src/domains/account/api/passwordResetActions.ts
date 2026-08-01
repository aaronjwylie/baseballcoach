"use server";
/**
 * The two public verbs of the forgot-password flow, kept apart from the login
 * actions so that file stays about logging in.
 */
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from "./passwordResetApi";

export type RequestResetState = { sent: true } | { error: string } | undefined;
export type ResetPasswordFormState =
  | { done: true }
  | { error: string }
  | undefined;

export async function requestResetAction(
  _prev: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  // Best-effort, and deliberately the same result whether or not it exists.
  await requestPasswordReset(email);
  return { sent: true };
}

export async function resetPasswordAction(
  _prev: ResetPasswordFormState,
  formData: FormData,
): Promise<ResetPasswordFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) {
    return { error: "Your new password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "The two passwords don't match." };
  }
  const result = await resetPasswordWithToken(token, password);
  return result.ok ? { done: true } : { error: result.error };
}
