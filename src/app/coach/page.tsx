import type { Metadata } from "next";
import { Container, Button } from "@/shared/ui";
import { requireRole, logout } from "@/domains/account";

export const metadata: Metadata = {
  title: "Coach portal",
  robots: { index: false },
};

export default async function CoachHomePage() {
  await requireRole("coach");

  return (
    <section className="py-14">
      <Container>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Coach portal
          </h1>
          <form action={logout}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          Your assigned reviews will appear here — download the video, then upload
          your feedback.
        </p>
      </Container>
    </section>
  );
}
