import type { Metadata } from "next";
import { Container, Button } from "@/shared/ui";
import { requireRole, logout } from "@/domains/account";
import { getCoachByUserId } from "@/domains/coach";
import { findByCoach, type Submission } from "@/domains/submission";
import { UploadFeedback } from "@/domains/feedback";

export const metadata: Metadata = {
  title: "Coach portal",
  robots: { index: false },
};

export default async function CoachHomePage() {
  const session = await requireRole("coach");
  const coach = await getCoachByUserId(session.userId);
  const submissions = coach ? await findByCoach(coach.id) : [];

  const open = submissions.filter((s) => s.status !== "complete");
  const done = submissions.filter((s) => s.status === "complete");

  return (
    <section className="py-10">
      <Container className="max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-bold text-ink">Baseball Sensei</span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
              {coach ? `${coach.name}'s reviews` : "Your reviews"}
            </h1>
          </div>
          <form action={logout}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>

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
            <ReviewCard key={s.id} submission={s} />
          ))}
        </ul>

        {done.length > 0 && (
          <>
            <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Delivered ({done.length})
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
                  <span className="font-semibold text-emerald-600">Delivered ✓</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Container>
    </section>
  );
}

function ReviewCard({ submission }: { submission: Submission }) {
  return (
    <li className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        {submission.videoUrl ? (
          <a
            href={`/api/video/${submission.id}`}
            className="text-sm font-semibold text-accent hover:underline"
          >
            Download video
          </a>
        ) : (
          <span className="text-sm text-ink-muted">Awaiting upload</span>
        )}
      </div>

      {submission.videoUrl && (
        <div className="mt-4 border-t border-line pt-4">
          <UploadFeedback submissionId={submission.id} />
        </div>
      )}
    </li>
  );
}
