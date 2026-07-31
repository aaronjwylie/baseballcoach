import type { Metadata } from "next";
import { Container } from "@/shared/ui";
import { requireRole } from "@/domains/account";
import { getCoachByUserId } from "@/domains/coach";
import {
  findByCoach,
  listFilesForSubmissions,
  SubmissionFileList,
  type Submission,
  type SubmissionFile,
} from "@/domains/submission";
import { UploadFeedback } from "@/domains/feedback";

export const metadata: Metadata = {
  title: "Coach portal",
  robots: { index: false },
};

export default async function CoachHomePage() {
  const session = await requireRole("coach");
  const coach = await getCoachByUserId(session.userId);
  const submissions = coach ? await findByCoach(coach.id) : [];
  // One query for the page rather than one per card.
  const filesBySubmission = await listFilesForSubmissions(
    submissions.map((s) => s.id),
  );

  // A coach's work is "open" until they upload; once uploaded it's awaiting
  // Yuta's approval (or delivered), and out of their hands.
  const open = submissions.filter(
    (s) => s.status === "assigned" || s.status === "in_review",
  );
  const done = submissions.filter(
    (s) => s.status === "awaiting_approval" || s.status === "complete",
  );

  return (
    <Container className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        {coach ? `${coach.name}'s reviews` : "Your reviews"}
      </h1>

      {!coach && (
          <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            Your login isn&apos;t linked to a coach profile yet. Ask the admin to set it up.
          </p>
        )}

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          To review ({open.length})
        </h2>
        <ul className="mt-3 space-y-3">
          {open.length === 0 && (
            <li className="rounded-2xl border border-line bg-white p-5 text-sm text-ink-muted">
              Nothing assigned to you right now.
            </li>
          )}
          {open.map((s) => (
            <ReviewCard
              key={s.id}
              submission={s}
              files={filesBySubmission.get(s.id) ?? []}
            />
          ))}
        </ul>

        {done.length > 0 && (
          <>
            <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Submitted ({done.length})
            </h2>
            <ul className="mt-3 space-y-3">
              {done.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-2xl border border-line bg-white p-5 text-sm"
                >
                  <span className="font-medium text-ink">
                    {s.playerName}
                    {s.focus ? <span className="text-ink-muted"> · {s.focus}</span> : null}
                  </span>
                  {s.status === "complete" ? (
                    <span className="font-semibold text-emerald-600">Delivered ✓</span>
                  ) : (
                    <span className="font-semibold text-purple-600">Awaiting review</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
    </Container>
  );
}

/**
 * A submission always arrives with its files already attached — they are
 * uploaded before payment now, and an unpaid submission never reaches a coach.
 * So there is no "awaiting upload" state to render here any more; an empty list
 * means the retention sweep has been through.
 */
function ReviewCard({
  submission,
  files,
}: {
  submission: Submission;
  files: SubmissionFile[];
}) {
  return (
    <li className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-ink">
            {submission.playerName}
            {submission.playerAge ? (
              <span className="text-ink-muted"> · {submission.playerAge}</span>
            ) : null}
          </div>
          <div className="mt-0.5 text-sm text-ink-muted">
            {submission.focus ? `${submission.focus} · ` : ""}
            {submission.customerNotes ? submission.customerNotes : "No notes"}
          </div>
        </div>
        <div className="text-right">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {files.length} file{files.length === 1 ? "" : "s"}
          </div>
          <SubmissionFileList files={files} emptyLabel="Files deleted" />
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <UploadFeedback submissionId={submission.id} />
      </div>
    </li>
  );
}
