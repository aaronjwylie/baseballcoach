# landing — `src/domains/landing/`

The **landing domain slice** — the sales pitch. All UI and copy; it knows nothing about
submissions and just links to `/start`.

---

## 1 · The northstar

A parent arrives cold, having never heard of us, and has to decide whether to hand $80 to
strangers overseas. The page's whole job is closing that gap.

**Section order is the argument**, and `ui/LandingPage.tsx` is where it's made:

| # | Section | Doing what |
|---|---|---|
| 1 | `Hero` | the hook — what this is, in one line |
| 2 | `HowItWorks` | the process, demystified |
| 3 | `Coach` | who's actually watching your kid's video |
| 4 | `Pricing` | the ask, with the value beside the number |
| 5 | `Faq` | the objections |
| 6 | `UseCase` | what the thing you're buying looks like |
| 7 | `FooterCta` | the ask again, for scrollers |

Seven sections, matching Audrey's approved wireframe,
[`docs/reference/Home • Desktop.svg`](../../../docs/reference/) (also supplied as a PDF).
Note that `UseCase` lands **after** the FAQ: the wireframe answers objections first, then
shows a sample review as the last thing before the ask.

### The invariants

- **Copy is data, never JSX.** Every word the client might change lives in `model/copy.ts`
  or `shared/config/site.ts`. A section component maps over a value; it never contains a
  sentence. This is what makes "Yuta wants to reword the FAQ" a one-file change by someone
  who doesn't write React.
- **The split between the two copy homes is by scope, not convenience.** Facts true of the
  whole business — name, price, turnaround — are in `shared/config/site.ts`, because the
  emails and checkout need them too. Facts true only of this page are here. *(PRINCIPLES #5
  — the highest node where it's still true.)*
- **Speed and price are derived, never typed twice.** The hero chip, the pricing card's
  third bullet, the FAQ answer, and the method subtitle all interpolate `site.turnaround`;
  the price on the card is the same `site.price` the PaymentIntent is built from. The page
  physically cannot promise something different from what the system does.
- **Every call to action goes to `/start`** — the live paid flow, not an anchor. The
  wireframe's CTAs go nowhere because a static mockup has nowhere to go.
- **This slice imports no other domain.** It's a pitch, not a workflow.

---

## 2 · Where we are now — 2026-07-30

Rebuilt from Audrey's approved wireframe. The greybox reference that preceded it
(`docs/reference/baseball_platform_wireframe.html`) is superseded and no longer describes
anything in the code.

- ✅ **Seven sections**, responsive down to 375px, composed in `ui/LandingPage.tsx`.
- ✅ **Copy externalized** to `model/copy.ts`.
- ✅ **Monochrome palette**, sampled from the wireframe's six hex values into
  `app/globals.css`. There is no accent hue in the approved design, so `--color-accent`
  resolves to ink — the token name survives for the rest of the app, but there is no second
  colour to point it at.
- ✅ **Smooth-scroll anchors** (`#how-it-works`, `#coaches`, `#pricing`, `#faq`).
- ✅ `/contact` and `/terms` **stubbed**, so every link the wireframe draws resolves.
- 🔶 **Typeface is a guess.** The wireframe outlines its text to paths, so the face isn't
  recoverable from the file. Jost is the closest freely-licensed match to the letterforms
  (single-storey `a`, tall ascenders, wedge apostrophe). **Confirm with Audrey.**
- 🔶 **Placeholder content throughout, and it cannot go live as written.** The coach section
  literally says "Meet your coach name and his expert team" with a lorem bio, because that
  is what the wireframe says; the four stat chips (NPB, 12 yrs, EN/JP, Hit·Pitch) are
  unsourced. All of it needs Yuta's real name, record, and headshot.
- 🔶 **No photography.** Three `MediaFrame` blocks stand in for the hero image, the coach
  headshot, and the example feedback clip. They render a plain label, deliberately *not* the
  wireframe's note to the asset sourcer ("Inspirational image kids playing… with fun badges,
  stickers, small animation around") — that's a brief for Audrey and would be nonsense to a
  parent reading the live page.
- 🔶 **No OG image, no structured SEO metadata** beyond title and description.
- 🔶 **Accessibility unaudited** — no Lighthouse run yet.
- 🔶 **`/terms` is a placeholder, not legal copy**, and says so on its face. It's `noindex`
  until reviewed. A site taking payments and storing video of minors needs real terms and a
  privacy policy before launch.

### Departures from the wireframe, and why

Each of these is a deliberate choice, not an oversight. **All want Audrey's sign-off.**

| Wireframe | Built | Why |
| --- | --- | --- |
| Header ~202px tall, drawn statically | Same proportions, **not sticky** | Pinning a 202px bar to the top eats a fifth of a laptop viewport on every scroll. The CTA repeats in the hero, the pricing card, the use-case section and the final band, so nothing is lost. |
| FAQ rows show question **and** answer, with a ⊕ button | `<details>`, closed, ⊕ rotating to × | Both can't be true at once. A plus means "there is more here", so the rows start closed. |
| FAQ answers 5–8 are one placeholder sentence repeated; one question is asked twice | Seven distinct questions with real answers | Shipping four identical answers would be worse than departing from a greybox. |
| "72H TURNAROUND" / "within 72 hours" / "within 48 hours" — three different promises | **48 hours** everywhere, from `site.turnaround` | The wireframe contradicts itself. Ben chose the tightest, 2026-07-30; it now also governs the emails and checkout. |
| "Get personalize feedback", "HEAD SENSE", "video exemple", "Seisei provide" | Typos corrected | Noted at each value in `model/copy.ts`. |
| "Question please reach out" | "Questions? Reach out" | Same. |
| No status link anywhere | "Check status" kept in the footer | A customer who has paid has no account by design, so the email lookup is their only route back to a submission. Dropping it would strand them. |
| Diamond-and-seams logo glyph | Wordmark only | The wireframe sets the brand in type alone, in both header and footer. |

### The content conflict still unresolved

**The pricing card sells a "Written summary of notes", and the pipeline cannot deliver it.**
A submission carries exactly one `feedbackUrl`, so a coach uploads one file — a video *or* a
document, not both. The claim is rendered because it is in the approved design, but it needs
one of two decisions from Yuta:

1. **Change the copy** — drop the line, or fold it into the video walkthrough. Free.
2. **Change the system** — a second file per submission is a schema change, a migration, a
   coach-portal change, and a customer-facing download change. Not free.

Two smaller flags in the same category:

- **"players like Ichiro Suzuki and Shohei Ohtani"** (use-case section) names real public
  figures. It reads as a claim about Japanese baseball methodology rather than an
  endorsement, which is defensible — but it's worth a deliberate look before launch.
- **`site.email` is still `hello@example.com`**, so `/contact` is a dead end until Yuta's
  address and a verified Resend domain are set.

---

## 3 · Where we came from

**Before 2026-07-28**, the entire landing page was a **344-line `src/app/page.tsx`** holding
eight section components, two icon components, and a shared heading component in one file,
with copy in `lib/site.ts` mixed together with app-wide brand facts.

Decisions taken, with their reasoning:

- **Copy externalized from the start** (original build). Kept, and it's the single best
  decision in the pre-existing code — it's why two consecutive design rebuilds could replace
  every component without losing a word of marketing copy.
- **Split into one file per section (Step 2).** The monolith was about to collide head-on
  with the wireframe work: eight sections in one file means every design change touches the
  same file, and any parallel work conflicts. Sections are also the unit Audrey thinks in,
  so the file boundaries match the conversation boundaries.
- **`site.ts` split in two (Step 2).** It had been holding both app-wide facts (name, price)
  and landing-only copy (coach bios, FAQ). The emails imported it for the price and got the
  FAQ in the bundle. Facts moved to `shared/config/site.ts`; page copy stayed here.
- **Restructured to a greybox reference wireframe (2026-07-29).** `TrustStrip` and
  `WhatYouGet` were deleted and their value proposition folded into the pricing card. That
  reference is now superseded, but the fold survived it — the approved design does the same
  thing.
- **Rebuilt to Audrey's approved wireframe (2026-07-30).** The change of substance is the
  coach section: three equal coach cards became **one lead coach with his team behind him**,
  which is the stronger argument — a parent is trusting a person, not a roster. `UseCase` is
  new, and answers "what does the thing I'm buying actually look like" by showing a sample
  rather than describing one. `Coaches.tsx` → `Coach.tsx`, and `icons.tsx` was deleted: the
  approved design has no checkmarks and no chevrons, only bullets and a plus.
- **Palette retuned in `globals.css` rather than added alongside (2026-07-30).** The token
  names didn't change, so the swap re-skinned the whole app in one file — the mechanism the
  token layer existed for. `email/shell.ts` was re-palettised in the same commit, since email
  can't read CSS variables and would otherwise have drifted from the site.
- **`Chip`, `MediaFrame`, `StickerCard`, and `SectionHeading` kept local, not promoted to
  `shared/ui/`.** Nothing outside this page uses them. Promoting them would claim a
  generality they haven't earned — and `shared/` is the hardest layer to change, because
  everything can depend on it. `Chip` in particular is deliberately *not* `shared/ui/Pill`:
  same idea, different shape and different reader.
- **`navLinks` promoted to `shared/layout/`.** The opposite call, for the opposite reason —
  the header and the footer both render it, and two copies of one list is how a renamed
  section goes missing from one of them.
