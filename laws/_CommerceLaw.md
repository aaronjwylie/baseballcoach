# \_CommerceLaw — value that can be accounted for

> **Take this law only if money moves.** In a project with no money it is exactly the empty folder
> [PRINCIPLES §6](../PRINCIPLES.md) forbids. Delete it and note the deletion once.

> **What this is.** The principled home for **money**: what a unit of value IS, how it is allowed to
> move, and the rules that make every movement provable after the fact.
>
> **This law is project-agnostic and copied verbatim.** The economic model, the rails' current state and
> the audit live in [`_CommerceDocumentation.md`](../documentation/_CommerceDocumentation.md).
>
> **Why it is NOT part of [`_SecurityLaw.md`](_SecurityLaw.md).** Security asks *what will this do for
> someone who is trying.* Commerce asks *is this right, and can we show our work* — and **most money bugs
> have no attacker in them at all.** A double-tap that charges twice, two concurrent transfers that drive
> a balance negative, a rounding rule that quietly favours the platform: nobody attacked anything, and a
> user is still out real value.
>
> | | Security | Commerce |
> |---|---|---|
> | Defends against | **intent** | **intent, accident, AND concurrency** |
> | The failure looks like | a breach | a wrong number nobody can explain |
> | Discovered by | us, if we are lucky | **the user**, then the operator, in that order |
> | Done means | no known hole + a rail | the books balance, **and we can prove they balance** |
>
> Where the two overlap, the security rail is **cited, not repeated.**

> **The bar money is held to, and nothing else is.** Everywhere else, *"works for the paths we
> enumerated"* is a reasonable standard. Money is the one domain where being *approximately* right is
> indistinguishable from being wrong, where the error compounds silently, and where the person who finds
> it is the person who lost something. **That asymmetry is the whole reason this document exists.**

---

## 1 · The northstar

> **Every unit of value can be accounted for: where it came from, where it went, and why the balance is
> what it is.**

Not *"the balance is usually correct."* **Accountable** — meaning that for any balance, at any time, the
movements that produced it can be listed, and their sum is that balance.

A system that cannot do this does not have a money bug or not have a money bug; **it has no way to
know** — which is strictly worse than a known bug, because it can never be closed.

**Currency is integers.** No float anywhere in a money path. Rounding happens **once**, at the end, at
the smallest unit. A fraction of the smallest unit does not exist.

---

## 2 · The six properties

A money flow is correct when it holds all six. **They are listed in dependency order:** the later ones
are worthless if the earlier ones are false, and the last one is the only one that can *detect* a
violation of the others.

| # | Property | Without it |
|---|---|---|
| 1 | **One writer.** Only one service's ledger mutates a balance | every other service becomes a place money can be invented |
| 2 | **The server owns the amount.** The client sends an *id*, or a number the server bounds | the price is whatever the client says |
| 3 | **A debit is one statement.** The balance check and the decrement are the same statement | concurrency drives balances negative, silently |
| 4 | **Idempotent by construction.** A retry is not a second payment | a dropped response costs the user twice |
| 5 | **The announcement derives from the commit** | a participant can assert money that never moved |
| 6 | **Every movement leaves a row, and the balance reconciles to the rows** | violations of 1–5 are undetectable and permanent |

---

## 3 · The rails

**C1 — One writer.** A balance is mutated in exactly one place. No other service writes it, and no other
service *asserts* it. Where another service needs money to happen, **it asks; it never acts and never
announces.**

**C2 — The server owns the amount.** The client sends a catalog id, a bundle id, a SKU — **never a
price.** Where a free-form amount is genuinely the product, the server bounds it against config **and**
against the balance, and **neither bound may be absent.** *(This is [`_SecurityLaw.md`](_SecurityLaw.md)
R6 applied to money.)*

**C3 — "Inside a transaction" is not "atomic".** The balance check and the decrement must be **one
statement the database re-evaluates at write time**:

```ts
const debit = await tx.wallet.updateMany({
  where: { accountId, balance: { gte: amount } },   // the guard IS the write
  data:  { balance: { decrement: amount } },
})
if (debit.count === 0) throw insufficient
```

A separate `find` → `if (balance < amount)` → `update` is **a race even inside a transaction**, because
the default isolation level re-reads nothing: two callers both read 100, both pass `100 >= 100`, both
decrement. **This one is dangerous precisely because the wrong version looks careful** — it is guarded,
it is inside a transaction, and it is still wrong.

**C4 — A retry is not a second payment.** Every operation that moves money is idempotent by a **key the
database enforces**: a unique constraint, or a conditional status transition that claims the row
(`updateMany where status: 'pending'` → `count === 0` means someone else has it). Not an in-memory guard,
not a client-side disable, not *"the button greys out"* — **the network will retry when nobody pressed
anything twice.**

**C5 — The announcement is a consequence, not a cause.** Anything an audience sees about money is emitted
by the **server, after the ledger commits.** A participant may never assert a money event. Getting this
backwards fails in **both** directions: a modified client announces money that never moved, *and* a
legitimate payment whose announcement is dropped moves money the room never sees. **A control that is
wrong in both directions is not a trade-off; it is just wrong.**

> The seam worth keeping: **chat is the same shape and correctly stays a relay.** Chat *is* the client's
> assertion — they are their words. **Money is the server's fact.**

**C6 — Every movement leaves a row, and money is never edited in place.** A refund is a **new movement**,
not an undo; a correction is a movement, not a rewrite. The record is **append-only**, survives the
deletion of either party (financial records are stamps, never cascading relations), and **the balance
must be reconcilable to it.** A balance that cannot be derived from its movements is a number with no
argument behind it.

**And a movement a human initiated names the human.** Ordinary movements need no actor — the account *is*
the actor. But an operator grant, reversal or correction must carry its operator **on the money**, not
only in a separate audit table: *"the platform did this"* is not an answer anyone can act on, **and a
tool that cannot be attributed is a tool that cannot be reviewed.**

**C7 — A rate is not an ordinary knob.** Any conversion or fee rate must be positive, finite and sane,
**validated where it is written** (not only where it is read), and every change leaves an audit trail
with the old and new value. **A nonsense rate must refuse to convert rather than produce a number.**
Guarding only at use fails in the middle of somebody's payment, long after the keystroke that caused it —
and a silent revert to a default gives an operator no way to know their edit did not take.

**C8 — Value is created in exactly one place, by an operator, on the record.** Some path must be able to
create value from nothing. That path is **singular, operator-gated, and audited.** **A convenience that
credits the caller's own balance is a mint no matter what its comment says.**

**C9 — Money OUT is stricter than money IN, and ambiguity fails toward not moving. The sign lives in the
VERB, never in the number.** An operator tool that removes value is **its own action**, never *"the grant
tool with a negative amount"*:

- a stray minus would silently become a different operation;
- the two use different primitives with different failure modes — a grant creates value and is unbounded,
  a removal is clamped by what is actually there and **may take less than asked**;
- they need different journal reasons, or the audit trail cannot tell value *created* from value *taken
  back*;
- **taking earns its own confirmation.**

**The rails are not symmetric: crediting wrongly is a bug, debiting or paying out wrongly is a loss.** So
the out-side carries the claim, the conditional debit, the refund-on-failure, and the human step. And
when an operation fails **ambiguously** — a timeout, an unknown provider state — the resolution is to
*not* move the money and **leave the row in a state an operator can settle.** Never optimistic, never
automatic.

**C10 — Not every ledger entry is money.** A receipt, a badge, a collectible is a *receive-only* record
with no giver and no amount. **Money rules apply to money; they do not apply to receipts.** Say which is
which, or the reconciliation will try to balance things that were never a balance.

---

## 4 · Two honest limits, stated where they will be read

**What a clean reconciliation does NOT mean.** It says every balance is explained by recorded movements.
**It does not say every movement was correct** — a double-charge that wrote two journal entries
reconciles perfectly. That is why C4 is enforced by unique constraints rather than inferred from a
balanced ledger. **Reconciliation catches value that appeared or vanished — never value that moved for a
bad reason.**

**The honest asymmetry in a reversal.** A refund to the sender is unconditional; the claw-back from the
recipient can only take what is still there. **So a reversal can return more than it recovers, and the
difference is a real platform cost** — surface it rather than hiding it. That is the right trade: the
alternative is refusing to reverse a fraudulent transfer because the fraudster already spent it, **which
punishes the victim for being slow.**

---

## 5 · The operator surface

Money is where a **read-first** operator surface pays off hardest: the numbers are only worth reading if
something says they are trustworthy. Three tiers, not interchangeable:

**SEE — the invariant.** One honest yes/no: *do the books balance?* Like a gate, **green has to mean
something** — so it is loud when a balance has drifted, and it **lists the drifted accounts rather than
counting them.** A count with no rows is a dead end for whoever has to fix it. And it **states its own
limit where it will be read** (§4).

**SEE — the flows, and the record.** Two views, and both should exist, because they answer different
questions:

| | Answers | Has |
|---|---|---|
| **Activity feed** | what happened, in human terms | counterparties, titles, events that move no money |
| **Journal** | what moved, and does it sum | signed deltas, reason, **operator**, the rows reconciliation adds up |

Replacing the feed with the journal loses the readable half; replacing the journal with the feed loses the
accountable half.

**DO — the tools, which are all movements.** **Every operator action is itself a journalled, attributed
movement, never an edit.** Each writes new entries, leaves the original record stamped and intact, names
the operator — **so the ledger stays the whole truth and the reconciliation still balances afterwards.**

---

## 6 · Made mechanical

Money rails are the ones most worth spending a gate on, **because their failures are silent.**

| Gate | Enforces |
|---|---|
| unit — conversion | C7 — a nonsense rate refuses to convert; a round-trip never pays out more than came in |
| unit — config bounds | C7 **at the write** — every shipped default is inside its own bounds |
| unit — mint | C8 — a route that credits the caller's own balance refuses in production, **and checks before doing any work** |
| unit — debit | C3 — asserted **on the emitted query**, not on the outcome |
| static — `check:money` | C1 + C3 — a balance may only be written through the primitive. **Declared, not inferred**: a new write fails the build until someone names it *with a reason* |
| integration — concurrency | C3 + C4 **against a real database** — the only place the race can be demonstrated |
| integration — reconciliation | C6 — after the concurrency and refund sections, every balance equals the sum of its movements |

> **Prove each one bites.** Reverting the debit primitive to read-then-write should make N of N concurrent
> debits succeed and land the balance **negative**. A gate that has never gone red is unproven.

---

## Related

- [`PRINCIPLES.md`](../PRINCIPLES.md) — §11b the point of no return (money is where it bites hardest)
- [`_SecurityLaw.md`](_SecurityLaw.md) — R6 the server owns the value · R2 dev routes refuse in production
- [`_NomenclatureLaw.md`](_NomenclatureLaw.md) — §2c one word per concept, and it survives every layer.
  **The money surface is where that rule was earned**
- [`_CommerceDocumentation.md`](../documentation/_CommerceDocumentation.md) — **this project's economic
  model, rail status, and audit**
