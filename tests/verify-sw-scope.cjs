#!/usr/bin/env node
/**
 * verify-sw-scope.cjs - the service worker must leave the game sites alone.
 *
 * sw.js sits at the origin root, so its scope is the WHOLE origin, and the games are
 * separate repos published on that same origin (mrcargon.github.io/game-*). If the SW
 * intercepts them, their big .pck/.wasm files go cache-first into the portfolio cache
 * and returning players get stale game builds (roast R3 finding #6).
 *
 * This loads sw.js in a vm with a fake `self`, fires fetch events, and checks which ones
 * call respondWith (= intercepted). Pass-through means the handler returned without
 * calling it, so the browser fetches normally and nothing is cached.
 *
 * Usage: node tests/verify-sw-scope.cjs [path/to/sw.js]   (default: ./sw.js)
 * Exit 0 = pass, 1 = fail. Against the pre-fix sw.js (7101db4) it fails on /game-*.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const swPath = process.argv[2] || path.join(__dirname, '..', 'sw.js');
const src = fs.readFileSync(swPath, 'utf8');

function loadSW(origin, scopePath) {
    const handlers = {};
    const cacheStub = { match: async () => undefined, put: async () => {}, addAll: async () => {} };
    const self = {
        location: new URL(scopePath + 'sw.js', origin),
        registration: { scope: new URL(scopePath, origin).href },
        addEventListener: (type, fn) => { handlers[type] = fn; },
        skipWaiting: () => Promise.resolve(),
        clients: { claim: () => Promise.resolve() },
    };
    const ctx = {
        self, URL, Promise, Set, setTimeout, clearTimeout, console,
        caches: { open: async () => cacheStub, keys: async () => [], delete: async () => true, match: async () => undefined },
        fetch: async () => ({ status: 200, clone() { return this; } }),
        Response: { error: () => ({ status: 0 }) },
    };
    vm.createContext(ctx);
    vm.runInContext(src, ctx, { filename: swPath });
    if (typeof handlers.fetch !== 'function') throw new Error('sw.js registered no fetch handler');
    return handlers.fetch;
}

function intercepted(fetchHandler, url, mode) {
    let called = false;
    const event = {
        request: { method: 'GET', url, mode: mode || 'no-cors' },
        respondWith: (p) => { called = true; if (p && p.catch) p.catch(() => {}); },
        waitUntil: () => {},
    };
    fetchHandler(event);
    return called;
}

const cases = [];
function run(origin, scope) {
    const h = loadSW(origin, scope);
    const base = origin + scope;
    const expect = (rel, want, mode) => cases.push({ url: base + rel, want, got: intercepted(h, base + rel, mode), mode });
    // The games and anything else on the origin: NEVER intercepted.
    expect('game-snake/', false, 'navigate');
    expect('game-snake/index.html', false, 'navigate');
    expect('game-barista/index.pck', false);
    expect('game-barista/index.wasm', false);
    expect('game-tictactoe/index.js', false);
    expect('game-tictactoe/index.html?v=2', false, 'navigate');
    expect('some-future-page/index.html', false, 'navigate');
    expect('README.md', false);
    // Cross-origin: never intercepted.
    cases.push({ url: 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.min.js', want: false,
        got: intercepted(h, 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.min.js') });
    // The portfolio's own files: still managed (offline shell + caching keep working).
    expect('', true, 'navigate');
    expect('index.html', true, 'navigate');
    expect('index.css', true);
    expect('manifest.webmanifest', true);
    expect('icon.svg', true);
    expect('src/main.js', true);
    expect('src/data/studio/content.json', true);
    expect('src/assets/textures/sun/sun_map.jpg', true);
}

run('https://mrcargon.github.io', '/');
// A scope below the origin root (e.g. a local server hosting the repo in a subfolder).
run('http://localhost:3430', '/sub/');

let bad = 0;
for (const c of cases) {
    const ok = c.got === c.want;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.want ? 'managed    ' : 'pass-thru  '} ${c.url}${ok ? '' : `  (intercepted=${c.got})`}`);
}
console.log(`\n${cases.length - bad}/${cases.length} passed (${path.basename(swPath)})`);
process.exit(bad ? 1 : 0);
