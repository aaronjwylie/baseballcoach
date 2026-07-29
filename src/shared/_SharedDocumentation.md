# shared — `src/shared/`

The **domain-less floor.** Everything here is true regardless of what business this app is
in. Nothing here knows what a Submission is.

---

## 1 · The northstar

`shared/` holds the things a *different* product could use unchanged: an HTTP transport, a
button, an env loader. The test for whether something belongs here is not "is it used
twice?" but **"is it still true if the domain changes?"**

```
shared/
  airtable/   the REST transport — create/update/get/query any table
  stripe/     the SDK singleton
  mux/        the SDK singleton
  email/      the Resend transport + the brand shell every message wears
  lib/        rateLimit — the domain-less request throttle
  ui/         Button · ButtonLink · Container · Field · Pill
  layout/     SiteHeader · SiteFooter · Logo
  config/     env (the only process.env reader) · site (brand facts)
```

### The invariants

- **`shared/` never imports a domain.** Not once, in either direction of convenience. If
  something here needs to know what a Submission is, it isn't shared — it's a domain's `api/`.
  *(This was violated during Step 2 and caught by the check below.)*
- **Every `process.env` read lives in `config/env.ts`.** Required values throw at point of
  use with a message naming the variable, so a misconfiguration is a clear error rather than
  `undefined` propagating into an API call.
- **`env` uses lazy getters, not eager parsing.** CLAUDE.md §6 specifies a Zod schema parsed
  at import. That would fail every build in an environment without production secrets —
  including Vercel preview builds and CI. Lazy reads fail at the point of use, where the
  error is also more useful. **This is a deliberate deviation from the spec.**
- **`email/` owns the shell, not the messages.** The three transactional emails are
  genuinely different and live in their domains; what they share — header, type scale, CTA,
  footer — is written once here. *(PRINCIPLES #8.)*
- **`layout/` is domain-less on purpose.** Header and footer link to routes but know nothing
  about what happens on them. If they ever needed to, they'd stop being shared and become a
  widget layer — which this codebase deliberately doesn't have yet.

---

## 2 · Where we are now — 2026-07-28

- ✅ **Four service seams** (airtable · stripe · mux · email), each wrapping one SDK or API.
- ✅ **Five UI primitives**, with `Button` and `ButtonLink` sharing one style module so they
  can't drift.
- ✅ **`config/env.ts`** — the only `process.env` reader.
- ✅ **`config/site.ts`** — brand facts used by landing, emails, and checkout alike.
- 🔶 **`lib/rateLimit.ts` is in-memory and therefore partial.** State lives in one serverless
  instance, so the effective limit scales with instance count and resets on a cold start.
  Documented in the module itself rather than papered over — it's a real speed bump against
  a script in a loop and nothing more. Upstash Redis is the upgrade, and a scope decision.
- 🔶 **No shadcn/ui.** CLAUDE.md §4 specifies it; these are hand-rolled. Deferred until the
  wireframe lands, since the design will decide whether shadcn's primitives fit.
- 🔶 **No React Email.** CLAUDE.md §4 specifies it; `email/shell.ts` builds HTML strings.
  Works and has no dependency cost, but templates are harder to preview and edit.
- 🔶 **Design tokens are provisional.** `app/globals.css` carries the warm-neutral/blue set
  taken from the reference wireframe (2026-07-29), replacing an invented navy/rose. Audrey's
  approved design supersedes it. `email/shell.ts` mirrors the same hex values by hand, since
  email can't read CSS variables — change one, change the other.

---

## 3 · Where we came from

**Before 2026-07-28**, this was `src/lib/` (eight unrelated modules — env, site, stripe, mux,
email, fulfillment, submission-input, airtable) and `src/components/` (four). The two folders
were grouped by *tech role*: `lib` meant "not a component," which is a statement about what a
file *isn't*.

Step 2 split them by the question above. Roughly half of `lib/` turned out to be domain code
in disguise — `fulfillment` went to payment, `submission-input` to submission — and only the
genuinely domain-less remainder stayed.

Decisions taken, with their reasoning:

- **`AirtableRecord` moved down into `shared/airtable/` (Step 2).** It had been declared in
  the submission codec, which meant `shared/airtable/client.ts` imported *up* into a domain
  to type its own return values — a dependency inversion caught by the invariant check
  during the move. The raw record shape is true of any Airtable table, so it belongs on the
  floor. *(PRINCIPLES #5.)*
- **`ui.tsx` split into one file per primitive**, with the shared button styling extracted to
  `buttonStyles.ts` rather than duplicated. `Button` and `ButtonLink` render different
  elements for different reasons but are one control to the eye; the shared part is written
  once. *(PRINCIPLES #8.)*
- **`rateLimit` put in `shared/lib/`, not in the submission domain (Step 3).** Throttling a
  request is true of any endpoint — it knows nothing about submissions. Only the *policy*
  (five per minute, keyed on `status:`) lives with the route that sets it. *(PRINCIPLES #5.)*
- **`Field` gained an `error` prop (Step 3)**, replacing the hint rather than stacking under
  it — two lines of small text under one input is noise, and the error is the more urgent.
- **`Field` and `inputClass` promoted here from the start form (Step 2).** Two forms already
  used the same input styling by copy-paste, which is exactly the drift PRINCIPLES #2 exists
  to stop.
- **Lazy env getters kept over CLAUDE.md's eager Zod parse** (original build). Flagged in
  the invariants above rather than silently reconciled — it's a real deviation from the spec,
  made for a real reason.
