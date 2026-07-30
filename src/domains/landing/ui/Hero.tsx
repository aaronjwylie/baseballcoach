import { ButtonLink, Container } from "@/shared/ui";
import { site } from "@/shared/config/site";
import { heroClaims, heroEyebrow, heroHighlights } from "../model/copy";
import { Chip } from "./Chip";
import { MediaFrame } from "./MediaFrame";
import { StickerCard } from "./StickerCard";

/**
 * The hook. Two columns: the argument on the left, the image on the right with
 * the Highlights card tilted across its bottom-left corner.
 *
 * Both CTAs are real destinations — `/start` enters the paid flow and "How it
 * Works" scrolls to the section that answers it. The wireframe's CTAs go
 * nowhere, because a static mockup has nowhere to go.
 */
export function Hero() {
  return (
    <section id="hero" className="bg-surface text-ink">
      <Container className="grid items-center gap-14 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div>
          <Chip>{heroEyebrow}</Chip>

          <h1 className="mt-8 text-[44px] font-medium leading-[1.06] tracking-tight sm:text-6xl lg:text-[64px]">
            {site.tagline}
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed sm:text-xl">
            {site.subhead}
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <ButtonLink href="/start" variant="outline" size="lg">
              Submit a video
            </ButtonLink>
            <ButtonLink href="/#how-it-works" variant="outline" size="lg">
              How it Works
            </ButtonLink>
          </div>

          <ul className="mt-10 flex flex-wrap gap-3">
            {heroClaims.map((claim) => (
              <li key={claim}>
                <Chip className="px-6 py-2">{claim}</Chip>
              </li>
            ))}
          </ul>
        </div>

        {/*
          The sticker overlaps the image, so the two share a stacking context.
          Below `lg` they stack instead: an overlap needs room the phone
          viewport doesn't have, and a tilted card half off-screen reads as a
          bug rather than a flourish.
        */}
        <div className="relative">
          <MediaFrame
            label="Hero image"
            className="min-h-[320px] sm:min-h-[440px] lg:min-h-[620px]"
          />
          <StickerCard className="mt-6 lg:absolute lg:-bottom-10 lg:-left-14 lg:mt-0 lg:w-[340px]">
            <h2 className="text-3xl font-medium tracking-tight">
              {heroHighlights.title}
            </h2>
            <ul className="mt-4 space-y-1.5 text-[15px] text-ink-soft">
              {heroHighlights.items.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span aria-hidden>•</span>
                  {item}
                </li>
              ))}
            </ul>
          </StickerCard>
        </div>
      </Container>
    </section>
  );
}
