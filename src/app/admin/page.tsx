import type { Metadata } from "next";
import { Container } from "@/shared/ui";
import { listSubmissions, type Submission, type SubmissionStatus } from "@/domains/submission";
import { listCoaches, assignCoachAction, type Coach } from "@/domains/coach";
import { requireRole } from "@/domains/account";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = {
  title: "Admin — Submissions",
  robots: { index: false },
};

const STATUS_LABEL: Record<SubmissionStatus, { text: string; className: string }> = {
  awaiting_upload: { text: "Awaiting upload", className: "bg-amber-50 text-amber-700 border-amber-200" },
  new: { text: "New — needs a coach", className: "bg-blue-50 text-blue-700 border-blue-200" },
  assigned: { text: "Assigned", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  in_review: { text: "In review", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  complete: { text: "Complete", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export default async function AdminHomePage() {
  await requireRole("admin");
  const [submissions, coaches] = await Promise.all([listSubmissions(), listCoaches()]);

  return (
    <section className="py-10">
      <Container>
        <AdminNav active="submissions" />
        <div className="mt-6">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Submissions</h1>
          <p className="mt-1 text-sm text-ink-muted">{submissions.length} total · the coaching queue</p>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
          {submissions.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-muted">
              No submissions yet. They&apos;ll appear here as customers pay and upload.
            </p>
          ) : (
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Player</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Focus</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Video</th>
                  <th className="px-4 py-3 font-medium">Coach</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <SubmissionRow key={s.id} submission={s} coaches={coaches} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Container>
    </section>
  );
}

function SubmissionRow({ submission, coaches }: { submission: Submission; coaches: Coach[] }) {
  const status = STATUS_LABEL[submission.status];
  const assignable = submission.status !== "awaiting_upload";

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
        {submission.videoUrl ? (
          <a href={`/api/video/${submission.id}`} className="font-medium text-accent hover:underline">
            Download
          </a>
        ) : (
          <span className="text-ink-muted">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {assignable ? (
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
        ) : (
          <span className="text-ink-muted">—</span>
        )}
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
