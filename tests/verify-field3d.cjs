// verify-field3d.cjs — prove the 3D particle field is correct, and that it and the 2D sim
// still implement the SAME model.
// Run: node tests/verify-field3d.cjs
//
// THREE is stubbed: the physics touches no graphics, and requiring a GPU to test
// arithmetic would mean this could not run at all.
//
// THE POINT OF THE FIRST TEST. ParticleLife and ParticleField3D each INLINE the force
// curve into their innermost loop instead of calling ForceMatrix.curve a few hundred
// thousand times a step. That is a genuine duplication risk — three copies of four lines
// that must never disagree. So rather than trust a comment, this recovers each sim's
// force EMPIRICALLY: put two particles at a known separation, step once, and divide the
// velocity change by forceScale * dt. That is the force the code actually applied. Sweep
// the separation across the whole radius and compare against the reference curve. If
// anyone edits one copy and not the others, this fails.

const path = require('path');
const fs = require('fs');

// --- minimal THREE stub: only what init()/render() touch -------------------------------
class Attr {
    constructor(arr, itemSize) { this.array = arr; this.itemSize = itemSize; this.needsUpdate = false; }
}
class Vec3 {
    constructor(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}
const THREE = {
    OrthographicCamera: class { updateProjectionMatrix() {} },
    PerspectiveCamera: class {
        constructor(fov, aspect, near, far) {
            this.fov = fov; this.aspect = aspect; this.near = near; this.far = far;
            this.position = new Vec3(); this.target = new Vec3();
        }
        lookAt(x, y, z) { this.target.set(x, y, z); }
        updateProjectionMatrix() { this.projUpdates = (this.projUpdates || 0) + 1; }
    },
    Scene: class { add() {} remove() {} },
    BufferGeometry: class {
        constructor() { this._a = {}; }
        setAttribute(n, a) { this._a[n] = a; }
        getAttribute(n) { return this._a[n]; }
        setDrawRange(s, c) { this.drawRange = { start: s, count: c }; }
        dispose() {}
    },
    BufferAttribute: Attr,
    PointsMaterial: class { constructor(o) { Object.assign(this, o); } dispose() {} },
    Points: class { constructor(g, m) { this.geometry = g; this.material = m; } },
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
const ForceMatrix = load('ForceMatrix.js', 'ForceMatrix');
const ParticleLife = load('ParticleLife.js', 'ParticleLife');
const ParticleField3D = load('ParticleField3D.js', 'ParticleField3D');

const renderer = { domElement: {}, setRenderTarget() {}, render() {} };

let failures = 0;
const pass = (n, m) => console.log(`  PASS  ${n.padEnd(30)} ${m}`);
const fail = (n, m) => { failures++; console.log(`  FAIL  ${n.padEnd(30)} ${m}`); };

console.log('\n=== 3D particle field ===\n');

// --- 1. all three copies of the force curve agree --------------------------------------
// Recover the applied force from a two-particle step: v = f * forceScale * dt.
function force2D(sep, m) {
    const sim = new ParticleLife(renderer, { count: 2, types: 2 });
    sim.init(); sim.count = 2;
    for (let a = 0; a < ForceMatrix.MAX_TYPES; a++)
        for (let b = 0; b < ForceMatrix.MAX_TYPES; b++) sim.setForce(a, b, m);
    sim._px[0] = 0.5; sim._py[0] = 0.5; sim._type[0] = 0;
    sim._px[1] = 0.5 + sep; sim._py[1] = 0.5; sim._type[1] = 1;
    sim._vx[0] = sim._vy[0] = sim._vx[1] = sim._vy[1] = 0;
    sim.step();
    return { f: sim._vx[0] / (sim.forceScale * sim.dt), R: sim.radius, beta: sim.beta };
}
function force3D(sep, m) {
    const sim = new ParticleField3D(renderer, { count: 2, types: 2 });
    sim.init(); sim.count = 2;
    for (let a = 0; a < ForceMatrix.MAX_TYPES; a++)
        for (let b = 0; b < ForceMatrix.MAX_TYPES; b++) sim.setForce(a, b, m);
    sim._px[0] = 0.5; sim._py[0] = 0.5; sim._pz[0] = 0.5; sim._type[0] = 0;
    sim._px[1] = 0.5 + sep; sim._py[1] = 0.5; sim._pz[1] = 0.5; sim._type[1] = 1;
    for (let i = 0; i < 2; i++) { sim._vx[i] = sim._vy[i] = sim._vz[i] = 0; }
    sim.step();
    return { f: sim._vx[0] / (sim.forceScale * sim.dt), R: sim.radius, beta: sim.beta };
}

{
    let worst2 = 0, worst3 = 0, samples = 0;
    for (const m of [-1, -0.4, 0, 0.4, 1]) {              // Rule 2: bounded
        for (let k = 1; k <= 24; k++) {                    // Rule 2: bounded
            const q = k / 25;
            const a = force2D(q * 0.075, m);               // 0.075 is the 2D radius
            const b = force3D(q * 0.11, m);                // 0.11 is the 3D radius
            const ref2 = ForceMatrix.curve(q, a.beta, m);
            const ref3 = ForceMatrix.curve(q, b.beta, m);
            worst2 = Math.max(worst2, Math.abs(a.f - ref2));
            worst3 = Math.max(worst3, Math.abs(b.f - ref3));
            samples++;
        }
    }
    const TOL = 1e-4;   // float32 position storage, not the curve, sets this floor
    if (worst2 < TOL && worst3 < TOL)
        pass('all 3 curve copies agree', `${samples} samples, worst 2D ${worst2.toExponential(1)}, 3D ${worst3.toExponential(1)}`);
    else
        fail('all 3 curve copies agree', `worst 2D ${worst2}, 3D ${worst3} (tol ${TOL})`);
}

// --- 2. repulsion pushes apart, attraction pulls together, at the right distances --------
{
    const R = 0.11, beta = 0.3;
    const close = force3D(R * beta * 0.5, 1.0);            // inside the repulsion zone
    const mid = force3D(R * (1 + beta) / 2, 1.0);          // the attraction peak
    if (close.f < 0) pass('close range repels', `f = ${close.f.toFixed(3)} (pushes -x, away)`);
    else fail('close range repels', `f = ${close.f} — should be negative`);
    if (mid.f > 0.99) pass('mid range attracts at peak', `f = ${mid.f.toFixed(3)} of a possible 1.0`);
    else fail('mid range attracts at peak', `f = ${mid.f} — tent should peak at 1.0`);
    const outside = force3D(R * 1.2, 1.0);
    if (Math.abs(outside.f) < 1e-9) pass('nothing beyond the radius', `f = ${outside.f}`);
    else fail('nothing beyond the radius', `f = ${outside.f} — should be exactly 0`);
}

// --- 3. the 27-bucket hash finds exactly the same neighbours as brute force -------------
{
    const sim = new ParticleField3D(renderer, { count: 800, types: 5 });
    sim.init(); sim.seed(800, 5);
    // Snapshot, run one hashed step, then recompute the same step by brute force.
    const n = sim.count;
    const px = sim._px.slice(0, n), py = sim._py.slice(0, n), pz = sim._pz.slice(0, n);
    sim._hash(); sim._accumulate();
    const hx = sim._vx.slice(0, n), hy = sim._vy.slice(0, n), hz = sim._vz.slice(0, n);

    const R = sim.radius, R2 = R * R, beta = sim.beta, N = ForceMatrix.MAX_TYPES;
    let worst = 0;
    for (let i = 0; i < n; i++) {                          // Rule 2: bounded
        let fx = 0, fy = 0, fz = 0;
        for (let j = 0; j < n; j++) {                      // Rule 2: bounded
            if (j === i) continue;
            let dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i];
            if (dx > 0.5) dx -= 1; else if (dx < -0.5) dx += 1;
            if (dy > 0.5) dy -= 1; else if (dy < -0.5) dy += 1;
            if (dz > 0.5) dz -= 1; else if (dz < -0.5) dz += 1;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > 1e-12 && d2 < R2) {
                const d = Math.sqrt(d2), q = d / R;
                const f = ForceMatrix.curve(q, beta, sim.matrix[sim._type[i] * N + sim._type[j]]);
                fx += dx / d * f; fy += dy / d * f; fz += dz / d * f;
            }
        }
        const k = sim.forceScale * sim.dt;
        worst = Math.max(worst,
            Math.abs(hx[i] - fx * k), Math.abs(hy[i] - fy * k), Math.abs(hz[i] - fz * k));
    }
    if (worst < 1e-6) pass('hash == brute force', `800 particles, worst velocity delta ${worst.toExponential(2)}`);
    else fail('hash == brute force', `worst delta ${worst} — the hash is missing neighbours`);
}

// --- 4. forces wrap across every face of the cube ---------------------------------------
{
    const axes = ['x', 'y', 'z'];
    let ok = 0;
    for (let ax = 0; ax < 3; ax++) {                       // Rule 2: bounded
        const sim = new ParticleField3D(renderer, { count: 2, types: 2 });
        sim.init(); sim.count = 2;
        for (let a = 0; a < ForceMatrix.MAX_TYPES; a++)
            for (let b = 0; b < ForceMatrix.MAX_TYPES; b++) sim.setForce(a, b, 1.0);
        const P = [sim._px, sim._py, sim._pz], V = [sim._vx, sim._vy, sim._vz];
        for (let i = 0; i < 2; i++) {
            sim._px[i] = 0.5; sim._py[i] = 0.5; sim._pz[i] = 0.5;
            sim._vx[i] = sim._vy[i] = sim._vz[i] = 0;
        }
        // Straddle the seam: one just above 0, one just below 1, on this axis only.
        P[ax][0] = 0.01; P[ax][1] = 0.98;
        sim._type[0] = 0; sim._type[1] = 1;
        sim.step();
        // Separation across the seam is 0.03, inside the 0.11 radius, and q = 0.27 < beta,
        // so they must REPEL: particle 0 pushed to +axis, away from the seam.
        if (V[ax][0] > 1e-9) ok++;
        else fail('wraps on ' + axes[ax], `v = ${V[ax][0]} — no force across the seam`);
    }
    if (ok === 3) pass('wraps on all 3 axes', 'pairs straddling x, y and z seams all interact');
}

// --- 5. the speed cap holds, so nothing tunnels ------------------------------------------
{
    const sim = new ParticleField3D(renderer, { count: 900, types: 5 });
    sim.init(); sim.seed(900, 5);
    for (let a = 0; a < ForceMatrix.MAX_TYPES; a++)
        for (let b = 0; b < ForceMatrix.MAX_TYPES; b++) sim.setForce(a, b, 1.0);
    const lim = sim.beta * sim.radius;
    let worst = 0;
    for (let s = 0; s < 200; s++) {                        // Rule 2: bounded
        sim.step();
        for (let i = 0; i < sim.count; i++) {              // Rule 2: bounded
            const v = Math.hypot(sim._vx[i], sim._vy[i], sim._vz[i]);
            if (v > worst) worst = v;
        }
    }
    if (worst <= lim * 1.0001) pass('speed never exceeds cap', `worst ${worst.toFixed(5)} of ${lim.toFixed(5)}`);
    else fail('speed never exceeds cap', `worst ${worst} > ${lim} — particles can tunnel`);
}

// --- 6. 200 steps of a full field: no NaN, nothing leaves the cube ------------------------
{
    const sim = new ParticleField3D(renderer, { count: 2200, types: 5 });
    sim.init(); sim.seed(2200, 5);
    for (let s = 0; s < 200; s++) sim.step();              // Rule 2: bounded
    let bad = 0, out = 0;
    for (let i = 0; i < sim.count; i++) {                  // Rule 2: bounded
        const x = sim._px[i], y = sim._py[i], z = sim._pz[i];
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) bad++;
        if (x < 0 || x >= 1 || y < 0 || y >= 1 || z < 0 || z >= 1) out++;
    }
    if (bad === 0 && out === 0) pass('stable over 200 steps', `2200 particles, 0 NaN, 0 outside the cube`);
    else fail('stable over 200 steps', `${bad} NaN, ${out} outside the cube`);
}

// --- 7. the hash is what makes it affordable ---------------------------------------------
// Same particle count both ways, so this measures the DATA STRUCTURE and nothing else.
// (An earlier version of the 2D test compared 1000 particles to 4000 and called the
// result "sub-quadratic". That measured density: with a fixed radius, 4x the particles
// really does mean ~4x the neighbours in range, however you find them.)
{
    const n = 2000;
    const sim = new ParticleField3D(renderer, { count: n, types: 5 });
    sim.init(); sim.seed(n, 5);
    const t0 = process.hrtime.bigint();
    for (let s = 0; s < 30; s++) sim.step();               // Rule 2: bounded
    const hashed = Number(process.hrtime.bigint() - t0) / 1e6 / 30;

    const R2 = sim.radius * sim.radius;
    const t1 = process.hrtime.bigint();
    for (let s = 0; s < 3; s++) {                          // Rule 2: bounded
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++) {
                if (j === i) continue;
                let dx = sim._px[j] - sim._px[i], dy = sim._py[j] - sim._py[i], dz = sim._pz[j] - sim._pz[i];
                if (dx > 0.5) dx -= 1; else if (dx < -0.5) dx += 1;
                if (dy > 0.5) dy -= 1; else if (dy < -0.5) dy += 1;
                if (dz > 0.5) dz -= 1; else if (dz < -0.5) dz += 1;
                const d2 = dx * dx + dy * dy + dz * dz;
                if (d2 > 1e-12 && d2 < R2) { const d = Math.sqrt(d2); if (d < 0) break; }
            }
    }
    const brute = Number(process.hrtime.bigint() - t1) / 1e6 / 3;
    if (hashed < brute) pass('hash beats brute force', `${hashed.toFixed(2)}ms vs ${brute.toFixed(2)}ms at ${n} particles (${(brute / hashed).toFixed(1)}x)`);
    else fail('hash beats brute force', `${hashed.toFixed(2)}ms vs ${brute.toFixed(2)}ms — no gain`);

    const BUDGET = 16.7;
    if (hashed < BUDGET) pass('fits a 60fps frame', `${hashed.toFixed(2)}ms of a ${BUDGET}ms budget at ${n} particles`);
    else fail('fits a 60fps frame', `${hashed.toFixed(2)}ms exceeds ${BUDGET}ms`);
}

// --- 8. the camera stays on its orbit and keeps looking at the cube -----------------------
{
    const sim = new ParticleField3D(renderer, { count: 10, types: 2 });
    sim.init();
    // A full revolution is 2*pi / spin = ~180 seconds. Sampling two seconds of it, as this
    // first did, moves the camera 0.07 radians and would pass even if the orbit were
    // broken — so step the clock hard enough to actually go all the way round.
    const R0 = ParticleField3D.ORBIT_RADIUS;
    const STEPS = 2000, DT = 0.1;                          // 200s: just over one revolution
    let rMin = Infinity, rMax = 0, aimed = 0, travelled = 0;
    let prev = { x: sim.camera.position.x, z: sim.camera.position.z };
    for (let s = 0; s < STEPS; s++) {                      // Rule 2: bounded
        sim._orbit(DT);
        const p = sim.camera.position;
        const r = Math.hypot(p.x - 0.5, p.y - 0.5, p.z - 0.5);
        if (r < rMin) rMin = r;
        if (r > rMax) rMax = r;
        travelled += Math.hypot(p.x - prev.x, p.z - prev.z);
        prev = { x: p.x, z: p.z };
        const t = sim.camera.target;
        if (t.x === 0.5 && t.y === 0.5 && t.z === 0.5) aimed++;
    }
    // The bob deliberately varies the radius, between R0 (bob at zero) and R0*sqrt(1.0784)
    // (bob at full). What must hold is that it stays in that band rather than drifting
    // inside the cube or off to infinity — and that it genuinely goes round: one lap of a
    // circle of radius R0 is 2*pi*R0 of ground covered.
    const rHi = R0 * Math.sqrt(1 + 0.28 * 0.28);
    const lap = 2 * Math.PI * R0;
    const inBand = rMin >= R0 - 1e-6 && rMax <= rHi + 1e-6;
    if (inBand && aimed === STEPS && travelled > lap * 0.95)
        pass('camera orbits the cube', `radius ${rMin.toFixed(3)}-${rMax.toFixed(3)} (band ${R0}-${rHi.toFixed(3)}), travelled ${travelled.toFixed(2)} vs ${lap.toFixed(2)} per lap`);
    else
        fail('camera orbits the cube', `radius ${rMin.toFixed(3)}-${rMax.toFixed(3)}, aimed ${aimed}/${STEPS}, travelled ${travelled.toFixed(2)} of ${lap.toFixed(2)}`);

    // A stalled tab hands back a huge delta; the orbit must not jump.
    const before = sim._angle;
    sim._orbit(9999);
    if (sim._angle - before <= 0.1 * sim.spin + 1e-9)
        pass('bounded against stalled tab', `9999s delta advanced the orbit by ${(sim._angle - before).toFixed(5)} rad`);
    else
        fail('bounded against stalled tab', `angle jumped ${sim._angle - before} rad`);
}

// --- 9. the matrix is shared with the 2D sim, and stays asymmetric ------------------------
{
    const sim = new ParticleField3D(renderer, { count: 10, types: 3 });
    sim.init();
    sim.setForce(0, 1, 0.8); sim.setForce(1, 0, -0.8);
    const near = (a, b) => Math.abs(a - b) < 1e-6;   // float32: 0.8 stores as 0.80000001
    if (near(sim.getForce(0, 1), 0.8) && near(sim.getForce(1, 0), -0.8))
        pass('matrix stays asymmetric', 'coral->mint +0.80 while mint->coral -0.80');
    else
        fail('matrix stays asymmetric', `${sim.getForce(0, 1)} / ${sim.getForce(1, 0)}`);

    const shared = (ParticleLife.MAX_TYPES === ForceMatrix.MAX_TYPES)
        && (ParticleLife.REPULSION === ForceMatrix.REPULSION)
        && (ParticleLife.TYPE_COLOURS === ForceMatrix.TYPE_COLOURS);
    if (shared) pass('one model, two sims', 'ParticleLife re-exports ForceMatrix, no second copy');
    else fail('one model, two sims', 'ParticleLife constants have drifted from ForceMatrix');
}

// --- 10. dispose releases everything -----------------------------------------------------
{
    const sim = new ParticleField3D(renderer, { count: 100, types: 3 });
    sim.init();
    sim.dispose();
    if (!sim._px && !sim._geom && !sim.scene && sim._disposed)
        pass('dispose releases buffers', 'positions, geometry, material and scene all cleared');
    else
        fail('dispose releases buffers', 'something survived dispose');
}

console.log(failures === 0
    ? `\n  ALL CHECKS PASSED\n`
    : `\n  ${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
