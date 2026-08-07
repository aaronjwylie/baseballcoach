#!/usr/bin/env node
/**
 * check-structure — the dependency rules, made mechanical.
 *
 * `_StructureLaw.md` §5 states four import rules and `_StructureDocumentation`
 * §1d admitted they were held by "convention and review". That was honest and it
 * was not working: a survey on 2026-08-06 found **a domain cycle** and **two
 * deep cross-domain imports from server files**, neither of which anything could
 * see. Both had compiled, linted and deployed for weeks.
 *
 * The reason they hid is worth stating, because it is why this check has the
 * shape it does. A deep cross-domain import is **sometimes legal**: a
 * `"use client"` file must import `model/` directly, or the domain barrel drags
 * the Postgres client into the browser bundle and the build fails. So the tree
 * contained twenty deep imports of which five were correct — and **nothing
 * distinguished a violation from an exception by reading it.** An exception
 * nobody can identify is an exception that launders violations.
 *
 * Three checks:
 *
 *   1. DEEP IMPORTS   a cross-domain deep import is legal only from a
 *                     `"use client"` file or a declaration file (*Table/*Enum)
 *   2. CYCLES         the domain graph is acyclic
 *   3. UPWARD         nothing in shared/ imports a domain; no domain imports app/
 *
 * Runs in `npm run build`.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const DOMAINS = join(SRC, "domains");

function sourceFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const findings = [];
const note = (file, message) => findings.push({ file: relative(ROOT, file), message });

const isClient = (body) => /^\s*["']use client["']/m.test(body.slice(0, 400));

/**
 * A declaration file — a table or an enum — by name, with or without extension.
 *
 * The first version tested `/(Table|Enum)\.tsx?$/` against the *import
 * specifier*, which never carries an extension, so the exemption never fired
 * and the check reported the entire declaration plane as violations. A rule's
 * exemption failing open is loud; failing closed buries the real findings in
 * noise, which is worse.
 */
const isDeclaration = (path) => /(Table|Enum)(\.tsx?)?$/.test(path);

/**
 * Files the law names as living outside the layer cake.
 *
 * `db/schema.ts` is the manifest — it imports every domain's declarations so
 * tooling has one entry point, declares nothing, and nothing in `src/` imports
 * it (`_StructureLaw` §5a). `proxy.ts` imports a model directly to keep
 * `next/headers` out of the proxy bundle. Both are documented, and a documented
 * exception belongs in the checker rather than in a reviewer's memory.
 */
const EXEMPT_FILES = new Set(["src/db/schema.ts", "src/proxy.ts"]);

const domainNames = existsSync(DOMAINS)
  ? readdirSync(DOMAINS).filter((d) => statSync(join(DOMAINS, d)).isDirectory())
  : [];

/** domain → Set(domains it imports) — barrel imports only, for the cycle check. */
const graph = new Map(domainNames.map((d) => [d, new Set()]));

for (const file of sourceFiles(SRC)) {
  const body = readFileSync(file, "utf8");
  const rel = relative(SRC, file);
  if (EXEMPT_FILES.has(`src/${rel}`)) continue;
  const owner = rel.startsWith("domains/") ? rel.split("/")[1] : null;

  for (const m of body.matchAll(/from\s+["']@\/([^"']+)["']/g)) {
    const target = m[1];

    // ── 3 · UPWARD ────────────────────────────────────────────────────────
    if (rel.startsWith("shared/") && target.startsWith("domains/")) {
      note(file, `shared/ imports a domain → @/${target}. If it needs to know a domain, it isn't shared`);
    }
    if (owner && target.startsWith("app/")) {
      note(file, `a domain imports app/ → @/${target}. Imports flow down only`);
    }

    if (!target.startsWith("domains/")) continue;
    const [, targetDomain, ...rest] = target.split("/");
    if (!targetDomain || targetDomain === owner) continue;

    /*
      A reference to another domain's *declaration* is not a deep import in the
      sense this rule means. §5.7: a table is reached at the declaration plane
      "uniformly, whoever is asking" — a foreign key is a compile-time reference
      no barrel can carry without closing a cycle through itself. So it is
      exempt from the deep-import rule *and* excluded from the graph, or every
      foreign key would read as a cycle.
    */
    const toDeclaration = isDeclaration(target);

    // ── 1 · DEEP IMPORTS ──────────────────────────────────────────────────
    if (rest.length > 0) {
      const clientExempt = isClient(body);
      const fileExempt = EXEMPT_FILES.has(rel.startsWith("domains") ? `src/${rel}` : `src/${rel}`);
      if (!clientExempt && !toDeclaration && !fileExempt) {
        note(
          file,
          `deep cross-domain import → @/${target}\n` +
            `      legal only from a "use client" file (the barrel would pull the DB client into the browser)\n` +
            `      or between declaration files (a foreign key no barrel can carry).\n` +
            `      This file is neither — import the barrel: @/domains/${targetDomain}`,
        );
      }
    }

    // Declaration references are excluded from the graph — see above.
    if (owner && graph.has(owner) && !toDeclaration) graph.get(owner).add(targetDomain);
  }
}

// ── 2 · CYCLES ──────────────────────────────────────────────────────────────
// Depth-first, reporting the actual path rather than "a cycle exists".
const WHITE = 0, GREY = 1, BLACK = 2;
const colour = new Map(domainNames.map((d) => [d, WHITE]));
const reported = new Set();

function walk(node, path) {
  colour.set(node, GREY);
  for (const next of graph.get(node) ?? []) {
    if (colour.get(next) === GREY) {
      const cycle = [...path.slice(path.indexOf(next)), next].join(" → ");
      const key = [...new Set([...path.slice(path.indexOf(next)), next])].sort().join("|");
      if (!reported.has(key)) {
        reported.add(key);
        findings.push({ file: `domains/${next}`, message: `cycle: ${cycle}\n      the graph must stay acyclic (_StructureLaw §5.3)` });
      }
    } else if (colour.get(next) === WHITE) {
      walk(next, [...path, next]);
    }
  }
  colour.set(node, BLACK);
}
for (const d of domainNames) if (colour.get(d) === WHITE) walk(d, [d]);

// ── report ──────────────────────────────────────────────────────────────────
if (findings.length) {
  console.error(`\n[structure] ${findings.length} problem${findings.length === 1 ? "" : "s"}:\n`);
  for (const f of findings) console.error(`  ${f.file}\n      ${f.message}`);
  console.error("");
  process.exit(1);
}
console.log(`[structure] ok — ${domainNames.length} domains, acyclic, no unsanctioned deep imports`);
