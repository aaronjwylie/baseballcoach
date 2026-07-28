import { Coaches } from "./Coaches";
import { Faq } from "./Faq";
import { FinalCta } from "./FinalCta";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Pricing } from "./Pricing";
import { TrustStrip } from "./TrustStrip";
import { WhatYouGet } from "./WhatYouGet";

/**
 * The landing page composition — section order is the pitch:
 * hook → proof → process → value → who → price → objections → ask.
 *
 * Reordering these is a marketing decision, and this is where it's made.
 */
export function LandingPage() {
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
