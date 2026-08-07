# ADR {{NNN}} — {{the decision, as a statement of what is now true}}

> Copy to `docs/decisions/{{NNN}}-{{kebab-slug}}.md`. **The title is the decision, not the topic** —
> *"Payment comes last"*, not *"Payment ordering"*. A reader scanning the folder listing should be able
> to reconstruct the architecture from the filenames alone.

**Date:** {{DATE}} · **Status:** {{Accepted | Superseded by ADR NNN | Retired}} · **Deciders:** {{who}}

---

## What we decided

{{One paragraph, present tense. The decision as it now stands.}}

## What forced it

{{The concrete pressure. A failure, a constraint, a thing that couldn't be built the other way. If there
was no pressure, this is a preference and probably doesn't need an ADR.}}

## What we rejected, and why each lost

> **This is the section that makes the ADR worth writing.** A decision with no rejected alternative isn't
> a decision, and six months from now the rejected option is what someone will propose again.

- **{{Alternative}}** — {{why it lost. Be specific: the cost, not the vibe.}}
- **{{Alternative}}** — {{…}}

## What this supersedes

{{Which ADR, which section of which law, which paragraph of a slice doc. Go and mark those superseded in
the same commit — **an ADR that quietly contradicts a still-authoritative doc has made things worse.**}}

## The cost we are paying knowingly

{{Every real decision has one. Naming it is what lets a future reader tell "we didn't think of that" from
"we thought about it and accepted it".}}

## What would reverse this

> Only for a **provisional** decision ([PRINCIPLES §13](../PRINCIPLES.md)). The observations that would
> reopen it — concrete enough that someone could notice them without being told to look.

- {{…}}

## Consequences already visible

{{What changed in the code, the schema, or the docs as a direct result. Name files.}}
