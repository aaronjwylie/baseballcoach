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
| 2 | `TrustStrip` | proof, before they've scrolled |
| 3 | `HowItWorks` | the process, demystified |
| 4 | `WhatYouGet` | the value, concretely |
| 5 | `Coaches` | who's actually watching your kid's video |
| 6 | `Pricing` | the ask, once they want it |
| 7 | `Faq` | the objections |
| 8 | `FinalCta` | the ask again, for scrollers |

### The invariants

- **Copy is data, never JSX.** Every word the client might change lives in `model/copy.ts`
  or `shared/config/site.ts`. A section component maps over an array; it never contains a
  sentence. This is what makes "Yuta wants to reword the FAQ" a one-file change by someone
  who doesn't write React.
- **The split between the two copy homes is by scope, not convenience.** Facts true of the
  whole business — name, price, turnaround — are in `shared/config/site.ts`, because the
  emails and checkout need them too. Facts true only of this page are here. *(PRINCIPLES #5
  — the highest node where it's still true.)*
- **This slice imports no other domain.** It's a pitch, not a workflow.

---

## 2 · Where we are now — 2026-07-28

- ✅ **Eight sections**, responsive, composed in `ui/LandingPage.tsx`.
- ✅ **Copy externalized** to `model/copy.ts`.
- ✅ **Smooth-scroll anchors** (`#how-it-works`, `#coaches`, `#pricing`, `#faq`).
- 🔶 **Placeholder content throughout.** The coaches are "Coach A/B/C" with initials instead
  of photos and invented credentials. The trust strip's stats ("NPB", "100%") are unsourced
  claims. **None of this can go live as written** — it needs Yuta's real coaches.
- 🔶 **Pre-wireframe.** This was built before Audrey's design existed. CLAUDE.md Sprint 1
  rebuilds it against the real thing; treat the current visual design as a placeholder that
  proves the structure, not as the destination.
- 🔶 **No OG image, no structured SEO metadata** beyond title and description.
- 🔶 **Accessibility unaudited** — no Lighthouse run yet (CLAUDE.md Sprint 7).

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
- **`SectionHeading` and `icons.tsx` kept local, not promoted to `shared/ui/`.** Nothing
  outside this page uses them. Promoting them would claim a generality they haven't earned —
  and `shared/` is the hardest layer to change, because everything can depend on it.
