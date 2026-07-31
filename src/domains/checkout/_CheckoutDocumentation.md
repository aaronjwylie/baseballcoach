# checkout — `src/domains/checkout/`

The **checkout slice** — the four-step path a customer walks from "I want
feedback" to "you've been charged".

---

## 1 · The northstar

It owns the **sequence**, not the steps.

| # | Step | Panel lives in | Because |
|---|---|---|---|
| 1 | Player details | `domains/submission/ui/PlayerInfoForm` | it collects a Submission |
| 2 | Verify email | `domains/verification/ui/VerifyPanel` | it proves an address |
| 3 | Upload files | `domains/upload/ui/UploadPanel` | it moves bytes |
| 4 | Payment | `domains/payment/ui/PaymentPanel` | it charges a card |

This slice puts them in order, decides where a returning customer resumes, and
holds the verbs that move between them. That is why it depends on four domains
and **nothing depends on it** — it's the composition root for the customer flow,
the way `app/` is for a page.

### The invariants

- **One route, four steps.** The steps don't get their own URLs. ADR 005 chose
  Elements so payment feels like part of the product rather than an errand; a
  full page navigation between steps reintroduces exactly the seam that bought,
  and the client secret would have to travel through a URL to survive it.
- **The server decides which step you're on.** `resolveFlowState()` reads the
  flow cookie and the submission's own state — never the URL, never client
  storage. This is what makes a refresh, a re-opened tab, and the redirect back
  from 3-D Secure all land where the customer left off.
- **Every action re-derives the submission from the cookie.** None of them takes
  a submission id from the browser, so there is nothing to tamper with.
- **Order is a product decision, made in `model/steps.ts`.** Verification is
  second because everything after it depends on being able to reach the customer;
  payment is last because nobody should pay for a submission whose upload then
  fails ([ADR 009](../../../docs/decisions/009-upload-before-payment.md)).

---

## 2 · Where we are now — 2026-07-30

- ✅ **All four steps built** and walked end to end in a real browser: step 1 → a
  code → two uploads → Stripe Elements showing `Pay CA$80.00`.
- ✅ **Resume works.** Reloading mid-flow returns to the right step with files
  restored; verified by reloading at steps 2 and 3.
- ✅ **Server Actions, not API routes.** The browser needs a typed answer, not an
  HTTP contract, and every verb reads the flow cookie anyway. Only the things
  that genuinely need HTTP stayed as routes: raw upload bodies, the Blob token
  handshake, Stripe's webhook, and the redirect return.
- ✅ **No effect on mount.** The 3-D Secure return trip is confirmed server-side
  in `/api/payment/return`, which then forwards to `/start`. An earlier version
  did it in a `useEffect` and set state on mount; that's slower, and React's own
  lint rule rejects it.
- 🔶 **`done` is a resume state, not a step.** It has no indicator position, but
  a paid submission has to be somewhere the flow can be *loaded into* after a
  redirect — hence `FlowStep = CheckoutStep | "done"`.
- 🔶 **The flow cookie deliberately survives payment.** It's what lets the
  confirmation name the player and count the files after a cold page load.
  "Send another video" is what lets go of it.
- 🔶 **No abandoned-cart email.** A customer who stops at step 3 hears nothing;
  their files are swept after 24h. Worth revisiting once there's volume.

---

## 3 · Where we came from

**Before 2026-07-30** the flow was two steps — player info, then payment — held
in `domains/payment/ui/SubmitFlow.tsx`, with upload on a separate `/upload` page
reached after checkout.

- **Payment moved last** ([ADR 009](../../../docs/decisions/009-upload-before-payment.md)),
  which is the change everything else follows from.
- **The composition moved out of `payment/`.** A flow spanning four domains
  living inside one of them was already a stretch at two steps; at four it would
  have made `payment` the de-facto owner of the customer journey. A slice whose
  whole job is ordering other slices earned its own folder.
- **`PlayerInfoForm` moved to `submission/ui/`.** It collects a Submission; it
  was only in `payment/` because the flow was.
- **The form stopped submitting itself.** It now takes an `onSubmit`, because the
  parent owns what "continue" means — which is what lets one form serve both the
  first visit and the customer coming back from step 2 to fix a typo.
