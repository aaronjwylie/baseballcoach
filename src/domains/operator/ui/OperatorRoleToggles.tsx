"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui";
import { setRolesAction } from "../api/operatorRoleActions";
import { ROLES, type Role } from "../model/operatorRoleEnum";

const BLURB: Record<Role, string> = {
  admin: "Runs the platform — the queue, onboarding, settings.",
  coach: "Can be assigned a submission to review.",
  translator: "Can be assigned a leg of a translation.",
};

/**
 * Which kinds this person is — the control that makes one operator several.
 *
 * **All three submit together**, as a set, rather than one toggle firing per
 * click. Two reasons: a half-applied change is not a state anyone wants to
 * discover, and `setRoles` diffs against what is held, so an unchanged role
 * keeps its original `grantedAt` and `grantedBy` instead of being restated as
 * having happened just now.
 *
 * Removing the last role is allowed. It leaves someone who can sign in and
 * enter nothing, which is a real state the portal chooser explains — an
 * operator can exist before anyone decides what they do, and after.
 */
export function OperatorRoleToggles({
  operatorId,
  held,
}: {
  operatorId: string;
  held: Role[];
}) {
  const [roles, setRoles] = useState<Role[]>(held);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const dirty =
    roles.length !== held.length || roles.some((r) => !held.includes(r));

  return (
    <form
      action={async (formData) => {
        setPending(true);
        await setRolesAction(formData);
        setPending(false);
        setSaved(true);
        router.refresh();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="operatorId" value={operatorId} />
      {roles.map((role) => (
        <input key={role} type="hidden" name="roles" value={role} />
      ))}

      <ul className="space-y-2">
        {ROLES.map((role) => (
          <li key={role}>
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={roles.includes(role)}
                onChange={(e) => {
                  setSaved(false);
                  setRoles((current) =>
                    e.target.checked
                      ? [...current, role]
                      : current.filter((r) => r !== role),
                  );
                }}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium capitalize text-ink">{role}</span>
                <span className="block text-ink-muted">{BLURB[role]}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {roles.length === 0 && (
        <p className="text-[13px] text-amber-700">
          With no roles they can still sign in, but there is nowhere for them to
          go until one is added back.
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save roles"}
        </Button>
        {saved && !dirty && (
          <span className="text-sm text-emerald-700">Saved.</span>
        )}
      </div>
    </form>
  );
}
