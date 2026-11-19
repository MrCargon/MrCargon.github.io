#!/usr/bin/env node
/**
 * verify-lazy-bundles.cjs - the lazy page bundles, index.html and sw.js agree.
 *
 * Roast R2 #7a moved the Life / Studio / Calendar / Notes / cosmology scripts out of
 * index.html into src/utils/LazyBundles.js, loaded on first navigation. Three lists now
 * describe the same files, and each drift breaks something quietly:
 *   - a bundle file missing on disk       -> that page shows its Retry panel forever;
 *   - a bundle file ALSO in index.html    -> it runs twice: "class X already declared";
 *   - sw.js LAZY_CODE missing a file      -> that page cannot open offline;
 *   - LazyBundles.js not in index.html, or after PageManager / SpaceEnvironment.
 *
 * Positive controls: the same check runs on three deliberately broken copies (a file
 * dropped from sw.js, a lazy file put back into index.html, a bundle file renamed) and
 * each MUST fail, so a check that cannot fail is caught too.
 *
 * Usage: node tests/verify-lazy-bundles.cjs     Exit 0 = pass, 1 = fail.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function loadBundles(src) {
    const ctx = { console, Promise, Map, Set, setTimeout, module: { exports: {} } };
    vm.createContext(ctx);
    vm.runInContext(src, ctx, { filename: 'LazyBundles.js' });
    return ctx.module.exports.BUNDLES;
}

function swList(src) {
    const m = src.match(/const LAZY_CODE = \[([\s\S]*?)\];/);
    if (!m) return null;
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1].replace(/^\.\//, ''));
}

function check(bundles, sw, html, exists) {
    const errs = [];
    if (!bundles || typeof bundles !== 'object') return ['LazyBundles.BUNDLES not found'];
    if (!sw) return ['sw.js has no LAZY_CODE array'];
    const files = [...new Set(Object.values(bundles).flat())];
    if (files.length === 0) errs.push('no bundle files at all');
    const tags = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    for (const f of files) {
        if (!exists(f)) errs.push(`bundle file missing on disk: ${f}`);
        if (tags.includes(f)) errs.push(`bundle file still loaded by index.html: ${f}`);
        if (!sw.includes(f)) errs.push(`sw.js LAZY_CODE does not precache: ${f}`);
    }
    for (const f of sw) if (!files.includes(f)) errs.push(`sw.js precaches a file no bundle has: ${f}`);
    const at = (s) => tags.indexOf(s);
    const lb = at('src/utils/LazyBundles.js');
    if (lb < 0) errs.push('index.html does not load src/utils/LazyBundles.js');
    for (const user of ['src/components/ui/PageManager.js', 'src/components/simulation/solarsystem/SpaceEnvironment.js']) {
        if (at(user) < 0) errs.push(`index.html does not load ${user}`);
        else if (lb > at(user)) errs.push(`LazyBundles.js must load before ${user}`);
    }
    return errs;
}

const bundles = loadBundles(read('src/utils/LazyBundles.js'));
const sw = swList(read('sw.js'));
const html = read('index.html');
const exists = (f) => fs.existsSync(path.join(ROOT, f));

let fail = 0;
const real = check(bundles, sw, html, exists);
const nFiles = bundles ? new Set(Object.values(bundles).flat()).size : 0;
if (real.length) { fail++; real.forEach((e) => console.log('FAIL ' + e)); }
else console.log(`ok   ${Object.keys(bundles).length} bundles, ${nFiles} files: on disk, not in index.html, precached by sw.js`);

// Positive controls: each broken copy must be caught.
const first = sw && sw[0];
const controls = [
    ['sw.js missing a file', () => check(bundles, sw.slice(1), html, exists)],
    ['lazy file back in index.html', () => check(bundles, sw, html + `<script src="${first}" defer></script>`, exists)],
    ['bundle file renamed', () => check(bundles, sw, html, (f) => f !== first && exists(f))],
];
for (const [name, run] of controls) {
    const errs = run();
    if (errs.length) console.log(`ok   control caught: ${name}`);
    else { fail++; console.log(`FAIL control NOT caught: ${name}`); }
}
console.log(fail ? `\n${fail} failure(s)` : '\nall passed');
process.exit(fail ? 1 : 0);
