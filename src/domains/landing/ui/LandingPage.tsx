import { Coach } from "./Coach";
import { Faq } from "./Faq";
import { FooterCta } from "./FooterCta";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Pricing } from "./Pricing";
import { UseCase } from "./UseCase";

/**
 * The landing page composition — section order is the pitch:
 * hook → process → who → price → objections → proof → ask.
 *
 * Seven sections, in the order of Audrey's approved wireframe
 * (`docs/reference/Home • Desktop.svg`). Note the proof section lands *after*
 * the FAQ, not before it: the wireframe answers the objections first, then
 * shows a sample review as the last thing before the ask. Reordering these is a
 * marketing decision, and this is where it's made.
 */
export function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Coach />
      <Pricing />
      <Faq />
      <UseCase />
      <FooterCta />
    </>
  );
}
