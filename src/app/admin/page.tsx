import type { Metadata } from "next";
import { Container, Button } from "@/shared/ui";
import { requireRole, logout } from "@/domains/account";

export const metadata: Metadata = {
  title: "Admin portal",
  robots: { index: false },
};

export default async function AdminHomePage() {
  // Secure check (the proxy already did the optimistic one).
  await requireRole("admin");

  return (
    <section className="py-14">
      <Container>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Admin portal
          </h1>
          <form action={logout}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          Signed in as an administrator. The submissions queue and coach
          management land here next.
        </p>
      </Container>
    </section>
  );
}
