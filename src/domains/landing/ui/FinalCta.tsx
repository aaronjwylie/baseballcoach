import Link from "next/link";
import { ButtonLink, Container } from "@/shared/ui";
import { site } from "@/shared/config/site";

export function FinalCta() {
  return (
    <section className="bg-ink text-white">
      <Container className="py-20 text-center sm:py-24">
        <h2 className="mx-auto max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to see what a pro sees?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-white/60">
          Upload a video today and get a personal breakdown back in{" "}
          {site.turnaroundDays}.
        </p>
        <div className="mt-8 flex justify-center">
          <ButtonLink href="/start" size="lg">
            Get your video reviewed — {site.price.label}
          </ButtonLink>
        </div>
        <p className="mt-6 text-sm text-white/40">
          Already sent one?{" "}
          <Link href="/status" className="text-white/70 underline">
            Check your status
          </Link>
        </p>
      </Container>
    </section>
  );
}
