# \_SecurityLaw — keeping software from being made to do things

> **What this is.** The principled home for **security**: the rails that keep a trust boundary closed,
> and the method for finding the ones that are open. It answers a different question from every other law
> here — not *does it work*, but **what else will it do, for someone who is trying?**
>
> **This law is project-agnostic and copied verbatim.** It legislates the rails (R1–R12) and the audit
> method. **This project's threat model, boundary table and standing audit live in**
> [`_SecurityDocumentation.md`](../documentation/_SecurityDocumentation.md) — and that doc is where the
> real work happens, because a rail with no boundary attached is theory.
>
> **Why it is NOT part of [`_VerificationLaw.md`](_VerificationLaw.md):**
>
> | | Verification | Security |
> |---|---|---|
> | Defends against | **accident** — our own regressions and drift | **intent** — someone who wants it to break |
> | Proves | *presence* of correctness, on paths we enumerated | *absence* of a hole — never finished, never proven |
> | True when | at commit | in **production configuration** |
> | Done means | the gate passes | no known hole **+ a rail that kills the class** |
>
> **They meet at one seam:** some security properties are mechanically checkable, and those belong in
> the gate roster as static checks (§6). Verification is the machinery; security is a property that
> partly rides on it.
>
> > **⟨INHERITED EVIDENCE — the whole argument for a separate doc.⟩** In `wrld-sandbox`, on one day the
> > gate roster read **25/25 green** while an unauthenticated **total account takeover** was live on the
> > deployed box. Verification was working perfectly; it simply was not asking this question.
>
> **Examples** ([PRINCIPLES §12a](../PRINCIPLES.md)): every finding in an audit is **evidence** — past
> tense, permanent, **never pruned, even after it is fixed.** A rail whose failure has been deleted is
> folklore, and folklore is what someone removes because they cannot see what it was for.

---

## 1 · The northstar

> **Authentication is who you are. Authorization is what you may do. Every hole ever found is one of
> those two being *asserted by the caller* instead of *proven by the server*.**

> **The rule that outranks the rest:** *the client is never the authority.* Not for identity, not for
> price, not for entitlement, not for whether a gate passed. **If the server can be told the answer, the
> answer is not a gate.**

---

## 2 · A threat model is required, and its second half is the one people skip

**Being explicit about who you are defending against is what stops security work sprawling into
theatre.** Every project writes its own in
[`_SecurityDocumentation.md` §1a](../documentation/_SecurityDocumentation.md); these four are the
defaults almost everyone should claim:

1. **The opportunist with `curl`.** Someone who reads a page, sees an id, and tries the obvious thing.
   **This is the realistic attacker**, and it is the one most real breaches turn out to be.
2. **A hostile client.** Your own app, modified. **Anything the client can assert, assume an attacker
   asserts.**
3. **Accidental self-harm at scale.** A retry loop, a runaway poller — **availability is a security
   property** (R9).
4. **Privilege drift.** An operator surface, a dev convenience, or a test bypass reaching production.

> **Naming what you do NOT defend against is part of the model.** An unstated exclusion is not a
> decision, it is an oversight waiting to be discovered by someone else. Every exclusion carries the
> milestone at which it is revisited.

---

## 3 · Trust boundaries

A **trust boundary** is any point where an untrusted caller meets something that matters. Enumerate them
all, and name the gate on each.

> **A boundary with no named gate is a finding, not a gap.** The difference matters: a gap is work not
> yet done, a finding is something currently wrong.

---

## 4 · The rails

Rules that kill a **class** of hole, each earned from a real failure. **A fix without a rail is a fix
that comes back.**

**R1 — Never trust a bare header.** A header that merely *names* a principal is not authentication. If a
value grants identity or privilege it must be a **secret** compared in constant time, or a **signature**
the server can verify.

**R2 — Every bypass is inert by default AND refuses in production.** A dev convenience must satisfy
both: absent config ⇒ off, and production ⇒ off regardless of config. **Either alone is insufficient** —
a leaked env var defeats the first, a mis-set environment defeats the second. Prefer **404 over 403** for
a dev-only route: in production it does not *exist*.

**R3 — A secret with a usable default is not a secret.** `?? 'dev-secret'` means an unset variable in
production silently downgrades to a publicly-known value. Secrets have **no default**, or the boot guard
refuses to start when the default is in play. **Declare each secret once, in one map**, and have every
consumer read through it — per-consumer literals let the guard pass while a consumer uses a different
default, and that drift is invisible.

**R4 — Fail closed.** When a gate cannot reach the thing it needs to decide, the answer is *no*. **An
error is not permission.** An unrecognised input is an error — including a value someone adds to an enum
later.

**R5 — The boot guard is part of the gate.** A gate whose configuration can be wrong in production must
be checked at startup and **throw**, not warn. **A warning in a log nobody reads is not a control.**

**R6 — The server owns every value that matters.** Price, entitlement, balance, identity, whether a gate
passed. **The client sends an *id*; the server resolves the *value*.**

**R7 — Public ids are public.** Design as if every id in any response is known to everyone, **because it
is.** Security must never rest on an id being hard to guess.

**R8 — Two auth models for one surface is a finding.** **The weaker one is the real one.**

**R9 — Availability is a security property.** Anything unbounded — request rate, message rate, upload
size, job fan-out — is a way to take the platform down without ever authenticating.
**And the allowlist is the load-bearing half of a rate limiter**: gate it with a check that asserts every
exempt path survives 8× the ceiling. *A limiter without its allowlist is an outage with extra steps.*

**R10 — A safety choice must survive a restart, and defaults must fail toward privacy.** If a user
deliberately chooses anon / private / coarse, that choice is a promise. Losing it to a process restart is
a broken promise, and losing it *toward the more exposing value* is a **disclosure.** Persist the choice,
or default to the safer end — never both-fail-open.

**R11 — Refuse to boot for EXPOSURE; warn for DEGRADATION. And a fail-closed check is a configuration
change.** Fatal is for *"serving would be unsafe"* (a public-knowledge signing key), never for *"a
surface would be unusable"* (an empty operator allowlist — that is a lockout, and making it fatal turns
an admin problem into a total public outage). **Before any check becomes fatal, verify the deploy
environment already satisfies it** — otherwise the *safe* behaviour is an outage.

**R12 — Extracting a rule is a security act.** A rule fused to a database read cannot be exercised
without constructing a whole world, so **a branch that cannot be reached from a live database is a branch
that will never be reviewed under load.** Pull the decision into a pure module and it becomes testable,
single-homed, and impossible to hand-copy with a divergent guard.

---

## 5 · How to audit

The audit itself lives in [`_SecurityDocumentation.md` §2](../documentation/_SecurityDocumentation.md).
This is how it is conducted.

> **Every entry is verified by reading the code, never inherited from a report.** Findings are **never
> pruned** after they are fixed — the entry is the rail's evidence.

**Structure each entry:** `### N — Title · SEVERITY · STATUS` → what the code actually did → why it
mattered concretely (**the attack in one sentence**) → how it was fixed → **which rails it earned.**

**Fix the class, not the instance.** A finding filed as one secret with a default turned out to be two
secrets across five files, and the second was worse — it surfaced only because the fix went looking for
the whole class. **A fix without a rail is a fix that comes back.**

### The method is part of the finding

> **⟨INHERITED EVIDENCE — the sharpest lesson in this document.⟩** In `wrld-sandbox`, four prose sweeps —
> including one specifically hunting money flows — walked past a **live self-serve currency mint**,
> because the comment above the route said what it was *supposed* to be. It was found the fifth time by
> making a machine **enumerate every route that can change a balance**; it was the very first row.
>
> **A comment is a claim, and an audit must check the claim.** And: *read a description and you will
> confirm it; enumerate a surface and you will find what is on it.*

**Reading, sweeping, enumerating and testing each catch a different class of hole**, so none of them is
the audit:

| Method | Finds |
|---|---|
| **Reading** the code | logic that is wrong on its face |
| **Sweeping** for a pattern | the same mistake repeated in places nobody looked |
| **Enumerating** a surface mechanically | the thing whose *description* is why it survived |
| **Writing tests** for code everyone has read | branches unreachable from a live database (R12) |

### Two more recorded lessons

> **Assess the mechanism before assigning the severity.** In `wrld-sandbox`, open CORS was pushed as
> *"the last live exposure"* and was **hygiene, not a hole** — the API authenticates with a `Bearer`
> header and enables no credentials, so a hostile page can neither have a token attached for it nor read
> one cross-origin. The time it would have absorbed would have been spent nowhere near the real takeover.

> **A law that lags its code is the failure this whole doctrine warns about.** One finding was marked
> OPEN for a day after the fix shipped, because the status line was never updated. **The doc sweep is
> part of the work, not after it.**

---

## 6 · The rails, made mechanical

The seam with [`_VerificationLaw.md`](_VerificationLaw.md). **A rail nobody can forget beats a rail
everyone must remember** ([PRINCIPLES §14](../PRINCIPLES.md)).

The three that generalise to almost any project:

| Gate | Enforces | Catches |
|---|---|---|
| `check:auth-surface` | R1 · R2 — every identity-granting request header is **declared** with why it is safe | an auth bypass **at authorship**, before it ever reaches a box |
| `check:secrets` | R3 · R5 — no secret carries a usable default; every service agrees on the shared ones | the secret nobody noticed had a fallback |
| unit suites over extracted rules | R4 · R12 — pure rules refuse out-of-range input instead of guessing | a gate that fails open on an input nobody thought about |

**Declared, not inferred.** An explicit allowlist, never a guess about whether a guard is "nearby
enough". Inference produces false positives, **and a gate that cries wolf is a gate someone disables.**
A new header read fails the build until someone writes down why it is safe — **so the decision lands in
a diff instead of in a hurry.**

> **⟨INHERITED EVIDENCE⟩** A `no-restricted-imports` rule guarding a production codebase's discovery
> design was enforced by **nothing** for its entire life, because eslint was never installed. **A control
> that isn't wired is a comment.**

**Not everything is mechanisable.** R10 and R11 are judgement rules; say so rather than pretending
otherwise. R11's second half is a *deploy-time* property and probably wants a smoke against a staging
boot, not a static check.

---

## Related

- [`PRINCIPLES.md`](../PRINCIPLES.md) — §10 honest degradation · §11b the point of no return · §14 make
  the rail mechanical
- [`_VerificationLaw.md`](_VerificationLaw.md) — the machinery these rails ride on
- [`_SecurityDocumentation.md`](../documentation/_SecurityDocumentation.md) — **this project's threat
  model, boundary table, and standing audit**
