"use client";

import { useRouter } from "next/navigation";

/**
 * A one-button form for a row action (notify, archive, unarchive).
 *
 * Client-side so it can `router.refresh()` after the action — `revalidatePath`
 * alone left the page serving its cached RSC, so the row wouldn't move/vanish
 * until a manual reload (same fix as the assign dropdown).
 */
export function RowActionForm({
  action,
  submissionId,
  label,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  submissionId: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <form
      action={async (formData) => {
        await action(formData);
        router.refresh();
      }}
    >
      <input type="hidden" name="submissionId" value={submissionId} />
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
