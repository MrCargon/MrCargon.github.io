#!/usr/bin/env node
/**
 * verify-presence-rules.cjs - the Firebase presence rules really refuse bad records
 * (roast R3 #12). Fully offline: no Firebase project, no network.
 *
 * 1. Reads the RULES JSON out of the comment in src/utils/PresenceConfig.js (the text a
 *    user would paste into the console), so the test runs the real rule strings.
 * 2. Evaluates them with a small Realtime-Database rule engine: .write cascades from the
 *    root, .validate runs on the node and on every child present (named rule or $other),
 *    validate is skipped on delete, {".sv":"timestamp"} becomes `now`, and an expression
 *    that throws counts as false (as on the server).
 * 3. Good and bad records: out-of-range lat/lng, a long name, an extra field, an id that
 *    is not the writer's uid, old/future ts, no auth, overwriting/deleting someone else's
 *    live record. Positive controls: good records are allowed, and the pre-fix rules
 *    (git 1ad803a: ".write": true) accept the bad records, so this test can fail.
 * 4. Client shape: runs the real FirebaseAdapter (src/utils/Presence.js) against a stub
 *    fetch, captures the PUT it would send, and checks the rules accept exactly that.
 *
 * Usage: node tests/verify-presence-rules.cjs     exit 0 = pass, 1 = fail
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails++; };

// ---- 1. rules out of the config comment -------------------------------------------
const cfgSrc = fs.readFileSync(path.join(ROOT, 'src/utils/PresenceConfig.js'), 'utf8');
const block = cfgSrc.split(/\r?\n/).filter((l) => /^\/\/\s{5}/.test(l)).map((l) => l.replace(/^\/\/\s{5}/, ''));
const start = block.findIndex((l) => l.trim() === '{');
let rules = null;
try {
    // the rules block is the first run of lines from "{" that parses as JSON
    for (let end = start + 1; end <= block.length && !rules; end++) {
        try { rules = JSON.parse(block.slice(start, end).join('\n')); } catch (e) { /* keep reading */ }
    }
} catch (e) { rules = null; }
ok(!!(rules && rules.rules && rules.rules.presence), 'rules JSON parsed from the PresenceConfig.js comment');
const NEW = rules ? rules.rules : {};
const OLD = {   // the pre-fix suggestion (PresenceConfig.js at 1ad803a)
    '.read': false, '.write': false,
    presence: { '.read': true, $id: { '.write': true, '.validate': "newData.hasChildren(['lat','lng','ts'])" } }
};

// ---- 2. a small RTDB rule engine ---------------------------------------------------
const ctx = vm.createContext({});
vm.runInContext("String.prototype.matches = function (re) { return re.test(String(this)); };", ctx);
function snap(v) {
    return {
        val: () => (v === undefined ? null : v),
        exists: () => v !== undefined && v !== null,
        child: (k) => snap(v && typeof v === 'object' ? v[k] : undefined),
        hasChildren: (ks) => !!(v && typeof v === 'object') && ks.every((k) => v[k] !== undefined && v[k] !== null),
        isNumber: () => typeof v === 'number',
        isString: () => typeof v === 'string'
    };
}
function evalRule(expr, env) {
    if (expr === true || expr === false) return expr;
    try {
        ctx.__env = env;
        const r = vm.runInContext(`(function(e){ var auth=e.auth, now=e.now, data=e.data, newData=e.newData, root=e.root, $id=e.$id; return (${expr}); })(__env)`, ctx);
        return r === true;
    } catch (e) { return false; }
}
function resolveSv(v, now) {
    if (v && typeof v === 'object') {
        if (v['.sv'] === 'timestamp') return now;
        const o = {}; for (const k of Object.keys(v)) o[k] = resolveSv(v[k], now); return o;
    }
    return v;
}
// write `value` (null = delete) at presence/<id>, current value `existing`.
function canWrite(R, { id, value, existing, auth, now }) {
    const v = resolveSv(value, now);
    const env = { auth, now, data: snap(existing), newData: snap(v), root: snap({}), $id: id };
    const p = R.presence || {}, node = p.$id || {};
    const write = evalRule(R['.write'] || false, env) || evalRule(p['.write'] || false, env) || evalRule(node['.write'] || false, env);
    if (!write) return false;
    if (v === null || v === undefined) return true;                 // validate skipped on delete
    if (node['.validate'] !== undefined && !evalRule(node['.validate'], env)) return false;
    if (typeof v !== 'object') return true;
    for (const k of Object.keys(v)) {
        const rule = (node[k] && node[k]['.validate'] !== undefined) ? node[k]['.validate']
            : (node.$other && node.$other['.validate'] !== undefined) ? node.$other['.validate'] : undefined;
        if (rule === undefined) continue;
        const cenv = Object.assign({}, env, { data: snap(existing ? existing[k] : undefined), newData: snap(v[k]) });
        if (!evalRule(rule, cenv)) return false;
    }
    return true;
}

// ---- 3. cases -----------------------------------------------------------------------
const NOW = 1763540000000;
const A = 'Xq3uVb7KpL2mN9sT4wYz0aBcDeF1';   // a 28-char anonymous uid shape
const B = 'Zz9yXx8wVv7uUu6tTt5sSs4rRr3q';
const authA = { uid: A, provider: 'anonymous' }, authB = { uid: B, provider: 'anonymous' };
const good = (over) => Object.assign({ id: A, lat: 37.8, lng: -122.4, ts: NOW, name: 'You' }, over || {});
const live = good({ ts: NOW - 10000 });
const cases = [
    // [label, request, expected under NEW]
    ['good record (positive control)', { id: A, value: good(), auth: authA }, true],
    ['good record, server timestamp', { id: A, value: good({ ts: { '.sv': 'timestamp' } }), auth: authA }, true],
    ['good record, no name', { id: A, value: (() => { const g = good(); delete g.name; return g; })(), auth: authA }, true],
    ['heartbeat update of own record', { id: A, value: good(), existing: live, auth: authA }, true],
    ['delete own record', { id: A, value: null, existing: live, auth: authA }, true],
    ['delete someone\'s record stale > 5 min', { id: A, value: null, existing: good({ ts: NOW - 400000 }), auth: authB }, true],
    ['lat 91 (out of range)', { id: A, value: good({ lat: 91 }), auth: authA }, false],
    ['lat -90.5 (out of range)', { id: A, value: good({ lat: -90.5 }), auth: authA }, false],
    ['lat as a string', { id: A, value: good({ lat: '37.8' }), auth: authA }, false],
    ['lng 181 (out of range)', { id: A, value: good({ lng: 181 }), auth: authA }, false],
    ['name 21 chars', { id: A, value: good({ name: 'x'.repeat(21) }), auth: authA }, false],
    ['name as a number', { id: A, value: good({ name: 7 }), auth: authA }, false],
    ['extra field (email)', { id: A, value: good({ email: 'a@b.c' }), auth: authA }, false],
    ['extra field (nested blob)', { id: A, value: good({ blob: { big: 'x'.repeat(5000) } }), auth: authA }, false],
    ['id mismatch: B writes key A', { id: A, value: good(), auth: authB }, false],
    ['id mismatch: body id != key', { id: A, value: good({ id: B }), auth: authA }, false],
    ['client me- id as key (not a uid)', { id: 'me-abc123x', value: good({ id: 'me-abc123x' }), auth: { uid: 'me-abc123x' } }, false],
    ['no auth', { id: A, value: good(), auth: null }, false],
    ['ts 2 min old', { id: A, value: good({ ts: NOW - 120000 }), auth: authA }, false],
    ['ts 2 min in the future', { id: A, value: good({ ts: NOW + 120000 }), auth: authA }, false],
    ['missing ts', { id: A, value: (() => { const g = good(); delete g.ts; return g; })(), auth: authA }, false],
    ['B overwrites A\'s live record', { id: A, value: good({ lat: 0 }), existing: live, auth: authB }, false],
    ['B deletes A\'s live record', { id: A, value: null, existing: live, auth: authB }, false],
    ['stale delete without auth', { id: A, value: null, existing: good({ ts: NOW - 400000 }), auth: null }, false],
    ['B replaces A\'s stale record (not a delete)', { id: A, value: good({ id: A }), existing: good({ ts: NOW - 400000 }), auth: authB }, false]
];
let oldAccepted = 0, badCount = 0;
for (const [label, req, expected] of cases) {
    const r = Object.assign({ now: NOW, existing: undefined }, req);
    ok(canWrite(NEW, r) === expected, `${expected ? 'allow' : 'deny '} ${label}`);
    if (!expected) { badCount++; if (canWrite(OLD, Object.assign({}, r, { auth: r.auth }))) oldAccepted++; }
}
// The test must be able to fail: the pre-fix rules let most bad records through.
ok(oldAccepted >= badCount - 3, `control: the pre-fix rules accept ${oldAccepted}/${badCount} of the bad records`);
ok(canWrite(OLD, { id: A, value: good({ lat: 91 }), now: NOW, auth: null }), 'control: pre-fix rules accept lat 91 with no auth');

// ---- 4. the real client's PUT -------------------------------------------------------
(async () => {
    const sent = [];
    const fakeFetch = (url, init) => {
        sent.push({ url: String(url), init: init || {} });
        const u = String(url);
        if (u.includes('accounts:signUp')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ idToken: 'tok-test', localId: A, refreshToken: 'r', expiresIn: '3600' }) });
        if ((init || {}).method === 'GET' || !init) return Promise.resolve({ ok: true, json: () => Promise.resolve(null) });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    };
    const box = vm.createContext({ console: { assert() {}, warn() {}, log() {} }, fetch: fakeFetch, setInterval: () => 1, clearInterval() {},
        Promise, JSON, Date, Math, Number, String, Object, encodeURIComponent, module: { exports: {} } });
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/utils/Presence.js'), 'utf8'), box);
    const FA = box.module.exports.FirebaseAdapter;
    ok(typeof FA === 'function', 'FirebaseAdapter loaded from Presence.js');

    // view-only: no apiKey -> no sign-in, no PUT
    const viewer = new FA({ databaseURL: 'https://example-test.invalid', path: 'presence' });
    viewer.connect({ onRoster() {} });
    viewer.publish({ id: 'me-abc1234', lat: 37.8, lng: -122.4, name: 'You' });
    await new Promise((r) => setTimeout(r, 20));
    ok(!sent.some((s) => s.init.method === 'PUT' || /signUp/.test(s.url)), 'no apiKey: view-only, no sign-in and no PUT');
    sent.length = 0;

    const fa = new FA({ databaseURL: 'https://example-test.invalid', path: 'presence', apiKey: 'test-key' });
    fa.connect({ onRoster() {} });
    fa.publish({ id: 'me-abc1234', lat: 37.8, lng: -122.4, name: 'You' });
    await new Promise((r) => setTimeout(r, 20));
    const put = sent.find((s) => s.init.method === 'PUT');
    ok(!!put, 'with apiKey: signs in, then PUTs one record');
    if (put) {
        const key = decodeURIComponent(put.url.split('/presence/')[1].split('.json')[0]);
        ok(key === A, 'PUT is keyed by the auth uid, not the me- page id');
        ok(/[?&]auth=tok-test/.test(put.url), 'PUT carries the ID token');
        const body = JSON.parse(put.init.body);
        ok(canWrite(NEW, { id: key, value: body, now: NOW, auth: authA }), 'the rules accept the real client\'s record');
        ok(!canWrite(NEW, { id: key, value: body, now: NOW, auth: authB }), 'and refuse it from another uid');
    }
    sent.length = 0;
    fa.publish(null);
    await new Promise((r) => setTimeout(r, 5));
    ok(sent.some((s) => s.init.method === 'DELETE' && s.url.includes('/presence/' + A + '.json?auth=')), 'stop sharing sends an authed DELETE');
    // stale prune: a signed-in sharer deletes a > 5 min old record, bounded at 5 per poll
    fa.publish({ id: 'me-abc1234', lat: 37.8, lng: -122.4, name: 'You' });
    await new Promise((r) => setTimeout(r, 5));
    sent.length = 0;
    const roster = {}; const nowReal = Date.now();
    for (let i = 0; i < 8; i++) roster['old' + i] = { id: 'old' + i, lat: 1, lng: 1, ts: nowReal - 400000 };
    roster.fresh = { id: 'fresh', lat: 2, lng: 2, ts: nowReal - 1000 };
    let shown = null;
    fa.onRoster = (l) => { shown = l; };
    fa._emit(roster);
    const dels = sent.filter((s) => s.init.method === 'DELETE');
    ok(dels.length === 5, `stale prune bounded: ${dels.length} DELETEs for 8 dead records (max 5)`);
    ok(shown && shown.length === 2 && shown.some((r) => r.id === 'fresh'), 'roster shows the fresh peer + self only');
    console.log(fails ? `\n${fails} FAIL` : '\nall pass');
    process.exit(fails ? 1 : 0);
})();
