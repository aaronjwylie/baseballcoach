# \_VerificationLaw — proving the software works

> **What this is.** The principled home for **verification** — the machinery that proves software
> behaves, automatically, on every push. It answers one question: *how do we know a change works,
> without a human clicking through it?*
>
> **This law is project-agnostic and copied verbatim.** It legislates the vocabulary, the taxonomy, and
> **what a gate must be.** The project's actual roster — which gates exist, what each covers, and what is
> deliberately not covered — lives in
> [`_VerificationDocumentation.md`](../documentation/_VerificationDocumentation.md).
>
> **A THIRD thing exists and is not a section of this one:** [`_SecurityLaw.md`](_SecurityLaw.md). This
> law proves the code does what we meant; that one asks what else it will do for someone who is trying.
>
> **Examples** ([PRINCIPLES §12a](../PRINCIPLES.md)): every failure cited is **evidence** — past tense,
> permanent, never pruned. Anything named as *the current best example to copy* is a **reference
> implementation** — present tense, swappable, and its own inventory stays in its own doc.

---

## 1 · The northstar

> **A compiler proves the code is spelled right. The harness proves it WORKS.** Everything here exists
> because those are different claims, and only the first was ever being checked.

Verification is **deterministic machinery, not judgement**: it runs the same way every time, produces a
binary answer, and either passes silently or fails loudly with the name of the thing that broke. It is
the floor a human — or an agent — stands on to make a change safely.

### The four words, used precisely

Loose usage rots fast ([`_NomenclatureLaw.md`](_NomenclatureLaw.md) §2c), so:

| Word | Means |
|---|---|
| **harness** | the **rig** that runs tests — runner · driver · test doubles · fixtures · reporter. *Not* the tests |
| **suite / test** | the assertions themselves — what you run **on** the harness |
| **check** | a machine-verifiable assertion. **static** (no execution: typecheck, lint) or **executing** (a test) |
| **gate** | any check whose failure **blocks the pipeline.** Orthogonal — anything can be gated |

> The name is borrowed from hardware: a *wiring harness* is the loom connecting a device to test
> equipment. **The harness is the rig; the suite is what you run on it; the gate is what happens when it
> goes red.** Note that **not every gate is a test** — a static check is a gate too, which is why *"the
> gates"* is the honest collective noun and *"the test suite"* is not.

**Test doubles have settled names** (Meszaros' five) — use them rather than "mock" for everything:
**dummy** (passed, never used) · **stub** (canned answers) · **spy** (a stub that records calls) ·
**mock** (pre-programmed with expectations, fails if unmet) · **fake** (a working lightweight
implementation).

### Two more properties worth naming

- **Hermetic** — depends on nothing outside itself: no wall clock, no network, no shared database, no
  ordering between tests. **Non-hermetic is the root cause of flakiness.** If a suite cannot be
  hermetic, say so where it lives — namespacing and self-cleaning are *mitigation*, not hermeticity.
- **Flaky** — passes and fails without the code changing. **Fix or delete it — never retry until
  green.** A retry converts a gate into decoration while leaving it looking like protection: the single
  worst state for a check to be in, because it now lies in the direction of safety.

### Why it exists — the escapes

**Do not adopt this law before you have your own.** The two or three things that shipped green and broke
anyway are the doc's whole argument, and they belong in
[`_VerificationDocumentation.md` §3](../documentation/_VerificationDocumentation.md) — a real escape, and
the sentence explaining why the compiler had nothing to say about it.

> **⟨INHERITED EVIDENCE⟩** In `wrld-sandbox`: an entire editor was built into a component **nothing
> rendered** (dead code compiles perfectly; being unreferenced is not a type error), and a page read a
> style role **that no longer existed** (the type was an index signature, so *every* key looked valid —
> it threw at render). In `baseballsensei`: a rename put **sixty-six wrong strings** into production
> copy, URLs and storage paths with `tsc`, `eslint`, the build and 149 simulation checks all green,
> because **a wrong string is a well-typed string.**
>
> The lesson is the doc's first line: **compiling is not working.**

---

## 2 · The taxonomy — a test is a VECTOR, not a category

> **The axes are largely orthogonal: a test picks one value from EACH, so it is a point in a space
> rather than a member of a bucket.** Most argument about testing is people comparing values from
> different axes (*"is it a unit test or a smoke test?"* — those are different questions; it is usually
> both).

> ⚠️ **PROVENANCE — this model is OURS, not an industry standard** ([`_NomenclatureLaw.md`](_NomenclatureLaw.md)
> §2e). There is no canonical taxonomy of testing; the field gives overlapping, partial schemes that do
> not reconcile — **ISTQB** (levels + types), **ISO/IEC 25010** (quality characteristics), **Cohn**
> (the pyramid), **Fowler** (narrow vs broad integration), **Meszaros** (test doubles), **Bolton/Bach**
> (checking vs testing). The eight axes and the composition rules below are a **synthesis** of those:
> complete for our purposes, not authoritative. The individual *values* are standard vocabulary anyone
> will recognise; the framing is a house term. **Say "our taxonomy" when sharing it outside the team.**

### The eight axes

**A · Scope** — how much is really wired together: *unit · component (a UI tree in a simulated
browser) · integration · contract · end-to-end · system-in-production.*

> ⚠️ **Two of these are ambiguous in the wild — pick one sense and say so** ([`_NomenclatureLaw.md`](_NomenclatureLaw.md)
> §2d). **"Component test"**: ISTQB means *unit test*; the frontend world means *a UI tree in jsdom*.
> **"Integration test"**: Fowler splits *narrow* (one service + immediate collaborators, doubles at the
> edges) from *broad* (many real services). State which you mean, once.

**B · Property** — which quality is asserted: *functional correctness · performance (load · stress ·
soak · spike) · security (SAST · DAST · SCA · pen) · accessibility · visual · compatibility ·
localisation · resilience · usability.*

**C · Generation** — how the *cases* are produced: *example-based · table/parameterised · property-based
· fuzzing · model-based.*

**D · Oracle** — how *correctness is decided* once a case has run: *assertion · golden/snapshot ·
metamorphic (a RELATION between outputs — "sort twice = sort once") · differential · characterisation ·
human judgement.*

> **C and D are genuinely different questions, and conflating them hides the real difficulty.**
> Generation asks *what do we run?*; the oracle asks *how do we know it was right?* A property can be
> trivial to generate cases for and have **no usable oracle** — which is what makes timeline maths,
> layout, and simulation hard to test. The answer there is a **metamorphic** oracle (invariants like
> *the playhead never moves backwards*, *the sum of segments equals the span*), not more examples.

**E · Knowledge** — *white-box · grey-box · black-box.*

**F · Purpose** — *smoke · sanity · regression · acceptance · exploratory · canary/synthetic monitoring
· shakeout.*

**G · Execution** — *automated · semi-automated · manual.*

> **Checking vs testing** (Bolton/Bach): a **check** is a machine-verifiable assertion about something
> you already knew to ask; **testing** is human exploration that finds what you did not know to ask. By
> that split, *everything in this document is checking* — which is why it complements a human clicking
> around rather than replacing it, and why §5's limit is **structural** rather than a temporary
> shortfall.

**H · Environment** — *local · CI · staging/preview · production.*

Plus one thing that is not an axis but an **order**: **meta-level** checks take a *suite* as their
subject rather than the system — mutation testing, coverage, flake detection. **They test the tests.**

### The composition rules — the invalid combinations are nameable

| # | Rule | Consequence |
|---|---|---|
| **R1** | **Execution floor** — a runtime-only property cannot be asserted statically | no static perf / resilience / visual check |
| **R2** | **Renderer floor** — visual + accessibility need something to render | scope ≥ component |
| **R3** | **Scale floor** *(soft)* | perf/resilience are *possible* at unit scope, *meaningful* only at ≥ integration |
| **R4** | **Human floor** — usability and exploratory measure human experience | Execution = manual, by definition |
| **R5** | **Boundary lock** — contract testing's subject *is* the seam | its scope is fixed, not free |
| **R6** | **Meta order** — mutation/coverage take a suite as subject | they take no Property value |
| **R7** | **Production safety** | Environment = production ⇒ read-only assertions, canaries, guard-railed chaos |
| **R8** | **Determinism requirement** — a golden ORACLE needs one stable output | combining it with generated inputs requires normalising first |
| **R9** | **Oracle floor** — you cannot test what you cannot DECIDE | a property with no available oracle is untestable at *any* scope. Find a weaker oracle (metamorphic / differential) or accept it is unverified — **do not fake it** |

Everything else composes. **That is the practical payoff: you find your gaps by enumerating the
combinations you have never written.**

### Plot your own gates as vectors

Tabulate every gate against the eight axes in
[`_VerificationDocumentation.md` §1c](../documentation/_VerificationDocumentation.md).

> **Read the column, not the row.** If every gate asserts *functional correctness*, generated by
> *example*, judged by a hand-written *assertion* — that single sentence is the honest summary of your
> coverage, and every gap is one of those three columns taking a different value. **The empty cells are
> the roadmap**, and they come out in a useful order for free.

---

## 3 · The roster — four KINDS, a larger list

> **"Four" is the number of KINDS, not of gates.** Each independently-runnable check is a gate, and a
> real roster is bigger than its kinds. The roster is **declared, not discovered** (§7) — so a gate that
> goes silent shows as silent rather than vanishing.

The four questions, each answered by a different kind of gate, ordered fast-to-slow:

| Kind | The question it answers |
|---|---|
| **Static check** (typecheck, lint, custom scanners) | Is it spelled right — do the shapes line up? Is anything exported that nothing uses? |
| **Unit suites** | Do the extracted pure rules refuse the inputs they should? |
| **Behaviour / route suites** | Does the **server** do the right thing — and refuse the wrong thing? |
| **Render suites** | Does the **page** actually appear, with its controls? |

**The cheapest tier is usually the empty one.** A project that jumps straight to integration tests has
paid the most for the slowest signal — and has nothing that can exercise a rule fused to a database read
([`_SecurityLaw.md`](_SecurityLaw.md) R12).

### 3a · Behaviour tests — driving the real server

A script boots the real application in-process and sends it **the same requests a browser would**, then
inspects the responses. The reusable part is the SHAPE, which generalises to any CRUD surface:

- **auth** — a stranger is refused; a wrong credential is refused
- **read** — the collection comes back, carrying the fields its editor needs
- **create** — saves; *refuses* a duplicate identity; *refuses* a reference to something that doesn't exist
- **edit** — every field persists; the lifecycle flags work
- **sub-resources** — add; *refuses* a duplicate; *refuses* one missing a required value; rename
- **upload** — a real file lands, is referenced by its owner, appears in the listing; a wrong type is *rejected*
- **delete** — *refuses* while the thing is in use or has been earned; succeeds when it isn't; children cascade
- **actions** — *refuse* where the action could not work

> **Roughly half of every behaviour suite should assert a REFUSAL.** The happy path is the easy half and
> the cheap half to get right. **The guards are what protect people who already earned something — and a
> guard nobody tests is a guard nobody knows is gone.**

### 3b · Render tests — drawing the page

Mount the real component tree in a simulated browser, feed it a fake API, and assert on **what is on
screen** — found the way a user would find it, **by role and visible text, not by internal class names.**

The shape, which generalises to any operator surface: the rows render with their identifying fields ·
every control that *should* be there is, **and any control that could not work is absent** · state
markers appear on the right rows · disclosure sections open **independently** · the editor exposes every
field, with immutable ones locked · **a degraded payload degrades instead of blanking.**

> **Assert what a user perceives, not how it is built.** A test coupled to internals fails on a refactor
> that changed nothing real, and passes on a rewrite that broke everything.

---

## 4 · How a gate behaves when it finds something

Predictably, and in the same shape every time:

1. **It fails loudly.** Non-zero exit; CI goes red; nothing merges or deploys.
2. **It names the thing** — file, symbol, assertion, expected-vs-actual.
3. **It says what to do.** A failure message that only says *"expected true"* has wasted the catch.
4. **It changes nothing.** Gates are read-only, and every suite cleans up what it created — so a failure
   is safe to re-run and never leaves debris.

> **The proof they work is that they fail.** When you add a gate, **break something on purpose and
> confirm it goes red** — then fix it. An unproven gate is decoration.

---

## 5 · Writing a new one

1. **Pick the surface that hurt.** Verification is cheapest to justify right after something broke — the
   failure tells you exactly what to assert.
2. **Follow the local convention**, and wire it into the build script and CI **in the same commit.**
3. **Assert the refusals**, not only the successes (§3a).
4. **Make it self-cleaning, and as hermetic as you can afford** (§1). If it cannot be hermetic, say so
   where it lives.
5. **Prove it fails** before you trust it (§4). **And prove it does not cry wolf** — the whole current
   codebase passes clean. That second proof is the one people skip, and it is the one that protects the
   ability to work.
6. **Give it a vacuity floor.** If the scan stops finding files or symbols to check, that is a
   **failure, not a pass.**
7. **Say why it exists** at the top of the file — name the bug it would have caught. That comment is
   what stops a later reader deleting it as noise.

**Known limits, stated honestly** ([PRINCIPLES §10](../PRINCIPLES.md)): a gate is a **floor, not a
ceiling.** It catches regressions in what someone thought to assert, and nothing else.

---

## 6 · The ways a gate is silently NOT a gate

> **⟨INHERITED EVIDENCE — every row is a real failure, not a hypothesis.⟩** A gate can be green,
> declared, and running, and still not be a gate — and the failure is **always silent**, because the
> whole point of a gate is that it only speaks when something is wrong.

| Edge case | How it actually happened |
|---|---|
| A gate runs in CI but is **not in the roster** | invisible on the status page; a runtime warning fired three times in one day and was read past each time, because the run itself was green |
| A gate is in the roster but **CI never runs it** | shows honestly as NEVER RUN, forever — an intention wearing a gate's clothes |
| A gate's **kind is not rendered** by the page | declared, running, reporting, absent |
| A gate **stops finding anything** | a moved root or changed pattern makes the scan vacuous; it reports "clean" while checking nothing |
| A gate asserts **today's data, not the rule** | a suite pinned to a fixture went red the day another gate was correctly *fixed*. **Assert the rule, never today's data** |
| A **quarantined gate with no reason** | quarantine without a stated why is just "off", and it reads as green-adjacent |
| A gate that **guards code nothing typechecks** | five suites rotted for months because the build `tsconfig` excluded `scripts/`. **The suites guarded the code; nothing guarded the suites** |
| A **fail-closed check shipped without checking the environment** | a correct boot guard took a staging API down for an hour |
| A gate whose **own proof was never run** | proven to pass but never proven to FAIL is decoration |

**THE RULE — a gate must itself be guarded.** A verifier outside the reach of the verifiers is exactly
as rot-prone as the code it watches, **and rots more quietly, because nobody reads a green suite.**

**And the corollary, learned in the same hour:** widening typecheck to cover the suites surfaced 26
further errors *in suites that were passing.* **A passing suite is a claim about the code, not about
itself.**

---

## 7 · If you build a surface for this

Two things a verification surface can be. They look identical on screen — a page of green and red — and
answer completely different questions. **Conflating them is the failure mode:** a green light meaning
*"the code was fine on Tuesday"* while the box is on fire.

| | **A · The logbook** | **B · The heartbeat** |
|---|---|---|
| Asks | *did each change pass its checks?* | *is it working right now?* |
| Looks at | **changes**, backwards | the **running system**, now |
| Subject | code | environment |
| Fed by | the gates you already have | **new checks that poke the live system** |
| Analogy | the factory's inspection log | the dashboard in the car you're driving |

**Build A first** — your gates can only ever feed a logbook; none of them look at the box. **B is a
second project whose checks do not exist yet.** They must never merge into one green light.

The rules that bind it, whatever the plumbing:

- **It reports; it does not judge.** Pass/fail plus the failure text — no interpretation, no severity
  heuristics.
- **A red gate is not dismissible.** No "acknowledge" that hides a failure — that is the flaky-retry
  failure in nicer clothes. It clears when it goes green.
- **Honest absence** ([PRINCIPLES §10](../PRINCIPLES.md)): a gate that has never run shows as *never run*,
  never as passing. **Never prune the newest run per gate** — prune by age alone and a silent gate
  *vanishes*, and the page can no longer distinguish *never run* from *pruned*. That is not a knob, it
  is a rule: a knob there would be a switch labelled *"allow the page to mislead you."*
- **It must not become the only way to run them.** Every gate stays runnable from a terminal with one
  command; the surface is a *view* over that, never a gatekeeper in front of it.
- **One execution path.** Whoever presses the button, CI runs the gates. Two paths could disagree, and
  the one that disagreed with CI would be the one that did *not* gate the merge.
- **Toggles govern TRIGGERING, never REPORTING.** A switch that stops results being recorded makes the
  page go quiet and **look green** while nothing runs.

> **⚠️ Never create a knob before its reader exists.** A knob whose reader does not exist is an
> **orphaned knob** — editable, with no effect, indistinguishable from a working control. Specify the
> name here; create it in the same commit as the code that reads it.

---

## 8 · The harness vs an AI reviewer — a tool, not a colleague

Complementary, and the difference is *judgement*.

| | **The harness** (this doc) | **A resident agent** ([charter](../templates/charter.md)) |
|---|---|---|
| Nature | deterministic machinery | chartered AI reviewer |
| Output | pass / fail | a **finding**, filed for review |
| Truth | ground truth — the code really did that | an **opinion**, needing a human to vet |
| Wrong how | flaky, or asserts the wrong thing | noisy, or confidently wrong |
| Authority | **blocks the merge** | advisory only |
| Answers | *does it work?* | *is it right / canon / wise?* |

A gate cannot tell you a name is off-canon — it has no taste. An agent cannot tell you the upload route
500s — it has no execution. **The agent reads; the harness runs.**

**The harness is what makes agentic work safe.** An agent can change code, run the gates, read a precise
failure, fix, and re-run — a tight loop with an *objective* signal at the end, instead of a
plausible-sounding claim that something works.

---

## 9 · What you choose NOT to gate is a decision, and decisions belong in writing

An absent gate is not a gap until someone writes it down; after that it is a **deferral with a cost
attached.** Record each one in the Documentation with what breaks while it waits.

**The trap to name explicitly: a harness that covers only the easy half.** A render harness that mounts
only the components with no native dependency gates the cheap part **while reading as coverage** — which
§4 says is the worst state for a check to be in. **An honest gap beats a flattering gate.**

**And look before you port.** Inventory the test assets that already exist before building a tier. Two
things that are never guessable from the outside: sometimes there is nothing to port, and sometimes the
highest-value test in the estate is **one nobody has written** — a fixture whose partner on the other
side of a seam was always intended and never built.

---

## Related

- [`PRINCIPLES.md`](../PRINCIPLES.md) — §10 honest degradation · §14 make the rail mechanical
- [`_SecurityLaw.md`](_SecurityLaw.md) — the other kind of automated scrutiny
- [`_VerificationDocumentation.md`](../documentation/_VerificationDocumentation.md) — **this project's
  roster, escapes, vectors, and deferrals**
