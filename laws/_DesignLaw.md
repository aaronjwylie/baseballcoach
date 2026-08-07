# \_DesignLaw — how a design system is governed

> **What this is.** The rules a design system must satisfy: where its tiers live, what makes a principle
> a principle, how tokens are consumed, and the checks that keep the system from quietly forking.
>
> **This law is project-agnostic and copied verbatim.** The actual principles, palette, type scale,
> motion values and component inventory are entirely project-specific and live in
> [`_DesignDocumentation.md`](../documentation/_DesignDocumentation.md).
>
> **Take this law when there is a second surface to keep consistent.** One screen does not need a
> constitution.

---

## 1 · The design tiers ARE the structure layers

A design system is **not a separate structure.** It is the visual language that populates the one you
already have ([`_StructureLaw.md`](_StructureLaw.md)):

| Design tier | Structure home | What lives here |
|---|---|---|
| **tokens** | `shared/tokens/` | the ONE token source |
| **primitives** | `shared/ui/` | low-level, domain-agnostic components |
| **features** | `domains/*/ui/` | domain components, in their slice |
| **sections** | `widgets/` | cross-domain compositions |
| **screens** | `pages/` or `app/` | route-level compositions |

**Dependency flows down only: a primitive never imports a feature.** Anything with its own rendering
world (a GL canvas, a video surface, a map) is a **separate plane** and is named as such — the classical
rules do not reach into it, and pretending they do produces rulings nobody can follow.

---

## 2 · What makes a principle a principle

> **Each principle must DECIDE something — it rules out a reasonable alternative. If one stops doing
> that, cut it or rewrite it.**

So every principle is written as a pair:

```markdown
### N. {{The principle, as an imperative}}
{{What it means, in the product's own terms.}}
*Rejects:* {{the specific, reasonable, popular alternative this refuses.}}
```

A principle with no *Rejects:* line is a mood. Name which one or two are **the sharpest refusals** — the
ones the product would stop being itself without.

**Application notes belong beneath the principles, derived from them**, each citing which principles it
falls out of. Density, contrast, and the accessibility baseline are the three that always earn a note.

**The accessibility baseline is a principle-level concern, not a compliance tax.** Labels on every
interactive element, adequate tap targets, sufficient contrast — **from the first primitive, not
retrofitted.** On a deliberately low-contrast palette, enforcing the floor is part of getting the look
*right*, not a tax on it.

---

## 3 · Tokens

**One source.** A flat internal palette plus a **semantic layer** that components import.
**Components import the semantic layer only, never the palette.** That indirection is what makes a
re-skin a data change instead of a sweep.

**Consumers compose by named pattern, not raw value.** `motion.patterns.press`, not `180ms`. A raw
duration at a call site is a value that can drift from its siblings; a named pattern cannot.

**Locked rulings are stated as rulings**, with the reason, in the Documentation — *"no pure black, no
pure white"*, *"a single accent serves every look-here role"*, *"strict 4pt radius"*. A ruling nobody
wrote down is a preference, and preferences lose arguments to whoever is typing.

### 3a · The rule that keeps a token system honest

> **A control must appear in BOTH the serializer and the seeder.**

> **⟨INHERITED EVIDENCE⟩** In `wrld-sandbox` the type, motion, elevation and globe token tabs previewed
> live and reported *"Published"* — while the serializer carried no field for them. **Edits were silently
> discarded on reload, and it was invisible precisely because the preview worked.**

Any token group that can be edited must be **serializable, published, read back, and resolved by every
renderer that ships.** A group that is previewed but not persisted is worse than one that is absent,
because it reads as working.

**And never ship a dial for a behaviour that does not exist** — or if you do, **mark it in the editor
rather than hiding it**, so the day the feature lands the dial is already there and honestly labelled
([PRINCIPLES §10](../PRINCIPLES.md)).

---

## 4 · The gallery is part of the definition of done

**No primitive ships without its gallery section.** A gallery is not documentation of the system, it *is*
the system's test surface: the one place a human can see every variant and state at once, on both
platforms, under the live theme.

Three rules that keep it from rotting:

- **One shared chrome module**, composed by every tier. Separate galleries that each re-define their own
  section/row furniture is a copy-paste duplication of exactly the kind [PRINCIPLES §2](../PRINCIPLES.md)
  forbids.
- **A spec-label beside every live demo** — a fixed caption naming the variant or state. Without it a
  gallery shows you *that* something renders, not *what* it is.
- **Show the foundations too** — palette swatches, spacing and radius scale strips, elevation samples.
  Otherwise the token system is the one part of the design system nobody can look at.

**Honest stubs for tiers not yet catalogued** ([PRINCIPLES §10](../PRINCIPLES.md)) — wired into the nav,
visibly empty, never absent.

---

## 5 · Made mechanical

**A barrel export is not a use.** An exported UI component must be referenced somewhere other than its own
file and its barrel — enforce it.

> **⟨INHERITED EVIDENCE⟩** In `wrld-sandbox` a panel was superseded by a new one, left exported and
> rendered nowhere. **A later session built an entire editor into it and shipped green** — dead code
> typechecks and builds, so nothing said a word, and the page never changed. This is a single-source-of-
> truth violation **at the render layer**, and the silent variety: two renderers for one concept, one
> unreferenced, so nothing forces them to reconcile. *The names were honest; it was not a nomenclature
> problem.*

**Two traps the checker must be built around** — both hit while writing it, and a naive version deletes
working code:

- **Match exported symbols, not filenames.** One file can export a dead component and a live one.
- **Skip platform twins.** A `*.web.tsx` is resolved by the bundler and never imported by name.

**Visual regression is the gap every design system has**, and naming it is better than a gate that only
covers the components with no platform dependency ([`_VerificationLaw.md` §9](_VerificationLaw.md)).

---

## 6 · Porting a design system

When the language comes from somewhere that already works:

- **Port the language; re-fit the components.** Harvest the tokens, the principles, the primitive
  vocabulary and the motion faithfully; rebuild the primitives clean against the new structure.
  *Rejects:* a 1:1 port (drags in the churn you escaped) and a fresh redesign (throws away a proven
  system).
- **Name the benchmark precisely** — which build of the source is the reference. *"Like the old app"* is
  not a benchmark when the old app has two renderers that disagree.
- **Additive, always green.** Add variants on the existing prop names rather than swapping APIs, so no
  consumer migration is needed. **Then record the deliberate divergences** as a named follow-up, or they
  become permanent by accident.
- **Port the ORGANIZATION when the components already exist.** The reusable thing is often the structure,
  not the code.

---

## Related

- [`PRINCIPLES.md`](../PRINCIPLES.md) · [`_StructureLaw.md`](_StructureLaw.md) ·
  [`_VerificationLaw.md`](_VerificationLaw.md)
- [`_DesignDocumentation.md`](../documentation/_DesignDocumentation.md) — **this project's principles,
  tokens, and inventory**
