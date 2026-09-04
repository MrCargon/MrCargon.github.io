// audit-deadcode.cjs — find stubs, orphans and broken links across the whole repo.
// Run: node tests/audit-deadcode.cjs
//
// WHY THIS EXISTS
// Over one working session this project turned up, one at a time and always by accident:
// a router whose back-button handler was `{ return true; }`, a preload flag on three
// routes that never preloaded, global error handlers that discarded every error,
// #keyboard-hints toggled from three places and present in no markup, a game spec testing
// a file deleted months earlier, 189 lines of Fourier maths loaded on every page and
// called from nowhere, and a starfield that was fine but unfindable because it was the
// only unnamed object in the scene.
//
// The pattern is not carelessness, it is that NOTHING WAS LOOKING. Each was discovered
// because someone happened to walk past it. This walks past all of them, every run.
//
// It reports rather than fails: several categories have honest false positives (a public
// API method with no in-repo caller is not dead), so the output is a list for a human,
// and only the categories that cannot be anything but a defect are counted as errors.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report', 'scratch']);
const VENDOR = /[\\/](vendor|assets[\\/]vendor)[\\/]/;

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) {
            if (SKIP_DIRS.has(e.name)) continue;
            walk(path.join(dir, e.name), out);
        } else {
            out.push(path.join(dir, e.name));
        }
    }
    return out;
}

const files = walk(ROOT).filter((f) => !VENDOR.test(f));
const js = files.filter((f) => f.endsWith('.js') && !f.includes('tests' + path.sep));
const html = files.filter((f) => f.endsWith('.html'));
const css = files.filter((f) => f.endsWith('.css'));
const read = (f) => fs.readFileSync(f, 'utf8');
const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/');

const jsSrc = js.map((f) => ({ f, s: read(f) }));
const allJs = jsSrc.map((x) => x.s).join('\n');
const allHtml = html.map(read).join('\n');
const allCss = css.map(read).join('\n');

let problems = 0;
const section = (title, rows, fatal) => {
    console.log('\n' + title);
    if (rows.length === 0) { console.log('   clean'); return; }
    rows.forEach((r) => console.log('   ' + r));
    if (fatal) problems += rows.length;
};

// ── 1. stub bodies ─────────────────────────────────────────────────────────
// A method whose entire body is `return <literal>;` does nothing, and the danger is that
// callers and event registrations cannot tell.
// A no-op is not automatically wrong — cleanupAboutPage has nothing to clean because the
// page allocates nothing. What is wrong is a no-op you cannot TELL from unfinished work,
// and that ambiguity is the whole reason this project kept turning up dead handlers:
// `{ return true; }` reads identically whether it means "nothing to do here" or "I will
// come back to this". So the rule is that a no-op must say why. A comment inside the
// body, or immediately above it, is enough.
const stubs = [];
for (const { f, s } of jsSrc) {
    const lines = s.split('\n');
    const re = /^\s{2,}(?:static\s+|async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{([\s\S]{0,400}?)\}/gm;
    let m;
    while ((m = re.exec(s))) {
        const name = m[1];
        const body = m[2];
        if (['if', 'for', 'while', 'switch', 'catch', 'function', 'constructor'].includes(name)) continue;
        // Does the body do anything beyond returning a literal?
        const meat = body.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
        const inert = meat === '' || /^return\s+(true|false|null|undefined|0)\s*;$/.test(meat);
        if (!inert) continue;
        // Explained, either inside the body or in the lines just above it?
        const upto = s.slice(0, m.index).split('\n').length;
        const above = lines.slice(Math.max(0, upto - 8), upto).join('\n');
        const explained = /\/\//.test(body) || /\/\*/.test(body) || /\/\/|\*/.test(above);
        if (explained) continue;
        stubs.push(`${rel(f)}  ${name}()  — does nothing, and does not say why`);
    }
}
section('UNDOCUMENTED NO-OPS (cannot be told from unfinished work)', stubs, true);

// ── 2. element ids referenced by JS but present in no markup ───────────────
const markupIds = new Set([...allHtml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
// Ids created at runtime, two ways. `el.id = 'x'` is the obvious one; the other is a
// component that builds its own markup as a template string, which several here do —
// TimeControlUI writes its entire panel through innerHTML, so every one of its controls
// looked like a reference to something that does not exist.
const runtimeIds = new Set([
    ...[...allJs.matchAll(/\.id\s*=\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
    ...[...allJs.matchAll(/\bid=["'`]([A-Za-z][\w-]*)["'`]/g)].map((m) => m[1]),
    ...[...allJs.matchAll(/\bid=\\?["']([A-Za-z][\w-]*)\\?["']/g)].map((m) => m[1])
]);
const missingIds = [];
for (const { f, s } of jsSrc) {
    for (const m of s.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const id = m[1];
        if (!markupIds.has(id) && !runtimeIds.has(id)) {
            missingIds.push(`${rel(f)}  #${id}  — referenced but in no HTML, and never created`);
        }
    }
}
section('ELEMENT IDS THAT DO NOT EXIST', [...new Set(missingIds)], true);

// ── 3. scripts referenced by index.html that are not on disk ───────────────
const badScripts = [];
for (const m of read(path.join(ROOT, 'index.html')).matchAll(/<script[^>]+src="([^"]+)"/g)) {
    const src = m[1];
    if (src.startsWith('http')) continue;
    if (!fs.existsSync(path.join(ROOT, src))) badScripts.push(`index.html -> ${src}  — file missing`);
}
for (const m of read(path.join(ROOT, 'index.html')).matchAll(/<link[^>]+href="([^"]+\.css)"/g)) {
    if (!fs.existsSync(path.join(ROOT, m[1]))) badScripts.push(`index.html -> ${m[1]}  — file missing`);
}
section('ASSETS REFERENCED BUT MISSING', badScripts, true);

// ── 4. globals exported and never used ─────────────────────────────────────
// SineShape sat here for weeks: loaded on every page, referenced by nothing.
const unusedGlobals = [];
for (const { f, s } of jsSrc) {
    for (const m of s.matchAll(/window\.([A-Z][\w$]*)\s*=\s*\1\s*;/g)) {
        const name = m[1];
        // Count references outside its own defining file.
        let uses = 0;
        for (const other of jsSrc) {
            if (other.f === f) continue;
            uses += (other.s.match(new RegExp('\\b' + name + '\\b', 'g')) || []).length;
        }
        uses += (allHtml.match(new RegExp('\\b' + name + '\\b', 'g')) || []).length;
        if (uses === 0) unusedGlobals.push(`${rel(f)}  window.${name}  — exported, referenced nowhere else`);
    }
}
section('GLOBALS EXPORTED AND NEVER USED', unusedGlobals, true);

// ── 5. methods defined and never called ────────────────────────────────────
// Advisory: a public API or an event-handler passed by reference has no textual caller.
const uncalled = [];
for (const { f, s } of jsSrc) {
    const defs = [...s.matchAll(/^\s{4}(?:static\s+|async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm)]
        .map((m) => m[1])
        .filter((n) => !['constructor', 'if', 'for', 'while', 'switch', 'catch'].includes(n));
    for (const name of new Set(defs)) {
        // The pattern requires a preceding dot, bracket or quote, which a DEFINITION line
        // (`    name() {`) does not have — so any match at all is a real call site. The
        // first version required more than one and reported forty live methods as dead,
        // including every setup step on the Projects page. `this.setupFilters()` appears
        // exactly once and is called exactly once.
        const calls = (allJs.match(new RegExp('[.\\[\'"`]' + name + '\\b', 'g')) || []).length;
        const inHtml = (allHtml.match(new RegExp('\\b' + name + '\\b', 'g')) || []).length;
        if (calls === 0 && inHtml === 0) {
            uncalled.push(`${rel(f)}  ${name}()  — no caller found`);
        }
    }
}
section('METHODS WITH NO CALLER (advisory — public API and callbacks land here)', uncalled, false);

// ── 6. ids in markup that nothing styles or scripts ────────────────────────
const orphanIds = [];
for (const id of markupIds) {
    const inJs = allJs.includes("'" + id + "'") || allJs.includes('"' + id + '"');
    const inCss = allCss.includes('#' + id);
    if (!inJs && !inCss) orphanIds.push(`#${id}  — in markup, used by no script or stylesheet`);
}
section('MARKUP IDS NOTHING USES (advisory — some are anchors or aria targets)', orphanIds, false);

console.log('\n' + '─'.repeat(72));
console.log(problems === 0
    ? 'No definite defects found.'
    : problems + ' definite defect(s) — see the fatal sections above.');
process.exit(problems === 0 ? 0 : 1);
