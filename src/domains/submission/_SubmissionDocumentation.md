# submission — `src/domains/submission/`

The **submission domain slice** — one folder holding both what a Submission **is** (the noun)
and what a customer **does** with it (looks theirs up). One request for coaching feedback:
the record every other domain orbits.

---

## 1 · The northstar

A submission is **one request for coaching feedback, carrying a pack of files** — not one
video. A customer attaches whatever shows the problem: a clip or two, a still of their grip,
a PDF from a previous coach. Up to `maxFilesPerSubmission`, each up to `maxFileSizeMb`, both
set by the operator. One payment buys one *review of the pack*, and the coach answers it with
a single response.

That plural is the shape of the data, not a detail: it's why `submissionFiles` is a table and
not a column, and why anything phrased as "the video" is a bug in the making. The single
`videoUrl` field this replaced could only ever hold one locator.

It is created at the *first* step of the flow — before verification, before files, before
money — and it accumulates: the proof of email, then the files, then the payment, then the
coach's response. Its `status` is the whole workflow in one field, and **[§2 · The northstar
path](#2--the-northstar-path--inception-to-completion) is the canonical account of that
journey** — read it before changing any stage.

**Nothing is retained until the payment clears.** Before that a submission is a scratch pad:
a refresh, a ten-minute idle timeout, or "Start over" discards it — files and record together
(`discardUnpaidSubmission`). Only a paid submission earns a place in the queue, and only a
paid one is safe from being scrubbed.

```mermaid
flowchart LR
    CO["checkout domain<br/>opens one"] --> SUB["Submission<br/>(Postgres row)"]
    VER["verification domain<br/>proves the email"] --> SUB
    UP["upload domain<br/>attaches files"] --> SUB
    PAY["payment domain<br/>marks it paid"] --> SUB
    FB["feedback domain<br/>completes it"] --> SUB
    SUB --> FILES["submissionFiles<br/>(one row per file)"]
    SUB --> LOOK["ui/StatusLookup<br/>customer reads theirs"]
```

**This slice imports no other domain.** Verification, upload, payment, feedback and checkout
all import *it*. That asymmetry is the architecture: arrows point at the record, and the
graph can't cycle.

### The invariants

- **The storage column names live in the Drizzle schema (`shared/db`), and the row↔domain
  mapping lives in `api/submissionRow.ts`.** No other file turns a DB row into a Submission.
  A schema change is a Drizzle migration. *(PRINCIPLES #2.)*
- **Email is normalized to lowercase on write and on lookup**, so a customer who checks out
  as `Alex@x.com` and later looks up `alex@x.com` finds their own submission.
- **One schema validates on both sides.** `model/submissionInput.ts` holds the Zod schemas;
  the client form and the API route use the same objects, so they cannot drift into
  disagreeing about what's acceptable. **The server always re-validates** — client validation
  is a courtesy to honest users, not a boundary.
- **Email is normalized *before* it's validated**, not after. A trailing space from a mobile
  keyboard's autocomplete would otherwise be rejected as an invalid address.
- **`PublicSubmission` is the only shape that leaves the building.** The lookup identifies
  customers by an *unverified* email, so anything on that type is visible to anyone who
  guesses an address. Adding a field to it is a security decision, which is why it lives
  here rather than in the route that serializes it.
- **`status` and `focus` are Postgres enums**, so the DB itself rejects a bad value — no
  runtime guard needed the way the Airtable single-selects required one.
- **The customer-facing flow writes only `draft`, `awaiting_payment` and `new`.** The other
  three are driven from the operator portal, expressed as `AppWrittenStatus`.
- **The flow cookie carries a submission id and nothing else.** Whether the email is verified
  lives on the row, so a stale cookie can't claim a verification that never happened
  ([ADR 010](../../../docs/decisions/010-verification-gates-upload.md)).
- **A file record outlives its bytes.** The retention sweep clears `fileUrl` and leaves the
  row, so the portal and the receipt can still say what was sent. `isAvailable()` is the
  honest way to ask.

### The pieces

- **the NOUN** — `model/submission.ts` (the type family, `SUBMISSION_STATUSES`,
  `FOCUS_OPTIONS`) · `model/submissionFile.ts` (one uploaded file) ·
  `api/submissionRow.ts` (the row↔domain mapper — the storage seam) ·
  `api/submissionApi.ts` and `api/submissionFileApi.ts` (the Drizzle queries).
- **the VERB** — `ui/PlayerInfoForm.tsx` (step 1 of the flow) · `ui/StatusLookup.tsx` (email
  in, your submissions out) · `ui/SubmissionFileList.tsx` (the operator's view of what
  arrived) · `api/flowSession.ts` (which submission this browser owns) ·
  `model/submissionInput.ts` (validating what a customer types) ·
  `model/publicSubmission.ts` (the trim-to-safe projection).
- `index.ts` — the barrel. Consumers import `@/domains/submission`.

The status lookup lives here rather than in its own domain because *checking your
submissions* is a verb over this noun, not a separate concept. That's PRINCIPLES #4 doing
its job.

---

## 2 · The northstar path — inception to completion

**This is the canonical journey, and the single reference for it.** Every other
doc describes a slice; this is the whole arc, so a proposed change to any stage
can be checked against what comes before and after. Refine it here first.

**It describes the northstar, not the build** — and as of 2026-08-01 the two have
converged. Every stage below has code behind it, verified by probe rather than by
inspection, so the table carries no *(not built)* or *(today: …)* notes for the
first time.

That is a moment, not a property. The convention stays: a cell states where the
step is going, in present tense, and a divergence is an **appended note** rather
than a softened sentence. The next thing that ships ahead of this doc, or lags
behind it, gets marked the same way.

### How to fill a row

Six rules. They exist because each was got wrong at least once while the table
was being written, and each mistake was invisible until it was named.

1. **A row is a move, not a state.** If you can't name a trigger, it isn't a row —
   it's a condition, and it belongs in someone else's *Before* or *After*.
2. **Trigger is the pivot.** Everything left of it is already true when the stage
   begins; everything right of it is caused by it. **A fact on the wrong side of
   that column means the row is wrong** — which is a thing you can check by
   reading, not by knowing the code.
3. **State what is, not what isn't.** "Nothing exists yet", "not yet notified",
   "no session needed" describe absence. Say what *is* true instead. Absences are
   real and worth recording — they go in an audit's gaps layer, not in the path.
4. **Cells hold content, not navigation.** No "see below", no cross-references.
   If a cell can't hold the detail, the detail belongs in a section of its own and
   the reader will find it.
5. **Write the real names, never a paraphrase.** `startSubmissionAction`, not
   "the submit handler". `emailVerifiedAt`, not "the verified flag". These are
   the shared vocabulary between this table, the admin screen and the source, so
   a mismatch between the three is *discoverable by reading* — and the table
   earns its keep as a nomenclature check, not just a description.

   It cuts the other way too: **if a name needs explaining every time it appears
   here, the name is wrong in the code.** Nomenclature should carry meaning, not
   require it. (PRINCIPLES §11.)
6. **One scope per column.** Don't let a cell answer a neighbouring column's
   question; the overlap is where drift starts.
7. **Resolve the chain across the row — don't defer it to prose.** A trigger
   rarely does one thing. **① ② ③ …** are its operations *in execution order*,
   one per column, so a row read left to right is a complete cause-and-effect
   chain: who, in what state, under what conditions, does what — which causes
   this, then this, then this — ending in an outcome, a message, a retention
   answer and a status move.

   Say which operations can abort the stage and which fail silently; that
   difference is usually the interesting part. Stages have different lengths, so
   the later columns are often blank — see rule 8. **Width is not a constraint;
   an unresolved row is.**
8. **A blank cell is an answer, and it has to be a true one.** Blank means
   *nothing happens in this dimension at this point* — no email fires, no status
   moves, nothing is retained. Don't pad it with "—" or "n/a"; the emptiness is
   the information, and a column of blanks broken by one entry is exactly how you
   see where something actually happens.

   Blank is **not** the same as missing. Where something *ought* to happen and
   doesn't, mark it **⚠️** and say so. That single distinction is what keeps the
   table honest as it gets sparser: silence means "correctly nothing", ⚠️ means
   "a gap we know about". If you can't tell which a cell is, the cell is wrong.

   **The whole grid is the story — blanks included.** A row's meaning comes as
   much from the columns it leaves empty as the ones it fills.

   Keep the cell itself empty — the sparseness is what makes the pattern
   readable — and give the reason in one line beneath the table. Some blanks are
   incidental; others are a decision, and those are worth saying out loud.
9. **Write the northstar, not the current state.** Every cell describes the
   destination, in present tense — the version of this step we're building toward,
   whether or not it exists. That's PRINCIPLES §12: present tense is the
   northstar, and it's never about legacy.

   Reality is recorded as an **appended note**, never by softening the statement:

   | Marker | Means |
   | --- | --- |
   | *(today: …)* | the step exists but the code differs from the northstar |
   | *(not built)* | the step is agreed and nothing implements it yet |
   | ⚠️ | a gap in the northstar itself — something that *should* be decided or built and isn't |

   The reason for the separation: a doc that describes what the code happens to
   do can only ever justify the code. Stating the destination first means the
   difference between the two is visible in every row, and a divergence becomes
   a to-do rather than a description.

   Keep the cell itself empty — the sparseness is what makes the pattern
   readable — and give the reason in one line beneath the table. Some blanks are
   incidental; others are a decision, and those are worth saying out loud.

What each column holds:

| Column | Holds | Not |
| --- | --- | --- |
| **① ② ③ …** | one operation of the trigger, in execution order, marked if it can abort or fails silently | a summary — that's *Outcome* |
| **Outcome** | where the actor is left, and what is now possible | the mechanics — those are the numbered columns |
| **Stage** | a short phrase naming the move | a status value — that's the last column |
| **Who** | the actor whose action causes it | the system, unless genuinely nobody triggers it |
| **Before** | what is already true as the stage begins | anything the trigger causes; anything absent |
| **Viable when** | every condition that must hold at the instant of the trigger | why the condition exists — that's prose, not a cell |
| **Trigger** | the literal control pressed, or the event that arrives | what it causes |
| **Email** | which numbered message fires, or ⚠️ if none does | messages that *should* exist — mark those, don't imply them |
| **Retention** | whether the submission survives being abandoned at this point | |
| **`status`** | `from → to`, or *(unchanged)* | the destination on its own — the move is the information |

| # | Stage | Who | Before | Viable when | Trigger | ① | ② | ③ | ④ | ⑤ | ⑥ | Outcome | Email | Retention | `status` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Details submitted | customer | • Step 1 of 4 — the customer is filling in the form<br>• Their previous unfinished attempt, if any, is still on record | the form is valid · they're under the abuse limit<br>No account or session — this is the front door | **“Continue to email verification”** → `startSubmissionAction` | any earlier unpaid attempt of theirs is discarded — files and row | stale abandoned submissions elsewhere are tidied up *(best-effort; never blocks this customer)* | the submission is created and gets its permanent id | a **30-minute sliding window** opens — **the only clock in the flow** | a 6-digit code is minted; only its hash is stored | the code is **confirmed accepted for delivery** before they're advanced | they land on step 2 knowing a code is on its way, **and where to look if it doesn't arrive** | ① code → customer | scratch pad — discardable at any moment | `—` → `draft` |
| 2 | Email verified | customer | • Step 2 — waiting on the code<br>• The panel tells them to check their spam folder <br>• They can ask for a fresh one, or go back and fix the address | 6 digits · **still inside the 30-minute window** — the code has no expiry of its own · fewer than 5 wrong guesses · matches the stored hash<br> | **“Verify and continue”** → `verifyCodeAction` | the attempt is counted *before* the comparison, so abandoning a request still spends one | the code is compared against its hash | the address is marked proven, and the code is burned — single-use | the window slides forward | a **resent** code inherits the remaining time — it never buys a fresh 30 | | the upload gate opens; they move to step 3 | | scratch pad | `draft` → `awaiting_payment` |
| 3 | Files attached | customer | • Step 3 — the upload gate is open<br>• Anything already added is listed with its size | the address is proven · not yet paid · under the file limit · each file is an allowed type and within the size limit | **picking a file** — no confirm button; each file commits on its own | a scoped, short-lived upload token is issued for this submission only | the browser uploads **straight to storage**, so file size isn't bounded by our server | the returned location is re-checked against this submission before it's trusted | the file is recorded as **client-original** | the window slides forward | | the card shows done; another card is offered | | scratch pad | *(unchanged)* |
| 4 | Payment clears | customer + Stripe | • Step 4 — the amount and a card field are shown<br>• Everything they'll send is already uploaded | the address is proven · not yet paid · **at least one file attached** · the card clears · the payment provably belongs to *this* submission | **“Pay …”** → confirmed inline, on return from 3-D Secure, or by webhook — whichever arrives first | the card is confirmed with the payment provider | the submission is marked paid **exactly once**, however many confirmations arrive | a receipt listing every file is sent | the receipt carries a **non-guessable status link** the customer can use any time | **Yuta is told a paid submission has arrived** | the flow session is released — its job is done | they see a confirmation; it enters Yuta's queue | ② receipt → customer **and Yuta** | **retained from here on** | `awaiting_payment` → **`new`** |
| 5 | Coach assigned | Yuta | • Paid and in the queue, unassigned<br>• The files are in the customer's language | he's an admin · a coach is chosen · the submission hasn't been handed over yet | coach dropdown → `assignCoachAction` | the coach is recorded against the submission | **whether translation is needed is now derivable** — the platform is English, so it's needed exactly when this coach doesn't read English | if it is, the queue says so, and steps 6–7 become a prompt rather than something Yuta must remember | | | | the row names the coach, and says whether translating is required | | retained | `new` → `assigned` |
| 6 | Originals translated *(optional)* | Yuta | • Assigned to a coach who doesn't read English<br>• The customer's files are as they arrived | the submission is assigned and its coach needs a translation | **download** from the *client* folder in the admin file view | translation happens **off-platform** — nothing runs on the server | the status records that it left for translation, so a submission can't sit here unnoticed | | | | | Yuta holds translated copies locally | | *(unchanged)* | `assigned` → **`intake_translating`** |
| 7 | Translations uploaded *(optional)* | Yuta | • Yuta has the translated files ready | the submission is out for translation | **upload** into the *client translated* folder | each file is recorded as **client-translated**, so the sets never blur | both languages now exist; step 8 chooses which the coach receives | | | | | the folder view shows two populated sets | | swept with the originals — same content, same clock | **`intake_translating`** → **`intake_translated`** |
| 8 | Handed to the coach **+ what they get** | Yuta | • Assigned, and translated if the coach needs it<br>• The coach hasn't been contacted | he's an admin · the submission is assigned or translated, and not yet handed over — so a second click can't re-send or skip ahead · **a language set is chosen** | **radio: English · Japanese · both** + **“Send email →”** → `notifyCoachAction` | the guard re-reads the submission and refuses anything already past this point | **the chosen set is recorded** — what the coach was sent is a fact worth keeping | the radio offers only sets that exist, and disappears when there's nothing to choose between | the coach is emailed the customer's details and a download link per file — **only the chosen set** | the submission is marked as sent, so Yuta can see it hasn't been picked up | | the coach has exactly what they can read, and nothing else | ③ hand-off → coach | retained | `assigned` or **`intake_translated`** → **`sent_to_coach`** |
| 9 | **Coach downloads** | coach | • Sent, but nothing proves the coach has the files<br>• Yuta is waiting to know work can begin | the link is theirs · the submission was sent to them · the files haven't been swept | **downloading** — the first file collected is the confirmation | the first successful download is stamped | the submission moves into review — **now `in_review` means the coach actually has it**, not merely that we emailed them | **Yuta is told the coach has picked it up** — the hand-off is closed | a re-download changes nothing — first success only | | | turnaround starts from a real event; a silent coach is now visible | ④ picked up → Yuta | retained | **`sent_to_coach`** → `in_review` |
| 10 | Coach delivers | coach | • In review — the coach is recording their response | they're signed in and it's **their** submission · the file isn't empty · **the submission is actually in review** | **“Send feedback”** → stores the response. **It does not reach the customer** | the response is saved to the *coach* folder | the submission is marked as having a response | **no clock is started** — unapproved work must not begin any countdown | **Yuta and the coach are both told it's waiting for approval** | | | it enters Yuta's approval queue; the customer sees nothing yet | ⑤ response submitted → Yuta + coach | retained | `in_review` → `awaiting_approval` |
| 11 | Response translated *(optional)* | Yuta | • A response is waiting for approval, written in Japanese | a response has been delivered | **download** from the *coach* folder | translation happens **off-platform** — nothing runs on the server | the status records that it left for translation — the mirror of step 5 | | | | | Yuta holds the English version locally | | *(unchanged)* | `awaiting_approval` → **`response_translating`** |
| 12 | Translation uploaded *(optional)* | Yuta | • Yuta has the English version ready | the response is out for translation | **upload** into the *coach translated* folder | it's recorded as **coach-translated** — it sits *beside* the original, never replacing it | both language versions of the response now exist; step 13 chooses which to send | | | | | the folder view shows all four sets populated | | swept with everything else — see step 17 | **`response_translating`** → **`response_translated`** |
| 13 | Approved &amp; sent **+ what they get** | Yuta | • A response is waiting on his check, in one or both languages | the submission is awaiting approval **and** a response is actually present · **a language set is chosen** — so a stray click can't send an empty review or the wrong language | **radio: English · Japanese · both** + **“Approve &amp; send →”** — **this is the moment it reaches the customer** | the guard refuses anything without a delivered response | **the chosen set is recorded** — what the customer was sent is a fact worth keeping | the submission is marked complete and the delivery is stamped | the customer is emailed a download link for **only the chosen set** | **the email states how long the files will be kept** — the eviction window is told up front, not sprung later | | the customer can collect what they bought, knowing the deadline | ⑥ feedback ready → customer | **no clock starts here** — the countdown waits for collection | **`response_translated`** or `awaiting_approval` → `complete` |
| 14 | **Customer downloads** | customer | • Complete — the response is available but hasn't been collected<br>• They can return whenever they like | they've proven who they are — a **verified status session** or the **link from their receipt** | **download**, from the status page or the emailed link | the first successful download is stamped | **the status moves to collected**, so Yuta can filter his queue on it — the thing he'd otherwise have to guess | **this starts the 30-day retention countdown** — a re-download doesn't restart it | **Yuta is told the customer has collected** | | | they have the response in hand; the row is visibly finished | ⑦ collected → Yuta | **30 days from collection**, or 90 days from step 13 — whichever is later | `complete` → **`collected`** |
| 15 | Resolved | Yuta | • Collected — the job is done and the queue says so | the customer has collected their response | **“Mark resolved”** on the queue row — **deliberately manual** | the submission is stamped resolved | a thank-you and an invitation to come back is sent **while they still have their files** | | | | | the submission is closed and can be archived | ⑧ thank you → customer | unchanged — the countdown keeps running | **`collected`** → **`resolved`** |
| 16 | Deletion warning | the system | • Collected 23 days ago; deletion is a week away | the countdown is 7 days from expiry and no warning has been sent | the scheduled sweep, extended to notice what's *approaching* | the customer is told their files will be deleted in a week | the status says deletion is imminent, so it's visible in the queue rather than only in a mailbox | the warning is stamped so it can never send twice | | | | they have a week to collect again if they want to | ⑨ deletion warning → customer | unchanged — nothing is deleted yet | **`resolved`** → **`purge_imminent`** |
| 17 | Files purged | the system | • 30 days since collection; the warning has been sent | the countdown has expired and the submission hasn't already been swept<br>**A submission never collected** falls back to 90 days from step 13 | the scheduled sweep | **every file goes — all four sets**, the customer's originals and the coach's response alike *(one failure is logged; the rest continue)* | the file **records survive** with their locations cleared, so the portal can still say what was sent | **the submission itself is kept forever** — the history is the point; only the bytes go | the sweep is stamped, making a re-run a no-op | | | download links answer **410 Gone**; the row remains, permanently | | nothing stored; everything remembered | **`purge_imminent`** → **`purged`** |

### Four paths that aren't stages

The spine runs 1 → 17. Four things happen *off* it and can't be numbered, because
they're branches rather than steps.

**A declined card (branches from step 4).** A decline is a customer *trying*, not
a customer leaving, and the northstar treats it that way: nothing rolls back, the
files stay, the reason is shown inline, retrying is one tap — and **the attempt
buys them time**, because a card failure should extend the abandonment window
rather than let it run out underneath them. They're emailed a way back in.

*(Today the first half holds — the submission stays at `awaiting_payment` with its
files, `payment_failed` is logged, retry works. The second half doesn't:
⚠️ **nobody is emailed and the clock keeps running**, so a customer who fails a
card and returns two days later finds their files gone.)*

**Checking status (recurring, any time after step 4).** Available for the life of
the submission, as often as the customer likes. Two ways in:

| Route | How it works | Notes |
| --- | --- | --- |
| **Email + PIN** | They enter their email; a **fresh 6-digit code** is mailed each time; entering it opens the whole view — the list *and* the downloads | ✅ built. The open `POST /api/status` was **removed** with it: gating the page while leaving the endpoint open would have been theatre |
| **Magic link** | A signed, purpose-bound link carried in the ② receipt | ✅ built. **The link is the proof** — it only reaches an address that verified at step 2 *and* paid at step 4, so it goes straight in. A bearer capability: whoever holds the URL is in |

Both land on the same page, and both grant the same thing: see the status, and —
once step 13 has run — download the response. **This is the surface step 14
measures**, so it has to exist before the retention clock can key off a download.

**The window lapses, or the guesses run out (branches from steps 2, 3 or 4).**
Two triggers, one outcome — **exactly the outcome of refreshing the page.** The
scratch pad is scrubbed, row and bytes together, and **the customer is returned to
step 1** with a sentence explaining why. They are never left standing on step 2, 3
or 4 holding a submission that no longer exists.

| Trigger | Where it can happen | What survives |
| --- | --- | --- |
| **5 wrong guesses** | step 2 only | nothing — and nothing valuable is lost, because uploads are gated on verification, so at step 2 there is only typed detail |
| **the 30-minute window lapses** | steps 2, 3 or 4 | nothing — including uploaded files, which is the expensive case |
| **refresh, new tab, or “Start over”** | anywhere before payment | nothing — the case the other two are being made to match |

Exhausting the guesses is **terminal, not resettable**. There is no "request a new
code and try five more" — the submission is gone, so there is nothing to reset
into. That's the point of making it the same outcome as a refresh: one rule, not a
family of near-misses.

⚠️ **Today none of this holds.** Attempts and the code TTL are enforced, but a
failure returns an inline error and the customer stays exactly where they are,
looking at a submission the server may already have discarded. See the assessment
below.

**Yuta intervenes (available from step 4 onward).** The pipeline runs forward on
its own; this is the handle for when it shouldn't. Two powers, both admin-only,
both deliberately blunt:

| Power | What it does | Why it exists |
| --- | --- | --- |
| **Purge the folders** | delete any or all of the four file sets now, without waiting for a clock | a wrong file, a file that shouldn't have been sent, a customer asking to be forgotten |
| **Reset the status** | move a submission back to an earlier point on the ladder | the only route backwards. A coach's work Yuta won't accept goes back to `in_review`; a mis-picked language set goes back to `assigned` |

**This is the answer to "what can be undone", and it's deliberately not a set of
per-stage undo buttons.** One general handle an operator can reach for beats
eleven specific ones nobody remembers exist. If Yuta isn't satisfied with a
coach's work he'll speak to them directly — the system's job is to let him put the
submission back where it needs to be, not to model the conversation.

Both actions write to `internalNotes`, because a submission that moved backwards
without explanation is worse than one that didn't move. ⚠️ Neither is built.

---

### The status ladder

**Every meaningful transition has a status, and every status has a timestamp.**
Sixteen of them, one per step that changes the world. Steps 3 and 5–6/11–12's
optionality mean the ladder is a *path with branches*, not a progress bar — a
submission needing no translation never touches four of these.

| # | Status | Set at | Means |
| --- | --- | --- | --- |
| 1 | `draft` | 1 | details captured, nothing proven |
| 2 | `awaiting_payment` | 2 | the address is proven; uploads may begin |
| 3 | `new` | 4 | paid — the boundary. In Yuta's queue |
| 4 | `assigned` | 5 | a coach is chosen — and translation need becomes derivable |
| 5 | `intake_translating` | 6 | the customer's files have gone out for translation |
| 6 | `intake_translated` | 7 | the Japanese set is back and stored |
| 7 | `sent_to_coach` | 8 | emailed with the chosen language set, but not yet picked up |
| 8 | `in_review` | 9 | **the coach actually has the files** |
| 9 | `awaiting_approval` | 10 | a response exists; the customer can't see it |
| 10 | `response_translating` | 11 | the response has gone out for translation |
| 11 | `response_translated` | 12 | the English version is back and stored |
| 12 | `complete` | 13 | released to the customer |
| 13 | `collected` | 14 | **the customer has downloaded it** — the clock starts |
| 14 | `resolved` | 15 | Yuta has closed it; the thank-you has gone |
| 15 | `purge_imminent` | 16 | deletion is a week out; the customer has been warned |
| 16 | `purged` | 17 | the bytes are gone; the record is permanent |

Names are a proposal, not a decision — they follow the folder vocabulary
(*intake* for what the customer sent, *response* for what the coach wrote) so a
status and a folder never need translating between. Argue with them before any
migration.

**Why a status and not just a timestamp.** Both, actually — but the status is what
makes a thing *filterable*, and filtering is how Yuta works. A timestamp answers
"when did this happen" for one submission; a status answers "which submissions are
here" across all of them. Steps 5, 9, 14 and 16 exist as statuses precisely so a
stalled submission surfaces in a list rather than being noticed by accident.

#### Where the timestamps live — settled 2026-08-01

Sixteen nullable `timestamptz` columns is the obvious reading of "every status has
a timestamp", and it's a wide, sparse table where most rows have most columns null.
**The decision is a `submission_events` table instead** — one row per transition,
with `submissions.status` kept as the current value so every existing query still
works.

To answer the obvious worry — *do we still get timestamps?* — **yes, and more of
them.**

| `submission_events` | |
| --- | --- |
| `submissionId` | which submission |
| `status` | the rung it moved to |
| `at` | when — the timestamp, one per transition |
| `actorId` | who caused it: Yuta, a coach, or null for the customer and the cron |
| `note` | why, for the operator overrides that need a reason |

Every question sixteen columns could answer, this answers — *when did it become
`complete`* is one row. What it adds is what columns structurally **cannot** hold:

- **Repeats.** Yuta resets a submission from `awaiting_approval` back to
  `in_review`; it reaches `awaiting_approval` again a day later. A column keeps one
  of those two moments and silently loses the other. The table keeps both, in order.
- **Who.** A column records that something happened, never who did it. With
  operator overrides now a supported power, "who moved this backwards, and why" is a
  question that will get asked.
- **The shape of the work.** Time-in-stage, coach turnaround, how long submissions
  sit unassigned — all arithmetic on rows we're already writing, rather than a
  reporting feature someone builds later.

The trade is one insert per transition and a join for history. Neither is
meaningful at this volume. ⚠️ It is still a **schema change** and a migration.

---

### Assessments — the six things that need a decision

#### 1 · Four folders, one folder's worth of schema

You've described the admin UI as four folders — **client · client translated ·
coach · coach translated** — which settles the shape. What it costs:
`submissionFolder()` returns one path per submission, and the coach's response is
written *into that same folder*. So this needs sub-folders (or a naming scheme)
**plus a `kind` on `submissionFiles`**, which today implicitly means "customer
upload".

**The curation radios answer two of the five questions I had.** "Does the coach
see one set or both?" and "does the customer ever see the untranslated original?"
are no longer things the system decides — **Yuta decides, per submission**, at
step 7 and again at step 13. That's the right answer: which languages a given
coach or parent can read isn't derivable from anything we store.

It does mean the choice is **data, not just a UI state**. Two facts to keep:
what was sent to the coach, and what was sent to the customer — recorded at the
moment of sending, because "what did we actually give them" is a question Yuta
will ask later and a re-derivation can't answer.

**Settled 2026-08-01:**

- **A translation sits beside its original, never replacing it.** Four folders,
  both directions — originals and translation for what the customer sent, originals
  and translation for what the coach wrote.
- **The radio offers only sets that exist**, and disappears when there's nothing to
  choose between. The untranslated case is a default, not a disabled control.
- **Everything is swept together.** No set outlives another, including the coach's
  response — which is only safe *because* the clock starts on collection. See the
  retention assessment.
- **Yuta can change his mind**, via the status reset in the operator-override path.
  A wrong language set goes back to `assigned` and out again.

#### 2 · "Gone" is not an error, and the flow can't currently tell them apart

Every Server Action answers the same shape — `{ ok: false, error }` — and the flow
renders that string in place. Which is right for *"that code was wrong"* and wrong
for *"that submission no longer exists"*: the first should leave the customer where
they are, the second must take them back to step 1.

The northstar needs **a distinguishable outcome**, not a different sentence. Some
`{ ok: false, gone: true }` the flow recognises and reacts to by resetting itself
— clearing client state, showing one explanation, and rendering step 1.

🔶 **Half of this landed on 2026-08-01.** "Start over" now genuinely resets to step
1 rather than leaving the customer on a dead step, and an upload that fails because
the session lapsed says so in words instead of reporting an opaque token error. What
is still missing is the *automatic* half: the customer has to notice and press the
button, and a lapse anywhere other than the upload step is still an anonymous
inline error.

Every action can return it, because every action re-derives the submission from
the cookie and any of them can find it missing. So this isn't a step-2 feature —
it's the shape of a failure the whole flow shares, and the reason a customer can
currently sit on step 3 uploading into a submission that was swept ten minutes ago.

#### 3 · "Successful download" is not directly observable — and now it matters twice

Steps 9 and 14 both turn a download into a fact the system acts on: one advances
the status and closes the hand-off, the other starts the retention clock. Both rest
on the same shaky ground. **We can only know that we served the bytes** — not that
they arrived, that the file opens, or that anyone kept it. A dropped connection at
90% still looks like a served download.

The workable definition for both: **the first time the download route returns a
success**, stamped once. Two stamps, one rule:

| | Stamp | Consequence | If it never happens |
| --- | --- | --- | --- |
| Step 9 | first coach download | `in_review`; Yuta notified | the submission sits in `sent_to_coach` — **visible, which is the point**. Yuta chases |
| Step 14 | first customer download | the 30-day clock starts | **nothing is ever purged** — safe, but unbounded storage. Needs a backstop |

The asymmetry is worth noticing. A coach who never downloads produces a **stuck
row someone will see**; a customer who never downloads produces **silence and a
growing bill**. So step 9 needs no backstop and step 14 does.

**Settled:** the backstop is **90 days from step 13**, and whichever window expires
later wins. It's a ceiling on storage, not a change of policy — a customer who
collects on day 80 still gets their full 30 days.

**And the customer is told the window up front**, in the ⑥ feedback-ready email,
rather than discovering it in the ⑨ warning. A deadline disclosed at delivery is
a term; a deadline disclosed a week out is a surprise.

Neither stamp should restart on a re-download — first success only, both times.

#### 4 · Sixteen statuses is a lot, and the safety net is a compile error

The status ladder above is a big expansion — seven states today, sixteen in the
northstar. That's a deliberate answer to a real complaint (a submission could sit
anywhere between "assigned" and "reviewed" with nothing to filter on), but it has a
cost worth naming.

**Every new status must answer whether it counts as paid.** Paid-ness is a
`Record<SubmissionStatus, boolean>`, not a list, so adding a value without
answering is a **compile error** — which is exactly how `awaiting_approval` was
caught the last time. Nine new statuses means nine deliberate answers; all of them
are paid, since the ladder only branches after step 4.

**The customer-facing lookup must not grow with it.** A parent has no use for
`response_translating`. The status page already collapses the middle into calm
language, and sixteen states makes that collapse more important, not less — the
mapping belongs in one function, not in the page.

**And the ladder is not a progress bar.** Four of the sixteen are optional; a
submission needing no translation skips them entirely. Anything that renders the
ladder as a linear track will be wrong for most submissions.

#### 5 · The deletion warning is the expensive kind of timer

The settings doc distinguishes three kinds of clock. Steps 16 and 17 are the
**first genuinely scheduled effect** in the system: unlike the existing sweeps,
"warn them at day 23" isn't derivable from a state — it's a one-off message that
must fire once and only once. It needs `deletionWarningSentAt` as its idempotency
guard, and it means the cron grows from "delete what's due" to "notice what's
approaching".

Two consequences: the daily-cron granularity (Hobby plan) makes "23 days" mean
23–24, which is fine here; and **the warning must not fire for submissions that
never started a clock**, or people who never downloaded get warned about a
deletion that isn't scheduled.

#### 6 · Resolved stays manual, and `collected` is what makes that safe

Step 15 sits before 16 and 17 deliberately — the thank-you lands while the customer
still has their files, not after they've gone.

**Settled: resolving stays a human act.** Yuta presses the button; nothing fires it
for him. The objection to that was always "he'll forget, and the thank-you never
sends" — which is answered not by automating it but by **step 14 setting a
`collected` status he can filter on**. The work he has to do is now a list he can
pull up, not something he has to remember to look for.

That's the general shape worth keeping: *make the pending work visible rather than
doing it automatically.* Automation can come later if Yuta asks for it; the
filterable queue is what makes deferring that decision cheap.

⚠️ The residual risk is honest and small: a submission collected but never resolved
is still purged on schedule, and its customer never gets a thank-you. Nothing is
lost but the courtesy.

---

### Why those cells are blank

Blanks are correct-nothings. The two marked **deliberate** are design choices
that would otherwise look like oversights.

| Step | Column | Why |
| --- | --- | --- |
| 2, 3 | Email | Nobody to tell — verifying and attaching happen in front of the customer. The step 4 receipt lists everything at once |
| 6, 11 | Email | Translation is off-platform; nothing has changed on the server yet |
| 5 | Email | **Deliberate.** The coach is *not* told at assignment — that's step 8's job, and the gap between them is where translation happens |
| 12 | Email | The response's second language is Yuta's own housekeeping; step 13 is where anyone is told |
| 17 | Email | **Deliberate.** The purge is meant to be invisible by then — step 16 already warned them, and the response they bought is untouched |
| 6, 11 | Retention | Nothing is stored; the files are on Yuta's machine |
| 3 | `status` | **Deliberate.** Attaching a file doesn't move the submission — the gate opened at step 2 and closes at step 4. A per-file status would make one failed upload look like a state change |

Note what *isn't* blank any more: **steps 9 and 14 both notify Yuta.** A download
used to look like a private act needing no acknowledgement. It isn't — each one
tells him the pipeline moved without him.

### A stage is a sequence, not an instant

The table makes each row look atomic — trigger on the left, new world on the
right. **It isn't.** Between the two sits an ordered run of operations, and a
failure partway through leaves the earlier ones committed.

Stage 1 shows the distance to the northstar. Six operations, one `try/catch`:

| | Operation | On failure today |
| --- | --- | --- |
| 1 | `discardUnpaidSubmission(previous)` | throws — the customer can't start again until the old row is deletable |
| 2 | `sweepAbandoned` | **caught and logged** — the only step that can't derail the stage |
| 3 | `createSubmission` | throws — nothing committed yet, clean failure |
| 4 | `setFlowSession` | throws — ⚠️ **the row already exists**, and now nothing points at it |
| 5 | `issueCode` | returns null → the action stops and says so; row and cookie both exist |
| 6 | `sendVerificationCode` | **silently swallowed** — the customer advances anyway |

This is why *Viable when* and the operation chain can't be collapsed into "what
happens": the guard is checked once, up front, while the sequence unfolds
afterwards and can stop anywhere along the way.

---

### The point of no return

**"Should a failed stage undo itself?" has no single answer, and looking for one
was the mistake.** The question resolves per operation, and the line that decides
it is sharp:

> **An operation must survive a failure if its effect already exists outside our
> database. It must be undone if the only place it is true is inside.**

Undoing something the outside world already did makes the record lie. Keeping
something only we believe makes the record lie in the other direction. So every
stage has a **point of no return** — the first operation whose effect escapes us —
and the disposition of the whole chain follows from where that point sits.

**Before it:** scrub. Nothing outside knows, so a clean retry is both possible and
correct.
**From it on:** keep, and **repair forward**. The world has moved; the database's
job is to catch up, never to pretend otherwise.

Two examples, both raised in review, and they resolve in opposite directions for
the same reason:

- **Step 4, killed after the card clears.** The money moved. Un-marking the
  submission paid would be a lie about a fact Stripe will happily confirm, and the
  customer would be charged for a submission we claim doesn't exist. **Keep
  everything**; the missing receipt is repaired forward.
- **Step 13, killed after the completion stamp but before the email.** Nothing has
  left the building. `complete` would mean "delivered" while the customer has heard
  nothing — a claim only we believe. **Scrub the stamp**, and let Yuta press the
  button again.

#### Two rules that fall out of it

**Put the point of no return as late in the chain as you can.** Everything before
it is cleanly reversible, so the later it sits, the more of the stage is safe.
Where an ordering is free, the outside effect goes last.

**When both failure states are bad, fail toward the one someone will notice.**
Step 13 is the case where the ordering *isn't* free — the email needs the record to
exist. Both outcomes are wrong; they aren't equally wrong. *Complete with no email*
is silent: Yuta's queue says delivered, the customer hears nothing, and nobody
learns otherwise until a complaint arrives. *Not-complete with a stray link* is
visible: the row still sits in his approval queue, and the link either works or
404s harmlessly. Choose the loud failure.

#### What each stage keeps

| # | Stage | Point of no return | Fails before it | Fails after it |
| --- | --- | --- | --- | --- |
| 1 | Details submitted | ⑥ the code leaves our hands | **scrub** — row, session and code go; the customer retries clean | keep — they may be holding a code |
| 2 | Email verified | *none — nothing leaves* | scrub, **except the spent attempt** | — |
| 3 | Files attached | ② the bytes land in storage | nothing written yet | **repair forward** — record the file; never silently orphan bytes |
| 4 | Payment clears | ① **the card is charged** | nothing written yet | **keep everything.** The charge is real and ours to honour |
| 5 | Coach assigned | *none — internal only* | scrub | — |
| 6 | Originals translated | *none — a status only* | scrub freely | — |
| 7 | Translations uploaded | ① the bytes land | nothing written yet | repair forward |
| 8 | Handed to the coach | ④ the coach's email leaves | scrub — including the recorded language choice | keep — and a retry must **not** re-send |
| 9 | Coach downloads | ① the bytes left our server | — | keep the stamp; the status can catch up |
| 10 | Coach delivers | ① the response file lands | nothing written yet | repair forward |
| 11 | Response translated | *none — a status only* | scrub freely | — |
| 12 | Translation uploaded | ① the bytes land | nothing written yet | repair forward |
| 13 | Approved &amp; sent | ④ the customer's email leaves | **scrub the completion stamp** | keep — they have the link |
| 14 | Customer downloads | ① the bytes left our server | — | keep the stamp **and** the clock it started |
| 15 | Resolved | ② the thank-you leaves | scrub the stamp | keep |
| 16 | Deletion warning | ① the warning leaves | scrub | **keep the stamp**, or it sends twice |
| 17 | Files purged | ① the first byte is deleted | — | **forward only.** Deletion has no undo, and the stamp must survive so a re-run doesn't re-attempt |

**Read the "none" rows as good news.** Five stages have no point of no return at
all — they move a status and nothing else — which makes them trivially safe to
retry. That's not an accident of implementation; it's what "off-platform" and
"internal only" mean.

**Step 2's exception is the one thing here that isn't about the outside world.**
The attempt counter is a **ratchet**: it increments before the comparison, so
abandoning a request still spends one, and a failure must never hand it back.
Nothing external changed — but rolling it back would turn five guesses into
unlimited ones. Abuse counters are the one category where "only we believe it" is
still a reason to keep it.

**Steps 3, 7, 10 and 12 fail in the opposite direction from everything else.** The
bytes reach storage before the row exists, so a failure leaves the *world ahead of
the record* rather than behind it. There is nothing to undo — the repair is to
finish writing the row, and the thing to avoid is a cleanup that deletes files a
customer successfully sent.

⚠️ **None of this is enforced today.** Every stage is a bare `try/catch` and the
dispositions above are aspirations. The cheapest first move is stage 1, which is
the only one whose residue a customer can currently collide with.

### Stage 1 — full audit of what must be satisfied

*The one stage worked all the way down, as the pattern for the rest. Unlike the
table above, this section reads the **code as it stands** — it's the measurement,
not the target. Layer 5 is where the two diverge.*

**1 · What the customer must supply** — `submissionInputSchema`

| Field | Required | Rule | Note |
| --- | --- | --- | --- |
| `customerEmail` | **yes** | trimmed → lowercased → valid address → ≤ 254 chars | Normalised **before** validating, not after. A mobile keyboard's trailing space would otherwise fail a valid address |
| `playerName` | **yes** | trimmed, 1 – 120 chars | |
| `playerAge` | no | `""` counts as absent; otherwise a whole number 4 – 99 | A supplied-but-implausible age is an error, not silently dropped — the coach pitches feedback by it |
| `focus` | no | `""` counts as absent; otherwise one of the five `FOCUS_OPTIONS` | |
| `customerNotes` | no | trimmed, ≤ 500 chars | |

**2 · Checked in the browser** — courtesy, not a boundary

React Hook Form runs the *same* schema via `zodResolver`, on blur rather than
per-keystroke, and the submit button is disabled while in flight. None of it is
trusted; the server re-validates with the identical object.

**3 · What must *succeed* on the server**, in order — `startSubmissionAction`

Distinct from *Viable when*: those are conditions that hold **before** the trigger,
these are steps that run **after** it and can each abort the action.

1. per-IP rate limit — 10 attempts per 10 minutes
2. `parseSubmissionInput` — the schema above; first failure returned as one sentence
3. *(side effects, not gates)* previous unpaid attempt discarded; abandoned ones swept
4. `createSubmission` must succeed
5. `setFlowSession` must succeed — signs `bs_flow`
6. `issueCode` must return a code

**4 · What the environment must provide**

| | Needed for | If missing |
| --- | --- | --- |
| `AUTH_SECRET` | signing `bs_flow` | throws — the customer sees a generic failure |
| database | `createSubmission`, `issueCode` | throws |
| `RESEND_API_KEY` | delivering the code | ⚠️ **nothing fails** — see below |

**5 · What is *not* checked — the gaps**

1. ⚠️ **Delivery is not a criterion.** `sendCode` returns `true` as soon as
   `issueCode` has stored the hash; `sendVerificationCode` is best-effort
   (ADR 004) and swallows its own failures. So with `RESEND_API_KEY` unset, or a
   Resend domain that isn't verified, **the customer advances to step 2 and waits
   for a code that will never arrive — with no error shown.** Everywhere else
   best-effort email is honest degradation; here it degrades into a dead end,
   because the customer is *blocked* on the message. This is the biggest gap at
   stage 1.
2. **Nothing proves the address exists.** Stage 1 only checks shape — proving
   reachability is exactly what stage 2 is for.
3. **The rate limit is a speed bump, not a wall.** It lives in one serverless
   instance's memory, so a caller spread across instances gets roughly
   `limit × instances`, and a cold start resets the window. `shared/lib/rateLimit`
   is candid about this.
4. **No duplicate or abuse check.** The same address can open unlimited
   submissions, bounded only by that rate limit.
5. **No bot check.** The front door takes no session and no challenge — by
   design, but worth stating plainly rather than discovering.

### Reading notes

Seven rows behave unlike the others:

- **There is exactly one clock, and it runs the whole flow.** A **30-minute
  sliding** window opened at step 1 governs the code, the uploads and the payment
  alike — the code does not expire separately, and a resend inherits what's left
  rather than starting fresh. Sliding rather than a hard cap so that a slow upload
  on bad wifi isn't cut off mid-transfer; the window only runs out on genuine
  inactivity.

- **Step 3 has no button and no status change.** Choosing a file *is* the
  commitment — uploads fire per card, independently, which is why one card can
  fail without taking the others with it.
- **Step 4 has three triggers racing** — the inline confirm, the 3-D Secure
  return, and the webhook — all converging on an idempotent write (ADR 003).
  That's why a customer closing the tab mid-redirect still gets fulfilled.
- **Steps 6, 7, 11 and 12 are optional and off-platform.** They keep whole
  numbers so the spine reads 1 → 17, but a submission whose coach reads English goes
  straight from **5 → 8** and from **10 → 13**. Skipping them changes nothing about
  the stages either side.
- **Assignment comes before translation, and that ordering is load-bearing.**
  Translation need is derived from the coach, so the coach must be known first —
  and translating for someone who then isn't assigned is money spent for nothing.
- **Steps 9 and 14 are the same stage twice, at opposite ends.** A download is
  confirmed, a status or clock moves, and Yuta is told. One closes the hand-off to
  the coach; the other closes the delivery to the customer. Building either one
  should build both — they want the same mechanism.
- **Steps 8 and 13 are the only rows where a human curates content, and both sit
  on a *send*.** The radio can't live on assignment — at that point the translation
  doesn't exist yet — so it belongs at the moment the files actually go to someone.
  Same shape both times: choose the language set, record what was chosen, send only
  that. "What did we actually send" outlives the click.
- **Step 10 stamps nothing on the clock.** The response is stored but nothing is
  marked complete, so unapproved work can't start a countdown. Step 13 owns that.
- **Every row from 4 onward moves the status, and every status is stamped.** The
  ladder is a path with branches, not a progress bar — four of the sixteen rungs
  are only touched when a submission needs translating.
- **Steps 14, 16 and 17 are the only rows whose timing the customer controls.**
  The retention clock starts when they collect, not when we deliver — so a
  customer who never downloads is never purged.

### The line that matters: step 4

**Before payment a submission is a scratch pad; after it, it's a record.** That
one sentence explains most of the rest:

- `isPaid()` is the guard on every destructive path, and it's true from `new`
  onward — **including `awaiting_approval`**, which is why it's a
  `Record<SubmissionStatus, boolean>` and not a hand-kept list;
- anything before step 4 is binned by `discardUnpaidSubmission` on a refresh,
  once the idle window lapses, or on "Start over" — `submissionFiles` rows and
  bytes together;
- `listSubmissions` and `findByCustomerEmail` both exclude the pre-payment
  states, so nothing before step 4 reaches Yuta's queue or the customer's status
  lookup;
- step 4 is also where the work changes hands, customer → Yuta. Those two facts
  landing on the same row isn't a coincidence.

### The abandonment path

Most submissions that start never reach step 4, and that's expected:

```
draft / awaiting_payment  ──►  discardUnpaidSubmission — row AND bytes, nothing kept
                                ▲
                                ├── refresh or a new tab (resolveFlowState never resumes)
                                ├── the 30-min sliding window lapses *(today: 10)*
                                ├── five wrong verification guesses *(today: not a scrub)*
                                ├── "Start over" → startAnotherAction
                                └── sweepAbandoned, from the cron *and* from
                                    startSubmissionAction — so the flow tidies up
                                    after itself under any real traffic
```

`discardUnpaidSubmission` refuses anything where `isPaid()` is true, and that
check lives inside the function rather than in its callers — every caller is a
place a customer may just have been charged.

**Every one of those routes ends the same way: back at step 1.** That's what makes
them one rule rather than five behaviours. The customer is told which one happened;
what they see next is always the empty form.

### The one thing that is *not* a stage

The status ladder now covers everything that happens *to* a submission, so this
list has shrunk to a single entry — and the reason it survives is the useful part.

| Field | Means | Set by | Reversible |
| --- | --- | --- | --- |
| `archivedAt` | out of Yuta's active queue; still a real submission | `archiveSubmissionAction` / `unarchiveSubmissionAction` | yes |

**Archiving isn't a status because it's orthogonal to every status.** A submission
can be archived while `complete`, or `collected`, or `purged` — it's a statement
about Yuta's attention, not about where the work has got to. Anything that can be
true *alongside* the ladder rather than *at a point on it* belongs here.

That's the test for anything proposed as a new status later: **if it can coexist
with the state you're already in, it isn't a rung.**

### Open questions — the decisions the northstar hasn't made

**These are not the gaps.** Anything agreed but unbuilt is marked *(not built)* in
the table above; it needs building, not discussing. What follows is the smaller,
harder set: **places where nobody could build the thing even with unlimited time,
because we haven't decided what right looks like.**

**There are none right now.** Fifteen have been answered, the last of them on
2026-08-01, and the pipeline is decided end to end. That is a real state and worth
saying plainly rather than manufacturing doubt to fill the section — but it is also
a *moment*, not a property. Every previous round of answers produced the next
question; the next one will come from building, which is where the remaining
disagreement lives.

**What to do instead of reading this section:** the `(not built)` markers in the
table are now the whole backlog, sequenced in
[`docs/design/rollout.md`](../../../docs/design/rollout.md), and the point-of-no-return
table is the specification for how each stage handles failure.

⚠️ **Two things shipped on 2026-08-01 that contradict decisions made here**, both
because they predate the decision rather than defy it. They're recorded in the
rollout plan and resolved in its Phase 6:

- `retentionSweep.ts` and the feedback token both state that **the coach's response
  is never swept**. The settled answer is that everything is swept together at step
  17 — safe only because the clock starts on collection.
- **`submissionFiles.kind` is `submission` / `feedback`**, while the status names
  settled here are `intake_*` / `response_*`. Two vocabularies for one pair of
  concepts. The rollout plan recommends keeping the shipped column names and
  renaming the statuses to match, before the migration writes them.

---

**Settled on 2026-08-01:**

| | Question | Decision |
| --- | --- | --- |
| **Retention** | when do we delete files a customer never collects? | **90 days from step 13**, or 30 from collection — whichever is later. And the ⑥ email states the window up front |
| **Resolving** | should it fire automatically on collection? | **No — it stays manual.** Step 14's `collected` status makes the pending work filterable, which was the real need |
| **Declined card** | does a failed payment buy more time? | **Yes** — extend the window and email a way back in |
| **Language radio** | what does it offer when only one language exists? | offers only sets that exist; **disappears** when there's nothing to choose |
| **Translations** | replace the original, or sit beside it? | **Beside.** Four folders, both directions |
| **Sweeping** | do translations follow the originals' clock? | **Everything is swept together** — no set outlives another |
| **Statuses** | is "the coach has it" a status or a timestamp? | **Both, for all of them.** See the status ladder — sixteen statuses, each stamped |
| **Undo** | what is allowed to be reversed? | **One general handle, not per-stage undo:** Yuta can purge folders and reset a status. See the operator-override path |
| **Identity** | PIN, link, or both — and does the link expire? | **Both.** The link doesn't expire but can be revoked |
| **Translation** | should the system know in advance that one is needed? | **Yes — derive it** from the coach's languages and the customer's. Steps 5 and 11 become prompts, not memory |
| **Failure** | when a step dies partway, is the earlier work undone? | **Case by case, and the case is decidable.** See *the point of no return* — an operation survives if its effect already exists outside our database |
| **Status names** | are the sixteen right? | **Yes, approved** — `intake_*` for what the customer sent, `response_*` for what the coach wrote |
| **Timestamps** | sixteen columns, or an events table? | **`submission_events`.** One row per transition — *more* history than columns can hold, not less |
| **Customer language** | does step 1 ask for it? | **No.** The platform is English, so it's presumed — translation need is a property of the coach alone |
| **Ordering** | assign before translating, or after? | **Assign first.** Translation need is derived from the coach, so the coach must be known — and the language radio moves to step 8 with it |

**Decided earlier, and worth not relitigating:**

- **Step 1's silent send** was never a question — the northstar already requires the
  code to be confirmed accepted before the customer advances. Alongside it, **step 2
  tells the customer to check their spam folder**.
- **Step 10 emails Yuta and the coach.**
- **Step 9 closed the oldest question on this list** — "`in_review` means the coach
  has been told, not that the coach has started". The coach's first download is that
  missing event.

## 3 · Where we are now — 2026-08-02

**The queue shows progress at the resolution of the path doc** — a sixteen-dot
rail per row with the current rung named above it, and the stage's chain as a
checklist that greys out as each line is met.

- ✅ **`model/stageChain.ts`** — what has to happen *within* a rung. Every line
  carries its own `met` predicate, so nothing is a flag a human ticks; each asks
  the row, the files, or the trail. That constrains what can be listed, which is
  the point.
- ✅ **Passive lines never hold the pointer.** Yuta translating on his laptop
  can't be observed, so treating it as a gate left a row showing nothing to do
  while an upload was plainly outstanding.
- ✅ **The control lives on the outstanding line**, not in a button bar. A bar
  makes you read the status, infer what it implies, then find the matching
  button; here the thing you read and the thing you press are the same thing.
- ✅ **The trail records sends, not just moves** — `submission_events.kind` is
  `status` or `email`, with `ok` for whether it landed. Sends are best-effort, so
  a progress view built on the old trail could only say "the status implies we
  tried".

### 🔴 The bug this surfaced, which was live on `main`

`listSubmissions` — the admin queue's only read — filtered on a **hardcoded list
of five statuses**, written when the ladder had seven rungs. When the ladder grew
to sixteen it silently stopped matching, and **every submission from
`sent_to_coach` onward disappeared from the queue**: all four translation rungs,
plus `collected`, `resolved`, `purge_imminent` and `purged`. Nothing failed. The
rows just weren't there.

It is precisely the failure the retention sweep had, and the same rule fixes it:
**a question about the ladder is a predicate, never a list.** It now derives from
`PAID_STATUSES`.

Worth noting *how* it was found — not by review, but by rendering the page and
counting rungs against the database. The literal-list hazard is invisible to the
compiler by construction.

---

## Where we were — 2026-08-01 (evening)

**The whole pipeline is built.** Phases 1–6 of
[the rollout](../../../docs/design/rollout.md) landed today; every stage in §2 has
code behind it, and the `(not built)` markers in the table are being cleared as
each is verified. What remains is Phase 0 — live Stripe keys, clearing the Basic
Auth gate, and real coach content — which is operations rather than code.

Verified end to end in probes rather than by inspection: all sixteen rungs walk,
both collection stamps refuse to fire early and refuse to fire twice, and the
retention sweep purges collected-and-old and never-collected-but-past-the-backstop
while leaving collected-recently (warned) and just-delivered alone.

**Two departures from ADR 004 worth remembering**, because both look like bugs
until you know why: the verification code fails the flow when it can't be sent
(the customer is blocked on it), and the deletion warning is stamped even when the
send fails (retrying nightly would turn one missed email into seven).

### Phase 1 — the ladder and the trail

**Phase 1 of the rollout landed today** — the ladder, the trail, and the four
folders' foundation. What that means in this slice:

- ✅ **Sixteen statuses**, in ladder order, enforced by the `submission_status`
  enum (migration `0008`). The enum's own ordering matches the ladder's, so
  `ORDER BY status` means "how far along" without a lookup table.
- ✅ **`submission_events`** — one row per transition, written inside the same
  transaction as the update that caused it. `listSubmissionEvents` reads a
  submission's history oldest-first, with the operator who caused each move.
- ✅ **`updateSubmission` is the one place a transition is stamped.** It reads the
  previous status first, so setting the same value twice — a redelivered webhook,
  a double-clicked button — writes no second event.
- ✅ **Four file kinds** (`intake` · `intake_translation` · `response` ·
  `response_translation`), now a DB enum rather than free text. Reads scope by
  *side* (`INTAKE_KINDS` / `RESPONSE_KINDS`), because "the customer's files" means
  the originals **and** their translation.
- ✅ **Four derived predicates**, each an exhaustive `Record`: `isPaid`,
  `hasResponse`, `isReleased`, `isWithCoach`.

**The predicates are the part worth understanding.** Thirteen call sites asked
"may the customer see this?" by writing `status === "complete"`. That was true
until `collected` existed — and then it becomes false *the moment a customer
downloads*, revoking their own access by using it. No type error, no test failure,
nothing to notice. `isReleased` is the fix, and the general rule it carries:
**a question about the ladder is a predicate, never a comparison.**

- 🔶 **Actors are recorded only where a session exists.** Admin and coach
  transitions carry `actorId`; the customer's four steps and the cron write null,
  which is correct — neither is logged in.
- ❌ **Nothing reads the trail yet.** `listSubmissionEvents` is built and exported;
  no UI shows a submission's history. That arrives with the operator override in
  Phase 5, which is the first feature that needs it.

---

- ✅ **On Postgres via Drizzle.** `Submission`, `NewSubmission`, `SubmissionPatch`, the
  `submission_status`/`focus` enums, and the `api/submissionRow.ts` mapper.
- ✅ **The queries** — create, update, get, finders (by payment id, by email, by coach) and
  `listSubmissions` for the admin queue.
- ✅ **The status lookup** — `/status` → `POST /api/status` → sanitized `PublicSubmission`
  list, rate limited. Exposes the row `id` (so the customer can hit their own feedback
  download) and `hasFeedback`, and nothing internal.
- ✅ **Zod schemas**, shared by the form and the route, with per-field errors in the UI.
- 🔶 **The rate limit is per-instance.** Five per minute per IP, held in one serverless
  instance's memory — so a caller spread across instances gets more, and a cold start resets
  the window. It stops a script in a loop, which is the realistic threat here; it does not
  stop a distributed one. Shared state (Upstash Redis) is the honest fix and is a scope
  decision for Ben, since it's a new third-party service. See `shared/lib/rateLimit.ts`.
- ✅ **`assignedCoachId` is a real FK** to `coaches` — set from the admin portal.
- ✅ **`submissionFiles`** — one row per uploaded file, replacing the single `videoUrl`.
  `listFilesForSubmissions` fetches a whole portal page in one query rather than one per row.
- ✅ **The flow cookie** (`api/flowSession.ts`) — a signed, httpOnly capability naming the
  one submission a browser started. It is what the upload gate checks now that payment no
  longer comes first. **Ten minutes, sliding**: every action re-issues it, so the clock
  measures idleness. An absolute ten minutes would expire people mid-upload, which on a slow
  connection means losing a 50 MB file at 99%.
- ✅ **A cold page load starts fresh.** `resolveFlowState` resumes *only* a paid submission
  (to show its confirmation); anything unpaid returns an empty step 1. Refresh, a new tab,
  and an expired cookie all mean a new attempt.
- ✅ **Drafts are hidden from both readers.** `listSubmissions` (the admin queue) and
  `findByCustomerEmail` (the status lookup) both exclude `draft`: an abandoned first step is
  noise in a work queue and alarming in a customer's list.
- ⚠️ **`deleteSubmission` has no guard of its own.** The "never delete something paid for"
  check lives one level up, in `discardUnpaidSubmission`, which is the only thing that should
  call it. Calling this directly would be a way to destroy a paid customer's record.
- 🔶 **`findSweepable` is the one query written for a job rather than a screen.** It encodes
  the two retention rules, which means the rules are expressed in SQL here and in prose in
  [ADR 012](../../../docs/decisions/012-retention-and-operator-settings.md). Keep them in
  step.

---

## 4 · Where we came from

**2026-07-30 (later) · Only payment earns retention.** Yuta's rule: until the money clears,
a submission is fair game to scrub. So the flow session dropped from six hours to **ten
sliding minutes**, a cold page load no longer resumes an unpaid submission, and
`startSubmissionAction` **discards and recreates** rather than editing in place.

That last one deleted code rather than adding it: `updateDraftDetails` existed to clear the
verification when a customer changed their email, and a submission that is always freshly
created is unverified by construction. The invariant became structural instead of remembered.

**2026-07-30 · The flow inverted** ([ADR 009](../../../docs/decisions/009-upload-before-payment.md)).
The submission is no longer born paid, which changed what this slice means.

- **Created at step 1, not at payment.** `createSubmission` defaults to `draft`; the row
  exists before we know whether the email is real or the money will arrive.
- **`awaiting_upload` retired.** Files arrive before payment, so "paid, awaiting a file"
  cannot occur. `draft` → `awaiting_payment` → `new` replaced it, and the migration maps the
  old value onto `draft`.
- **`videoUrl` became a table.** A submission carries several files now; the column could
  hold one locator.
- **New timestamps** — `emailVerifiedAt`, `paidAt`, `completedAt`, `filesPurgedAt`. Each
  exists because something now asks "when did that happen", and inferring it from `status`
  plus `updatedAt` would have been a guess.
- **`updateDraftDetails` is separate from `updateSubmission`** because editing the details
  must *clear* the verification. A customer who changes their email after verifying has not
  proven the new one, and a generic patch would have left the old flag standing.

**2026-07-29 · Postgres + storage cutover** ([ADR 007](../../../docs/decisions/007-portal-and-postgres-retire-airtable.md)).
The domain moved off Airtable onto Postgres/Drizzle. The Airtable codec
(`submissionSchema.ts`) and its column-name registry were replaced by a thin
`submissionRow.ts` mapper — the DB schema now owns the names. Status values became a
lowercase Postgres enum; the Mux id columns became `videoUrl`/`feedbackUrl` storage
locators; `Assigned Coach` (text) became `assignedCoachId` (FK). Client components stopped
importing the barrel (which now pulls the Postgres client) and import the model directly.
Everything below is the Airtable era, kept as the trail.


**2026-07-28 · Step 1 — the naming sweep.** Column names used to be bare string literals in
six files, and one concept carried three names: the coaching focus was `focus` in code,
`Sport` in Airtable (holding `"Hitting"`), and `Skill Focus` in the spec. A rename in the
base broke the app silently, in six places. The codec was built to make that impossible.

Decisions taken, with their reasoning:

- **`Sport` → `Focus`.** The column never held a sport. Nobody reading Yuta's base could
  tell what it meant.
- **Kept five focus values, standardized on `Hitting`** over CLAUDE.md's `Batting`. The
  existing data, the coach bios, and the FAQ copy all said Hitting; changing the word would
  have meant migrating rows *and* editing marketing copy to satisfy a spec written before
  either existed. The spec was amended instead.
- **`Notes` split into `Customer Notes` + `Internal Notes`.** One column had been holding
  both what the parent wrote and `[system]` error messages appended by the Mux handler, so
  nothing could be forwarded to a coach without hand-cleaning first. *(PRINCIPLES #2 — one
  home per fact; two facts had been sharing one.)*
- **`Created At` → `Submitted At`, as an Airtable created-time field.** It had been an
  app-written string sitting in an editable cell, and the status lookup sorts on it — one
  stray edit from broken ordering. Now it can't be edited at all.
- **Status 3 → 5.** Without `New` and `Assigned`, Yuta couldn't distinguish "needs a coach"
  from "a coach has it" — which is the queue he actually works from.
- **Column names, not Airtable field IDs.** Field IDs would survive a rename in the UI, but
  `fld7Kd2mQ` is unreadable and IDs differ between the dev and production bases. Chose
  readability plus a single declaration site; the tradeoff is that a rename in Airtable needs
  a matching one-line code change, which OPERATIONS.md warns the client about.
- **`Stripe Session ID` → `Stripe Payment ID`** — named for the *role*, not the Stripe
  object, so the pending Elements rebuild changes what it holds without another migration of
  the client's live base. *(See [ADR 005](../../../docs/decisions/005-stripe-elements-over-checkout.md).)*

**2026-07-28 · Step 3 — Zod and the rate limit.** The hand-rolled validator went; the schema
is now one object both sides import. Writing the check suite caught a bug that would have
shipped: `z.email()` runs *before* a trailing `.transform()`, so trimming there meant
`"alex@x.com "` — what a mobile keyboard produces after autocomplete — was rejected as
invalid. Fixed by normalizing first (`.trim().toLowerCase().pipe(z.email())`), and the
regression is now a named assertion.

React Hook Form came with it, per CLAUDE.md §4's locked stack. It earns its place beyond the
spec: the form previously had no client-side validation at all beyond browser defaults, so
every mistake cost a server round-trip to discover. Fields now show their own errors on blur
— not on keystroke, since flagging a half-typed email is hostile.

**2026-07-28 · Step 2b — the routes got thin.** The status route had been holding the
`PublicSubmission` type and its projection inline. That put "what is safe to show a stranger"
in the app layer, where it read as serialization rather than as the security decision it is.
Moved to `model/publicSubmission.ts`, and the route now calls `lookupPublicSubmissions()`.
The email-validation regex was also duplicated between the route and `submissionInput.ts` —
two copies of one question, free to drift into accepting different things. Now one
`isValidEmail`.

**2026-07-28 · Step 2 — domain-first.** The slice moved here from three separate homes:
`src/types/submission.ts` (the type), `src/integrations/airtable/` (schema + queries), and
`src/lib/submission-input.ts` (validation), with `StatusLookup` lifted out of
`src/app/status/status-form.tsx`. Four folders became one. `AirtableRecord` went the other
way — down to `shared/airtable/`, because the raw record shape is true of any table
(PRINCIPLES #5), and `shared/` importing a domain would have inverted the dependency.
