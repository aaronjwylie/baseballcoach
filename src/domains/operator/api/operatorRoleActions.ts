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
import { setGrants } from "./operatorRoleApi";

const isRole = (value: string): value is Role =>
  (ROLES as readonly string[]).includes(value);

export async function setRolesAction(formData: FormData): Promise<void> {
  const session = await requireRole("admin");

  const operatorId = String(formData.get("operatorId") ?? "");
  if (!operatorId) return;

  /*
    Two fields, so holding and being available arrive together and are applied
    together — a half-saved change between "is a coach" and "is taking work" is
    not a state worth being able to reach.

    Unknown values are dropped rather than rejected. The form only ever submits
    the three, so anything else arrived by hand, and ignoring it is safer than
    trusting it into a `Role` cast.
  */
  const active = formData.getAll("active").map(String).filter(isRole);
  const paused = formData.getAll("paused").map(String).filter(isRole);
  const grants = [
    ...active.map((role) => ({ role, isActive: true })),
    ...paused.map((role) => ({ role, isActive: false })),
  ];

  await setGrants(operatorId, grants, session.operatorId);

  for (const kind of ["all", "admins", "coaches", "translators"]) {
    revalidatePath(`/admin/operators/${kind}`);
    revalidatePath(`/admin/operators/${kind}/${operatorId}`);
  }
}
