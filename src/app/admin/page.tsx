import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/shared/ui";
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
const STATUS_LABEL: Record<SubmissionStatus, { text: string; className: string }> = {
  draft: { text: "Draft", className: "bg-stone-50 text-stone-600 border-stone-200" },
  awaiting_payment: { text: "Awaiting payment", className: "bg-amber-50 text-amber-700 border-amber-200" },
  new: { text: "New — needs a coach", className: "bg-blue-50 text-blue-700 border-blue-200" },
  assigned: { text: "Assigned", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  // The two translation pairs read as "out" / "back" rather than naming the
  // status, because that's the question being asked of the row.
  intake_translating: { text: "Files out for translation", className: "bg-sky-50 text-sky-700 border-sky-200" },
  intake_translated: { text: "Files translated", className: "bg-sky-50 text-sky-700 border-sky-200" },
  // The distinction `sent_to_coach` exists to make: emailed, but not collected.
  // This is the row Yuta chases.
  sent_to_coach: { text: "Sent — not picked up", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  in_review: { text: "In review", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  awaiting_approval: { text: "Coach submitted", className: "bg-purple-50 text-purple-700 border-purple-200" },
  response_translating: { text: "Response out for translation", className: "bg-sky-50 text-sky-700 border-sky-200" },
  response_translated: { text: "Response translated", className: "bg-sky-50 text-sky-700 border-sky-200" },
  complete: { text: "Sent — not collected", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  collected: { text: "Collected", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  resolved: { text: "Resolved", className: "bg-stone-50 text-stone-600 border-stone-200" },
  purge_imminent: { text: "Deleting in 7 days", className: "bg-amber-50 text-amber-700 border-amber-200" },
  purged: { text: "Files purged", className: "bg-stone-50 text-stone-600 border-stone-200" },
};

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
                    feedbackFiles={feedbackBySubmission.get(s.id) ?? []}
                    folders={foldersBySubmission.get(s.id)}
                    coaches={coaches}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
    </Container>
  );
}

function SubmissionRow({
  submission,
  files,
  feedbackFiles,
  folders,
  coaches,
}: {
  submission: Submission;
  files: SubmissionFile[];
  feedbackFiles: SubmissionFile[];
  folders?: Record<FileKind, SubmissionFile[]>;
  coaches: Coach[];
}) {
  const status = STATUS_LABEL[submission.status];

  /*
    What each hand-off may offer, derived from what actually exists.

    `availableSets` returns a single entry when there's no translation, which is
    the common case — `SendWithFileSet` then renders the button with no radio at
    all, rather than a question with one answer.
  */
  const present = folders
    ? (Object.keys(folders) as FileKind[]).filter((k) => folders[k].length > 0)
    : [];
  const intakeSets = availableSets(
    present.filter((k) => k === "intake" || k === "intake_translation"),
  );
  const responseSets = availableSets(
    present.filter((k) => k === "response" || k === "response_translation"),
  );

  const assignedCoach = coaches.find((c) => c.id === submission.assignedCoachId);
  const wantsTranslation = assignedCoach
    ? needsTranslation(assignedCoach)
    : null;
  const alreadyTranslated = (folders?.intake_translation.length ?? 0) > 0;
  const translationHint =
    wantsTranslation === true && !alreadyTranslated
      ? `${assignedCoach?.name ?? "This coach"} doesn't read English — translate the client files first.`
      : assignedCoach && assignedCoach.languages.length === 0
        ? "No languages recorded for this coach."
        : null;

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
        {/*
          The four folders replace the flat list once a submission is paid: the
          same files, plus the two translation folders Yuta uploads into. Before
          payment there's nothing to curate, so the simpler list stands.
        */}
        {folders && isPaid(submission) ? (
          <>
            <FileFolders
              submissionId={submission.id}
              folders={folders}
              uploadAction={uploadTranslationAction}
            />
            <div className="mt-2">
              <OperatorOverride
                submissionId={submission.id}
                status={submission.status}
                purgeAction={purgeFolderAction}
                resetAction={resetStatusAction}
              />
            </div>
          </>
        ) : (
          <SubmissionFileList files={files} emptyLabel="—" />
        )}
      </td>
      <td className="px-4 py-3">
        {submission.archivedAt ? (
          <div className="flex flex-col items-start gap-2">
            <span className="font-medium text-ink">
              {coaches.find((c) => c.id === submission.assignedCoachId)?.name ?? "—"}
            </span>
            <RowActionForm
              action={unarchiveSubmissionAction}
              submissionId={submission.id}
              label="Unarchive"
              className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-muted hover:text-ink"
            />
          </div>
        ) : submission.status === "in_review" || hasResponse(submission) ? (
          // The coach is locked in once the review is under way (in_review) or
          // done — show the name, not a reassign dropdown, so notified work
          // can't be pulled out from under them. Any per-status action is below.
          <div className="flex flex-col items-start gap-2">
            <span className="font-medium text-ink">
              {coaches.find((c) => c.id === submission.assignedCoachId)?.name ?? "—"}
            </span>

            {(submission.status === "awaiting_approval" ||
              submission.status === "response_translated") && (
              <>
                <FeedbackFileLinks files={feedbackFiles} />
                {/* Step 13 — and the radio only appears when a translation
                    exists to choose between. */}
                <SendWithFileSet
                  action={completeSubmissionAction}
                  submissionId={submission.id}
                  sets={responseSets}
                  label="Approve & send →"
                  className="rounded-md border border-emerald-500 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                />
              </>
            )}

            {isReleased(submission) && (
              <>
                <FeedbackFileLinks files={feedbackFiles} />

                {/* Step 15 — only offered once they've actually collected, so a
                    thank-you can't go out for something they haven't seen. */}
                {submission.status === "collected" && (
                  <RowActionForm
                    action={resolveSubmissionAction}
                    submissionId={submission.id}
                    label="Mark resolved"
                    className="rounded-md border border-emerald-500 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  />
                )}

                <RowActionForm
                  action={archiveSubmissionAction}
                  submissionId={submission.id}
                  label="Archive"
                  className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-muted hover:text-ink"
                />
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <AssignCoachSelect
              key={submission.assignedCoachId ?? "unassigned"}
              submissionId={submission.id}
              assignedCoachId={submission.assignedCoachId}
              coaches={coaches}
            />

            {/*
              Step 5's derivation, surfaced.

              Translation need is a property of the coach — the platform is
              English, so a submission needs translating exactly when the coach
              assigned to it doesn't read English. Saying so here is the whole
              point of assigning before translating: it turns a thing Yuta had to
              remember into a thing the row tells him.
            */}
            {translationHint && (
              <p className="text-[11px] text-amber-700">{translationHint}</p>
            )}

            {(submission.status === "assigned" ||
              submission.status === "intake_translated") &&
              submission.assignedCoachId && (
              <SendWithFileSet
                action={notifyCoachAction}
                submissionId={submission.id}
                sets={intakeSets}
                label="Send email →"
                className="rounded-md border border-accent px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/5"
              />
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

/** The coach's feedback files as download links — Yuta reviews each before he
 * approves, and can still pull them after delivery. */
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

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
