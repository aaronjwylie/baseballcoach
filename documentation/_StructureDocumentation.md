# \_StructureDocumentation — how this codebase is laid out

> **Scope:** this project only. Governed by [`_StructureLaw.md`](../laws/_StructureLaw.md), which holds
> the *rules*; this holds **which of them we took, what we declined, and where the exceptions are.**
>
> **If this contradicts the tree, the tree wins — fix this doc.**
>
> Supersedes `docs/design/structure.md`, which held both halves in one file until 2026-08-06. That
> mixture is not a filing preference — see §3.

---

## 1 · The northstar

### 1a · The layers we took

| Layer | Taken? | Why |
|---|---|---|
| `app/` | ✅ | Next.js App Router; routes and API handlers, kept thin |
| `domains/` | ✅ | nine slices — the heart |
| `shared/` | ✅ | the domain-less floor: SDK seams, UI primitives, config |
| `widgets/` | ❌ | nothing here is a cross-domain block that *knows* domains. The site header is domain-less, so it is `shared/ui` |
| `pages/` | ❌ | Next.js reserves the name, and one screen per route leaves the layer nothing to earn |
| group folders | ❌ | no family of alikes yet. The nearest candidate — coach and translator — turned out to be **one** shape with a role column, not a family (§1c) |
| nested slices | ❌ | `submission` is the largest and still reads at one level |

### 1b · The domains

```
domains/
  submission/    the request for feedback — the spine noun, plus looking yours up
  checkout/      the four-step customer flow — sequence only; composes the panels below
  verification/  proving the customer can read the email they typed
  upload/        getting their files to us (storage)
  payment/       paying for one (Stripe) — the LAST step
  feedback/      the coach's response coming back
  operator/      everyone who logs in — admin, coach, translator — and their profiles
  settings/      the limits the admin tunes without a deploy
  landing/       the sales pitch
```

Read top to bottom, that's the business: *someone tells us about a player, proves their email,
uploads their clips, pays, and a coach responds.*

**`submission` is the noun every other domain orbits.** `checkout` opens one, `verification` proves
its email, `upload` attaches files to one, `payment` marks it paid, `feedback` completes it,
`operator` gets assigned one. They import its barrel; it imports none of them.

### 1c · The slice shaped differently

**`checkout` is the composition root for the customer flow.** It depends on four domains and nothing
depends on it, because its whole job is *ordering* them. Each step's panel still lives with the domain
that owns its subject — the verification form in `verification`, the payment element in `payment` —
and `checkout` only decides what comes next.

**If a second slice ever starts looking like this, that is a smell worth investigating rather than a
pattern worth copying.**

### 1d · Dependency enforcement

**Convention and review**, not lint. At nine domains and one developer the graph is small enough to
hold in your head, and the two rules that actually bite — the declaration plane and the client
boundary — fail loudly at build time rather than silently: a barrel cycle produces an `undefined`
table inside Drizzle, and a client component importing a domain barrel fails the build with the
Postgres client in the browser bundle.

**What would change it:** a second developer, or the first time a violation ships rather than being
caught by the build.

### 1e · The exceptions, named

| Exception | Where | Why it is forced rather than chosen |
|---|---|---|
| the declaration plane | `*Table.ts` · `*Enum.ts` | a foreign key is a compile-time reference no barrel can carry without closing a cycle through itself — [PRINCIPLES §7b](../PRINCIPLES.md), [ADR 015](../docs/decisions/015-schema-by-domain.md) |
| the schema manifest | `src/db/schema.ts` | not a layer: it imports every domain, declares nothing, and nothing in `src/` imports it. It cannot live in `shared/`, which may not import a domain |
| client components import `model/` directly | any `"use client"` file | a domain barrel re-exports `api/`, which pulls the Postgres client into the browser bundle and fails the build |
| `proxy.ts` at `src/` root | Next.js 16 | the framework reserves the location and the filename (renamed from `middleware.ts`) |

### 1f · What landed in `shared/`, and why each earned it

> The test each one passed: *would putting this in a domain force another domain to import it?*

| | Why it can't live in a domain |
|---|---|
| `shared/db` | every domain reads storage; none owns the connection |
| `shared/storage` | the customer's uploads and the coach's feedback both go through one seam with two drivers (local disk in dev, Vercel Blob in prod) — [ADR 006](../docs/decisions/006-object-storage-over-mux.md) |
| `shared/email` | nine messages across six domains share one brand shell and one transport |
| `shared/auth` | the JWT crypto seam. `operator` owns the *payload shape*; the signing does not belong to it, because `proxy.ts` verifies without importing a domain |
| `shared/config` | the only place `process.env` is read, split by audience (§2) |
| `shared/ui` | primitives with no domain knowledge |

**`shared/` is not a junk drawer.** Nothing here knows what a Submission is.

---

## 2 · Where we are now — 2026-08-06

- ✅ **Down-only imports** hold. No domain imports `app/`; nothing in `shared/` imports a domain.
- ✅ **The declaration plane** holds. Every `*Table.ts` imports other declarations directly and no barrel.
- ✅ **One row mapper per domain that needs one.** `submission` has `submissionRow.ts`.
- 🔶 **`operator` has no `*Row.ts`.** Its mapping lives in `operatorProfileApi.toProfile` and inline in
  `operatorApi`. Defensible — the operator "row" is a join of two tables rather than one row — but it
  means the rule reads differently in two domains, which is worth either a mapper or a sentence in the
  slice doc.
- 🔶 **`operator` holds two concerns** — authentication and the people who do the work. Not a violation
  of any rule, and that is the problem: see [`_StructureLaw §5b`](../laws/_StructureLaw.md). It splits
  once `password_hash` moves to its own table.
- 🔶 **The `Coach` type is a role, not a shape** — `translatorApi` imports it to describe a translator.
  [`_NomenclatureLaw §4`](../laws/_NomenclatureLaw.md).

**Greppable invariants and their current values:**

| Invariant | Today |
|---|---|
| longest route handler | **146 lines** — `api/webhooks/resend/route.ts`, most of it the Svix signature check |
| routes importing an SDK | **0** |
| files reading configuration | **2** — `shared/config/env.ts` and `publicEnv.ts` |
| files reading `process.env` at all | **4** — the two above, plus `shared/db/client.ts` and `shared/auth/cookie.ts`, which read `NODE_ENV`. That is the framework's own switch, not configuration, and it is why the invariant is worded *configuration* rather than *`process.env`* |
| files mapping storage columns | **1** (`submission`); `operator` maps inline — see above |
| domains | **9** |
| tables | **7** |

---

## 3 · Where we came from

> The layout this replaced, in past tense, **with what it cost.** Keep it forever
> ([PRINCIPLES §12](../PRINCIPLES.md)) — a newcomer who can't see the old shape can't see what the new
> one is for.

**Before 2026-07-28:** the plan was layer-first — a `features/` folder for behaviour and an
`integrations/` folder for I/O, with a concept's data and its verbs in different trees. Retired before
it was built, after reading the WRLD sandbox, which had run the same experiment at larger scale and
retired its own `entities/`-vs-`features/` split.

- **2026-08-05 — the schema split by domain** ([ADR 015](../docs/decisions/015-schema-by-domain.md)).
  One `shared/db/schema.ts` held every table; each now lives with its owner. Exposed seven duplicated
  enums in the process — the same vocabulary spelled twice, once for storage and once for the domain.
- **2026-08-06 — `domains/coach` dissolved into `operator`** ([ADR 018](../docs/decisions/018-translator-role.md)).
  A coach stopped being a table and became a role, at which point `coachApi.ts` was an `api/` file
  reading another domain's tables — a dependency violation that compiled. Nine domains, not ten.
- **2026-08-06 — this document.** `docs/design/structure.md` held the rules *and* the domain list in
  one file. That mixture had a cost worth recording: when `operator` was questioned for holding two
  concerns, **there was no way to tell whether the answer was a rule or a description** — so a
  structural gap read as a description of the tree three times before it was named. The law now holds
  the rules; this holds our instance of them.
