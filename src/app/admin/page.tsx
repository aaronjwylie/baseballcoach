import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/shared/ui";
import {
  listFilesForSubmissions,
  listSubmissions,
  SubmissionFileList,
  type Submission,
  type SubmissionFile,
  type SubmissionStatus,
} from "@/domains/submission";
import { listCoaches, assignCoachAction, type Coach } from "@/domains/coach";
import { requireRole } from "@/domains/account";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = {
  title: "Admin — Submissions",
  robots: { index: false },
};

/**
 * The queue only ever holds paid submissions (`listSubmissions` filters the
 * pre-payment states out), but the map is exhaustive so a new status can't be
 * added without deciding how the portal shows it.
 */
const STATUS_LABEL: Record<SubmissionStatus, { text: string; className: string }> = {
  draft: { text: "Draft", className: "bg-stone-50 text-stone-600 border-stone-200" },
  awaiting_payment: { text: "Awaiting payment", className: "bg-amber-50 text-amber-700 border-amber-200" },
  new: { text: "New — needs a coach", className: "bg-blue-50 text-blue-700 border-blue-200" },
  assigned: { text: "Assigned", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  in_review: { text: "In review", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  complete: { text: "Complete", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

/**
 * The filter tabs above the table — "all" plus one per status the queue can
 * actually contain.
 *
 * There is no "awaiting upload" tab any more: files arrive before payment, so
 * that state no longer exists, and an unpaid submission never reaches this
 * queue at all.
 */
const TABS: { key: string; label: string; match: (s: Submission) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "new", label: "New", match: (s) => s.status === "new" },
  { key: "assigned", label: "Assigned", match: (s) => s.status === "assigned" },
  { key: "in_review", label: "In review", match: (s) => s.status === "in_review" },
  { key: "complete", label: "Complete", match: (s) => s.status === "complete" },
];

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRole("admin");
  const { status } = await searchParams;
  const [all, coaches] = await Promise.all([listSubmissions(), listCoaches()]);

  const activeKey = TABS.some((t) => t.key === status) ? status! : "all";
  const rows = all.filter(TABS.find((t) => t.key === activeKey)!.match);

  // One query for the whole page rather than one per row.
  const filesBySubmission = await listFilesForSubmissions(rows.map((s) => s.id));

  return (
    <section className="py-10">
      <Container>
        <AdminNav active="submissions" />

        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Submissions</h1>
          <p className="mt-1 text-sm text-ink-muted">{all.length} total · the coaching queue</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {TABS.map((t) => {
            const count = all.filter(t.match).length;
            const href = t.key === "all" ? "/admin" : `/admin?status=${t.key}`;
            const isActive = t.key === activeKey;
            return (
              <Link
                key={t.key}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-ink bg-ink text-surface"
                    : "border-line bg-white text-ink-muted hover:text-ink"
                }`}
              >
                {t.label}
                <span className={isActive ? "opacity-80" : "text-ink-muted"}>{count}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-muted">
              {all.length === 0
                ? "No submissions yet. They'll appear here once a customer uploads and pays."
                : "No submissions in this view."}
            </p>
          ) : (
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Player</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Focus</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Files</th>
                  <th className="px-4 py-3 font-medium">Coach</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <SubmissionRow
                    key={s.id}
                    submission={s}
                    files={filesBySubmission.get(s.id) ?? []}
                    coaches={coaches}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Container>
    </section>
  );
}

function SubmissionRow({
  submission,
  files,
  coaches,
}: {
  submission: Submission;
  files: SubmissionFile[];
  coaches: Coach[];
}) {
  const status = STATUS_LABEL[submission.status];

  return (
    <tr className="border-b border-line last:border-0 align-top">
      <td className="px-4 py-3 font-medium text-ink">
        {submission.playerName}
        {submission.playerAge ? <span className="text-ink-muted"> · {submission.playerAge}</span> : null}
        <div className="text-xs text-ink-muted">{formatDate(submission.submittedAt)}</div>
      </td>
      <td className="px-4 py-3 text-ink-muted">{submission.customerEmail}</td>
      <td className="px-4 py-3 text-ink-muted">{submission.focus ?? "—"}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>
          {status.text}
        </span>
      </td>
      <td className="px-4 py-3">
        <SubmissionFileList files={files} emptyLabel="—" />
      </td>
      <td className="px-4 py-3">
        <form action={assignCoachAction} className="flex items-center gap-2">
          <input type="hidden" name="submissionId" value={submission.id} />
          <select
            name="coachId"
            defaultValue={submission.assignedCoachId ?? ""}
            className="rounded-md border border-line bg-white px-2 py-1 text-sm"
          >
            <option value="" disabled>
              Assign…
            </option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className="text-xs font-semibold text-accent hover:underline">
            Save
          </button>
        </form>
      </td>
    </tr>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
