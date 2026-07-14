/**
 * Single source of truth for all client-editable content.
 * Coach bios, pricing, and copy get swapped here — not in the page components.
 */

export const site = {
  name: "Diamond Path",
  tagline: "Elite Japanese baseball coaching, wherever you play.",
  subhead:
    "Upload a video of your swing or delivery. A professional coach trained in the Japanese system breaks it down frame by frame and sends you a personal video walkthrough within days.",
  email: "hello@example.com",
  price: {
    amountCents: 14900,
    currency: "cad",
    label: "$149",
    unit: "per video review",
  },
  turnaroundDays: "3–5 days",
} as const;

export const howItWorks = [
  {
    step: "01",
    title: "Record your video",
    body: "Film your swing, pitch, or fielding rep on your phone. Side-on and front-on angles work best. Under five minutes is plenty.",
  },
  {
    step: "02",
    title: "Upload and pay",
    body: "Tell us about the player, check out securely, and drop the video in. The whole thing takes about two minutes.",
  },
  {
    step: "03",
    title: "Get your breakdown",
    body: `Your coach reviews the footage and records a personal video walkthrough — mechanics, timing, and the drills to fix it. Back to you in ${site.turnaroundDays}.`,
  },
] as const;

export const coaches = [
  {
    name: "Coach A",
    role: "Hitting — former NPB infielder",
    bio: "Twelve seasons in Japan's top division. Specializes in bat path, timing, and the lower-half mechanics that generate power without losing contact.",
    initials: "A",
  },
  {
    name: "Coach B",
    role: "Pitching — former NPB right-hander",
    bio: "Built his career on command over velocity. Works on delivery repeatability, arm health, and sequencing that holds up deep into games.",
    initials: "B",
  },
  {
    name: "Coach C",
    role: "Development — youth & high school",
    bio: "Fifteen years coaching Japanese high school baseball. Focused on fundamentals, discipline, and building mechanics that last.",
    initials: "C",
  },
] as const;

export const included = [
  {
    title: "Frame-by-frame breakdown",
    body: "Your coach scrubs through the footage and shows you exactly what's happening — not generic tips, your actual mechanics.",
  },
  {
    title: "A personal video walkthrough",
    body: "A recorded Loom-style walkthrough talking through your swing or delivery, so you can rewatch it as many times as you need.",
  },
  {
    title: "Drills that fix the root cause",
    body: "Specific, prioritized drills to work on before your next session — the one or two things that will move the needle most.",
  },
  {
    title: "Trained in the Japanese system",
    body: "Coaching built on the fundamentals, discipline, and mechanical precision that Japanese baseball is known for.",
  },
] as const;

export const faqs = [
  {
    q: "What kind of video should I send?",
    a: "A phone video is perfect. Film from the side and from the front if you can, and include a few reps. Keep it under five minutes — MP4 or MOV.",
  },
  {
    q: "How long until I get feedback?",
    a: `Most reviews come back in ${site.turnaroundDays}. You'll get an email the moment your coach's breakdown is ready.`,
  },
  {
    q: "What do I actually receive?",
    a: "A personal video walkthrough from your coach — going through your footage, pointing out what's working, what isn't, and the specific drills to fix it. Some coaches include a written summary too.",
  },
  {
    q: "Who are the coaches?",
    a: "Professional coaches and former players from the Japanese system. Every review is done by a real coach — nothing is automated.",
  },
  {
    q: "Is this for kids or adults?",
    a: "Both. Most of our players are 10–18, but we review adult players too. If the player is a minor, a parent or guardian should submit on their behalf.",
  },
  {
    q: "Can I send more than one video?",
    a: "Yes — each review is purchased individually, so submit as many as you like. Many players send one every few weeks to track progress.",
  },
] as const;
