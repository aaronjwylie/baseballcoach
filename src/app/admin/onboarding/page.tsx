import { redirect } from "next/navigation";

/** Onboarding defaults to admins — the kind you add first on a new install. */
export default function OnboardingIndex() {
  redirect("/admin/onboarding/admins");
}
