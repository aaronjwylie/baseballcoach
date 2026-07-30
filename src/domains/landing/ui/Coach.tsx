import { Container } from "@/shared/ui";
import { coach } from "../model/copy";
import { Chip } from "./Chip";
import { MediaFrame } from "./MediaFrame";
import { SectionHeading } from "./SectionHeading";

/**
 * Who is actually watching your kid's video.
 *
 * One lead coach, with his team behind him — the wireframe replaced three equal
 * coach cards with this, and it is the stronger argument: a parent is trusting a
 * person, not a roster. The photo carries the same tilted card as the hero, and
 * the stat blocks below the bio are the credentials in four glances.
 */
export function Coach() {
  return (
    <section id="coaches" className="scroll-mt-8 bg-surface py-20 lg:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div className="relative">
          <MediaFrame
            label="Coach photo"
            className="min-h-[380px] sm:min-h-[480px] lg:min-h-[560px]"
          />
          {/*
            Tilted the other way from the hero's card, and anchored to the
            opposite corner — the wireframe alternates them so the two sections
            don't read as the same slide twice.
          */}
          <ul className="mt-6 rounded-3xl bg-paper-alt px-8 py-7 text-lg text-ink-soft shadow-sm sm:rotate-[6deg] lg:absolute lg:-bottom-12 lg:-right-10 lg:mt-0 lg:w-[280px]">
            {coach.card.map((line) => (
              <li key={line} className="flex gap-2.5">
                <span aria-hidden>•</span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <SectionHeading
            eyebrow={coach.eyebrow}
            title={coach.title}
            subtitle={coach.bio}
          />

          <blockquote className="mt-8 bg-paper-alt px-7 py-6 text-xl leading-relaxed">
            {coach.quote}
          </blockquote>

          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {coach.stats.map((stat) => (
              <li key={stat.label}>
                <Chip className="w-full flex-col gap-1 px-3 py-2.5">
                  <span>{stat.value}</span>
                  <span className="text-[10px] font-medium opacity-80">
                    {stat.label}
                  </span>
                </Chip>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
