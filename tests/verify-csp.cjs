#!/usr/bin/env node
/**
 * verify-csp.cjs - the CSP in index.html stays strict and actually matches the page.
 *
 * Roast R3 #7. Checks, offline:
 *   1. script-src has no 'unsafe-inline' / 'unsafe-eval', no cdnjs, and no WHOLE-host
 *      jsdelivr (only a path under it).
 *   2. Every inline <script> (no src) is the import map, and its sha256 is in script-src.
 *      Prints the right hash when it is not, so an edit to the map is a one-line fix.
 *   3. Every URL the import map can resolve to that the page uses has a sha384
 *      integrity entry, and every integrity URL is allowed by script-src.
 *   4. No inline on*= event-handler attributes in index.html, src/**.html or HTML
 *      templates inside src/**.js (they need 'unsafe-inline').
 * With --online it also downloads every integrity URL and checks the sha384 matches.
 *
 * Usage: node tests/verify-csp.cjs [--online]     exit 0 = pass, 1 = fail
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
// The HTML parser turns CRLF into LF before hashing an inline script, so do the same.
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails++; };

const cspMatch = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
ok(!!cspMatch, 'CSP meta tag present');
const csp = cspMatch ? cspMatch[1] : '';
const dir = {};
for (const part of csp.split(';')) {
    const t = part.trim().split(/\s+/);
    if (t[0]) dir[t[0]] = t.slice(1);
}
const scriptSrc = dir['script-src'] || [];
ok(scriptSrc.length > 0, 'script-src present');
ok(!scriptSrc.includes("'unsafe-inline'"), "script-src has no 'unsafe-inline'");
ok(!scriptSrc.includes("'unsafe-eval'"), "script-src has no 'unsafe-eval'");
ok(!csp.includes('cdnjs.cloudflare.com'), 'cdnjs is not allowed anywhere (nothing loads from it)');
ok(!scriptSrc.some((s) => /^https:\/\/cdn\.jsdelivr\.net\/?$/.test(s)), 'jsdelivr is path-pinned, not whole-host');
ok((dir['object-src'] || []).join(' ') === "'none'", "object-src 'none'");

// 2. inline scripts
const noComments = html.replace(/<!--[\s\S]*?-->/g, '');
const scripts = [...noComments.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const inline = scripts.filter((m) => !/\bsrc\s*=/.test(m[1]));
for (const m of inline) {
    const isMap = /type\s*=\s*["']importmap["']/.test(m[1]);
    ok(isMap, `inline <script${m[1]}> is the import map${isMap ? '' : ' - move it to a file'}`);
    const h = "'sha256-" + crypto.createHash('sha256').update(m[2], 'utf8').digest('base64') + "'";
    ok(scriptSrc.includes(h), `inline script hash ${h} is in script-src`);
}

// 3. import map integrity
const mapM = html.match(/<script\s+type=["']importmap["']\s*>([\s\S]*?)<\/script>/);
let map = {};
try { map = JSON.parse(mapM[1]); ok(true, 'import map is valid JSON'); } catch (e) { ok(false, 'import map is valid JSON: ' + e.message); }
const integrity = map.integrity || {};
const imports = map.imports || {};
// What the page actually imports through the map: three-boot.js's specifiers plus
// three.module.min.js's own relative import of three.core.min.js.
const boot = fs.readFileSync(path.join(ROOT, 'src', 'three-boot.js'), 'utf8');
const specs = [...boot.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
const resolve = (spec) => {
    if (imports[spec]) return imports[spec];
    const key = Object.keys(imports).find((k) => k.endsWith('/') && spec.startsWith(k));
    return key ? imports[key] + spec.slice(key.length) : null;
};
const needed = new Set(specs.map(resolve).filter(Boolean));
if (imports.three) needed.add(new URL('./three.core.min.js', imports.three).href);
ok(needed.size >= 6, `resolved ${needed.size} CDN module URLs from src/three-boot.js`);
for (const u of needed) ok(/^sha384-[A-Za-z0-9+/]{64}$/.test(integrity[u] || ''), `integrity sha384 for ${u}`);
const allowed = (u) => scriptSrc.some((s) => s.startsWith('https://') && (s.endsWith('/') ? u.startsWith(s) : u === s));
for (const u of Object.keys(integrity)) ok(allowed(u), `script-src allows ${u}`);

// 4. inline handlers
const handlerRe = /\son(?:click|error|load|change|input|submit|focus|blur|key\w+|mouse\w+|pointer\w+|touch\w+)\s*=\s*["']/i;
const files = ['index.html'];
(function walk(d) {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
        const rel = path.join(d, e.name);
        if (e.isDirectory()) { if (!/vendor$/.test(rel)) walk(rel); }
        else if (/\.(html|js)$/.test(e.name)) files.push(rel);
    }
})('src');
const offenders = [];
for (const f of files) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    text.split(/\r?\n/).forEach((line, i) => { if (handlerRe.test(line)) offenders.push(`${f}:${i + 1}`); });
}
ok(offenders.length === 0, `no inline on*= handlers (${files.length} files)${offenders.length ? ': ' + offenders.join(', ') : ''}`);

async function online() {
    for (const [u, want] of Object.entries(integrity)) {
        const res = await fetch(u);
        const buf = Buffer.from(await res.arrayBuffer());
        const got = 'sha384-' + crypto.createHash('sha384').update(buf).digest('base64');
        ok(res.ok && got === want, `online sha384 matches ${u}${got === want ? '' : ' (got ' + got + ')'}`);
    }
}

(process.argv.includes('--online') ? online() : Promise.resolve()).then(() => {
    console.log(fails ? `\n${fails} check(s) FAILED` : '\nall CSP checks passed');
    process.exit(fails ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
