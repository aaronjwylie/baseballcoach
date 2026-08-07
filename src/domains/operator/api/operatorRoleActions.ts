"use server";
/**
 * Changing which kinds someone is. Admin-only.
 *
 * The guard is re-checked here rather than trusted from the UI — a Server
 * Action is a public endpoint with a nice-looking call site, and this one grants
 * privileges.
 */
import { revalidatePath } from "next/cache";
import { requireRole } from "@/domains/account";
import { ROLES, type Role } from "../model/operatorRoleEnum";
import { setRoles } from "./operatorRoleApi";

const isRole = (value: string): value is Role =>
  (ROLES as readonly string[]).includes(value);

export async function setRolesAction(formData: FormData): Promise<void> {
  const session = await requireRole("admin");

  const operatorId = String(formData.get("operatorId") ?? "");
  if (!operatorId) return;

  /*
    Unknown values are dropped rather than rejected. The form only ever submits
    the three, so anything else arrived by hand — and silently ignoring it is
    safer than trusting it into a `Role` cast.
  */
  const roles = formData.getAll("roles").map(String).filter(isRole);

  await setRoles(operatorId, roles, session.operatorId);

  for (const kind of ["admins", "coaches", "translators"]) {
    revalidatePath(`/admin/onboarding/${kind}`);
    revalidatePath(`/admin/onboarding/${kind}/${operatorId}`);
  }
}
