import { ButtonLink, Container } from "@/shared/ui";
import { useCase } from "../model/copy";
import { MediaFrame } from "./MediaFrame";
import { SectionHeading } from "./SectionHeading";

/**
 * What the thing you're buying actually looks like — the last doubt before the
 * final ask, answered by showing a sample review rather than describing one.
 *
 * New in the approved wireframe; there was no equivalent section before.
 */
export function UseCase() {
  return (
    <section className="bg-surface py-20 lg:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionHeading
            eyebrow={useCase.eyebrow}
            title={useCase.title}
            subtitle={useCase.body}
          />

          <div className="mt-9 flex flex-wrap gap-4">
            <ButtonLink href="/start" variant="outline" size="lg">
              Submit a video
            </ButtonLink>
            <ButtonLink href="/#how-it-works" variant="outline" size="lg">
              How it Works
            </ButtonLink>
          </div>
        </div>

        <MediaFrame
          label="Example feedback video"
          className="min-h-[280px] sm:min-h-[380px] lg:min-h-[480px]"
        />
      </Container>
    </section>
  );
}
