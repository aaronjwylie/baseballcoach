import type { Metadata } from "next";
import { Container, ButtonLink } from "@/shared/ui";
import { getSubmission, listFeedbackFiles, formatFileSize } from "@/domains/submission";
import { verifyFeedbackToken } from "@/domains/feedback";

export const metadata: Metadata = {
  title: "Your feedback",
  // The link is a capability; keep it out of search results.
  robots: { index: false, follow: false },
};

/**
 * The customer's feedback delivery, reached only from the signed link in their
 * "feedback is ready" email.
 *
 * There is no email entry here, by design: the token *is* the identity. A
 * stranger can't guess an address and collect someone's review, because there's
 * no address to guess — only the unguessable token grants access, and it's bound
 * to one submission.
 */
export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const submissionId = await verifyFeedbackToken(token);
  const submission = submissionId ? await getSubmission(submissionId) : null;
  const files =
    submission && submission.status === "complete"
      ? (await listFeedbackFiles(submission.id)).filter((f) => !!f.fileUrl)
      : [];

  return (
    <section className="py-14 sm:py-20">
      <Container className="max-w-xl">
        {files.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white p-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              This link isn&apos;t available
            </h1>
            <p className="mt-3 text-ink-muted">
              It may have expired, or the review isn&apos;t ready yet. Check the
              latest email we sent you, or get in touch and we&apos;ll help.
            </p>
            <div className="mt-6">
              <ButtonLink href="/contact">Contact us</ButtonLink>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                Your feedback is ready 🎬
              </h1>
              <p className="mt-4 text-ink-muted">
                Your coach has finished reviewing{" "}
                {submission?.playerName
                  ? `${submission.playerName}'s`
                  : "your"}{" "}
                video. Download the full breakdown below.
              </p>
            </div>

            <ul className="mt-10 space-y-3">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-5"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">
                      {file.filename}
                    </div>
                    <div className="text-xs text-ink-muted">
                      {formatFileSize(file.sizeBytes)}
                    </div>
                  </div>
                  <ButtonLink
                    href={`/api/feedback/${file.id}`}
                    size="md"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download
                  </ButtonLink>
                </li>
              ))}
            </ul>
          </>
        )}
      </Container>
    </section>
  );
}
