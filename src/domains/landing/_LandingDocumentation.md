# landing — `src/domains/landing/`

The **landing domain slice** — the sales pitch. All UI and copy; it knows nothing about
submissions and just links to `/start`.

---

## 1 · The northstar

A parent arrives cold, having never heard of us, and has to decide whether to hand $149 to
strangers overseas. The page's whole job is closing that gap.

**Section order is the argument**, and `ui/LandingPage.tsx` is where it's made:

| # | Section | Doing what |
|---|---|---|
| 1 | `Hero` | the hook — what this is, in one line |
| 2 | `HowItWorks` | the process, demystified |
| 3 | `Coaches` | who's actually watching your kid's video |
| 4 | `Pricing` | the ask, with the value beside the number |
| 5 | `Faq` | the objections |
| 6 | `FooterCta` | the ask again, for scrollers |

Six sections, matching
[`docs/reference/baseball_platform_wireframe.html`](../../../docs/reference/baseball_platform_wireframe.html).

### The invariants

- **Copy is data, never JSX.** Every word the client might change lives in `model/copy.ts`
  or `shared/config/site.ts`. A section component maps over an array; it never contains a
  sentence. This is what makes "Yuta wants to reword the FAQ" a one-file change by someone
  who doesn't write React.
- **The split between the two copy homes is by scope, not convenience.** Facts true of the
  whole business — name, price, turnaround — are in `shared/config/site.ts`, because the
  emails and checkout need them too. Facts true only of this page are here. *(PRINCIPLES #5
  — the highest node where it's still true.)*
- **Every call to action goes to `/start`** — the live paid flow, not an anchor. The
  wireframe's CTAs scroll to `#pricing` because a static mockup has nowhere else to go.
- **This slice imports no other domain.** It's a pitch, not a workflow.

---

## 2 · Where we are now — 2026-07-28

- ✅ **Eight sections**, responsive, composed in `ui/LandingPage.tsx`.
- ✅ **Copy externalized** to `model/copy.ts`.
- ✅ **Smooth-scroll anchors** (`#how-it-works`, `#coaches`, `#pricing`, `#faq`).
- 🔶 **Placeholder content throughout.** The coaches are "Coach A/B/C" with initials instead
  of photos and invented credentials. The trust strip's stats ("NPB", "100%") are unsourced
  claims. **None of this can go live as written** — it needs Yuta's real coaches.
- ✅ **Restructured to the reference wireframe** (2026-07-29) — six sections, warm-neutral
  palette with a blue accent, specialty tags on coach cards.
- 🔶 **Provisional design.** The reference wireframe is greybox and explicitly not final.
  **Audrey's brand work supersedes all of it.** Every colour is a token in
  `app/globals.css`, so the swap is one file — no component holds a hex value.
- 🔶 **Coach headshots.** The wireframe calls for photos; we render initials until Yuta
  supplies real ones.
- 🔶 **No OG image, no structured SEO metadata** beyond title and description.
- 🔶 **Accessibility unaudited** — no Lighthouse run yet (CLAUDE.md Sprint 7).
- 🔶 **No privacy page**, though the wireframe's footer lists one. A site taking payments
  wants it; a link to nowhere would be worse, so the footer omits it for now.

### Content conflicts the wireframe introduces — unresolved

The reference makes three promises the current system doesn't back. **None was adopted**, on
the grounds that a landing page shouldn't promise what the pipeline can't deliver:

| Wireframe says | We say | Why it wasn't adopted |
| --- | --- | --- |
| "Feedback within **48 hours**" | `3–5 days` | Tightening a customer SLA is Yuta's call. 48h across timezones, with a manual hand-off to coaches in Japan, is aggressive. |
| "**Written summary** of notes" as a paid feature | not offered | **There is no field for it.** A submission stores one feedback file (`feedbackUrl`); §2 puts written reports out of scope. Selling it would need a schema change *and* a coach workflow change. |
| Coach tag "**Batting**" | `Hitting` | We standardized on Hitting — it's the `focus` enum value and the word in the coach bios. Changing it now is a schema + copy change to satisfy a wireframe label. |

---

## 3 · Where we came from

**Before 2026-07-28**, the entire landing page was a **344-line `src/app/page.tsx`** holding
eight section components, two icon components, and a shared heading component in one file,
with copy in `lib/site.ts` mixed together with app-wide brand facts.

Decisions taken, with their reasoning:

- **Copy externalized from the start** (original build). Kept, and it's the single best
  decision in the pre-existing code — it's why the wireframe rebuild can replace components
  without touching a word of marketing copy.
- **Split into one file per section (Step 2).** The monolith was about to collide head-on
  with the wireframe work: eight sections in one file means every design change touches the
  same file, and any parallel work conflicts. Sections are also the unit Audrey will think
  in, so the file boundaries now match the conversation boundaries.
- **`site.ts` split in two (Step 2).** It had been holding both app-wide facts (name, price)
  and landing-only copy (coach bios, FAQ). The emails imported it for the price and got the
  FAQ in the bundle. Facts moved to `shared/config/site.ts`; page copy stayed here.
- **Restructured to the reference wireframe (2026-07-29).** `TrustStrip` and `WhatYouGet`
  were **deleted**, not moved: the wireframe folds the value proposition into the pricing
  card, where it lands next to the number. `included` still renders — as the card's feature
  list — so nothing was lost, only relocated. Dropping `TrustStrip` also retired its
  unsourced claims ("NPB", "100%"), which were flagged as unshippable anyway.
- **Palette taken from the wireframe** — warm off-white with a blue accent, replacing an
  invented navy/rose. The primary button is **ink, not accent**: the wireframe reserves blue
  for step numbers and tags so nothing competes with the call to action. `email/shell.ts` was
  re-palettised in the same commit, since email can't read CSS variables and would otherwise
  have drifted from the site.
- **`SectionHeading` lost its eyebrow.** Three stacked lines of centered text before any
  content was one too many; the wireframe leads with the title alone.
- **`SectionHeading` and `icons.tsx` kept local, not promoted to `shared/ui/`.** Nothing
  outside this page uses them. Promoting them would claim a generality they haven't earned —
  and `shared/` is the hardest layer to change, because everything can depend on it.
