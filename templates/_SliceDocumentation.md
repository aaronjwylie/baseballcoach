# \_SliceDocumentation — the boilerplate every slice copies

> **This file is a form, not a doc.** Copy it to `domains/<slice>/_<Slice>Documentation.md`, rename the
> heading, delete every instruction block, and fill it in. **Ship it in the same commit as the slice** —
> a doc updated later is a doc that was wrong in between ([PRINCIPLES §11](../PRINCIPLES.md)).
>
> **Read the slice's doc before changing the slice.**
>
> ---
>
> **The three sections are three different questions, and each has its own tense**
> ([PRINCIPLES §12](../PRINCIPLES.md)):
>
> | Section | Question | Tense | Churn |
> |---|---|---|---|
> | **1 · The northstar** | what this slice **is** | present | never — it reads the same at commit 1 and commit 100 |
> | **2 · Where we are** | what's built **right now** | present, with honest markers | every commit |
> | **3 · Where we came from** | what it **replaced**, and why | past | append-only |
>
> **Write the real names.** `startSubmissionAction`, `emailVerifiedAt`, `awaiting_approval`,
> `/api/cron/sweep` — never *"the submit handler"* or *"the verified flag"*. Jargon is welcome;
> vagueness is not. **This is also how the doc audits the code: a term that can't be written plainly in a
> sentence is a term to rename.**

---

# {{slice}} — `src/domains/{{slice}}/`

The **{{slice}} slice** — {{one sentence: what it is for, in the product's own words.}}

---

## 1 · The northstar

> Present tense, timeless. **What this slice is in the destination we're building**, not what the code
> currently does. Where the build lags, state the destination and append the distance — *(today: …)* /
> *(not built)* / ⚠️ — **never soften the sentence.**

{{Why this slice exists. If it exists because of a tension between two other things, say what they are —
that paragraph is usually the most valuable one in the file.}}

{{An optional diagram, when the shape is a flow rather than a list.}}

### The invariants

> The things that must be true for this slice to be correct. **Each one is a sentence someone could
> violate**, and most of them exist because someone did.

- **{{Invariant.}}** {{Why. What breaks without it.}}
- **{{Invariant.}}** {{…}}

### What this slice does NOT do

> Optional but high-value: the adjacent thing it is regularly mistaken for, and the line between them.

{{…}}

---

## 2 · Where we are now — {{DATE}}

> Honest degradation ([PRINCIPLES §10](../PRINCIPLES.md)). ✅ built · 🔶 partial · ❌ not built.
> **Absent reads as absent** — never describe a stub as though it works.

- ✅ **{{What's true.}}** {{The detail that makes it checkable.}}
- 🔶 **{{What's partial.}}** {{Exactly which half, and what the other half needs.}}
- ❌ **{{What isn't built.}}** {{And what it is currently blocked on.}}

### 2b · Where we were — {{EARLIER DATE}}

> When §2 gets long, demote the older snapshot rather than deleting it. The trail of *"what we thought
> was done"* is worth keeping.

---

## 3 · Where we came from

> Past tense. **The breadcrumb trail, and it must actually leave crumbs.** Not *"ported from the old
> build"* — the record: decisions taken **with their reasoning**, what each superseded, the scars.
> **When a decision reverses an earlier one, the earlier one stays, marked superseded.** Date everything.
>
> A newcomer should be able to reconstruct how this slice reached its present shape by reading top to
> bottom.

{{What was here before, and what it cost.}}

- **{{DATE}} — {{the decision}}.** {{The reasoning. What it superseded. What was rejected and why.}}
- **{{DATE}} — {{a scar}}.** {{The bug that forced a rewrite; the kluge we retired; what it taught.}}

---

<!--
DELETE-BEFORE-COMMIT CHECKLIST

□ Every {{placeholder}} is gone
□ Section 1 is present tense and would still read true in six months
□ Section 2 uses ✅ / 🔶 / ❌ and nothing is described more optimistically than it is
□ Section 3 has at least one dated entry with its REASONING, not just its outcome
□ Real function, field, status, route and env-var names throughout — no paraphrase
□ Any term used here that isn't in _NomenclatureDocumentation.md is either added there or renamed
□ This file is in the same commit as the code it describes
-->
