import type { Metadata } from "next";
import Link from "next/link";
import { Container, LocalTime, pillClass } from "@/shared/ui";
import { FLOW_WINDOW_MINUTES } from "@/shared/lib";
import {
  listFeedbackFiles,
  listFilesForSubmissions,
  listSubmissions,
  SubmissionFileList,
  type Submission,
  type SubmissionFile,
  type SubmissionStatus,
  hasResponse,
  isReleased,
  availableSets,
  listFilesByFolder,
  type FileKind,
  isPaid,
  listProgressFacts,
  describeStage,
  listSubmissionEvents,
  type SubmissionEvent,
  whoseCourt,
} from "@/domains/submission";
import {
  listCoaches,
  notifyCoachAction,
  AssignCoachSelect,
  type Coach,
} from "@/domains/coach";
import { requireRole } from "@/domains/account";
import { RowActionForm } from "./RowActionForm";
import { SendWithFileSet } from "./SendWithFileSet";
import { FileFolders } from "./FileFolders";
import { OperatorOverride } from "./OperatorOverride";
import { QueueRow } from "./QueueRow";
import { needsTranslation } from "@/domains/coach/model/coach";
import {
  archiveSubmissionAction,
  completeSubmissionAction,
  purgeFolderAction,
  resetStatusAction,
  resolveSubmissionAction,
  uploadTranslationAction,
  unarchiveSubmissionAction,
} from "./adminActions";

export const metadata: Metadata = {
  title: "Admin — Submissions",
  robots: { index: false },
};

/**
 * The queue only ever holds paid submissions (`listSubmissions` filters the
 * pre-payment states out), but the map is exhaustive so a new status can't be
 * added without deciding how the portal shows it.
 */
/**
 * The filter tabs above the table — "all" plus one per status the queue can
 * actually contain, then "Archived".
 *
 * Archiving is a separate dimension from status: an archived submission still
 * sits somewhere on the ladder, so every non-archived tab (including "All")
 * excludes it, and only "Archived" shows it. There is no "awaiting upload" tab —
 * files arrive before payment, so that state no longer exists.
 *
 * **Not one tab per rung.** Sixteen tabs would be a worse queue than seven; a
 * tab earns its place by answering "what needs me?", which is why the translation
 * rungs are folded into their neighbours and `sent_to_coach` gets its own — it's
 * the one that means *chase somebody*.
 */
const TABS: { key: string; label: string; match: (s: Submission) => boolean }[] = [
  { key: "all", label: "All", match: (s) => !s.archivedAt },
  {
    key: "unpaid",
    label: "In progress",
    /*
      Someone filling in the form right now, or stalled before paying.

      Its own tab rather than hidden: at this volume a live attempt is the most
      interesting thing on the page, and during a test run a queue that shows
      nothing until money moves is a queue you can't follow. They clear
      themselves — the abandonment sweep deletes them outright — so nothing
      accumulates here.
    */
    match: (s) => !isPaid(s) && !s.archivedAt,
  },
  { key: "new", label: "New", match: (s) => s.status === "new" && !s.archivedAt },
  {
    key: "assigned",
    label: "Assigned",
    // Assignment through translation — the coach has it on their desk but
    // hasn't been handed anything yet.
    match: (s) =>
      (s.status === "assigned" ||
        s.status === "intake_translating" ||
        s.status === "intake_translated") &&
      !s.archivedAt,
  },
  {
    key: "sent_to_coach",
    label: "Not picked up",
    // The row that means someone is waiting on a person. Its own tab because
    // that's the whole reason the rung exists.
    match: (s) => s.status === "sent_to_coach" && !s.archivedAt,
  },
  { key: "in_review", label: "In review", match: (s) => s.status === "in_review" && !s.archivedAt },
  {
    key: "awaiting_approval",
    label: "Coach submitted",
    // Delivered, plus the response-translation pair — all of it is waiting on
    // Yuta and none of it has reached the customer.
    match: (s) =>
      (s.status === "awaiting_approval" ||
        s.status === "response_translating" ||
        s.status === "response_translated") &&
      !s.archivedAt,
  },
  {
    key: "complete",
    label: "Sent",
    // Everything released, whether or not the customer has collected it yet.
    match: (s) => isReleased(s) && !s.archivedAt,
  },
  { key: "archived", label: "Archived", match: (s) => !!s.archivedAt },
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

  /*
    The four folders, per row.

    One query per submission rather than one for the page: the folder view only
    renders for rows Yuta has expanded in practice, and a page-wide join would
    read every translation of every submission to show a handful. Bounded by the
    page size, which the queue already limits.
  */
  const foldersBySubmission = new Map(
    await Promise.all(
      rows.map(async (s) => [s.id, await listFilesByFolder(s.id)] as const),
    ),
  );

  // What each row has passed through, and which messages landed. One read for
  // the page — the progress view needs it on every row.
  const progressBySubmission = await listProgressFacts(rows.map((s) => s.id));

  // The full trail, for the expanded panel. Per row rather than page-wide: only
  // an opened row shows it, and most rows are never opened.
  const eventsBySubmission = new Map(
    await Promise.all(
      rows.map(async (s) => [s.id, await listSubmissionEvents(s.id)] as const),
    ),
  );

  // The coach's feedback files, for the rows where Yuta acts on them — reviewing
  // before approval, and after it's delivered.
  const feedbackBySubmission = new Map(
    await Promise.all(
      rows
        .filter(hasResponse)
        .map(async (s) => [s.id, await listFeedbackFiles(s.id)] as const),
    ),
  );

  return (
    <Container>
      <div>
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

        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-muted">
              {all.length === 0
                ? "No submissions yet. They'll appear here once a customer uploads and pays."
                : "No submissions in this view."}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,200px)_1fr_minmax(0,150px)_30px] gap-4 border-b border-line bg-paper-alt px-4 py-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted max-[860px]:hidden">
                <div>Player</div>
                <div>Progress</div>
                <div />
                <div />
              </div>
              {rows.map((s) => (
                <SubmissionRow
                  key={s.id}
                  submission={s}
                  files={filesBySubmission.get(s.id) ?? []}
                  feedbackFiles={feedbackBySubmission.get(s.id) ?? []}
                  folders={foldersBySubmission.get(s.id)}
                  progress={progressBySubmission.get(s.id)}
                  events={eventsBySubmission.get(s.id) ?? []}
                  coaches={coaches}
                />
              ))}
            </>
          )}
        </div>
    </Container>
  );
}

/**
 * One submission, as the queue shows it.
 *
 * A server component that assembles everything and hands it to `QueueRow`,
 * which owns only the open/closed state. The controls are passed as nodes
 * because they're bound to Server Actions — the row shouldn't know which.
 */
function SubmissionRow({
  submission,
  files,
  feedbackFiles,
  folders,
  progress,
  events,
  coaches,
}: {
  submission: Submission;
  files: SubmissionFile[];
  feedbackFiles: SubmissionFile[];
  folders?: Record<FileKind, SubmissionFile[]>;
  progress?: { reached: Set<SubmissionStatus>; emails: Map<string, boolean> };
  events: SubmissionEvent[];
  coaches: Coach[];
}) {
  const assignedCoach = coaches.find((c) => c.id === submission.assignedCoachId);
  const empty: Record<FileKind, SubmissionFile[]> = {
    intake: [], intake_translation: [], response: [], response_translation: [],
  };
  const folderMap = folders ?? empty;

  /*
    What each hand-off may offer, derived from what actually exists.

    `availableSets` returns a single entry when there's no translation, which is
    the common case — `SendWithFileSet` then renders the button with no radio at
    all, rather than a question with one answer.
  */
  const present = (Object.keys(folderMap) as FileKind[]).filter((k) => folderMap[k].length > 0);
  const intakeSets = availableSets(present.filter((k) => k === "intake" || k === "intake_translation"));
  const responseSets = availableSets(present.filter((k) => k === "response" || k === "response_translation"));

  const wantsTranslation = assignedCoach ? needsTranslation(assignedCoach) : null;

  const stage = describeStage(submission, {
    files: {
      intake: folderMap.intake.length,
      intake_translation: folderMap.intake_translation.length,
      response: folderMap.response.length,
      response_translation: folderMap.response_translation.length,
    },
    coachHasLanguages: (assignedCoach?.languages.length ?? 0) > 0,
    reached: progress?.reached ?? new Set<SubmissionStatus>(),
    emails: progress?.emails ?? new Map<string, boolean>(),
  });

  /*
    The control belongs to the outstanding line, so it's chosen from the chain
    rather than from the status. Two sources of truth about "what happens next"
    is exactly how a button bar and a status badge drift apart.
  */
  const act = stage.find((line) => line.now)?.act;

  const control = submission.archivedAt ? (
    <RowActionForm
      action={unarchiveSubmissionAction}
      submissionId={submission.id}
      label="Unarchive"
      className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-muted hover:text-ink"
    />
  ) : act === "assign" ? (
    <div className="flex flex-col items-start gap-2">
      <AssignCoachSelect
        key={submission.assignedCoachId ?? "unassigned"}
        submissionId={submission.id}
        assignedCoachId={submission.assignedCoachId}
        coaches={coaches}
      />
      <p className="text-[11px] text-ink-muted">
        Assigning is also what makes translation need derivable — the coach decides it.
      </p>
    </div>
  ) : act === "handoff" ? (
    <SendWithFileSet
      action={notifyCoachAction}
      submissionId={submission.id}
      sets={intakeSets}
      label="Send email →"
      className="rounded-md border border-accent px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/5"
    />
  ) : act === "approve" ? (
    <div className="flex flex-col items-start gap-2">
      <FeedbackFileLinks files={feedbackFiles} />
      <SendWithFileSet
        action={completeSubmissionAction}
        submissionId={submission.id}
        sets={responseSets}
        label="Approve & send →"
        className="rounded-md border border-emerald-500 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
      />
    </div>
  ) : act === "resolve" ? (
    <div className="flex flex-wrap items-center gap-2">
      <RowActionForm
        action={resolveSubmissionAction}
        submissionId={submission.id}
        label="Mark resolved"
        className="rounded-md border border-emerald-500 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
      />
      <RowActionForm
        action={archiveSubmissionAction}
        submissionId={submission.id}
        label="Archive"
        className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-muted hover:text-ink"
      />
    </div>
  ) : act === "uploadIntake" || act === "uploadResponse" ? (
    <p className="text-[11px] text-ink-muted">
      Off-platform work — upload the result into the{" "}
      {act === "uploadIntake" ? "client" : "coach"}-translated folder on the right.
    </p>
  ) : act ? (
    // The waits. Naming who we're waiting on is more use than a disabled button.
    <p className="text-[11px] text-ink-muted">
      {act === "waitCoach"
        ? "Waiting on the coach. Chase them if this sits."
        : act === "waitCustomer"
          ? "Waiting on the customer. No clock runs until they act."
          : "Waiting on the nightly sweep."}
    </p>
  ) : isReleased(submission) && !submission.archivedAt ? (
    <RowActionForm
      action={archiveSubmissionAction}
      submissionId={submission.id}
      label="Archive"
      className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-muted hover:text-ink"
    />
  ) : undefined;

  const outstanding = stage.find((line) => line.now);

  /*
    `awaiting_payment` is one rung across two steps, and its own name is only
    true for the second.

    A customer who has just verified their email is *uploading* — a row saying
    "awaiting payment" reads as "we're waiting on their money" when we're waiting
    on their files. The server can't tell step 3 from step 4, because the payment
    intent id isn't stored until payment succeeds — so this says the thing it
    actually knows: whether anything has arrived yet.

    The rung is unchanged. Renaming the enum would be a migration to fix a label,
    and the label is what was wrong.
  */
  const railLabel =
    submission.status === "awaiting_payment"
      ? folderMap.intake.length === 0
        ? "Verified — uploading"
        : `Uploaded ${folderMap.intake.length} — not paid`
      : undefined;

  const lastActivity = submission.updatedAt ?? submission.submittedAt;
  const sessionExpiry = lastActivity
    ? new Date(new Date(lastActivity).getTime() + FLOW_WINDOW_MINUTES * 60_000).toISOString()
    : undefined;

  /*
    The coach gets their name; everyone else gets their role.

    A name is only more useful than a role when there's a specific person to
    chase — and for the customer, Yuta himself, or an off-platform translator
    there isn't one, or it's obvious. "Waiting on the translator" is actionable
    in a way "assigned to Yuki" isn't when Yuki hasn't been sent anything yet.
  */
  const court = whoseCourt(submission);
  const courtName =
    court === "coach"
      ? (assignedCoach?.name ?? "the coach")
      : court === "system"
        ? "the sweep"
        : court;

  return (
    <QueueRow
      playerName={submission.playerName}
      /*
        The short id leads, because it's the handle.

        A uuid is unusable in conversation and the first eight characters are
        unambiguous at any volume this product will see — enough to say "look at
        6dccefdb" and both people know which row. The full one is in the details,
        where it can be copied.
      */
      shortId={submission.id.slice(0, 8)}
      meta={[
        submission.focus,
        `${folderMap.intake.length} file${folderMap.intake.length === 1 ? "" : "s"}`,
        submission.customerEmail,
      ]
        .filter(Boolean)
        .join(" · ")}
      rail={{
        status: submission.status,
        needsTranslation: wantsTranslation === true,
        label: railLabel,
      }}
      /*
        Whose court the ball is in — not who is assigned.

        A submission can belong to a coach for days while everyone is actually
        waiting on Yuta to approve it. The assigned coach is only sometimes the
        answer to "who is holding this up", and the queue exists to answer the
        second question.

        An archived row is nobody's move, whatever rung it stopped on.
      */
      facts={
        submission.archivedAt ? (
          <span className={`${pillClass} border-line text-ink-muted`}>archived</span>
        ) : (
          /*
            Filled ink when it's ours, outlined when it isn't.

            The design system carries emphasis by weight and contrast rather than
            hue (globals.css), so "primary" here means the same solid ink the
            active status pill uses. Scanning the column, the filled pills are
            the work waiting on us — which is the one thing an operator opening
            this page is actually looking for.
          */
          <span
            className={`${pillClass} ${
              court === "admin"
                ? "border-ink bg-ink text-white"
                : "border-line bg-white text-ink-soft"
            }`}
          >
            {courtName}
          </span>
        )
      }
      /* The flag names what's outstanding rather than restating the status —
         the rail already says where it is. */
      flag={outstanding && !submission.archivedAt ? outstanding.what : undefined}
      stage={stage}
      control={control}
      folders={
        isPaid(submission) ? (
          <FileFolders
            submissionId={submission.id}
            folders={folderMap}
            uploadAction={uploadTranslationAction}
          />
        ) : (
          <SubmissionFileList files={files} emptyLabel="Nothing uploaded yet." />
        )
      }
      details={
        <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 text-xs">
          <dt className="text-ink-muted">ID</dt>
          <dd className="m-0 font-mono text-[11.5px] break-all text-ink-soft">
            {submission.id}
          </dd>
          <dt className="text-ink-muted">Started</dt>
          <dd className="m-0 font-mono text-[11.5px] text-ink-soft">
            <LocalTime iso={submission.submittedAt} />
          </dd>
          {/*
            Only while it can still lapse. After payment the flow cookie is
            released deliberately, so an expiry here would describe a session
            nobody is holding.

            Derived, not stored: the cookie is re-issued on every action and the
            server never records when. Measuring from the last write is the
            earliest it can die, never the latest — hence the qualifier, which is
            the honest thing to show rather than a precise-looking time that can
            be wrong.
          */}
          {!isPaid(submission) && (
            <>
              <dt className="text-ink-muted">Session expires</dt>
              <dd className="m-0 font-mono text-[11.5px] text-ink-soft">
                <LocalTime iso={sessionExpiry} />
                <span className="ml-1.5 font-sans text-ink-muted">at the earliest</span>
              </dd>
            </>
          )}
          <dt className="text-ink-muted">Customer</dt>
          <dd className="m-0 font-mono text-[11.5px] text-ink-soft">{submission.customerEmail}</dd>
          <dt className="text-ink-muted">Coach</dt>
          <dd className="m-0 font-mono text-[11.5px] text-ink-soft">{assignedCoach?.name ?? "—"}</dd>
          <dt className="text-ink-muted">Languages</dt>
          <dd className="m-0 font-mono text-[11.5px] text-ink-soft">
            {assignedCoach ? assignedCoach.languages.join(", ") || "none recorded" : "—"}
          </dd>
          <dt className="text-ink-muted">Sent to coach</dt>
          <dd className="m-0 font-mono text-[11.5px] text-ink-soft">{submission.coachFileSet ?? "—"}</dd>
          <dt className="text-ink-muted">Sent to customer</dt>
          <dd className="m-0 font-mono text-[11.5px] text-ink-soft">{submission.customerFileSet ?? "—"}</dd>
          <dt className="text-ink-muted">Collected</dt>
          <dd className="m-0 font-mono text-[11.5px] text-ink-soft"><LocalTime iso={submission.collectedAt} /></dd>
        </dl>
      }
      events={events}
      override={
        isPaid(submission) ? (
          <OperatorOverride
            submissionId={submission.id}
            status={submission.status}
            purgeAction={purgeFolderAction}
            resetAction={resetStatusAction}
          />
        ) : null
      }
    />
  );
}

function FeedbackFileLinks({ files }: { files: SubmissionFile[] }) {
  if (files.length === 0) {
    return <span className="text-xs text-ink-muted">No feedback files</span>;
  }
  return (
    <div className="flex flex-col items-start gap-1">
      {files.map((file) => (
        <a
          key={file.id}
          href={`/api/feedback/${file.id}`}
          className="text-xs font-semibold text-accent hover:underline"
        >
          {file.filename} ↓
        </a>
      ))}
    </div>
  );
}

