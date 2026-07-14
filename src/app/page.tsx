import Link from "next/link";
import { Container, ButtonLink, Pill } from "@/components/ui";
import {
  site,
  howItWorks,
  coaches,
  included,
  faqs,
} from "@/lib/site";

export default function Home() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <WhatYouGet />
      <Coaches />
      <Pricing />
      <Faq />
      <FinalCta />
    </>
  );
}

function Hero() {
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

function TrustStrip() {
  const items = [
    { stat: site.turnaroundDays, label: "Typical turnaround" },
    { stat: "NPB", label: "Coaches from Japan's top league" },
    { stat: "100%", label: "Reviewed by a real coach" },
    { stat: "Ages 10+", label: "Youth, high school & adult" },
  ];
  return (
    <section className="border-b border-line bg-white">
      <Container className="grid grid-cols-2 gap-y-8 py-10 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <div className="text-2xl font-bold text-ink">{item.stat}</div>
            <div className="mt-1 text-sm text-ink-muted">{item.label}</div>
          </div>
        ))}
      </Container>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="How it works"
          title="From phone video to pro feedback in three steps"
          subtitle="No app to download, no account to manage. Film it, send it, and get a coach's breakdown back within days."
        />
        <ol className="mt-14 grid gap-8 md:grid-cols-3">
          {howItWorks.map((step) => (
            <li
              key={step.step}
              className="relative rounded-2xl border border-line bg-white p-7"
            >
              <span className="text-4xl font-bold text-accent/25">
                {step.step}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-ink">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function WhatYouGet() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="What you get"
          title="A real coaching session, delivered async"
          subtitle="Everything that comes with a single video review."
        />
        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {included.map((item) => (
            <div
              key={item.title}
              className="flex gap-4 rounded-2xl border border-line bg-paper p-6"
            >
              <CheckIcon />
              <div>
                <h3 className="font-semibold text-ink">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Coaches() {
  return (
    <section id="coaches" className="scroll-mt-20 py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="The coaches"
          title="Learn from the Japanese system"
          subtitle="Professional coaches and former players who've spent their careers in the game."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {coaches.map((coach) => (
            <article
              key={coach.name}
              className="rounded-2xl border border-line bg-white p-7"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-lg font-bold text-white">
                {coach.initials}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-ink">
                {coach.name}
              </h3>
              <p className="text-sm font-medium text-accent">{coach.role}</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {coach.bio}
              </p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Pricing"
          title="Simple, per-video pricing"
          subtitle="Pay once, per review. Send another whenever you're ready."
        />
        <div className="mx-auto mt-14 max-w-md">
          <div className="overflow-hidden rounded-3xl border border-line bg-paper">
            <div className="bg-ink px-8 py-8 text-center text-white">
              <div className="text-sm font-medium uppercase tracking-wide text-white/60">
                Single video review
              </div>
              <div className="mt-3 flex items-baseline justify-center gap-1">
                <span className="text-5xl font-bold">{site.price.label}</span>
                <span className="text-white/60">
                  {" "}
                  {site.price.currency.toUpperCase()}
                </span>
              </div>
              <div className="mt-1 text-sm text-white/60">
                {site.price.unit}
              </div>
            </div>
            <ul className="space-y-3 px-8 py-8">
              {included.map((item) => (
                <li key={item.title} className="flex items-start gap-3 text-sm">
                  <CheckIcon small />
                  <span className="text-ink-soft">{item.title}</span>
                </li>
              ))}
            </ul>
            <div className="px-8 pb-8">
              <ButtonLink href="/start" size="lg" className="w-full">
                Get started
              </ButtonLink>
              <p className="mt-3 text-center text-xs text-ink-muted">
                Secure checkout via Stripe · No account required
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-24">
      <Container className="max-w-3xl">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions, answered"
          subtitle=""
        />
        <div className="mt-12 divide-y divide-line border-y border-line">
          {faqs.map((faq) => (
            <details key={faq.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-ink">
                {faq.q}
                <span className="shrink-0 text-ink-muted transition-transform group-open:rotate-45">
                  <PlusIcon />
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

function FinalCta() {
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

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-sm font-semibold uppercase tracking-wide text-accent">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-4 text-lg text-ink-muted">{subtitle}</p>
      ) : null}
    </div>
  );
}

function CheckIcon({ small = false }: { small?: boolean }) {
  const size = small ? "h-4 w-4" : "h-6 w-6";
  return (
    <span
      className={`mt-0.5 flex ${small ? "h-5 w-5" : "h-8 w-8"} shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent`}
    >
      <svg className={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M20 6 9 17l-5-5"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function PlusIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
