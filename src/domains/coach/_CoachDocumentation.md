# coach — `src/domains/coach/`

The **coach domain slice** — the people who review submissions, and the admin verbs for
managing them and assigning work.

---

## 1 · The northstar

A `Coach` is a reviewer's profile (name, specialties, languages, active) **plus a login** —
the `coaches` row is keyed to a `users` row by `userId`. Yuta creates coaches from the admin
portal (there is no self-signup) and assigns each submission to one.

```mermaid
flowchart LR
    ADMIN["admin portal"] -->|"createCoach"| PAIR["users (login) + coaches (profile)"]
    ADMIN -->|"assignCoach"| SUB["Submission.assignedCoachId + status → assigned"]
    COACHUI["coach portal"] -->|"getCoachByUserId(session)"| PAIR
```

### The invariants

- **A coach is two rows, made together.** `createCoach` calls the account domain's
  `createOperator` for the login, then inserts the `coaches` profile — one is useless without
  the other.
- **Both verbs are admin-only**, re-checked with `requireRole("admin")` in the server action,
  never trusted from the UI.
- **Assignment moves the status to `assigned`** — one call, so the queue state and the
  ownership can't disagree.
- **The coach portal finds *its* coach by the session's `userId`**, never by a client-supplied
  id.

### The pieces

- `api/coachApi.ts` — `listCoaches`, `getCoachByUserId`, `createCoach` (the only `coaches`
  reader/writer).
- `api/coachActions.ts` — `createCoachAction`, `assignCoachAction` (server actions).
- `ui/AddCoachForm.tsx` — the admin's add-coach form.
- `model/coach.ts` — `Coach`, `NewCoach`.

---

## 2b · Fixed 2026-08-02

- 🔴 **The hand-off refused translated submissions.** `notifyCoachAction` only
  accepted `assigned`, but a translated intake sits at `intake_translated` — so
  the button appeared, the action returned, and nothing happened. Silently, for
  exactly the submissions that needed translating. Found by simulation, not by
  review.

## 2 · Where we are now — 2026-08-01

**Phases 3–4 of the rollout landed here.**

- ✅ **The hand-off stops at `sent_to_coach`.** Emailing a coach is not the same
  as a coach starting work, and the gap between them is the one place a
  submission stalls on a person outside the building. Yuta can now see it.
- ✅ **`noteCoachCollected`** — the coach's first download earns `in_review` and
  tells Yuta the hand-off closed. Gated on it being **that coach's** submission:
  the download route can only see that *a* coach is logged in, and an admin
  checking on the work must not count as the coach starting it.
  Fire-and-forget and self-swallowing, because it hangs off a route whose real
  job is delivering bytes.
- ✅ **`needsTranslation`** — derived from `coaches.languages`. The platform is
  English, so a submission needs translating exactly when *this* coach doesn't
  read it. **Unknown is not the same as no**: no languages recorded returns
  `null`, and the queue says so, rather than prompting on the strength of a blank
  field until someone fills it in.
- ✅ **The hand-off carries a language choice** (step 8's radio) and records what
  was actually sent. The radio can't live on assignment — at that point the
  translation doesn't exist to choose.
- ✅ **Reassignment is guarded server-side**, not just hidden: a stale tab could
  previously pull a submission out from under a coach who had already been
  emailed it.
- ⚠️ **The derivation does nothing until languages are recorded.** Every coach
  needs their languages filled in from the portal before step 5's prompt appears.


### Before 2026-08-01

- ✅ **Create a coach** from `/admin/coaches` — login + profile, specialties, languages.
- ✅ **Assign a coach** to a submission from the admin queue, moving it to `assigned`.
- ✅ **`getCoachByUserId`** backs the coach portal's "my assigned submissions" view.
- ✅ **Edit a coach** at `/admin/coaches/[id]` — name, specialties, languages, and the
  `isActive` toggle (an inactive coach still shows in the assign dropdown; hiding them there
  is a small follow-up).
- 🔶 **No delete** — a coach can be deactivated but not removed (their assignments would
  orphan). Reassignment is by picking a different coach on the queue.

---

## 3 · Where we came from

**2026-07-29 · Created with the operator portal** ([ADR 007](../../../docs/decisions/007-portal-and-postgres-retire-airtable.md)).
Under Airtable, "Assigned Coach" was a free-text field Yuta typed into and there was no coach
concept in code. The portal made coaches real: a login, a profile, and referential
integrity via `assignedCoachId`.
