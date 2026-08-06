import re, html as H
from northstar import RUNGS

SURFACE = {"flow": ("▤","on the checkout flow"), "status": ("▥","on the status page"),
           "portal": ("▣","in the operator portal"), "email": ("✉","by email")}
def nb(t): return t.replace(" *(not built)*","")
def flag(t): return ' <span class="td">not built</span>' if "*(not built)*" in t else ""
def say(t):
    m = re.match(r"^(Customer|Admin|Coach|Translator|Operator)/(flow|status|portal|email): ", t)
    if not m: return H.escape(nb(t))
    who, ch = m.group(1), m.group(2); rest = nb(t[m.end():]); ic, ti = SURFACE[ch]
    return f'<b class="who">{who}</b><span class="ch" title="{ti}">{ic}</span> {H.escape(rest)}'

rows, n, counts = [], 0, {"failures":0,"badsay":0,"records":0,"oksay":0,"planned":0}
for num, label, steps in RUNGS:
    for j, st in enumerate(steps):
        n += 1
        if st.get("planned"): counts["planned"] += 1
        for k in counts:
            if k != "planned": counts[k] += len(st.get(k, []))
        head = (f'<th rowspan="{len(steps)}" class="sub-step"><span class="sn">{num}</span>{H.escape(label)}'
                f'<span class="steprow" title="written to the trail when the step opens">{H.escape(label)}</span></th>') if j==0 else ""
        def cell(cls, items, verbatim):
            if not items: return f'<td class="{cls}"><span class="none">—</span></td>'
            li = "".join(f"<li>{H.escape(nb(x)) if verbatim else say(x)}{flag(x)}</li>" for x in items)
            return f'<td class="{cls}"><ul class="rowlist">{li}</ul></td>'
        # Every substep gets a letter inside its step, so "4b" names one line
        # of the pipeline exactly. The step number alone can't — six substeps
        # share it — and the label alone can't either, since two rungs hand off
        # to the coach.
        letter = chr(ord("a") + j)
        # `instant` drops only the badge — every entry beside it already carries
        # its own. The opening row stays: every substep announces itself.
        if st.get("instant"):
            todo_cell = (f'<td class="todo"><span class="sublet">{letter}</span>{H.escape(st["todo"])}'
                         f'<span class="steprow" title="written to the trail when the substep opens">{H.escape(st["todo"])}</span></td>')
        else:
            p = ' <span class="td">not built</span>' if st.get("planned") else ""
            todo_cell = (f'<td class="todo"><span class="sublet">{letter}</span>{H.escape(st["todo"])}{p}'
                         f'<span class="steprow" title="written to the trail when the substep opens">{H.escape(st["todo"])}</span></td>')
        # Who sets it going, and whether a person must. The actor is bolded
        # like an audience badge, so the column scans as five names.
        actor, _, rest = st["pre"].partition(" · ")
        pre_cell = (f'<td class="pre"><b class="who">{H.escape(actor)}</b>'
                    f'<span class="mode">{H.escape(rest)}</span></td>')
        rows.append(head + todo_cell + pre_cell
          + cell("bad", st.get("failures",[]), True) + cell("badsay", st.get("badsay",[]), False)
          + cell("ok", st.get("records",[]), True) + cell("oksay", st.get("oksay",[]), False)
          + f'<td class="done">{H.escape(st["done"])}<span class="steprow" title="written to the trail when the substep closes">{H.escape(st["done"])}</span></td>')
print("\n".join(f"<tr>{r}</tr>" for r in rows))
import sys
print(f"{n} substeps · {counts['planned']} wholly new · {counts['failures']} failure rows · "
      f"{counts['records']} success rows · {counts['badsay']+counts['oksay']} messages", file=sys.stderr)
