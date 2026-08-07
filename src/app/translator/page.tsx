import { requireRole } from "@/domains/account";
import { Container } from "@/shared/ui";

export const metadata = { title: "Translator" };

/**
 * The translator's portal.
 *
 * Deliberately empty of work: a translator can exist and sign in (ADR 018
 * phase 2), but nothing can be *assigned* to one until the assignment join
 * lands in phase 3. The page says so rather than showing an empty queue, which
 * would read as "you have nothing to do" instead of "this isn't wired up yet".
 */
export default async function TranslatorPage() {
  await requireRole("translator");

  return (
    <Container className="py-12">
      <h1 className="text-2xl font-semibold text-ink">Translator</h1>
      <p className="mt-4 max-w-prose text-ink-muted">
        You&rsquo;re signed in. Submissions can&rsquo;t be sent to a translator
        yet &mdash; that arrives with assignment. When it does, the files
        waiting for you will appear here.
      </p>
    </Container>
  );
}
