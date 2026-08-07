# \_StructureLaw — how a codebase is laid out

The one home for the **rules** of layout: the layers, the slice, the segments, and the direction imports
flow. Feature-Sliced Design **tilted to domain-first** — instead of splitting a concept across an
`entities/` folder (its data) and a `features/` folder (its behavior), **one domain slice holds both.**

> **This law is project-agnostic and copied verbatim.** It legislates *shape*. The actual layers this
> project took, the domain list, and where the exceptions live belong in
> [`_StructureDocumentation.md`](../documentation/_StructureDocumentation.md).
>
> Rests on [PRINCIPLES](../PRINCIPLES.md) §3 (domain over layer), §4 (noun + verb), §5 (highest node
> where it's still true), §6 (no empty ceremony), §7 (the barrel).

---

## 1 · The layers — imports flow **down** only

| Layer | What it is | Depends on |
|---|---|---|
| **`app/`** | routes + API handlers — **thin** | everything below |
| **`domains/`** | the **noun+verb slices** — the heart. Everything product-specific | other domains (acyclic) · shared |
| **`shared/`** | the domain-**less** foundation (SDK seams · UI primitives · config) | nothing above |

`shared/` is the floor — it knows no domain. `app/` is the ceiling — a route knows everything.

**Three layers is a complete architecture.** Two more exist and are **earned, never assumed**:

| Layer | Sits | Take it when |
|---|---|---|
| `widgets/` | domains ← app | a cross-domain block **that knows domains** exists. If the header is domain-less it's `shared/layout/` instead |
| `pages/` | widgets ← app | a route composes more than one widget, **and** the framework doesn't reserve the folder name |
| group folders | inside `domains/` | a **family of alikes** exists that can share one written-once shape (a *cutter*) |
| nested slices | inside a slice | one domain has grown big enough to recurse |

**Do not create these empty** ([PRINCIPLES §6](../PRINCIPLES.md)). Adopting structure before it is needed
teaches the next person that ceremony is free.

---

## 2 · The domains

Read the folder listing top to bottom and it should be **the business**. That is domain-over-layer
working — the tree names the domain, not the tech. A newcomer scanning `domains/` should learn what the
product does.

**One noun is the spine; every other domain orbits it.** The others import its barrel; it imports none of
them. The graph stays acyclic and the arrows all point at the record.

**Name the one slice shaped differently, and say why.** A *composition-root* slice — one that depends on
several domains while nothing depends on it — is legitimate when its whole job is **ordering** them, the
way a page is for `app/`. Say so explicitly in the Documentation, and add the guard:
*if a second slice ever starts looking like this, that is a smell worth investigating rather than a
pattern worth copying.*

---

## 3 · The slice — noun + verb, one folder

```
<slice>/
  model/<slice>.ts          the type family + logic     ┐ the NOUN — shape + rules
  model/<slice>Table.ts     the storage declaration      │
  model/<slice>Input.ts     what a user types + rules    ┘
  api/<slice>Row.ts         the row↔domain mapper         I/O — the storage seam
  api/<slice>Api.ts         the queries
  ui/<Component>.tsx        pixels — the verb
  index.ts                  the barrel (public surface)
  _<Slice>Documentation.md
```

**The segments** — a slice uses as few as it needs:

| Segment | Holds | Rule |
|---|---|---|
| `model/` | types + logic (the domain, minus I/O and pixels) | almost always |
| `api/` | outbound I/O — HTTP clients, third-party calls, outbound email | when it talks to anything |
| `ui/` | components | when it renders |
| `lib/` · `config/` | slice-local helpers · constants | as needed |

**The segment vocabulary is fixed.** Resist inventing one (`email/`, `services/`, `helpers/`) — an
outbound email send is I/O, so it's `api/`. **A fixed vocabulary is what makes any slice navigable on
sight**, and the cost of one more name is paid by every reader forever.

**The floor that's always worth it:** separate **`ui/` from non-UI.** That's the load-bearing split —
logic stays testable and reusable without dragging components in. `api/` vs `model/` is the next-best,
marking the I/O boundary.

**Where slice docs live.** Every domain carries one. `shared/` normally carries a **single** doc for the
whole floor, because its seams are small and domain-less. **A seam earns its own doc only when it owns a
*decision* rather than just a mechanism.** Don't split the rest on principle.

### 3a · Two slices for parallel concepts should be roughly the same size

When they aren't, **the shared part is living inside one of them.** That is the whole failure, and it is
visible from a directory listing — you do not need to open either file.

The tell is an import: a file about one variant reaching into its sibling for the shape they both are. A
**missing** counterpart is the same signal — a message, a form or a type that exists on one side and not
the other is usually evidence it was filed under the wrong noun, not evidence the other side doesn't
need one.

The fix is never to fatten the thin side. **Move the commonality out until both sides are thin**, and
what remains in each is only what is genuinely that variant's own.

> **⟨INHERITED EVIDENCE⟩** In `baseballsensei`, two roles of one entity — an operator with a profile —
> produced `coachApi.ts` at 235 lines against `translatorApi.ts` at 25, `coachActions.ts` at 272 against
> 38, plus a `coachEmail.ts` with no counterpart, a model file with no counterpart, and a form with no
> counterpart. Read as a bug list it was five items. It was **one**: the shared weight had been written
> into the files named for the role that came first, so the second role could only ever be a wrapper
> importing from it.

---

## 4 · The HTTP surface — where routes live, and what may be in them

Two shapes, and the framework decides which you get:

- **Routes registered by a composition root** (Fastify, Express, Nest): the route file lives **inside the
  slice**, and a `server.ts` wires them up.
- **Routes whose file path IS the URL** (file-system routers): the folder stays where the framework
  demands, and it plays the part `server.ts` plays over there — **the composition root, not a home for
  logic.**

Either way the rule about *contents* is the same, and it is the important one. A route file **may
contain**:

- reading the body — **raw, unparsed bytes for anything signature-verified**
- validating shape, and rejecting with 400
- calling **one or two domain functions**
- mapping the outcome to a status code

A route file may **not** contain:

- an SDK call, or an import from `shared/` — **if a route needs Stripe, the *domain* needed it**
- a decision about what data is safe to expose *(that's `PublicX`)*
- a state transition, or anything about what an event *means*

> **The test:** if you can't tell what the endpoint does from the domain function names it calls, the
> logic is in the wrong file.

**Keep it greppable.** *"Every route is under N lines and none imports an SDK"* is an invariant you can
actually check, and it is worth stating as a number.

**URL paths are a wire contract, not a naming choice.** Anything configured in a third party's dashboard
— a webhook path, a redirect URI, an OAuth callback — stays as it is. Renaming it means re-pointing the
integration, **and that is a failure every project hits exactly once.**

---

## 5 · Dependency rules

1. **Down-only across layers:** `app → domains → shared`. Never up.
2. **Within a slice:** `model(types) ← api ← model(logic) ← ui`. UI depends on logic; **logic never
   imports UI.**
3. **Cross-domain:** a domain may import **another domain's barrel**, never its internals, and the graph
   stays **acyclic**.
4. **`shared/` is domain-less** and imports nothing above it. That is what makes it shared — **if
   something in `shared/` needs to know what an Order is, it is in the wrong layer.**
5. **Import the barrel, never deep.**

Rule 5 is what makes [PRINCIPLES §6](../PRINCIPLES.md) safe: because nobody imports internals, internal
layout can change freely.

**The test for `shared/`:** *would putting this in a domain force another domain to import it?* If yes it
belongs on the floor; if no it belongs in the domain that uses it. **`shared/` is not a junk drawer.**

### 5a · Two sanctioned exemptions, both by force rather than preference

6. **The declaration plane** ([PRINCIPLES §7b](../PRINCIPLES.md)) — `*Table.ts` / `*Enum.ts` import other
   declaration files **directly, across domains**, and **never a barrel**, nor anything that
   transitively reaches one. A foreign key is a compile-time reference no barrel can carry without
   closing a cycle through itself; close that loop and one module initialises half-formed, so a table
   arrives `undefined` from inside the ORM **with a stack trace naming neither file.** Leaf model files
   are safe, because nothing loops back through them.
7. **A cutter beside its family** — a shape written once at a group-folder root, imported by its sibling
   slices ([PRINCIPLES §8](../PRINCIPLES.md)). A mild, deliberate bend for clarity.

**Everything above the plane keeps rules 1–5.** A schema manifest that imports every domain **is not a
layer** — it exists so tooling has one entry point, it declares nothing, and nothing in the source tree
imports it. It cannot live in `shared/`, because rule 4 forbids anything there from importing a domain.

### 5b · A shared table is not a reason to share a folder

Rule 3 and the declaration plane together have a consequence nobody usually writes down:

> **Two concerns that share a table cannot be two domains.**

Which quietly makes the schema the author of the folder tree. That is fine when the table is right, and
harmful when it isn't — the rules will then defend a **schema** mistake as though it were a
**structural** fact, because the violation you would have to commit to fix it is visible and the mistake
is not.

**So read the constraint as evidence, not as a verdict.** If two concerns *would* be separate domains but
for sharing a table, that is evidence about the **table**. Ask what the table is doing before accepting
what the tree looks like.

**The general form: a constraint that arrives from the schema deserves one round of *why is the schema
like that* before it becomes an architectural conclusion.** A constraint nobody has tried to remove is an
assumption wearing a rule's clothes.

> **⟨INHERITED EVIDENCE⟩** In `baseballsensei`, one slice held both authentication and the people who do
> the work, and was told twice it could not split because a query joined its two tables. True — and it
> did not reach the question asked. The join bound *the record* to *the profile*; **authentication joins
> nothing.** It read a single column, and the only thing holding it in the slice was that the column sat
> on that table. Moving the credential to its own table made the split legal and the schema better
> independently: every `SELECT *` had been carrying a password hash for a column almost nothing reads.

---

> **Enforcement is a choice with a size.** Lint-enforced boundaries or convention-and-review — say which
> in the Documentation, and say why that is proportionate *at this size*. "Small enough to police by eye,
> revisit if it slips" is a legitimate answer, **once written down.**

---

## 6 · The invariants worth stating out loud

- **Every stored column name lives in one place** — the owning domain's `model/<x>Table.ts` — and
  **exactly one file** turns a storage row into a domain object. A schema change is a migration; never
  edit a table by hand.
- **Every environment read lives in one config folder**, split by *audience* — server secrets in one
  file, browser-safe values in another. **The split is a security boundary, not a convenience.**
- **`shared/` never imports a domain.** If you need to, the thing you're writing isn't shared.
- **Operator-tunable values are data, not env vars.** Limits an operator adjusts live in the database and
  are edited in the product. **Env is the developer's configuration; those are the operator's.**
- **Types cross the storage boundary once.** Whatever the ORM hands back (a `Date`, a `Decimal`, a
  `Buffer`) is converted by the mapper and never leaks into the domain.

---

## Related

- [`PRINCIPLES.md`](../PRINCIPLES.md) — why
- [`_NomenclatureLaw.md`](_NomenclatureLaw.md) — how it's spelled
- [`_StructureDocumentation.md`](../documentation/_StructureDocumentation.md) — **this project's layers,
  domains, and exceptions**
