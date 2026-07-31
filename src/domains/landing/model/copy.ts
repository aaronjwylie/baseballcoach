/**
 * Landing-page section copy. Client-editable — change words here, never in the
 * section components.
 *
 * Transcribed from Audrey's approved wireframe
 * (`docs/reference/Home • Desktop.svg`, 2026-07-30). Where the wireframe holds
 * an obvious typo or an unfinished placeholder, the correction is noted at the
 * value — see the slice doc for the full list, which needs Audrey's sign-off.
 *
 * Brand facts used across the whole app (name, price, turnaround) live in
 * `shared/config/site.ts`; this file is only what the landing page says.
 */
import { site } from "@/shared/config/site";

/** The chip above the hero headline. */
export const heroEyebrow = "Now taking clips";

/**
 * The four claim chips under the hero CTAs. The turnaround one is derived
 * rather than written, so it can never contradict the pricing card or the
 * confirmation email.
 */
export const heroClaims = [
  `${site.turnaround} turnaround`,
  "1:1 video reply",
  "No robots",
  "Real pro coach",
] as const;

/** The rotated card overlapping the hero image. */
export const heroHighlights = {
  title: "Highlights",
  items: [
    "Human coaching",
    "Japanese baseball philosophy",
    "Personalized advice",
    "Trusted expertise",
  ],
} as const;

export const method = {
  eyebrow: "Method",
  title: "Three steps. That’s it.",
  subtitle: `Send one clip. Get a personal video breakdown in ${site.turnaround}. Real humans, zero robots.`,
  steps: [
    {
      step: "01",
      title: "Film one rep",
      body: "One swing or pitch. Side angle. Phone is fine.",
    },
    {
      step: "02",
      title: "Sensei reviews",
      body: "A former NPB coach studies your clip frame by frame.",
    },
    {
      // Wireframe reads "Get personalize feedback".
      step: "03",
      title: "Get personalized feedback",
      body: "One personal video. One adjustment. One drill.",
    },
  ],
} as const;

/**
 * One lead coach and the team under him — the shape the wireframe asks for,
 * replacing the three equal coach cards that preceded it.
 *
 * Every value here is placeholder text drawn straight from the wireframe and
 * **cannot go live as written** — it needs Yuta's real name, record, and
 * headshot. The `stats` are unsourced claims for the same reason.
 */
export const coach = {
  // Wireframe reads "HEAD SENSE".
  eyebrow: "Head sensei",
  title: "Meet your coach name and his expert team",
  bio: "Short bio Japanese professional baseball league, but he has a few coaches under him who help with drills etc with number years of experience with these achievements.",
  quote: "Anyone can say ‘swing earlier.’ I show you what earlier feels like.",
  /** The rotated card overlapping the coach photo. */
  card: ["Name", "Position", "Team"],
  stats: [
    { value: "NPB", label: "Pro coaches" },
    { value: "12 yrs", label: "Coaching youth" },
    { value: "EN / JP", label: "Languages" },
    { value: "Hit · Pitch", label: "Speciality" },
  ],
} as const;

/**
 * The pricing card's feature list.
 *
 * ⚠️ "Written summary of notes" is a promise the pipeline does not currently
 * back: a submission carries exactly one `feedbackUrl`, so a coach delivers one
 * file, not a video *and* a document. Selling both needs either a schema change
 * or a copy change — flagged in the slice doc rather than silently resolved.
 */
export const pricing = {
  eyebrow: "Pricing",
  title: "One video. No subscription.",
  included: [
    "Coach video walkthrough",
    "Written summary of notes",
    `Delivered within ${site.turnaround}`,
  ],
} as const;

export const useCase = {
  eyebrow: "Use case",
  title: "Type of feedback you will receive.",
  body: "Learn the mindset and techniques that shaped players like Ichiro Suzuki and Shohei Ohtani — with personalized coaching designed for young athletes.",
} as const;

/**
 * `answer` is prose, `items` is a list. A question uses one or the other, which
 * is what lets the "Why Baseball Sensei" row hold its bullets without needing a
 * second component.
 *
 * The wireframe's last four answers are one placeholder sentence repeated, and
 * it asks the same question twice. The questions are kept; the answers are the
 * real ones, because shipping four identical answers would be worse than
 * departing from a greybox.
 */
export const faqHeading = {
  eyebrow: "FAQ",
  title: "Straight answers.",
} as const;

export const faqs = [
  {
    q: "What age?",
    answer: "Players 10 and up — little league to pro-track.",
  },
  {
    q: "Why Baseball Sensei",
    items: [
      "Human coaching",
      "Japanese baseball philosophy",
      "Professional experience",
      "Personalized advice",
      "Trusted expertise",
    ],
  },
  {
    q: "How long does feedback take?",
    answer: `Personal video reply within ${site.turnaround}.`,
  },
  {
    q: "What do I film?",
    answer: "One side-angle clip on your phone. We send a guide.",
  },
  {
    q: "What video format should I use?",
    answer:
      "MP4 or MOV, straight off the phone. Keep it under five minutes so your coach sees the reps, not the warm-up.",
  },
  {
    q: "Who are the coaches?",
    answer:
      "Professional coaches and former players from the Japanese system. Every review is done by a real coach — nothing is automated.",
  },
  {
    q: "Can I send more than one file?",
    answer:
      "Yes. One submission carries a pack of files, so send a couple of angles, a still, or an old report together — your coach reviews them as one. Need a second opinion later? Each review is purchased individually, so send another whenever you like.",
  },
] as const;

export const finalCta = {
  title: "Send your first clip.",
  subtitle: "Fix one thing before your next game.",
} as const;
