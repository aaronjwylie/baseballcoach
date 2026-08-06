"""
The northstar chain, authored as a document.

Deliberately *not* generated from STAGE_CHAIN: the model is the build, and this
is where the build is going. Once it's agreed, this becomes the model and the
table goes back to being generated.

Each substep is (to-do, done, failures, told-on-fail, records, told-on-success).
`†` on a substep means nothing behind it yet.
"""

C, A, K, T = "Customer", "Admin", "Coach", "Translator"
NB = " *(not built)*"


def send(label, to_who, party=A, built=True):
    """The five ways a message dies, and the two rows it writes when it lives."""
    n = "" if built else NB
    return (
        [f"{label} failed", f"{label} bounced — hard", f"{label} bounced — soft",
         f"{label} bounced", f"{label} complained"],
        [f"{party}/portal: “{to_who} never received this — they don’t know they have work.”" + NB],
        [label, f"{label} delivered"],
    )


def status(msg):
    """
    The customer's current state, on the status page. No email.

    **One sentence, overwritten** — not a log (settled 2026-08-03). The page
    answers "where is my submission" for someone who wondered; a scrolling
    history would make them read six lines to learn the one thing they came for.
    The trail already keeps the history, and it is the operator's tool.

    No email for the same reason: nine already reach them, and "your files are
    being translated" is progress they cannot act on.
    """
    return dict(
        todo="Update Client",
        # No opening line and no badge on the name: a status update isn't
        # something anyone waits on, it fires. The other substeps have an
        # opening row because there is a gap between asking and getting.
        instant=True,
        # The sentence itself lives in the two columns that carry it — the trail
        # row and the customer's screen. Repeating it as the substep's name made
        # the label and its own trail row two copies of the same paragraph.
        done="Client Updated",
        planned=True,
        # **A status write can fail, and its failure is silent by construction.**
        # Everything else here announces itself to whoever is standing there;
        # this one leaves the customer reading yesterday's sentence with no sign
        # anything went wrong. So the operator is the one who has to be told, and
        # the stale line has to be named — "it still shows the previous step" is
        # the only way to tell a failed write from a step that hasn't moved.
        failures=["client status update failed — the page still shows the previous line" + NB],
        badsay=[f"{A}/portal: “The client’s status page didn’t update — it still shows the previous step.”" + NB],
        records=[f"client status — “{msg}”" + NB],
        oksay=[f"{C}/status: “{msg}”" + NB],
    )


def step(todo, done, **kw):
    return dict(todo=todo, done=done, **kw)


UPLOAD_REFUSED = [f"{C}/flow: “You can attach up to 5 files.”",
                  f"{C}/flow: “Files must be under 50 MB.”",
                  f"{C}/flow: “That file type isn’t supported.”",
                  f"{C}/flow: “That file is empty.”",
                  f"{C}/flow: “Your session has expired. Please start again.”"]
ATTACHED = lambda kind: [f"files attached — {i} {kind}" + NB for i in range(1, 6)]

# Packing the set into one archive is a convenience — it makes a partial take
# unlikely — but it is not what makes one *knowable*. Only the per-file row does
# that, which is why both exist.
#
def collecting(kind, party, total, label, surface="portal"):
    """
    Every way a collection can go, in full.

    A download has more failure modes than an upload and had almost none of them
    written down: refused, unauthorised, wrong party, storage down, a transfer
    that stopped halfway, an archive too big to build — and the two that only
    time reveals, *nothing taken* and *not all of it taken*.

    Those last two are the point. Every other failure announces itself to
    whoever is standing there; these are silent, and they are the ones that let
    somebody translate three files out of five.

    **The counts are enumerated, not templated.** A submission carries one to
    five files, so "3 of 5" is one of ten things that sentence can say and "all
    5 downloaded" is one of five. Writing the template would hide the same set
    the wrong-code rows were hidden behind before they were spelled out.
    """
    caps = range(1, total + 1)
    # Numerator-major: every “1 of …”, then every “2 of …”. Grouping by how much
    # is *in hand* is how you read the column — a run of “1 of” is one problem,
    # a run of “4 of” is a different one. Grouping by the total buries that.
    partial = [(n, m) for n in caps for m in caps if n < m]
    every = [(n, m) for n in caps for m in caps if n <= m]
    return dict(
        failures=[
            f"{kind} fetch refused — 410, the folder was swept",
            f"{kind} fetch refused — 401, the session had expired" + NB,
            f"{kind} fetch refused — 403, a different party asked" + NB,
            f"{kind} fetch failed — storage unreachable" + NB,
            f"{kind} fetch stopped partway" + NB,
            f"{kind} pack build failed — too large to archive" + NB,
            f"{kind} never collected — 48h after hand-off" + NB,
        ] + [f"{kind} still incomplete — {n} of {m}, 48h after hand-off" + NB for n, m in partial],
        badsay=[
            f"{party}/{surface}: “That file is no longer available.”",
            f"{party}/{surface}: “Your session has expired. Please sign in again.”" + NB,
            f"{party}/{surface}: “This submission isn’t assigned to you.”" + NB,
            f"{party}/{surface}: “We couldn’t reach storage. Please try again in a moment.”" + NB,
            f"{party}/{surface}: “That download didn’t finish — try it again.”" + NB,
            f"{party}/{surface}: “We couldn’t build the archive. Download the files individually.”" + NB,
            f"{A}/portal: “{label} hasn’t collected anything, 48h after hand-off.”" + NB,
        ] + [f"{A}/portal: “{label} has {n} of {m} files.”" + NB for n, m in partial],
        records=[f"{kind} collected — {n} of {m}" + NB for n, m in every]
                + [f"{kind} collected in one pack" + NB],
        oksay=[
            f"{party}/{surface}: the file downloads",
            f"{party}/{surface}: “Your file downloaded — you have the complete set.”" + NB,
        ] + [f"{party}/{surface}: “All {m} files downloaded — you have the complete set.”" + NB
             for m in range(2, total + 1)]
        + [f"{A}/portal: “{label} has started — first file collected.”" + NB,
           f"{A}/portal: “{label} has the complete set.”" + NB],
    )


def assigning(scope, role, missing, idname, also=None):
    """
    Choosing who does a piece of work — coach or translator, one helper.

    **More than one is normal in both cases**, and the row carries the id rather
    than a position. "assigned — 1, 2, 3" answers *how many* and nothing else;
    the id answers *who*, and a fourth assignment needs no new row shape. One
    row per assignment, one per removal, and the count is however many you can
    see.

    Note what this asks of the schema: `assignedCoachId` is a single column and
    cannot hold two. The northstar wants a join, the way file kinds already do.
    """
    extra = [f"{A}/portal: “{also}”" + NB] if also else []
    return dict(
        failures=[
            f"{scope} already assigned — reassignment refused" + NB,
            f"{scope} assignment failed — {missing}" + NB,
        ],
        badsay=[
            f"{A}/portal: “This has already gone to a {role}. Reload to see where it is.”" + NB,
            f"{A}/portal: “{missing[0].upper()}{missing[1:]}.”" + NB,
            f"{A}/portal: “That didn’t go through — try again.”" + NB,
        ],
        records=[f"{scope} assigned — {{{idname}}}" + NB,
                 # "Unassigned", not "removed" — the person still exists, they are
                 # off this submission. And no "before hand-off" qualifier: if it
                 # succeeded it was before, since the guard refuses afterwards.
                 f"{scope} unassigned — {{{idname}}}" + NB],
        oksay=[
            f"{A}/portal: the {role}’s name appears on the row" + NB,
            f"{A}/portal: “Two {role}s on this one.”" + NB,
            f"{A}/portal: “Reassigned — {{name}} has it now.”" + NB,
        ] + extra,
    )


def uploading(kind, party, label, nag, surface="portal"):
    """
    An upload's own failures, for the substeps that aren't translations.

    A refusal at the door **is** written down here, unlike the old reading. A
    file rejected once is a customer having trouble; the same file rejected four
    times is a customer about to give up, and only the trail can tell them
    apart.

    The nag is the important row again: an upload that never happens is the
    silent one. Everything else puts a sentence in front of somebody.
    """
    return dict(
        failures=[
            f"{kind} rejected — over the size limit" + NB,
            f"{kind} rejected — file type not supported" + NB,
            f"{kind} rejected — the file was empty" + NB,
            f"{kind} rejected — over the file-count limit" + NB,
            f"{kind} upload stopped partway" + NB,
            f"{kind} upload failed — storage unreachable" + NB,
            f"{kind} never uploaded — {nag} after hand-off" + NB,
        ],
        badsay=[
            f"{party}/{surface}: “That file was rejected — too large, wrong type, or empty.”" + NB,
            f"{party}/{surface}: “That upload didn’t finish — try it again.”" + NB,
            f"{party}/{surface}: “We couldn’t reach storage. Please try again in a moment.”" + NB,
            f"{A}/portal: “{label} hasn’t uploaded anything, {nag} after hand-off.”" + NB,
        ],
    )


def translating(kind, source, party, total=5):
    """
    A translated set is only done when it covers the original set.

    Counting uploads answers "did anything arrive", which is the wrong question.
    Three translations against five originals looks finished from every angle —
    the folder has files in it, the substep ticks, the hand-off goes out — and
    the coach receives two files they cannot read.

    So the northstar **pairs a translation to its original** rather than pooling
    them: `submission_files` gains the link, and the substep is met when every
    original has one. That also makes "which file is missing" answerable, which
    a count never can be.

    Enumerated numerator-major, like the collections.
    """
    caps = range(1, total + 1)
    partial = [(n, m) for n in caps for m in caps if n < m]
    return dict(
        failures=[
            f"{kind} rejected — over the size limit" + NB,
            f"{kind} rejected — file type not supported" + NB,
            f"{kind} rejected — the file was empty" + NB,
            f"{kind} unmatched — no original to pair it with" + NB,
            f"{kind} duplicate — that original already has a translation" + NB,
        ] + [f"{kind} incomplete — {n} of {m} originals translated" + NB for n, m in partial],
        badsay=[
            f"{party}/portal: “That file was rejected — too large, wrong type, or empty.”" + NB,
            f"{party}/portal: “That file doesn’t match any original.”" + NB,
            f"{party}/portal: “That original already has a translation.”" + NB,
        ] + [
            # Sorted on the number this sentence prints — the count *outstanding* —
            # not on the count already done. Ordering a list by a figure it never
            # shows is how the same ten strings read as scrambled.
            f"{party}/portal: “{left} of {m} originals still need a translation.”" + NB
            for left, m in sorted({(m - n, m) for n, m in partial})
        ]
        + [f"{A}/portal: “{n} of {m} originals have a translation.”" + NB for n, m in partial],
        records=[f"{kind} paired to its original — {n} of {m}" + NB
                 for n, m in [(n, m) for n in caps for m in caps if n <= m]],
        oksay=[
            f"{party}/portal: the file appears beside the original it translates" + NB,
            f"{A}/portal: “Every original has a translation.”" + NB,
        ] + [f"{party}/portal: “All {m} translated.”" + NB for m in caps],
    )


# A collection is per file, like an attachment. "They downloaded it" is not one
# event: five files fetched over six days is a different fact from five fetched
# in one minute, and only the per-file row can tell them apart.
COLLECTED = lambda kind: [f"{kind} collected — {i} of 5" + NB for i in range(1, 6)]

f3, s3, r3 = send("③ hand-off → translator", "The translator", A, built=False)
f7, s7, r7 = send("③ hand-off → coach", "The coach", A)

RUNGS = [
 ("1", "Draft", [
   step("Send Code", "Code Sent",
     failures=["① code → customer failed", "① code → customer bounced — hard",
               "① code → customer bounced — soft", "① code → customer bounced",
               "① code → customer complained"],
     badsay=[f"{C}/flow: “That email address doesn’t exist. Please check it for a typo and try again.”",
             f"{C}/flow: “That inbox couldn’t accept our email. It may be full, so please try a different address.”",
             f"{C}/flow: “We couldn’t deliver your code to that address. Check it for a typo, or try a different email.”",
             f"{C}/flow: “We couldn’t send your code — please check the address and try again.”",
             f"{C}/flow: “We couldn’t send your code — please try again in a moment.”"],
     records=["① code → customer", "① code → customer delivered"],
     oksay=[f"{C}/flow: “Enter the code from your email.”",
            f"{C}/flow: “We’ve sent a new code.” on a resend"]),
   step("Prove Email", "Email Proven",
     failures=[f"code rejected — wrong code — {i} of 5 attempts spent" for i in range(1, 6)]
              + ["code rejected — 5 attempts spent", "code rejected — the window had closed",
                 "code rejected — no code outstanding"],
     badsay=[f"{C}/flow: “That code doesn’t match. Check the email and try again.”",
             f"{C}/flow: “Too many incorrect attempts. Ask for a new code to try again.”",
             f"{C}/flow: “We haven’t sent a code yet. Ask for a new one below.”",
             f"{C}/flow: “Too many attempts. Please wait a few minutes.”",
             f"{C}/flow: “Too many code requests. Please wait a few minutes.” on the resend"],
     records=["code accepted"] + [f"code accepted — on attempt {i}" for i in range(2, 6)],
     oksay=[f"{C}/flow: the upload step opens — no message, the screen simply advances"]),
 ]),
 ("2", "Upload", [
   step("Attach File/s", "File/s Attached",
     failures=uploading("intake", C, "The customer", "the flow window", surface="flow")["failures"],
     badsay=UPLOAD_REFUSED
            + [f"{C}/flow: “Please attach at least one file first.” on trying to advance"],
     records=ATTACHED("intake"),
     oksay=[f"{C}/flow: each file appears in the list with its size"]),
   step("Clear Payment", "Payment Cleared",
     # Every row the decline notice writes belongs here, delivery included: the
     # column asks what *this substep* did, and a notice that lands cleanly is
     # still something that only happens because the payment didn't.
     failures=["declined — a row of its own, not just the notice" + NB,
               "card declined → customer", "card declined → customer delivered",
               "card declined → customer failed", "card declined → customer bounced — hard",
               "card declined → customer bounced — soft", "card declined → customer bounced",
               "card declined → customer complained"],
     badsay=[f"{C}/flow: “That card didn’t go through”",
             f"{C}/flow: “That payment didn’t go through.”",
             f"{C}/flow: “We couldn’t start the payment. Please try again.”",
             f"{C}/flow: “Your payment is still processing. We’ll email you as soon as it clears.”",
             f"{C}/email: the decline email, carrying a way back in",
             f"{C}/flow: “That submission expired, so we’ve started you fresh.”" + NB],
     # Two callers reach one idempotent fulfilment — the browser returning from
     # payment and the webhook landing — and whichever arrives first does the
     # work. Which one it was is a fact only this row can hold, and it is the
     # first thing anyone asks when a payment looks odd.
     records=["payment cleared — confirmed in the browser" + NB,
              "payment cleared — confirmed by webhook" + NB,
              "payment cleared — already paid, second caller no-ops" + NB,
              "payment cleared — 3-D Secure, returned via /api/payment/return" + NB],
     oksay=[f"{C}/flow: the confirmation screen"]),
 ]),
 ("3", "New", [
   step("Send Receipt", "Receipt Sent",
     failures=["② receipt → customer failed", "② receipt → customer bounced — hard",
               "② receipt → customer bounced — soft", "② receipt → customer bounced",
               "② receipt → customer complained"],
     badsay=[f"{A}/portal: “The receipt to {{customer}} bounced — they may not know their submission arrived.”" + NB],
     records=["② receipt → customer", "② receipt → customer delivered"],
     oksay=[f"{C}/email: ② the receipt, listing every file"]),
   step("Inform Admin", "Admin Informed",
     failures=["② New submission → Admin failed", "② New submission → Admin bounced — hard",
               "② New submission → Admin bounced — soft", "② New submission → Admin bounced",
               "② New submission → Admin complained"],
     badsay=[f"{A}/portal: a banner on the row — “Your new-submission notice bounced. Check the address on your account.”" + NB],
     records=["② New submission → Admin", "② New submission → Admin delivered"],
     oksay=[f"{A}/email: ② the new-submission notice"]),
   status("Welcome — your submission is in and we're finding you a coach."),
 ]),
 ("4", "Assign", [
   # Discipline is a hard filter, language is a label. Assessing both here —
   # before anyone picks — is what lets the assign list show the cost of each
   # choice instead of announcing it afterwards.
   step("Assess Coach Fit", "Coach Fit Assessed",
     planned=True,
     failures=["no active coach covers that focus" + NB,
               "no eligible coach shares a language — translation unavoidable" + NB],
     badsay=[f"{A}/portal: “No active coach covers that focus.”" + NB,
             f"{A}/portal: “No coach who covers this focus shares the client’s language — a translation will be needed whoever you pick.”" + NB],
     records=["coach fit assessed — {n} eligible on focus" + NB,
              "coach fit assessed — {n} of those share a language" + NB],
     oksay=[f"{A}/portal: the assign list shows each eligible coach and whether picking them needs a translation" + NB,
            f"{A}/portal: “{{n}} coaches cover this focus. {{m}} of them read the client’s language.”" + NB]),
   step("Assign Coach", "Coach Assigned",
     **assigning("coach", "coach", "the pick is no longer eligible — reassess fit", "coachId")),
   # The customer's status page changes underneath them when this fires, but it
   # shows the step, never the reason — "no shared language with your coach" is
   # a staffing detail, not their business. That is a property of the status
   # line at 5b/6b, not a message this substep sends.
   #
   # No failure: the fork is total. Both sides declare by construction — step 1
   # requires a choice and falls back to English, the coach form always has one
   # selected — so the intersection can always be taken. Same reason the
   # "coach's languages recorded" line was retired.
   status("Your coach has been assigned."),
   step("Choose Path", "Path Chosen",
     planned=True,
     # Two ways this can still fail, and the second only exists because a
     # submission may now carry more than one coach: they need not agree. If
     # any one of them can't read the client's files, the files need
     # translating — a check against "the coach" has no answer to give.
     # One row per coach who fails the check, named. "1 of 3" says how many
     # and leaves you hunting for which; the id says which, and needs no new
     # row shape when a fourth coach is added.
     failures=["compatibility check skipped — no coach assigned" + NB,
               "compatibility split — {coachId} shares no language with the client" + NB],
     badsay=[f"{A}/portal: “Assign a coach before checking languages.”" + NB,
             f"{A}/portal: “{{name}} can’t read the client’s files. Translate for all, or reassign.”" + NB],
     records=["translation required — no shared language. Proceeding to Step 5" + NB,
              "translation not required — shared language. Proceeding to Step 8" + NB],
     oksay=[f"{A}/portal: “No shared language — this needs translating. Moving to Step 5.”" + NB,
            f"{A}/portal: “Shared language — no translation needed. Moving to Step 8.”" + NB]),
 ]),
 ("5", "Translate", [
   step("Assign Translator", "Translator Assigned",
     planned=True, **assigning("intake translator", "translator",
                               "nobody on file covers that language pair", "translatorId",
                               also="The return leg can take a different translator.")),
   step("Inform Translator", "Translator Informed",
     failures=f3, badsay=s3 + [f"{A}/portal: “That didn’t go through — try again.”" + NB], records=r3,
     oksay=[f"{T}/email: ③ the hand-off, with a download link per file" + NB,
            f"{A}/portal: the row moves to Translating"]),
   status("Your files are with a translator."),
   step("Download Originals", "Originals Downloaded",
     **collecting("original", T, 5, "The translator")),
 ]),
 ("6", "Translating", [
   status("Your files are being translated."),
   step("Upload Translations", "Translations Uploaded",
     **{**translating("intake_translation", "intake", T),
        "records": ATTACHED("intake_translation")
                   + translating("intake_translation", "intake", T)["records"]}),
 ]),
 ("7", "Translated", [
   step("Inform Admin", "Admin Informed",
     planned=True,
     failures=["④ translated → Admin failed" + NB, "④ translated → Admin bounced — hard" + NB,
               "④ translated → Admin bounced — soft" + NB, "④ translated → Admin bounced" + NB,
               "④ translated → Admin complained" + NB],
     badsay=[f"{A}/portal: a banner on the row — “The translation notice bounced.”" + NB],
     records=["④ translated → Admin" + NB, "④ translated → Admin delivered" + NB],
     oksay=[f"{A}/email: ④ the translations are back" + NB]),
   # Approval has two outcomes, not one. Rejecting sends the work back to
   # step 6 — the only backwards edge in the pipeline that isn't an override —
   # so it belongs in the failure column with the rung it returns to.
   # The mirror of 10b: whoever just did the work is told it arrived. A
   # translator who uploads into silence has no way to know the files landed.
   step("Inform Translator", "Translator Informed",
     planned=True,
     failures=[f"④ received → translator failed" + NB,
               f"④ received → translator bounced — hard" + NB,
               f"④ received → translator bounced — soft" + NB,
               f"④ received → translator bounced" + NB,
               f"④ received → translator complained" + NB],
     badsay=[f"{A}/portal: a banner on the row — “The translator’s receipt bounced. They don’t know the translations arrived.”" + NB],
     records=[f"④ received → translator" + NB,
              f"④ received → translator delivered" + NB],
     oksay=[f"{T}/email: ④ we have your translations" + NB]),
   step("Assess Translations", "Translations Assessed",
     planned=True,
     # An assessment succeeds either way — the verdict is the outcome, not the
     # failure. Only the sends can go wrong, and each verdict has its own.
     failures=["④ approved → translator failed" + NB, "④ approved → translator bounced — hard" + NB,
               "④ approved → translator bounced — soft" + NB, "④ approved → translator bounced" + NB,
               "④ approved → translator complained" + NB,
               "④ returned → translator failed" + NB, "④ returned → translator bounced — hard" + NB,
               "④ returned → translator bounced — soft" + NB, "④ returned → translator bounced" + NB,
               "④ returned → translator complained" + NB],
     badsay=[f"{A}/portal: “There’s nothing in the translated folder to assess.”" + NB,
             f"{A}/portal: “Say why it’s going back — the translator only gets what you write here.”" + NB,
             f"{A}/portal: “Choose which set the coach receives.”" + NB,
             f"{A}/portal: “That didn’t go through — try again.”" + NB],
     records=["hand-off set chosen — originals" + NB,
              "hand-off set chosen — translations" + NB,
              "hand-off set chosen — both" + NB,
              "translations approved — every original covered. Proceeding to Step 8" + NB,
              "translations rejected — sent back for rework. Returning to Step 6" + NB,
              "④ approved → translator" + NB, "④ approved → translator delivered" + NB,
              "④ returned → translator" + NB, "④ returned → translator delivered" + NB],
     oksay=[f"{A}/portal: “Approved — moving to Step 8.”" + NB,
            f"{A}/portal: “Returned for rework — back to Step 6.”" + NB,
            f"{T}/email: ④ your translation was approved" + NB,
            f"{T}/email: ④ your translation was returned, with the reason" + NB,
            f"{T}/portal: “This came back — see the note and re-upload.”" + NB]),
   
 ]),
 ("8", "Sent", [
   # Kept even though 8b is automated — *because* 8b can fail. A bounced
   # hand-off leaves the client on this sentence, which is true and stable,
   # rather than on "your files are being translated", which is not.
   status("Your files have been translated."),
   step("Inform Coach", "Coach Informed",
     failures=f7,
     badsay=s7,
     records=r7,
     oksay=[f"{K}/email: ③ the hand-off, with a download link per file",
            f"{A}/portal: the set that was sent is recorded against the submission" + NB]),
   step("Coach Downloads", "Coach Downloaded",
     **{**collecting("coach", K, 5, "The coach"),
        # The rung and its notice ride on the collection, so they join the
        # success rows rather than replacing them.
        "records": collecting("coach", K, 5, "The coach")["records"],
        "oksay": collecting("coach", K, 5, "The coach")["oksay"] + [f"{A}/email: ⑤ picked up — the coach has it"]}),
 ]),
 ("9", "Reviewing", [
   status("Your coach is writing your feedback."),
   step("Upload Feedback", "Feedback Uploaded",
     **{**uploading("feedback", K, "The coach", "7 days"),
        "records": ATTACHED("feedback"),
        "oksay": [f"{K}/portal: the file appears in their folder",
                  f"{A}/portal: “The coach has delivered.”" + NB]}),
 ]),
 ("10", "Submitted", [
   step("Inform Admin", "Admin Informed",
     failures=["⑥ feedback → Admin failed", "⑥ feedback → Admin bounced — hard",
               "⑥ feedback → Admin bounced — soft", "⑥ feedback → Admin bounced",
               "⑥ feedback → Admin complained"],
     badsay=[f"{A}/portal: a banner on the row — “The feedback notice bounced.”" + NB],
     records=["⑥ feedback → Admin", "⑥ feedback → Admin delivered"],
     oksay=[f"{A}/email: ⑥ the coach has delivered"]),
   step("Inform Coach", "Coach Informed",
     failures=["⑥ feedback → coach failed", "⑥ feedback → coach bounced — hard",
               "⑥ feedback → coach bounced — soft", "⑥ feedback → coach bounced",
               "⑥ feedback → coach complained"],
     badsay=[f"{A}/portal: a banner on the row — “The coach’s copy bounced.”" + NB],
     records=["⑥ feedback → coach", "⑥ feedback → coach delivered"],
     oksay=[f"{K}/email: ⑥ we have your feedback"]),
   # The admin's own verdict on the coaching, and the pipeline's second
   # backwards edge: a rejected feedback goes back to step 9 for the coach to
   # redo. It sits *before* the fit assessment deliberately — there is no sense
   # costing out a translation for work that isn't going to be sent.
   # **Feedback, not feedback, on every line a human reads here.** The file kind
   # stays `feedback` — it's a schema word and it pairs with `intake` — but this
   # substep judges the coaching as a deliverable, not the bytes, and the coach
   # who gets the email thinks of it as their feedback. One stem per concept
   # still holds: the concept being named is the work, not the file.
   step("Approve Feedback", "Feedback Approved",
     planned=True,
     # The verdict is the outcome, not the failure — only the two sends can go
     # wrong, and each verdict carries its own.
     failures=["⑥ approved → coach failed" + NB, "⑥ approved → coach bounced — hard" + NB,
               "⑥ approved → coach bounced — soft" + NB, "⑥ approved → coach bounced" + NB,
               "⑥ approved → coach complained" + NB,
               "⑥ returned → coach failed" + NB, "⑥ returned → coach bounced — hard" + NB,
               "⑥ returned → coach bounced — soft" + NB, "⑥ returned → coach bounced" + NB,
               "⑥ returned → coach complained" + NB],
     badsay=[f"{A}/portal: “There’s nothing in the feedback folder to assess.”" + NB,
             f"{A}/portal: “Say why it’s going back — the coach only gets what you write here.”" + NB,
             f"{A}/portal: “That didn’t go through — try again.”" + NB],
     records=["feedback approved — proceeding to the fit assessment" + NB,
              "feedback rejected — sent back for rework. Returning to Step 9" + NB,
              "⑥ approved → coach" + NB, "⑥ approved → coach delivered" + NB,
              "⑥ returned → coach" + NB, "⑥ returned → coach delivered" + NB],
     oksay=[f"{A}/portal: “Approved — checking whether the client can read it.”" + NB,
            f"{A}/portal: “Returned for rework — back to Step 9.”" + NB,
            f"{K}/email: ⑥ your feedback was approved" + NB,
            f"{K}/email: ⑥ your feedback was returned, with the reason" + NB,
            f"{K}/portal: “This came back — see the note and re-upload.”" + NB]),
   # The customer's status page changes underneath them when this fires, but it
   # shows the step, never the reason — "no shared language with your coach" is
   # a staffing detail, not their business. That is a property of the status
   # line at 5b/6b, not a message this substep sends.
   #
   # No failure: the fork is total. Both sides declare by construction — step 1
   # requires a choice and falls back to English, the coach form always has one
   # selected — so the intersection can always be taken. Same reason the
   # "coach's languages recorded" line was retired.
   step("Assess Feedback Fit", "Feedback Fit Assessed",
     planned=True,
     failures=["no coach who answered shares the client's language — translation unavoidable" + NB],
     badsay=[f"{A}/portal: “The feedback came back in a language the client doesn’t read — a translation will be needed.”" + NB],
     records=["feedback fit assessed — written in {language}" + NB,
              "feedback fit assessed — the client reads it" + NB],
     oksay=[f"{A}/portal: “The client reads this. No translation needed.”" + NB,
            f"{A}/portal: “The client can’t read this. Translation needed.”" + NB]),
   step("Choose Path", "Path Chosen",
     planned=True,
     # No "unassigned" case here — a feedback cannot exist without a coach. The
     # split can, and means two coaches wrote in different languages.
     failures=["compatibility split — the feedback spans two languages" + NB,
               "compatibility split — {coachId} answered in a language the client can’t read" + NB],
     badsay=[f"{A}/portal: “{{name}} answered in a language the client can’t read. Translate the set, or send one.”" + NB],
     records=["translation required — no shared language. Proceeding to Step 11" + NB,
              "translation not required — shared language. Proceeding to Step 14" + NB],
     oksay=[f"{A}/portal: “No shared language — this needs translating. Moving to Step 11.”" + NB,
            f"{A}/portal: “Shared language — no translation needed. Moving to Step 14.”" + NB]),
 ]),
 ("11", "Translate", [
   step("Assign Translator", "Translator Assigned",
     planned=True, **assigning("feedback translator", "translator",
                               "nobody on file covers that language pair", "translatorId",
                               also="The intake leg can take a different translator.")),
   step("Inform Translator", "Translator Informed",
     planned=True,
     failures=["⑦ feedback → translator failed" + NB, "⑦ feedback → translator bounced — hard" + NB,
               "⑦ feedback → translator bounced — soft" + NB, "⑦ feedback → translator bounced" + NB,
               "⑦ feedback → translator complained" + NB],
     badsay=[f"{A}/portal: “The translator never received this.”" + NB,
             f"{A}/portal: “That didn’t go through — try again.”" + NB],
     records=["⑦ feedback → translator" + NB, "⑦ feedback → translator delivered" + NB],
     oksay=[f"{T}/email: ⑦ a feedback to translate" + NB]),
   # No status update on this leg. 12a says “Your feedback is being translated”
   # one substep later, and “is with a translator” a moment before it is the same
   # sentence twice — a page that changes and tells you nothing new is worse than
   # one that held still.
   step("Download Feedback", "Feedback Downloaded",
     **collecting("feedback", T, 5, "The translator")),
 ]),
 ("12", "Translating", [
   status("Your feedback is being translated."),
   step("Upload Translation", "Translation Uploaded",
     **{**translating("feedback_translation", "feedback", T),
        "records": ATTACHED("feedback_translation")
                   + translating("feedback_translation", "feedback", T)["records"]}),
 ]),
 ("13", "Translated", [
   step("Inform Admin", "Admin Informed",
     planned=True,
     failures=["⑦ translated → Admin failed" + NB, "⑦ translated → Admin bounced" + NB],
     badsay=[f"{A}/portal: a banner on the row — “The translation notice bounced.”" + NB],
     records=["⑦ translated → Admin" + NB, "⑦ translated → Admin delivered" + NB],
     oksay=[f"{A}/email: ⑦ the translation is back" + NB]),
   # The mirror of 10b: whoever just did the work is told it arrived. A
   # translator who uploads into silence has no way to know the files landed.
   step("Inform Translator", "Translator Informed",
     planned=True,
     failures=[f"⑦ received → translator failed" + NB,
               f"⑦ received → translator bounced — hard" + NB,
               f"⑦ received → translator bounced — soft" + NB,
               f"⑦ received → translator bounced" + NB,
               f"⑦ received → translator complained" + NB],
     badsay=[f"{A}/portal: a banner on the row — “The translator’s receipt bounced. They don’t know the translation arrived.”" + NB],
     records=[f"⑦ received → translator" + NB,
              f"⑦ received → translator delivered" + NB],
     oksay=[f"{T}/email: ⑦ we have your translation" + NB]),
   step("Assess Translation", "Translation Assessed",
     planned=True,
     failures=["⑦ approved → translator failed" + NB, "⑦ approved → translator bounced — hard" + NB,
               "⑦ approved → translator bounced — soft" + NB, "⑦ approved → translator bounced" + NB,
               "⑦ approved → translator complained" + NB,
               "⑦ returned → translator failed" + NB, "⑦ returned → translator bounced — hard" + NB,
               "⑦ returned → translator bounced — soft" + NB, "⑦ returned → translator bounced" + NB,
               "⑦ returned → translator complained" + NB],
     badsay=[f"{A}/portal: “There’s nothing in the translated folder to assess.”" + NB,
             f"{A}/portal: “Say why it’s going back — the translator only gets what you write here.”" + NB,
             f"{A}/portal: “That didn’t go through — try again.”" + NB],
     records=["translation approved — every original covered. Proceeding to Step 14" + NB,
              "translation rejected — sent back for rework. Returning to Step 12" + NB,
              "⑦ approved → translator" + NB, "⑦ approved → translator delivered" + NB,
              "⑦ returned → translator" + NB, "⑦ returned → translator delivered" + NB],
     oksay=[f"{A}/portal: “Approved — moving to Step 14.”" + NB,
            f"{A}/portal: “Returned for rework — back to Step 12.”" + NB,
            f"{T}/email: ⑦ your translation was approved" + NB,
            f"{T}/email: ⑦ your translation was returned, with the reason" + NB,
            f"{T}/portal: “This came back — see the note and re-upload.”" + NB]),
   
 ]),
 ("14", "Deliver", [
   status("Your feedback has been translated."),
   # The one irreversible substep on the operator's side. Everything before it
   # can be moved back; this hands files to someone outside the building, and
   # once the customer has seen them there is no unseeing. So it carries a
   # double-release guard of its own rather than trusting the rung to hold —
   # a second press must be refused, not merely ignored.
   #
   # It is also where the retention clock's backstop starts (`completedAt`), so
   # a release that half-lands leaves a submission that will be swept on a date
   # nobody set. That is why the stamp gets its own row.
   step("Release Feedback", "Feedback Released",
     failures=["release refused — nothing in the feedback folder" + NB,
               "release refused — no set chosen" + NB,
               "release refused — already delivered" + NB,
               "release failed — the delivery stamp didn’t land" + NB],
     badsay=[f"{A}/portal: “There is no feedback file to send yet.”" + NB,
             f"{A}/portal: “Choose which set the client receives.”" + NB,
             f"{A}/portal: “This has already been sent. Reload to see where it is.”" + NB,
             f"{A}/portal: “That didn’t go through — try again.”" + NB],
     records=["approved — original set released" + NB,
              "approved — translated set released" + NB,
              "approved — both sets released" + NB,
              "delivered — the client may now collect. Proceeding to 14c" + NB,
              "retention backstop started — 90 days from delivery" + NB],
     oksay=[f"{A}/portal: the row moves to Delivered",
            f"{A}/portal: “Released — the client is being emailed.”" + NB,
            f"{A}/portal: “Kept until {{date}} unless they collect sooner.”" + NB]),
   step("Send Feedback", "Feedback Sent",
     failures=["⑧ feedback ready → customer failed", "⑧ feedback ready → customer bounced — hard",
               "⑧ feedback ready → customer bounced — soft", "⑧ feedback ready → customer bounced",
               "⑧ feedback ready → customer complained"],
     badsay=[f"{A}/portal: a banner on the row — “{{customer}} never received this. They don’t know it’s ready.”" + NB],
     records=["⑧ feedback ready → customer", "⑧ feedback ready → customer delivered"],
     oksay=[f"{C}/email: ⑧ feedback ready, stating the retention window"]),
   status("Your feedback is ready to collect."),
   step("Customer Downloads", "Customer Downloaded",
     **{**collecting("customer", C, 5, "The customer", surface="status"),
        # This collection is the one that starts the retention clock, so the
        # rung rides on it.
        "records": collecting("customer", C, 5, "The customer", surface="status")["records"]}),
 ]),
 ("15", "Collected", [
   step("Inform Admin", "Admin Informed",
     failures=["⑨ collected → Admin failed", "⑨ collected → Admin bounced — hard",
               "⑨ collected → Admin bounced — soft", "⑨ collected → Admin bounced",
               "⑨ collected → Admin complained"],
     badsay=[f"{A}/portal: a banner on the row — “The collection notice bounced.”" + NB],
     records=["⑨ collected → Admin", "⑨ collected → Admin delivered"],
     oksay=[f"{A}/email: ⑨ collected — the customer has it"]),
   status("Thanks — you've collected your feedback."),
   step("Mark Resolved", "Marked Resolved",
     badsay=[f"{A}/portal: “That didn’t go through — try again.”" + NB],
     records=["resolved by an admin" + NB,
              "resolved — retention clock set to {date}" + NB],
     oksay=[f"{A}/portal: the row moves to Resolved"]),
 ]),
 ("16", "Resolved", [
   step("Send Thank-You", "Thank-You Sent",
     failures=["⑩ thank you → customer failed", "⑩ thank you → customer bounced — hard",
               "⑩ thank you → customer bounced — soft", "⑩ thank you → customer bounced",
               "⑩ thank you → customer complained"],
     badsay=[f"{A}/portal: a banner on the row — “The thank-you bounced.”" + NB],
     records=["⑩ thank you → customer", "⑩ thank you → customer delivered"],
     oksay=[f"{C}/email: ⑩ thank you, carrying the deletion date"]),
   status("Resolved. Your files are kept until {date}."),
   step("Reach Warning Date", "Warning Date Reached",
     badsay=[f"{A}/portal: “The nightly sweep has not run since {{date}}.”" + NB,
             f"{A}/portal: “CRON_SECRET is unset — the sweep refuses to run rather than run unguarded.”" + NB],
     records=["warning due — 30 days from collection" + NB,
              "warning due — 90 days from delivery" + NB],
     oksay=[f"{A}/portal: the row moves to Deleting"]),
 ]),
 ("17", "Deleting", [
   # ⑪ is stamped even when the send fails, so it never retries: retrying nightly
   # would turn one missed warning into seven. That is why the message below has
   # to say so — nobody is coming back to fix it.
   step("Send Warning", "Warning Sent",
     failures=["⑪ deletion warning → customer failed", "⑪ deletion warning → customer bounced — hard",
               "⑪ deletion warning → customer bounced — soft", "⑪ deletion warning → customer bounced",
               "⑪ deletion warning → customer complained"],
     badsay=[f"{A}/portal: “The deletion warning to {{customer}} did not send. They have no notice, and it will not retry.”" + NB,],
     records=["⑪ deletion warning → customer", "⑪ deletion warning → customer delivered"],
     oksay=[f"{C}/email: ⑪ the deletion warning, a week out"]),
   status("Your files will be deleted on {date}."),
   step("Delete Files", "Files Deleted",
     badsay=[f"{A}/portal: “Storage refused the delete — {{n}} files are still there.”" + NB,
             f"{A}/portal: the locator stays and the sweep retries tomorrow" + NB],
     records=["swept — every folder, together" + NB,
              "swept by the nightly cron" + NB,
              "purged early by an admin override" + NB],
     oksay=[f"{C}/status: any link they kept now answers 410",
            f"{A}/portal: the filenames show struck through in the folders"]),
 ]),
 ("18", "Purged", [
   step("Remove Bytes", "Bytes Removed",
     records=["bytes removed — {n} files, {size} freed" + NB],
     oksay=[f"{A}/portal: the filenames show struck through in the folders"]),
   step("Clear Locators", "Locators Cleared",
     records=["locators cleared — the rows survive" + NB],
     oksay=[f"{C}/status: an old link answers 410 — gone, not missing"]),
   status("Your files have been deleted. The record of your submission is kept."),
   step("Keep Record", "Record Kept",
     records=["record kept — nothing further is written" + NB],
     oksay=[f"{A}/portal: the row still says what was sent, forever"]),
 ]),
]


# ---------------------------------------------------------------------------
# What sets each substep going: who acts, and whether a person has to.
#
# The distinction the pipeline turns on is **manual or automated**, because a
# manual step can sit untouched for a week and an automated one cannot. Every
# nag row in this table exists under a manual step; every silent failure under
# an automated one. Read this column and you can predict which kind of trouble
# a substep is prone to before reading any other.
# ---------------------------------------------------------------------------
PRE = {
 "1a": "System · automated — fires the moment the draft row is created",
 "1b": "Customer · manual — types the six digits",
 "2a": "Customer · manual — picks files from their device",
 "2b": "Customer · manual — submits the card",
 "3a": "System · automated — fires on payment clearing",
 "3b": "System · automated — fires on payment clearing",
 "3c": "System · automated — fires on arrival at New",
 "4a": "System · automated — scores every active coach on focus and language",
 "4b": "Admin · manual — picks from the eligible list, cost shown per option",
 "4c": "System · automated — fires once the coach is on the row",
 "4d": "System · automated — reads the assigned coach's language match",
 "5a": "Admin · manual — picks from the translator list",
 "5b": "System · automated — fires on assignment; there is one set, so nothing to choose",
 "5c": "System · automated — fires when the hand-off goes out",
 "5d": "Translator · manual — collects the pack, off-platform",
 "6a": "System · automated — fires on the translator's first collection",
 "6b": "Translator · manual — uploads each file against its original",
 "7a": "System · automated — fires when the last translation lands",
 "7b": "System · automated — fires when the last translation lands",
 "7c": "Admin · manual — approves or returns, and picks which set the coach gets",
 "8a": "System · automated — fires only when arriving from step 7; untranslated submissions skip it",
 "8b": "System · automated — fires on arrival at Sent; the set was chosen at 7c",
 "8c": "Coach · manual — collects the pack",
 "9a": "System · automated — fires on the coach's first collection",
 "9b": "Coach · manual — uploads their feedback",
 "10a": "System · automated — fires when the feedback lands",
 "10b": "System · automated — fires when the feedback lands",
 "10c": "Admin · manual — approves the coaching, or returns it with a reason",
 "10d": "System · automated — reads the language the feedback was written in",
 "10e": "System · automated — reads what the fit assessment found",
 "11a": "Admin · manual — picks from the translator list",
 "11b": "System · automated — fires on assignment; there is one set, so nothing to choose",
 "11c": "Translator · manual — collects the feedback, off-platform",
 "12a": "System · automated — fires on the translator's first collection",
 "12b": "Translator · manual — uploads each file against its original",
 "13a": "System · automated — fires when the last translation lands",
 "13b": "System · automated — fires when the last translation lands",
 "13c": "Admin · manual — approves the translation, or returns it with a reason",
 "14a": "System · automated — fires only when arriving from step 13; untranslated feedback skips it",
 "14b": "Admin · manual — chooses the set and releases it",
 "14c": "System · automated — fires on release",
 "14d": "System · automated — fires on release",
 "14e": "Customer · manual — collects from the status page",
 "15a": "System · automated — fires on the customer's first collection",
 "15b": "System · automated — fires on the customer's first collection",
 "15c": "Admin · manual — closes the job",
 "16a": "System · automated — fires on resolve",
 "16b": "System · automated — fires on resolve",
 "16c": "System · automated — the nightly sweep, on the later of the two clocks",
 "17a": "System · automated — the nightly sweep",
 "17b": "System · automated — fires on the warning",
 "17c": "System · automated — the nightly sweep, a week after the warning",
 "18a": "System · automated — the nightly sweep",
 "18b": "System · automated — the nightly sweep",
 "18c": "System · automated — fires on the purge",
 "18d": "System · automated — nothing further is written",
}

_seen = set()
for _n, _l, _ss in RUNGS:
    for _j, _st in enumerate(_ss):
        _ref = f"{_n}{chr(ord('a') + _j)}"
        assert _ref in PRE, f"no precondition for {_ref}"
        _st["pre"] = PRE[_ref]
        _seen.add(_ref)
assert _seen == set(PRE), f"unused: {set(PRE) - _seen}"
