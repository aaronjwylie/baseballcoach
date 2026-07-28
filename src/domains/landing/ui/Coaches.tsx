import { Container } from "@/shared/ui";
import { coaches } from "../model/copy";
import { SectionHeading } from "./SectionHeading";

export function Coaches() {
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
