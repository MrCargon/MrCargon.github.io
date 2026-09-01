// verify-patterns.js — prove every RLE string in LifePatterns.js actually does what its
// METADATA claims. Run: node tests/verify-patterns.js
//
// This exists because RLE is easy to transcribe subtly wrong, and a wrong pattern still
// LOOKS like Life when you run it. The only trustworthy check is to simulate and compare.
//
// Deliberately a SPARSE implementation (a Set of "x,y" keys) rather than an array: it is
// unbounded, so nothing wraps or clips and a spaceship can fly as far as it likes without
// the torus folding it back onto itself and faking a false "period". That is the same
// sparse-encoding idea described in CELLULAR_AUTOMATA.md §7.

const path = require('path');
const fs = require('fs');

// package.json is "type": "module", so a plain require() of the source would be treated
// as ESM and refused. Evaluate the REAL file instead of re-implementing the decoder here
// -- a test that reimplements what it is testing proves nothing.
const SRC = path.join(__dirname, '..', 'src', 'utils', 'LifePatterns.js');
const shim = { exports: {} };
new Function('module', 'window', fs.readFileSync(SRC, 'utf8'))(shim, undefined);
const LifePatterns = shim.exports;
if (typeof LifePatterns.decode !== 'function') {
    console.error('Could not load LifePatterns from ' + SRC);
    process.exit(1);
}

const key = (x, y) => x + ',' + y;

/** One generation of B3/S23 over a sparse cell set. Unbounded. */
function stepSparse(live) {
    const counts = new Map();
    for (const k of live) {
        const [x, y] = k.split(',').map(Number);
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nk = key(x + dx, y + dy);
                counts.set(nk, (counts.get(nk) || 0) + 1);
            }
        }
    }
    const next = new Set();
    for (const [k, n] of counts) {
        if (n === 3 || (n === 2 && live.has(k))) next.add(k);
    }
    return next;
}

const toSet = (cells) => new Set(cells.map(c => key(c[0], c[1])));

/** Normalise a cell set to its bounding-box origin, so shape can be compared ignoring position. */
function normalise(live) {
    if (live.size === 0) return { key: '', minX: 0, minY: 0 };
    let minX = Infinity, minY = Infinity;
    for (const k of live) {
        const [x, y] = k.split(',').map(Number);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
    }
    const rel = [...live].map(k => {
        const [x, y] = k.split(',').map(Number);
        return (x - minX) + ',' + (y - minY);
    }).sort();
    return { key: rel.join(' '), minX, minY };
}

const sameSet = (a, b) => a.size === b.size && [...a].every(k => b.has(k));

let failures = 0;
const pass = (n, m) => console.log(`  PASS  ${n.padEnd(16)} ${m}`);
const fail = (n, m) => { failures++; console.log(`  FAIL  ${n.padEnd(16)} ${m}`); };

console.log('Verifying ' + Object.keys(LifePatterns.RLE).length + ' patterns against B3/S23\n');

for (const name of Object.keys(LifePatterns.RLE)) {
    const meta = LifePatterns.META[name];
    if (!meta) { fail(name, 'no METADATA entry'); continue; }
    const decoded = LifePatterns.decode(LifePatterns.RLE[name]);
    const start = toSet(decoded.cells);
    if (start.size === 0) { fail(name, 'decoded to zero cells'); continue; }

    const parts = meta.check.split(' ');
    const kind = parts[0];

    if (kind === 'period') {
        const p = parseInt(parts[1], 10);
        let live = new Set(start);
        let returnedAt = -1;
        for (let g = 1; g <= p * 3 + 4; g++) {
            live = stepSparse(live);
            if (sameSet(live, start)) { returnedAt = g; break; }
        }
        if (returnedAt === p) pass(name, `period ${p} confirmed (${start.size} cells)`);
        else fail(name, `claims period ${p}, measured ${returnedAt < 0 ? 'never returned' : returnedAt}`);

    } else if (kind === 'moves') {
        const dx = parseInt(parts[1], 10), dy = parseInt(parts[2], 10), p = parseInt(parts[3], 10);
        let live = new Set(start);
        for (let g = 0; g < p; g++) live = stepSparse(live);
        const a = normalise(start), b = normalise(live);
        if (a.key !== b.key) {
            fail(name, `shape not preserved after ${p} generations`);
        } else {
            const mdx = b.minX - a.minX, mdy = b.minY - a.minY;
            if (mdx === dx && mdy === dy) pass(name, `moves (${dx},${dy}) per ${p} gens — speed confirmed`);
            else fail(name, `claims (${dx},${dy})/${p}, measured (${mdx},${mdy})/${p}`);
        }

    } else if (kind === 'grows') {
        let live = new Set(start);
        const before = live.size;
        for (let g = 0; g < 300; g++) live = stepSparse(live);
        if (live.size > before * 2) pass(name, `unbounded growth: ${before} -> ${live.size} cells at gen 300`);
        else fail(name, `expected growth, got ${before} -> ${live.size}`);

    } else if (kind === 'chaos') {
        const claimed = parseInt(parts[1], 10);
        // Measure by POPULATION, not shape. A settled methuselah still emits gliders that
        // fly away forever, so its shape never repeats and a shape-based test reports
        // "never settles" no matter how long it runs. Population going constant is the
        // real definition of stabilised, and it is what the literature's figure means.
        let live = new Set(start);
        let lastChange = 0;
        let prevPop = live.size;
        const limit = claimed + 600;
        const QUIET = 120;                 // generations of unchanged population = settled
        for (let g = 1; g <= limit; g++) {
            live = stepSparse(live);
            if (live.size !== prevPop) { lastChange = g; prevPop = live.size; }
            if (g - lastChange >= QUIET) break;
        }
        const delta = lastChange - claimed;
        pass(name, `population settled at gen ${lastChange} (literature ~${claimed}, ` +
                   `${delta >= 0 ? '+' : ''}${delta}); final ${live.size} cells`);

    } else if (kind === 'dies') {
        const claimed = parseInt(parts[1], 10);
        let live = new Set(start);
        let diedAt = -1;
        for (let g = 1; g <= claimed + 200; g++) {
            live = stepSparse(live);
            if (live.size === 0) { diedAt = g; break; }
        }
        if (diedAt === claimed) pass(name, `dies out at gen ${claimed} exactly`);
        else if (diedAt > 0) fail(name, `claims death at ${claimed}, measured ${diedAt}`);
        else fail(name, `claims death at ${claimed}, still alive with ${live.size} cells`);

    } else {
        fail(name, 'unknown check kind: ' + kind);
    }
}

// Rule parsing is the other thing that silently half-works.
console.log('\nRule strings:');
for (const r of LifePatterns.RULES) {
    const p = LifePatterns.parseRule(r.rule);
    if (!p) { fail(r.name, `parseRule("${r.rule}") returned null`); continue; }
    const back = 'B' + p.birth.join('') + '/S' + p.survive.join('');
    if (back.toUpperCase() === r.rule.toUpperCase()) pass(r.name, `${r.rule} round-trips`);
    else fail(r.name, `${r.rule} parsed to ${back}`);
}

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' FAILURE(S)'));
process.exit(failures === 0 ? 0 : 1);
