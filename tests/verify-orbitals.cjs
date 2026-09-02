// verify-orbitals.cjs — prove the hydrogen orbitals are the real thing.
// Run: node tests/verify-orbitals.cjs
//
// This is the one simulation on the site with EXACT analytic answers to check against, so
// there is no excuse for judging it by eye. Quantum mechanics supplies, for every (n, l):
//
//   - the radial density integrates to exactly 1
//   - the mean radius is (3n^2 - l(l+1)) / 2 Bohr radii
//   - the mean inverse radius is 1 / n^2, exactly
//   - there are exactly n - l - 1 radial nodes and l - |m| angular ones
//   - the 1s density peaks at exactly r = 1 (the Bohr radius, recovered rather than assumed)
//
// If the Laguerre or Legendre recurrences are wrong, or the normalisation is off, or the
// CDF sampler is skewed, at least one of those numbers moves. None of it needs a GPU.

const path = require('path');
const fs = require('fs');

class Attr {
    constructor(arr, itemSize) { this.array = arr; this.itemSize = itemSize; this.needsUpdate = false; }
}
class Vec3 {
    constructor(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}
const THREE = {
    PerspectiveCamera: class {
        constructor(f, a, n, fa) { this.fov = f; this.aspect = a; this.near = n; this.far = fa; this.position = new Vec3(); this.target = new Vec3(); }
        lookAt(x, y, z) { this.target.set(x, y, z); }
        updateProjectionMatrix() {}
    },
    Scene: class { add() {} remove() {} },
    BufferGeometry: class {
        constructor() { this._a = {}; }
        setAttribute(n, a) { this._a[n] = a; }
        getAttribute(n) { return this._a[n]; }
        setDrawRange() {}
        dispose() {}
    },
    BufferAttribute: Attr,
    PointsMaterial: class { constructor(o) { Object.assign(this, o); } dispose() {} },
    Points: class { constructor(g, m) { this.geometry = g; this.material = m; } },
    CanvasTexture: class { constructor() { this.needsUpdate = false; } },
    AdditiveBlending: 2
};
global.THREE = THREE;

function load(file, name) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', file), 'utf8');
    const shim = { exports: {} };
    new Function('module', 'window', 'THREE', src)(shim, undefined, THREE);
    global[name] = shim.exports;
    return shim.exports;
}
load('ForceMatrix.js', 'ForceMatrix');
load('ParticleField3D.js', 'ParticleField3D');   // OrbitalCloud borrows its dot sprite
const OrbitalCloud = load('OrbitalCloud.js', 'OrbitalCloud');

const renderer = { domElement: {}, setRenderTarget() {}, render() {} };

let failures = 0;
const pass = (n, m) => console.log(`  PASS  ${n.padEnd(30)} ${m}`);
const fail = (n, m) => { failures++; console.log(`  FAIL  ${n.padEnd(30)} ${m}`); };

console.log('\n=== hydrogen orbitals ===\n');

/** Numerically integrate f over [0, hi] with n slices (midpoint rule). */
function integrate(f, hi, n) {
    return integrateRange(f, 0, hi, n);
}

/** Midpoint rule over an arbitrary interval. */
function integrateRange(f, lo, hi, n) {
    const h = (hi - lo) / n;
    let s = 0;
    for (let i = 0; i < n; i++) s += f(lo + (i + 0.5) * h);  // Rule 2: bounded
    return s * h;
}

const STATES = [[1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [3, 2], [4, 2], [5, 1], [6, 5]];

// --- 1. every radial function is correctly normalised ------------------------------------
{
    let worst = 0, worstAt = '';
    for (const [n, l] of STATES) {                           // Rule 2: bounded
        const hi = 3 * n * n + 40 * n;
        const I = integrate((r) => {
            const R = OrbitalCloud.radial(n, l, r);
            return R * R * r * r;
        }, hi, 200000);
        const err = Math.abs(I - 1);
        if (err > worst) { worst = err; worstAt = `${n}${OrbitalCloud.SHELL_LETTERS[l]}`; }
    }
    if (worst < 1e-4) pass('radial normalisation', `${STATES.length} states, worst |1 - integral| = ${worst.toExponential(2)} (${worstAt})`);
    else fail('radial normalisation', `worst error ${worst.toExponential(2)} at ${worstAt}`);
}

// --- 2. mean radius matches (3n^2 - l(l+1)) / 2 ------------------------------------------
{
    let worst = 0, detail = '';
    for (const [n, l] of STATES) {                           // Rule 2: bounded
        const hi = 3 * n * n + 40 * n;
        const mean = integrate((r) => {
            const R = OrbitalCloud.radial(n, l, r);
            return R * R * r * r * r;
        }, hi, 200000);
        const exact = (3 * n * n - l * (l + 1)) / 2;
        const rel = Math.abs(mean - exact) / exact;
        if (rel > worst) { worst = rel; detail = `${n}${OrbitalCloud.SHELL_LETTERS[l]}: ${mean.toFixed(3)} vs ${exact}`; }
    }
    if (worst < 1e-3) pass('mean radius <r>', `matches (3n^2-l(l+1))/2 to ${(worst * 100).toExponential(1)}% — ${detail}`);
    else fail('mean radius <r>', `worst ${(worst * 100).toFixed(2)}% off — ${detail}`);
}

// --- 3. <1/r> is exactly 1/n^2, independent of l -----------------------------------------
// A sharper check than <r>: it depends on the normalisation and the polynomial in a
// different combination, and it must NOT vary with l.
{
    let worst = 0, detail = '';
    for (const [n, l] of STATES) {                           // Rule 2: bounded
        const hi = 3 * n * n + 40 * n;
        const inv = integrate((r) => {
            const R = OrbitalCloud.radial(n, l, r);
            return R * R * r;                                // |R|^2 r^2 * (1/r)
        }, hi, 200000);
        const exact = 1 / (n * n);
        const rel = Math.abs(inv - exact) / exact;
        if (rel > worst) { worst = rel; detail = `${n}${OrbitalCloud.SHELL_LETTERS[l]}: ${inv.toFixed(5)} vs ${exact.toFixed(5)}`; }
    }
    if (worst < 2e-3) pass('mean inverse radius <1/r>', `equals 1/n^2 for every l — ${detail}`);
    else fail('mean inverse radius <1/r>', `worst ${(worst * 100).toFixed(2)}% off — ${detail}`);
}

// --- 4. node counts: n-l-1 radial, l-|m| angular ------------------------------------------
{
    let bad = 0, seen = 0, detail = [];
    for (const [n, l] of STATES) {                           // Rule 2: bounded
        // Count sign changes of R (excluding the trivial one at r=0 for l>0).
        let signs = 0, prev = 0;
        const hi = 3 * n * n + 40 * n, N = 20000;
        for (let i = 1; i <= N; i++) {                       // Rule 2: bounded
            const R = OrbitalCloud.radial(n, l, (i / N) * hi);
            const s = Math.sign(R);
            if (s !== 0 && prev !== 0 && s !== prev) signs++;
            if (s !== 0) prev = s;
        }
        seen++;
        if (signs !== n - l - 1) { bad++; detail.push(`${n}${OrbitalCloud.SHELL_LETTERS[l]} radial ${signs} != ${n - l - 1}`); }
    }
    // Angular nodes for a few (l, m) pairs.
    for (const [l, m] of [[1, 0], [2, 0], [2, 1], [3, 1], [3, 3], [4, 2]]) {   // Rule 2: bounded
        let signs = 0, prev = 0;
        const N = 20000;
        for (let i = 1; i < N; i++) {                        // Rule 2: bounded
            const A = OrbitalCloud.angular(l, m, (i / N) * Math.PI);
            const s = Math.sign(A);
            if (s !== 0 && prev !== 0 && s !== prev) signs++;
            if (s !== 0) prev = s;
        }
        seen++;
        if (signs !== l - Math.abs(m)) { bad++; detail.push(`l=${l},m=${m} angular ${signs} != ${l - Math.abs(m)}`); }
    }
    if (bad === 0) pass('node counts', `${seen} states: n-l-1 radial and l-|m| angular, all exact`);
    else fail('node counts', detail.join('; '));
}

// --- 5. the Bohr radius falls out of the 1s state ------------------------------------------
// Not asserted anywhere in the code — it emerges from the polynomials. If it comes back at
// 1.000 the whole radial machinery is right.
{
    let best = 0, bestR = 0;
    const N = 100000, hi = 10;
    for (let i = 1; i <= N; i++) {                           // Rule 2: bounded
        const r = (i / N) * hi;
        const R = OrbitalCloud.radial(1, 0, r);
        const P = R * R * r * r;
        if (P > best) { best = P; bestR = r; }
    }
    if (Math.abs(bestR - 1) < 1e-3) pass('1s peaks at the Bohr radius', `most probable r = ${bestR.toFixed(5)} a0`);
    else fail('1s peaks at the Bohr radius', `peak at ${bestR.toFixed(4)}, expected 1.0`);
}

// --- 6. the CDF sampler reproduces the distribution it was given --------------------------
{
    const sim = new OrbitalCloud(renderer, { count: 60000 });
    sim.setState(3, 1, 0);
    sim.init();
    sim.resample(60000);

    // Bin the sampled radii and compare against the analytic density over the same bins.
    const B = 40, hi = sim._rMax;
    const obs = new Float64Array(B);
    for (let i = 0; i < sim.count; i++) {                    // Rule 2: bounded
        const b = Math.min(B - 1, (sim._r[i] / hi * B) | 0);
        obs[b]++;
    }
    // TWO MISTAKES LIVED HERE, both in the test rather than in the sampler:
    //
    //   1. Each bin's expected share was computed as integrate(0, up) - integrate(0, lo),
    //      two midpoint approximations with DIFFERENT step sizes. Their difference carries
    //      the difference of their discretisation errors, which is not the bin integral.
    //      Integrate the bin itself.
    //   2. It compared a random sample against its expectation as a flat percentage. Bin
    //      counts are Poisson: a bin expecting 50 has a standard deviation of about 7, so
    //      13% deviation there is ordinary noise, not bias. Judging it needs sigma.
    //
    // So: measure the deviation in standard deviations. Over ~30 usable bins, the largest
    // of a set of standard normals lands near 3 sigma; 5 catches real skew without
    // failing on chance.
    let worstSigma = 0, worstBin = -1, used = 0;
    for (let b = 0; b < B; b++) {                            // Rule 2: bounded
        const lo = b * hi / B, up = (b + 1) * hi / B;
        const p = integrateRange((r) => {
            const R = OrbitalCloud.radial(3, 1, r);
            return R * R * r * r;
        }, lo, up, 4000);
        const expect = p * sim.count;
        if (expect < 100) continue;                          // too few to say anything
        used++;
        const sigma = Math.abs(obs[b] - expect) / Math.sqrt(expect);
        if (sigma > worstSigma) { worstSigma = sigma; worstBin = b; }
    }
    if (worstSigma < 5) pass('sampler matches the density', `60k samples over ${used} bins, worst deviation ${worstSigma.toFixed(1)} sigma (bin ${worstBin})`);
    else fail('sampler matches the density', `bin ${worstBin} is ${worstSigma.toFixed(1)} sigma from analytic — the sampler is skewed`);
    sim.dispose();
}

// --- 7. invalid quantum numbers are clamped, never accepted -------------------------------
{
    const sim = new OrbitalCloud(renderer, {});
    sim.init();
    const cases = [
        [3, 5, 0, 'l >= n'],
        [2, 1, 7, '|m| > l'],
        [0, 0, 0, 'n < 1'],
        [99, 3, 1, 'n over the ceiling'],
        [4, 2, -9, 'm below -l']
    ];
    let bad = 0;
    for (const [n, l, m, why] of cases) {                    // Rule 2: bounded
        sim.setState(n, l, m);
        const ok = sim.n >= 1 && sim.n <= OrbitalCloud.MAX_N
            && sim.l >= 0 && sim.l < sim.n
            && Math.abs(sim.m) <= sim.l;
        if (!ok) { bad++; fail('invalid states clamped', `${why} -> n=${sim.n} l=${sim.l} m=${sim.m}`); }
    }
    if (bad === 0) pass('invalid states clamped', `${cases.length} impossible combinations all landed valid`);
    sim.dispose();
}

// --- 8. the probability current turns, and only when m != 0 -------------------------------
{
    const still = new OrbitalCloud(renderer, { count: 2000 });
    still.setState(3, 1, 0); still.init();
    const before0 = still._phi.slice(0, 2000);
    for (let i = 0; i < 60; i++) still.step(1 / 60);          // Rule 2: bounded
    let moved0 = 0;
    for (let i = 0; i < 2000; i++) if (still._phi[i] !== before0[i]) moved0++;
    still.dispose();

    const turning = new OrbitalCloud(renderer, { count: 2000 });
    turning.setState(3, 1, 1); turning.init();
    const before1 = turning._phi.slice(0, 2000);
    for (let i = 0; i < 60; i++) turning.step(1 / 60);        // Rule 2: bounded
    let moved1 = 0, worst = 0;
    for (let i = 0; i < 2000; i++) {                          // Rule 2: bounded
        if (turning._phi[i] !== before1[i]) moved1++;
        worst = Math.max(worst, Math.abs(turning._phi[i] - before1[i]));
    }
    // It must SHEAR, not rotate rigidly: points at different r and theta move by
    // different amounts. A rigid rotation would mean the current is not being applied.
    const spread = new Set();
    for (let i = 0; i < 2000; i++) spread.add((turning._phi[i] - before1[i]).toFixed(3));
    turning.dispose();

    if (moved0 === 0) pass('m=0 has no current', '2000 points, phase unchanged over 60 steps');
    else fail('m=0 has no current', `${moved0} points drifted with m=0`);

    if (moved1 > 1900 && spread.size > 100)
        pass('m!=0 shears the phase', `${moved1}/2000 moved, ${spread.size} distinct rates, max ${worst.toFixed(3)} rad`);
    else
        fail('m!=0 shears the phase', `${moved1} moved, ${spread.size} distinct rates — looks rigid`);
}

// --- 9. the axis singularity stays bounded ------------------------------------------------
// The true angular velocity goes like 1 / (r sin(theta))^2 and diverges on the axis. That
// is a real feature of the formula, not a bug, but a fixed timestep cannot survive it.
{
    const sim = new OrbitalCloud(renderer, { count: 3000 });
    sim.setState(2, 1, 1); sim.init();
    // Force the worst case: put points exactly on the axis and at the origin.
    for (let i = 0; i < 500; i++) { sim._theta[i] = 0; sim._r[i] = 0; }
    for (let i = 500; i < 1000; i++) { sim._theta[i] = Math.PI; sim._r[i] = 1e-8; }
    let bad = 0;
    for (let s = 0; s < 300; s++) {                           // Rule 2: bounded
        sim.step(1 / 60);
        for (let i = 0; i < sim.count; i++) if (!Number.isFinite(sim._phi[i])) { bad++; break; }
        if (bad) break;
    }
    if (bad === 0) pass('axis singularity bounded', '500 points on the axis, 500 at r=0, 300 steps, no NaN or infinity');
    else fail('axis singularity bounded', 'phase went non-finite on the axis');
    sim.dispose();
}

// --- 10. rebuilding tables on a state change is affordable ---------------------------------
{
    const sim = new OrbitalCloud(renderer, { count: 14000 });
    sim.init();
    const t0 = process.hrtime.bigint();
    for (let k = 0; k < 10; k++) sim.setState(1 + (k % 6), k % 3, 0);   // Rule 2: bounded
    const per = Number(process.hrtime.bigint() - t0) / 1e6 / 10;

    const t1 = process.hrtime.bigint();
    for (let k = 0; k < 60; k++) sim.step(1 / 60);            // Rule 2: bounded
    const stepMs = Number(process.hrtime.bigint() - t1) / 1e6 / 60;

    if (per < 250) pass('state change is affordable', `${per.toFixed(1)}ms to rebuild tables and resample 14k points`);
    else fail('state change is affordable', `${per.toFixed(1)}ms per state change — too slow to drag a slider`);

    if (stepMs < 16.7) pass('per-frame cost fits 60fps', `${stepMs.toFixed(3)}ms/step at 14k points`);
    else fail('per-frame cost fits 60fps', `${stepMs.toFixed(2)}ms/step exceeds the frame budget`);
    sim.dispose();
}

// --- 11. labels name the orbital the way a chemist would -----------------------------------
{
    const sim = new OrbitalCloud(renderer, { count: 500 });
    sim.init();
    const got = [];
    for (const [n, l, m] of [[1, 0, 0], [2, 1, 0], [3, 2, 1], [4, 3, -2]]) {  // Rule 2: bounded
        sim.setState(n, l, m);
        got.push(sim.label());
    }
    const want = ['1s', '2p', '3d m=+1', '4f m=-2'];
    if (got.join('|') === want.join('|')) pass('orbital labels', got.join(', '));
    else fail('orbital labels', `got ${got.join(', ')} — wanted ${want.join(', ')}`);
    sim.dispose();
}

console.log(failures === 0
    ? `\n  ALL CHECKS PASSED\n`
    : `\n  ${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
