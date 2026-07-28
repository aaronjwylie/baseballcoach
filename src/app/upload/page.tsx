import type { Metadata } from "next";
import Link from "next/link";
import { Container, ButtonLink } from "@/shared/ui";
import { site } from "@/shared/config/site";
import { UploadPanel } from "@/domains/upload";

export const metadata: Metadata = {
  title: "Upload your video",
  robots: { index: false },
};

export default async function UploadPage(props: PageProps<"/upload">) {
  const { session_id } = await props.searchParams;
  const sessionId = typeof session_id === "string" ? session_id : undefined;

  return (
    <section className="py-14 sm:py-20">
      <Container className="max-w-xl">
        {sessionId ? (
          <>
            <div className="text-center">
              <div className="text-sm font-semibold uppercase tracking-wide text-accent">
                Step 2 of 2
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                Upload your video
              </h1>
              <p className="mt-4 text-ink-muted">
                Payment received. Drop in the video you&apos;d like reviewed —
                MP4 or MOV, under five minutes works best.
              </p>
            </div>
            <div className="mt-10">
              <UploadPanel sessionId={sessionId} />
            </div>
          </>
        ) : (
          <MissingSession />
        )}
      </Container>
    </section>
  );
}

function MissingSession() {
  return (
    <div className="rounded-2xl border border-line bg-white p-8 text-center">
      <h1 className="text-2xl font-bold text-ink">We lost the thread</h1>
      <p className="mt-3 text-ink-muted">
        This upload link is missing its checkout reference. If you just paid,
        use the &ldquo;Upload your video&rdquo; button in your confirmation
        email. Otherwise you can check the status of your submissions anytime.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <ButtonLink href="/status" variant="dark">
          Check submission status
        </ButtonLink>
        <ButtonLink href="/start" variant="outline">
          Start a new review
        </ButtonLink>
      </div>
      <p className="mt-6 text-xs text-ink-muted">
        Stuck? Email us at{" "}
        <Link href={`mailto:${site.email}`} className="underline">
          {site.email}
        </Link>
        .
      </p>
    </div>
  );
}
