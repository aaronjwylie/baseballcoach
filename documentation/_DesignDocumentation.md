# \_DesignDocumentation — this project's visual system

> **Scope:** this project only. Governed by [`_DesignLaw.md`](../laws/_DesignLaw.md), which holds the
> *rules*; this holds **our tokens, our rulings, and the honest state of the surface.**
>
> **If this contradicts `globals.css`, the CSS wins — fix this doc.**

---

## 1 · The northstar

### 1a · The principles

**1. Hierarchy is carried by weight and space, not by colour.**
This is the load-bearing decision and it explains the token table below. `--color-accent` resolves to
the same value as `--color-ink`. That is not a placeholder waiting for a brand colour — it is the
system stating that emphasis comes from type and spacing, so an accent that shouts would be doing a
job nothing here needs done.
*Rejects:* a coloured primary button; a coloured section heading; status conveyed by hue alone.

**2. The product is about a child's video, so the interface gets out of its way.**
A parent uploading footage of their kid is not looking at our layout. Near-white ground, near-black
type, one hairline rule weight.
*Rejects:* decorative imagery competing with uploaded media; a hero that outranks the upload control.

**3. Semantic colour is separate from the accent, and is the only place hue carries meaning.**
Status pills in the operator queue and the customer's status page use hue because *state* is the one
thing that must read at a glance without being read.
*Rejects:* using the status palette for emphasis anywhere else.

### 1b · Tokens

Declared once in `src/app/globals.css` as CSS custom properties, consumed through Tailwind's
`@theme`. **No component declares a colour.**

| Token | Value | Job |
|---|---|---|
| `--color-paper` | `#ffffff` | the ground |
| `--color-paper-alt` | `#f2f2f2` | a recessed band |
| `--color-surface` | `#ffffff` | a card on the ground |
| `--color-ink` | `#161616` | body type, and the primary button's fill |
| `--color-ink-soft` | `#4f4f52` | secondary type |
| `--color-ink-muted` | `#818184` | captions, labels, help text |
| `--color-line` | `#e3e3e3` | every rule and border |
| `--color-band` | `#b3b3b5` | a heavier divider |
| `--color-accent` | `#161616` | **deliberately equal to ink** — see principle 1 |
| `--color-accent-dark` | `#000000` | the accent's hover |
| `--color-accent-soft` | `#f2f2f2` | the accent's tint |

**Usage, measured 2026-08-06** — the distribution is the evidence the system is real rather than
aspirational:

```
text-ink-muted  125     border-line   50     bg-surface     9
text-ink         80     text-ink-soft 37     text-accent    8
                        bg-paper-alt  14     border-accent  2
```

Three ink weights carrying nearly all the type, one line token carrying every border, and the accent
appearing ten times total. That is principle 1 holding in practice.

### 1c · The locked rulings

- **One rule weight.** Every divider is `border-line` at 1px. A second weight needs a reason in this
  document first.
- **No shadows.** Elevation is a border and a ground change.
- **Tabular numerals wherever digits align** — the queue, the file sizes, the settings form.
- **375px is the target, not the fallback.** The customer is on a phone with a video they just shot.

### 1d · The tiers, mapped

| Design tier | Structure layer | Holds |
|---|---|---|
| primitives | `shared/ui` | button, field, pill — no domain knowledge |
| domain components | `domains/*/ui` | `PlayerInfoForm`, `AssignCoachSelect`, `StatusRail` |
| compositions | `app/*/page.tsx` | the queue, the flow, the landing page |

---

## 2 · Where we are now — 2026-08-06

- ✅ **The token system is real and used** — no component declares a colour; the usage distribution
  above shows the hierarchy principle holding.
- ✅ **The landing page is Audrey's approved wireframe** (2026-07-30).
- ✅ **The operator queue** carries status as pills, tabs derived from the ladder, and an expandable
  trail per row.
- ❌ **shadcn/ui is specified in `CLAUDE.md` and not adopted.** Components are hand-rolled against the
  tokens. This is a live divergence between the brief and the code; either the brief changes or the
  components do.
- ❌ **No dark theme.** Single-theme by omission rather than decision, which by `_DesignLaw` is the
  weaker of the two. The product is a daytime utility used briefly; that is an argument, but it has
  not been made until now.
- ❌ **No gallery.** There is no page that renders every primitive in every state, so a broken variant
  is found in the flow that uses it. `_DesignLaw §4` calls this part of done; we do not do it.
- ⚠️ **The coach section and all photography are placeholder** and cannot go live as written. This is
  content, not design, but it is the visible blocker.

---

## 3 · Decision log

### 2026-07-30 — the accent is ink

Considered a brand colour for primary actions. Rejected: the surface is a form and a file list, and the
one thing that should draw the eye is the customer's own uploaded content. Hierarchy moved to weight
and space. **The consequence to watch:** if a future screen genuinely needs two competing actions
distinguished at a glance, this ruling is what will be in the way, and the answer is a second *shape*
before a second hue.

### 2026-07-30 — Stripe Elements, not hosted Checkout

Design-side consequence of [ADR 005](../docs/decisions/005-stripe-elements-over-checkout.md): the card
field is ours to style and ours to get wrong. It inherits the token set through Stripe's `appearance`
API.

---

## 4 · Roadmap

| | Why not yet |
|---|---|
| a gallery page | one developer, small surface — but this is the cheapest thing on this list and the only one with a rule behind it |
| dark theme | no user has asked; the ground is white by principle 2 |
| shadcn/ui | adopting it now would rewrite working components to reach the same tokens |
| real photography | waiting on the client |
