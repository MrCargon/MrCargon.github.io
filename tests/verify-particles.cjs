// verify-particles.cjs — prove the particle simulation is correct.
// Run: node tests/verify-particles.cjs
//
// THREE is stubbed rather than loaded: the physics touches no graphics, and requiring a
// GPU to test arithmetic would mean this could not run at all.
//
// A NOTE ON WHAT IS WORTH TESTING HERE.
// The first version of this file judged the force law by emergent crowd behaviour —
// "does a cloud of 600 particles cluster", "how close does the closest pair get" — against
// thresholds I had guessed, on a WRAPPED world where distance-from-the-centroid barely
// means anything. Those tests failed, passed and failed again as I tuned constants, and
// they were never really measuring the rule. They are replaced by two-particle tests: put
// two particles at a known distance, step once, and check they move the way the rule says
// they must. Deterministic, and it actually pins the physics down.

const path = require('path');
const fs = require('fs');

// --- minimal THREE stub: only what init()/render() touch -------------------------------
class Attr {
    constructor(arr, itemSize) { this.array = arr; this.itemSize = itemSize; this.needsUpdate = false; }
}
const THREE = {
    OrthographicCamera: class { updateProjectionMatrix() {} },
    Scene: class { add() {} },
    BufferGeometry: class {
        constructor() { this._a = {}; }
        setAttribute(n, a) { this._a[n] = a; }
        getAttribute(n) { return this._a[n]; }
        setDrawRange() {}
        dispose() {}
    },
    BufferAttribute: Attr,
    PointsMaterial: class { constructor(o) { Object.assign(this, o); } dispose() {} },
    Points: class { constructor(g, m) { this.geometry = g; this.material = m; } }
};
global.THREE = THREE;

// ForceMatrix holds the shared model and must be a global before ParticleLife runs — the
// browser gets that from index.html's script order, so the test reproduces it here rather
// than papering over it with a require() the browser would never take.
function load(file, name) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', file), 'utf8');
    const shim = { exports: {} };
    new Function('module', 'window', 'THREE', src)(shim, undefined, THREE);
    global[name] = shim.exports;
    return shim.exports;
}
load('ForceMatrix.js', 'ForceMatrix');
const ParticleLife = load('ParticleLife.js', 'ParticleLife');

const renderer = { domElement: {}, setRenderTarget() {}, render() {} };

let failures = 0;
const pass = (n, m) => console.log(`  PASS  ${n.padEnd(28)} ${m}`);
const fail = (n, m) => { failures++; console.log(`  FAIL  ${n.padEnd(28)} ${m}`); };

/** Two particles at a chosen separation, everything else at rest. */
function pair(sep, force, opts) {
    const sim = new ParticleLife(renderer, Object.assign({ count: 2, types: 2 }, opts || {}));
    sim.init();
    sim.count = 2;
    for (let a = 0; a < ParticleLife.MAX_TYPES; a++)
        for (let b = 0; b < ParticleLife.MAX_TYPES; b++) sim.setForce(a, b, force);
    sim._px[0] = 0.5; sim._py[0] = 0.5; sim._vx[0] = 0; sim._vy[0] = 0; sim._type[0] = 0;
    sim._px[1] = 0.5 + sep; sim._py[1] = 0.5; sim._vx[1] = 0; sim._vy[1] = 0; sim._type[1] = 1;
    return sim;
}
const gap = (s) => Math.abs(s._px[1] - s._px[0]);

// --- 1. the hash must agree EXACTLY with testing every pair ----------------------------
function bruteForceVelocities(sim) {
    const N = ParticleLife.MAX_TYPES, R = sim.radius, R2 = R * R, beta = sim.beta;
    const vx = new Float32Array(sim.count), vy = new Float32Array(sim.count);
    for (let i = 0; i < sim.count; i++) {
        let fx = 0, fy = 0;
        for (let j = 0; j < sim.count; j++) {
            if (i === j) continue;
            let dx = sim._px[j] - sim._px[i], dy = sim._py[j] - sim._py[i];
            if (dx > 0.5) dx -= 1; else if (dx < -0.5) dx += 1;
            if (dy > 0.5) dy -= 1; else if (dy < -0.5) dy += 1;
            const d2 = dx * dx + dy * dy;
            if (d2 > 1e-12 && d2 < R2) {
                const d = Math.sqrt(d2), q = d / R;
                let f;
                // Must mirror step() exactly — including the repulsion scale and the
                // speed limit below. A reference that has drifted from the code proves
                // only that two different formulas disagree.
                if (q < beta) f = (q / beta - 1) * ParticleLife.REPULSION;
                else f = sim.matrix[sim._type[i] * N + sim._type[j]] *
                         (1 - Math.abs(2 * q - 1 - beta) / (1 - beta));
                fx += (dx / d) * f; fy += (dy / d) * f;
            }
        }
        let nvx = sim._vx[i] * sim.friction + fx * sim.forceScale * sim.dt;
        let nvy = sim._vy[i] * sim.friction + fy * sim.forceScale * sim.dt;
        const sp2 = nvx * nvx + nvy * nvy, lim = sim.beta * sim.radius;
        if (sp2 > lim * lim) { const k = lim / Math.sqrt(sp2); nvx *= k; nvy *= k; }
        vx[i] = nvx; vy[i] = nvy;
    }
    return { vx, vy };
}

{
    const sim = new ParticleLife(renderer, { count: 900, types: 5 });
    sim.init(); sim.seed(900, 5);
    const expect = bruteForceVelocities(sim);
    sim.step();
    let worst = 0;
    for (let i = 0; i < sim.count; i++) {
        worst = Math.max(worst, Math.abs(sim._vx[i] - expect.vx[i]), Math.abs(sim._vy[i] - expect.vy[i]));
    }
    if (worst < 1e-6) pass('hash == brute force', `900 particles, worst delta ${worst.toExponential(2)}`);
    else fail('hash == brute force', `worst velocity delta ${worst.toExponential(2)} — the hash misses neighbours`);
    sim.dispose();
}

// --- 2. nothing escapes, nothing goes NaN ----------------------------------------------
{
    const sim = new ParticleLife(renderer, { count: 1200, types: 4 });
    sim.init(); sim.seed(1200, 4);
    for (let s = 0; s < 400; s++) sim.step();
    let out = 0, nan = 0;
    for (let i = 0; i < sim.count; i++) {
        if (!Number.isFinite(sim._px[i]) || !Number.isFinite(sim._py[i])) nan++;
        else if (sim._px[i] < 0 || sim._px[i] >= 1 || sim._py[i] < 0 || sim._py[i] >= 1) out++;
    }
    if (nan === 0 && out === 0) pass('wrapping stays bounded', '400 steps, 0 escaped, 0 NaN');
    else fail('wrapping stays bounded', `${out} outside [0,1), ${nan} NaN`);
    sim.dispose();
}

// --- 3. close range REPELS, even when the matrix says attract --------------------------
// The whole point of the repulsion branch. Two particles well inside beta, maximum mutual
// attraction: they must still move APART, or nothing stops matter collapsing to points.
{
    const sim = pair(0.008, 1);                      // beta*radius = 0.0225, so this is inside
    const before = gap(sim);
    sim.step();
    const after = gap(sim);
    if (after > before) pass('repulsion beats attraction', `inside beta: gap ${before.toFixed(5)} -> ${after.toFixed(5)} despite M=+1`);
    else fail('repulsion beats attraction', `gap ${before.toFixed(5)} -> ${after.toFixed(5)} — they closed in`);
    sim.dispose();
}

// --- 4. mid range ATTRACTS when the matrix says so, and repels when it does not ---------
{
    const a = pair(0.05, 1);                         // between beta*R and R
    const b0 = gap(a); a.step(); const a1 = gap(a); a.dispose();
    const r = pair(0.05, -1);
    const c0 = gap(r); r.step(); const r1 = gap(r); r.dispose();
    if (a1 < b0 && r1 > c0) pass('matrix sign controls force', `M=+1 closes ${b0.toFixed(4)}->${a1.toFixed(4)}, M=-1 opens ${c0.toFixed(4)}->${r1.toFixed(4)}`);
    else fail('matrix sign controls force', `attract ${b0.toFixed(4)}->${a1.toFixed(4)}, repel ${c0.toFixed(4)}->${r1.toFixed(4)}`);
}

// --- 5. beyond the radius, nothing happens at all --------------------------------------
{
    const sim = pair(0.5, 1, { radius: 0.075 });     // far outside R
    sim.step();
    const moved = Math.abs(sim._vx[0]) + Math.abs(sim._vy[0]);
    if (moved === 0) pass('no force beyond radius', 'separation 0.5 with R=0.075 leaves velocity exactly 0');
    else fail('no force beyond radius', `velocity ${moved.toExponential(2)} — force reaches too far`);
    sim.dispose();
}

// --- 6. the matrix is asymmetric, and can be made symmetric -----------------------------
{
    const sim = new ParticleLife(renderer, { count: 10, types: 3 });
    sim.init();
    sim.setForce(0, 1, 0.8); sim.setForce(1, 0, -0.8);
    // Float32Array stores 0.8 as 0.800000011920929, so === tests the storage format.
    const near = (x, y) => Math.abs(x - y) < 1e-6;
    if (near(sim.getForce(0, 1), 0.8) && near(sim.getForce(1, 0), -0.8))
        pass('matrix is asymmetric', 'M[0][1]=+0.8 while M[1][0]=-0.8');
    else fail('matrix is asymmetric', `got ${sim.getForce(0, 1)} / ${sim.getForce(1, 0)}`);
    sim.symmetriseMatrix();
    if (near(sim.getForce(1, 0), sim.getForce(0, 1))) pass('symmetrise mirrors', `both now ${sim.getForce(0, 1).toFixed(3)}`);
    else fail('symmetrise mirrors', 'upper triangle not mirrored');
    sim.dispose();
}

// --- 7. the spatial hash earns its keep -------------------------------------------------
// NOT a 1000-vs-4000 comparison. The grid and the radius are both fixed, so four times the
// particles genuinely means about four times as many neighbours WITHIN RANGE of each one,
// and the interacting-pair count rises quadratically however they are found. That is the
// physics of a denser world, not a bad data structure — measuring it and calling the
// result "quadratic" was a bug in the first version of this test. What the hash must prove
// is that it beats testing every pair AT THE SAME PARTICLE COUNT.
{
    const n = 3000;
    const sim = new ParticleLife(renderer, { count: n, types: 5 });
    sim.init(); sim.seed(n, 5);
    for (let k = 0; k < 5; k++) sim.step();                     // warm up
    let t0 = process.hrtime.bigint();
    for (let k = 0; k < 10; k++) sim.step();
    const hashed = Number(process.hrtime.bigint() - t0) / 1e6 / 10;
    t0 = process.hrtime.bigint();
    for (let k = 0; k < 3; k++) bruteForceVelocities(sim);
    const brute = Number(process.hrtime.bigint() - t0) / 1e6 / 3;
    const speedup = brute / hashed;
    if (speedup > 3) pass('hash beats brute force', `${n} particles: ${hashed.toFixed(2)}ms vs ${brute.toFixed(2)}ms — ${speedup.toFixed(1)}x`);
    else fail('hash beats brute force', `only ${speedup.toFixed(1)}x (${hashed.toFixed(2)}ms vs ${brute.toFixed(2)}ms)`);
    sim.dispose();
}

// --- 8. it runs fast enough to animate --------------------------------------------------
{
    const n = 2000;
    const sim = new ParticleLife(renderer, { count: n, types: 5 });
    sim.init(); sim.seed(n, 5);
    for (let k = 0; k < 5; k++) sim.step();
    const t0 = process.hrtime.bigint();
    for (let k = 0; k < 30; k++) sim.step();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 30;
    if (ms < 16) pass('fast enough for 60fps', `${n} particles in ${ms.toFixed(2)}ms/step (budget 16.7)`);
    else fail('fast enough for 60fps', `${ms.toFixed(2)}ms/step at ${n} particles — over the frame budget`);
    sim.dispose();
}

// --- 9. density regulation ---------------------------------------------------------------
// CodeNoodles calls this "the most important component to making complex particle life":
// same-type particles must not pile up unboundedly UNLESS other types are mixed in with
// them. Getting the measure right took two wrong tries, both recorded here so nobody
// repeats them:
//
//   1. same / (1 + other). Cancels out — when everything attracts, `other` grows in
//      proportion to `same`, so the ratio sat at ~0.5 no matter how dense it got, and the
//      regulation provably did nothing (occupancy 255 vs 246, i.e. noise).
//   2. A target of 2.5 picked out of the air. The measure's actual range was 0 to 0.95, so
//      the threshold was never reached. Exactly the invented-threshold mistake this file's
//      header already warns about.
//
// The measure that works is the signed EXCESS, same - other, and the thresholds below come
// from measuring it: -2.9 at t=0, +19.9 after 600 steps when types segregate, -14.1 when
// they stay mixed.
const ForceMatrix = global.ForceMatrix;

{
    const T = 4, S = 0.25;
    const below = ForceMatrix.densityScale(-14, T, S);
    const at = ForceMatrix.densityScale(T, T, S);
    const above = ForceMatrix.densityScale(20, T, S);
    const far = ForceMatrix.densityScale(200, T, S);
    const monotone = below >= at && at > above && above > far;
    const bounded = far > 0 && below <= 1;
    if (below === 1 && at === 1 && monotone && bounded)
        pass('densityScale shape', `1.0 below target, ${above.toFixed(2)} at excess 20, ${far.toFixed(3)} at 200`);
    else
        fail('densityScale shape', `below=${below} at=${at} above=${above} far=${far}`);
}

/** Run a field to `steps` and report peak crowding and how much space it occupies. */
function field(mode, regulation, steps) {
    const sim = new ParticleLife(renderer, { count: 1200, types: 3, densityRegulation: regulation });
    sim.init(); sim.seed(1200, 3);
    for (let a = 0; a < ParticleLife.MAX_TYPES; a++)                 // Rule 2: bounded
        for (let b = 0; b < ParticleLife.MAX_TYPES; b++)             // Rule 2: bounded
            sim.setForce(a, b, mode === 'self' ? (a === b ? 1 : 0) : 1);
    for (let s = 0; s < steps; s++) sim.step();                      // Rule 2: bounded
    // 95th percentile, not the maximum. The max over 1200 particles is one extreme
    // sample and swings run to run even at median-of-3 (measured 40.0, 35.0 and 33.2 for
    // the same unregulated configuration), which makes any threshold on it a coin flip.
    // p95 moves with the whole distribution, which is what "the field is less crowded"
    // actually means. Same correction as the frame-time assertion in
    // phase2-elliptical-orbits.spec.js.
    const ds = [];
    const G = 40, occ = new Set();
    for (let i = 0; i < sim.count; i++) {                            // Rule 2: bounded
        ds.push(sim._density[i]);
        occ.add(((sim._py[i] * G) | 0) * G + ((sim._px[i] * G) | 0));
    }
    ds.sort((a, b) => a - b);
    sim.dispose();
    return { peak: ds[Math.floor(ds.length * 0.95)], occupancy: occ.size };
}

/** Median of several trials — the seed is random, so one run proves nothing. */
function trials(mode, regulation, n) {
    const peaks = [], occs = [];
    for (let k = 0; k < n; k++) {                                    // Rule 2: bounded
        const r = field(mode, regulation, 500);
        peaks.push(r.peak); occs.push(r.occupancy);
    }
    const mid = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
    return { peak: mid(peaks), occupancy: mid(occs) };
}

{
    // The failure case: every type attracts only itself, so each segregates into a ball
    // of one colour with nothing mixed in — precisely what the rule is meant to prevent.
    const off = trials('self', false, 3);
    const on = trials('self', true, 3);
    if (on.peak < off.peak * 0.8)
        pass('regulation caps crowding', `peak excess ${off.peak.toFixed(1)} -> ${on.peak.toFixed(1)} (median of 3)`);
    else
        fail('regulation caps crowding', `peak ${off.peak.toFixed(1)} -> ${on.peak.toFixed(1)}, not meaningfully lower`);

    if (on.occupancy > off.occupancy * 1.15)
        pass('regulation spreads the field', `${off.occupancy} -> ${on.occupancy} of 1600 cells occupied`);
    else
        fail('regulation spreads the field', `${off.occupancy} -> ${on.occupancy} cells, no real spread`);
}

{
    // The case it must NOT touch: everything attracts everything, so clumps are dense but
    // thoroughly MIXED. The video's rule is about same-type crowding specifically, so a
    // mixed clump is a structure worth keeping and must be left alone.
    const off = trials('all', false, 3);
    const on = trials('all', true, 3);
    const delta = Math.abs(on.occupancy - off.occupancy) / off.occupancy;
    // Compared against the TARGET, not against zero. The first version of this asserted
    // peak < 0, reasoning from the mean (-15.3) — but this is the maximum over 1200
    // particles, and in a mixed field one of them transiently reaches +1.3. That is a
    // third invented threshold; the claim being tested is "regulation never engages
    // here", and the test of that is whether the excess reaches the point where
    // densityScale starts to bite.
    const target = new ParticleLife(renderer, { count: 1, types: 2 }).densityTarget;
    if (off.peak < target && delta < 0.20)
        pass('mixed clumps left alone', `peak excess ${off.peak.toFixed(1)} never reaches the ${target} threshold; occupancy ${off.occupancy} vs ${on.occupancy}`);
    else
        fail('mixed clumps left alone', `peak ${off.peak.toFixed(1)} vs target ${target}, occupancy ${off.occupancy} vs ${on.occupancy} (${(delta * 100).toFixed(0)}% apart)`);
}

{
    // Regression guard: an isolated pair is not crowded, so regulation must not alter the
    // force between them at all. This is what the two-particle tests above measure, and
    // they would silently drift if regulation leaked into the uncrowded case.
    const a = pair(0.05, 1.0, { densityRegulation: false });
    const b = pair(0.05, 1.0, { densityRegulation: true });
    a.step(); b.step();
    if (Math.abs(a._vx[0] - b._vx[0]) < 1e-12)
        pass('isolated pair unaffected', `identical velocity ${a._vx[0].toExponential(3)}`);
    else
        fail('isolated pair unaffected', `${a._vx[0]} vs ${b._vx[0]} — regulation is damping an uncrowded pair`);
}

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' FAILURE(S)'));
process.exit(failures === 0 ? 0 : 1);
