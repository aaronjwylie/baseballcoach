import { ButtonLink, Container, Pill } from "@/shared/ui";
import { site } from "@/shared/config/site";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-ink text-white">
      <div className="absolute inset-0 bg-diamond opacity-70" aria-hidden />
      <div
        className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
        aria-hidden
      />
      <Container className="relative py-20 sm:py-28">
        <div className="max-w-2xl">
          <Pill className="bg-white/10 text-white/90">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Remote coaching · {site.turnaroundDays} turnaround
          </Pill>
          <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
            {site.tagline}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-white/70">
            {site.subhead}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href="/start" size="lg">
              Get your video reviewed — {site.price.label}
            </ButtonLink>
            <ButtonLink
              href="/#how-it-works"
              size="lg"
              variant="outline"
              className="border-white/25 bg-transparent text-white hover:bg-white/10"
            >
              See how it works
            </ButtonLink>
          </div>
          <p className="mt-5 text-sm text-white/50">
            One-time {site.price.label} {site.price.unit}. No subscription. No
            account to create.
          </p>
        </div>
      </Container>
    </section>
  );
}
