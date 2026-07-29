import { Container } from "@/shared/ui";
import { coaches } from "../model/copy";
import { SectionHeading } from "./SectionHeading";

/**
 * Coach cards carry a specialty tag, per the reference wireframe — it's what
 * lets a parent tell at a glance whether anyone here coaches what their kid
 * needs.
 *
 * The circular initials stand in for the photos the wireframe calls for. Real
 * headshots are pending from Yuta; initials degrade more gracefully than an
 * empty frame labelled PHOTO.
 */
export function Coaches() {
  return (
    <section
      id="coaches"
      className="scroll-mt-16 border-b border-line bg-paper-alt py-20 sm:py-24"
    >
      <Container>
        <SectionHeading
          title="Meet your coaches"
          subtitle="Professional coaches and former players who've spent their careers in the Japanese game."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {coaches.map((coach) => (
            <article
              key={coach.name}
              className="rounded-xl border border-line bg-surface p-6 text-center"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-line text-lg font-semibold text-ink-soft">
                {coach.initials}
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink">
                {coach.name}
              </h3>
              <p className="mt-0.5 text-sm text-ink-muted">{coach.role}</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {coach.bio}
              </p>
              <span className="mt-4 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                {coach.specialty}
              </span>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
