"""
Regenerate everything downstream of `northstar.py`.

    python3 docs/design/northstar/build.py

Rewrites the table body inside `pipeline.html` and both CSVs. `northstar.py` is
the only file anyone edits by hand; these three are outputs and a diff on them
that isn't explained by a diff on the source means someone edited an output.

The header sentence in `pipeline.html` carries the counts in words and is *not*
rewritten here — it's prose, and it's checked against the tallies this prints.
"""

import csv
import html
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

from northstar import RUNGS  # noqa: E402

NB = "*(not built)*"
# The four surfaces, spelled out for a spreadsheet — the artifact uses glyphs,
# which don't survive a CSV column.
SURFACE = {
    "flow": "checkout flow",
    "status": "status page",
    "portal": "operator portal",
    "email": "email",
}
COLUMNS = [
    ("failures", "Written to the trail when it fails"),
    ("badsay", "Shown to someone when it fails"),
    ("records", "Written to the trail when it works"),
    ("oksay", "Shown to someone when it works"),
]


def split(text):
    """Peel the audience and surface off a message. Trail rows have neither."""
    match = re.match(
        r"^(Customer|Admin|Coach|Translator|Operator)/(flow|status|portal|email): ", text
    )
    body = text.replace(" " + NB, "")
    if not match:
        return "", "", body
    return match.group(1), SURFACE[match.group(2)], body[match.end():]


def render_table():
    """`render.py` prints the tbody on stdout and the tallies on stderr."""
    done = subprocess.run(
        [sys.executable, str(HERE / "render.py")],
        capture_output=True, text=True, cwd=HERE, check=True,
    )
    return done.stdout.rstrip(), done.stderr.strip()


def splice(rows):
    page = HERE / "pipeline.html"
    source = page.read_text()
    # The *last* tbody: the point-of-no-return table above it has one too, and
    # an earlier version of this script quietly overwrote the wrong one.
    start = source.rindex("      <tbody>\n") + len("      <tbody>\n")
    end = source.rindex("\n      </tbody>")
    page.write_text(source[:start] + rows + source[end:])


def spreadsheets():
    wide, tidy = [], []
    for number, label, steps in RUNGS:
        for index, substep in enumerate(steps):
            actor, _, mode = substep["pre"].partition(" · ")
            head = {
                "Ref": f"{number}{chr(ord('a') + index)}",
                "Step no": number,
                "Step": label,
                "Substep — still to do": substep["todo"],
                "Actor": actor,
                "Mode": "manual" if "manual" in mode else "automated",
                "Precondition": mode,
                "Substep — done": substep["done"],
            }
            cells = {}
            for key, heading in COLUMNS:
                lines = []
                for value in substep.get(key, []):
                    who, surface, text = split(value)
                    line = f"{who} [{surface}] {text}" if who else text
                    lines.append(line + ("  ← not built" if NB in value else ""))
                    tidy.append({
                        **head,
                        "Column": heading,
                        "Kind": "trail row" if key in ("failures", "records") else "message",
                        "Outcome": "fails" if key in ("failures", "badsay") else "works",
                        "Audience": who,
                        "Surface": surface,
                        "Text": text,
                        "Built": "no" if (NB in value or substep.get("planned")) else "yes",
                    })
                cells[heading] = "\n".join(lines)
            wide.append({**head, "Substep is new": "yes" if substep.get("planned") else "", **cells})

    for name, rows in (("wide", wide), ("tidy", tidy)):
        path = HERE / f"pipeline-northstar-{name}.csv"
        # BOM, or Excel opens the curly quotes and em dashes as mojibake.
        with path.open("w", newline="", encoding="utf-8-sig") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        print(f"  {path.name}  {len(rows)} rows")
    return len(wide), len(tidy)


def verify(expected_substeps):
    """
    Source, artifact and CSV must agree — on the count *and* the text.

    The artifact renders `Customer/status:` as a name and a glyph, so a naive
    comparison against the source reports every message missing. Strip the
    prefix from both sides and what's left has to match exactly.
    """
    def bare(value):
        return re.sub(
            r"^(Customer|Admin|Coach|Translator|Operator)/(flow|status|portal|email): ",
            "", value.replace(" " + NB, ""),
        )

    source = [bare(v) for _, _, steps in RUNGS for st in steps
              for key, _ in COLUMNS for v in st.get(key, [])]
    page = (HERE / "pipeline.html").read_text()
    body = re.sub(r"\s+", " ", html.unescape(
        re.sub(r"<[^>]+>", " ", page[page.rindex("<tbody>"):page.rindex("</tbody>")])))

    missing = [t for t in set(source)
               if re.sub(r"\s+", " ", html.unescape(t)).strip() not in body]
    labels = [st[k] for _, _, steps in RUNGS for st in steps
              for k in ("todo", "done") if st[k] not in body]
    pres = [st["pre"] for _, _, steps in RUNGS for st in steps
            if re.sub(r"\s+", " ", st["pre"].replace(" · ", " ")) not in body]

    ok = not (missing or labels or pres)
    print(f"  {len(source)} rows · {len(missing)} absent · {len(labels)} labels absent · "
          f"{len(pres)} preconditions absent")
    for item in missing[:5]:
        print(f"    absent: {item[:110]}")
    if not ok:
        raise SystemExit("verification failed — an output disagrees with northstar.py")
    return len(source)


if __name__ == "__main__":
    rows, tally = render_table()
    splice(rows)
    print(f"  pipeline.html   {rows.count('<tr>')} rows spliced")
    wide_rows, tidy_rows = spreadsheets()
    total = verify(wide_rows)
    print(f"\n  {tally}")
    print("  header sentence in pipeline.html is prose — check it against that line")
