/**
 * Guard: a `*Table` name is a Drizzle export, never a word.
 *
 * ## What this exists to catch
 *
 * On 2026-08-05 a rename replaced `submissions` with `submissionTable`
 * everywhere the word appeared — including sixty-six places that were never
 * identifiers. It shipped. The public FAQ asked `"Who are the coachTable?"`, the
 * admin nav pointed at `/admin/coachTable` (a 404), and coach feedback uploads
 * wrote to `submissionTable/{id}/feedback` in Blob storage.
 *
 * **Every existing check passed**, and none of them could have failed: `tsc` and
 * `eslint` see a well-typed string, and `npm run simulate` renders no copy and
 * follows no URLs. A wrong string is a valid string. That is the hole this
 * closes, and it is why the guard is a script rather than a rule someone is
 * asked to remember.
 *
 * ## The rule
 *
 * A table export may appear as an identifier in code, and as a backticked
 * reference in a docblock. Everywhere else it is a mistake:
 *
 * - **Rule A — never inside a string or template literal.** That covers URLs,
 *   storage paths, `revalidatePath`, and every line of user-facing copy. Module
 *   specifiers are exempt: `from "./operatorTable"` is how you import the thing.
 * - **Rule B — never in a file that doesn't import or declare it.** That covers
 *   bare JSX text, which sits in no string at all. A file using a table legitimately
 *   has imported it.
 *
 * Backticked mentions in comments are allowed under both, because a docblock
 * pointing at `operatorProfileTable` is documentation working as intended.
 *
 * Run by `npm run build`, so this fails a deploy rather than teaching a lesson
 * twice.
 */
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src", "scripts"];
const EXTS = new Set([".ts", ".tsx", ".mjs"]);

/**
 * Every `pgTable` declaration in the tree — the names to police.
 *
 * Discovered rather than listed, so a seventh table is covered the day it's
 * written. This file excludes itself: its own prose quotes the damage as
 * examples, and a docblock showing the declaration pattern would otherwise
 * enrol a fictional table into the guard.
 */
function tableNames() {
  const found = new Set();
  for (const file of walk(ROOTS)) {
    if (file.endsWith("check-names.mjs")) continue;
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/export const (\w+Table)\s*=\s*pgTable/g)) {
      found.add(m[1]);
    }
  }
  return found;
}

/**
 * Is this occurrence inside a `backticked span` on its own line?
 *
 * In a comment that means a code reference — documentation working as intended.
 * The naive version of this check only allowed a name *immediately* after a
 * backtick, which rejected `/admin/coachTable` and every other path or sentence
 * where the reference is part of a longer span.
 */
function backticked(src, at) {
  const start = src.lastIndexOf("\n", at) + 1;
  const end = src.indexOf("\n", at);
  const line = src.slice(start, end === -1 ? src.length : end);
  const offset = at - start;
  let open = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== "`") continue;
    if (open === -1) open = i;
    else {
      if (offset > open && offset < i) return true;
      open = -1;
    }
  }
  return false;
}

function* walk(dirs) {
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) yield* walk([full]);
      else if (EXTS.has(path.extname(entry.name))) yield full;
    }
  }
}

/**
 * Which character ranges of a file are comments.
 *
 * Line-based rather than a real parser: the cost of a miss here is a false
 * negative on one line, not a wrong answer about the codebase.
 */
function commentRanges(src) {
  const ranges = [];
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("/*", i)) {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      ranges.push([i, stop]);
      i = stop;
    } else if (src.startsWith("//", i)) {
      const end = src.indexOf("\n", i);
      const stop = end === -1 ? src.length : end;
      ranges.push([i, stop]);
      i = stop;
    } else i++;
  }
  return ranges;
}

/** Character ranges covered by a string or template literal. */
function literalRanges(src, comments) {
  const inComment = (n) => comments.some(([a, b]) => n >= a && n < b);
  const ranges = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if ((ch === '"' || ch === "'" || ch === "`") && !inComment(i)) {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === "\\") j += 2;
        else if (src[j] === ch) break;
        else j++;
      }
      ranges.push([i, Math.min(j + 1, src.length)]);
      i = j + 1;
    } else i++;
  }
  return ranges;
}

const names = tableNames();
if (names.size === 0) {
  console.error("[names] found no table declarations — the guard would pass vacuously");
  process.exit(1);
}

const problems = [];

for (const file of walk(ROOTS)) {
  const src = fs.readFileSync(file, "utf8");
  const comments = commentRanges(src);
  const literals = literalRanges(src, comments);
  const lineAt = (n) => src.slice(0, n).split("\n").length;

  for (const name of names) {
    // Does this file legitimately deal in this table?
    const declares = new RegExp(`export const ${name}\\s*=`).test(src);
    const imports = new RegExp(`import[^;]*\\b${name}\\b[^;]*from`, "s").test(src);

    for (const m of src.matchAll(new RegExp(`\\b${name}\\b`, "g"))) {
      const at = m.index;
      const inComment = comments.some(([a, b]) => at >= a && at < b);
      const literal = literals.find(([a, b]) => at >= a && at < b);

      // A backticked mention inside a docblock is documentation. Allowed always.
      if (inComment && backticked(src, at)) continue;

      if (literal) {
        // `from "./operatorTable"` is how you import it — not a mistake.
        const line = src.slice(src.lastIndexOf("\n", at) + 1, src.indexOf("\n", at));
        if (/\bfrom\s*['"`]/.test(line) || /^\s*import\b/.test(line)) continue;
        problems.push([file, lineAt(at), name, "inside a string — a URL, a path, or copy?"]);
      } else if (inComment) {
        problems.push([file, lineAt(at), name, "prose in a comment — did a rename overwrite a word?"]);
      } else if (!declares && !imports) {
        problems.push([file, lineAt(at), name, "used but never imported — bare JSX text?"]);
      }
    }
  }
}

if (problems.length) {
  console.error(`\n[names] ${problems.length} misuse(s) of a table export:\n`);
  for (const [file, line, name, why] of problems) {
    console.error(`  ${file}:${line}  ${name} — ${why}`);
  }
  console.error(
    `\n  A *Table name is a Drizzle export. Not a prop, not a URL segment, not a\n` +
      `  word in a sentence. Elsewhere use the English plural — coaches, submissions.\n`,
  );
  process.exit(1);
}

console.log(`[names] ok — ${names.size} table exports, no misuse`);
