import { Coaches } from "./Coaches";
import { Faq } from "./Faq";
import { FooterCta } from "./FooterCta";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Pricing } from "./Pricing";

/**
 * The landing page composition — section order is the pitch:
 * hook → process → who → price → objections → ask.
 *
 * Six sections, matching the reference wireframe
 * (`docs/reference/baseball_platform_wireframe.html`). Reordering these is a
 * marketing decision, and this is where it's made.
 */
export function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Coaches />
      <Pricing />
      <Faq />
      <FooterCta />
    </>
  );
}
