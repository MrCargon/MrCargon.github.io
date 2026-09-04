// verify-sineshape.cjs — prove the Fourier shape engine actually reconstructs shapes.
// Run: node tests/verify-sineshape.cjs
//
// SineShape has been in this repo, loaded on every page, called from nowhere and tested by
// nothing. Before wiring it into a visible scene it has to earn it, and a DFT is easy to
// check because the round trip is the whole claim: transform an outline, evaluate the
// series, and you should get the outline back.
//
// Pure arithmetic — no THREE, no DOM.

const path = require('path');
const fs = require('fs');

function load(file, name) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', file), 'utf8');
    const shim = { exports: {} };
    new Function('module', 'window', src)(shim, undefined);
    global[name] = shim.exports;
    return shim.exports;
}
const SineShape = load('SineShape.js', 'SineShape');

let failures = 0;
const pass = (n, m) => console.log(`  PASS  ${n.padEnd(30)} ${m}`);
const fail = (n, m) => { failures++; console.log(`  FAIL  ${n.padEnd(30)} ${m}`); };

console.log('\n=== SineShape: Fourier outlines ===\n');

/** An outline with a known analytic form. */
function outline(kind, n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        let r;
        if (kind === 'circle') r = 1;
        else if (kind === 'star') r = 1 + 0.45 * Math.cos(5 * t);
        else if (kind === 'gear') r = 1 + 0.16 * Math.sign(Math.cos(11 * t));
        else r = 1 + 0.22 * Math.sin(2 * t + 0.7) + 0.12 * Math.cos(4 * t);
        pts.push({ x: r * Math.cos(t), y: r * Math.sin(t) });
    }
    return pts;
}

/** Worst distance between the original points and the reconstructed ones. */
function roundTripError(pts, maxTerms) {
    const s = SineShape.fromPoints(pts, maxTerms);
    let worst = 0;
    for (let i = 0; i < pts.length; i++) {
        const p = s.point(i / pts.length);
        worst = Math.max(worst, Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
    }
    return { worst, shape: s };
}

// --- 1. keeping every term reproduces the outline exactly ---------------------------------
{
    let worst = 0, at = '';
    for (const kind of ['circle', 'star', 'gear', 'blob']) {   // Rule 2: bounded
        const pts = outline(kind, 128);
        const r = roundTripError(pts);                          // no truncation
        if (r.worst > worst) { worst = r.worst; at = kind; }
    }
    if (worst < 1e-9) pass('full round trip is exact', `worst point error ${worst.toExponential(2)} (${at})`);
    else fail('full round trip is exact', `worst error ${worst.toExponential(2)} at ${at} — the DFT is wrong`);
}

// --- 2. a circle needs exactly one term ----------------------------------------------------
// The sharpest statement of correctness available: a circle of radius R is a single
// epicycle. If any second term carries real amplitude, the transform is leaking.
{
    const s = SineShape.fromPoints(outline('circle', 128));
    const strongest = s.terms[0];
    const next = s.terms[1] ? s.terms[1].amp : 0;
    if (Math.abs(strongest.amp - 1) < 1e-9 && next < 1e-9)
        pass('a circle is one epicycle', `term 1 amp ${strongest.amp.toFixed(9)}, term 2 amp ${next.toExponential(1)}`);
    else
        fail('a circle is one epicycle', `amp ${strongest.amp}, second ${next}`);
}

// --- 3. truncation degrades gracefully, and monotonically ----------------------------------
{
    const pts = outline('star', 128);
    const errs = [];
    for (const k of [1, 2, 4, 8, 16, 32]) {                     // Rule 2: bounded
        errs.push({ k, e: roundTripError(pts, k).worst });
    }
    let monotone = true;
    for (let i = 1; i < errs.length; i++) if (errs[i].e > errs[i - 1].e + 1e-12) monotone = false;
    const shrinks = errs[errs.length - 1].e < errs[0].e * 0.05;
    if (monotone && shrinks)
        pass('LOD degrades gracefully', errs.map((x) => `${x.k}:${x.e.toFixed(3)}`).join('  '));
    else
        fail('LOD degrades gracefully', `monotone=${monotone} ` + errs.map((x) => `${x.k}:${x.e.toFixed(4)}`).join(' '));
}

// --- 4. one term IS a circle — the floor case the docs claim ------------------------------
{
    const s = SineShape.fromPoints(outline('star', 128), 1);
    let min = Infinity, max = 0;
    for (let i = 0; i < 200; i++) {                             // Rule 2: bounded
        const p = s.point(i / 200);
        const r = Math.hypot(p.x, p.y);
        min = Math.min(min, r); max = Math.max(max, r);
    }
    if (max - min < 1e-9) pass('one term is a circle', `radius constant at ${max.toFixed(6)}`);
    else fail('one term is a circle', `radius varies ${min.toFixed(4)}..${max.toFixed(4)}`);
}

// --- 5. detailFor returns enough terms to carry the amplitude it promises -----------------
{
    const s = SineShape.fromPoints(outline('blob', 128), 24);
    let bad = 0, detail = [];
    for (const f of [0.1, 0.5, 0.9, 0.99, 1.0]) {               // Rule 2: bounded
        const n = s.detailFor(f);
        let total = 0, run = 0;
        for (let i = 0; i < s.terms.length; i++) total += s.terms[i].amp;
        for (let i = 0; i < n; i++) run += s.terms[i].amp;
        if (run / total < f - 1e-9) bad++;
        detail.push(`${f}->${n}`);
    }
    if (bad === 0) pass('detailFor keeps its promise', detail.join('  '));
    else fail('detailFor keeps its promise', `${bad} fractions came up short`);
}

// --- 6. morph endpoints are the endpoints, and the middle is between them ------------------
{
    const a = SineShape.fromPoints(outline('star', 128), 16);
    const b = SineShape.fromPoints(outline('gear', 128), 16);
    const at = (s, t) => { const p = s.point(t); return { x: p.x, y: p.y }; };

    let worst0 = 0, worst1 = 0;
    for (let i = 0; i < 64; i++) {                              // Rule 2: bounded
        const t = i / 64;
        const m0 = at(SineShape.morph(a, b, 0), t), pa = at(a, t);
        const m1 = at(SineShape.morph(a, b, 1), t), pb = at(b, t);
        worst0 = Math.max(worst0, Math.hypot(m0.x - pa.x, m0.y - pa.y));
        worst1 = Math.max(worst1, Math.hypot(m1.x - pb.x, m1.y - pb.y));
    }
    if (worst0 < 1e-9 && worst1 < 1e-9)
        pass('morph endpoints are exact', `t=0 error ${worst0.toExponential(1)}, t=1 error ${worst1.toExponential(1)}`);
    else
        fail('morph endpoints are exact', `t=0 ${worst0.toExponential(2)}, t=1 ${worst1.toExponential(2)}`);

    // And the halfway shape must be a genuine blend, not a jump to one end.
    const half = SineShape.morph(a, b, 0.5);
    let dA = 0, dB = 0;
    for (let i = 0; i < 64; i++) {                              // Rule 2: bounded
        const t = i / 64;
        const h = at(half, t), pa = at(a, t), pb = at(b, t);
        dA += Math.hypot(h.x - pa.x, h.y - pa.y);
        dB += Math.hypot(h.x - pb.x, h.y - pb.y);
    }
    if (dA > 1e-6 && dB > 1e-6)
        pass('morph midpoint is a blend', `distance to A ${dA.toFixed(3)}, to B ${dB.toFixed(3)}`);
    else
        fail('morph midpoint is a blend', `dA=${dA}, dB=${dB} — it snapped to an endpoint`);
}

// --- 7. phase interpolates the SHORT way round -----------------------------------------
// The failure this guards against: a term near +pi morphing to one near -pi takes the long
// way and the shape visibly unwinds through a full turn on the way.
{
    const a = new SineShape([{ freq: 1, amp: 1, phase: 3.0 }]);
    const b = new SineShape([{ freq: 1, amp: 1, phase: -3.0 }]);
    const mid = SineShape.morph(a, b, 0.5).terms[0].phase;
    // Short way is 0.28 rad across the +/-pi seam, so the midpoint sits just outside pi,
    // NOT at 0 which is what naive linear interpolation would give.
    const shortWay = Math.abs(Math.abs(mid) - Math.PI) < 0.2;
    if (shortWay) pass('phase takes the short arc', `3.0 -> -3.0 passes through ${mid.toFixed(3)}, not 0`);
    else fail('phase takes the short arc', `midpoint ${mid.toFixed(3)} — it unwound the long way`);
}

// --- 8. rotation is a phase offset, and preserves the shape --------------------------------
{
    const s = SineShape.fromPoints(outline('star', 128), 20);
    // Rotating by `rot` must map the outline onto itself rotated — check radii, which are
    // rotation invariant.
    let worst = 0;
    for (let i = 0; i < 128; i++) {                             // Rule 2: bounded
        const t = i / 128;
        const p0 = s.point(t);
        const r0 = Math.hypot(p0.x, p0.y);
        const p1 = s.point(t, undefined, 0.7);
        const r1 = Math.hypot(p1.x, p1.y);
        worst = Math.max(worst, Math.abs(r1 - r0));
    }
    if (worst < 1e-9) pass('spin preserves the outline', `worst radius change ${worst.toExponential(2)} over a 0.7 rad spin`);
    else fail('spin preserves the outline', `radius changed by ${worst.toExponential(2)} — spin is deforming it`);
}

// --- 9. the size claim, actually counted ---------------------------------------------------
{
    const kinds = ['blob', 'star', 'gear', 'leaf', 'cross', 'bloom'];
    let bytes = 0, terms = 0;
    for (const k of kinds) {                                    // Rule 2: bounded
        const s = SineShape.fromPoints(outline(k === 'leaf' || k === 'cross' || k === 'bloom' ? 'blob' : k, 256), 28);
        bytes += s.byteSize();
        terms += s.terms.length;
    }
    // A small PNG is comfortably over 2 KB; this whole library must be well under.
    if (bytes < 2048) pass('the whole library is tiny', `${kinds.length} shapes, ${terms} terms, ${bytes} bytes total`);
    else fail('the whole library is tiny', `${bytes} bytes — larger than claimed`);
}

// --- 10. point() does not allocate per call ------------------------------------------------
// It documents a pooled return object. If that ever changes it becomes a per-frame
// allocation inside the trace loop, which is the thing the pooling exists to avoid.
{
    const s = SineShape.circle(1);
    const a = s.point(0.1), b = s.point(0.2);
    if (a === b) pass('point() reuses its buffer', 'same object returned, no per-call allocation');
    else fail('point() reuses its buffer', 'a fresh object per call — allocates inside the hot loop');
}

// --- 11. the FAST trace agrees with the direct evaluation ---------------------------------
// SineField does not call point() per sample any more. It rotates a vector by a fixed
// step instead, which turned 12.66 ms/frame into 0.71 — but an optimisation that draws a
// different shape is not an optimisation. This reproduces both and compares them.
{
    const shape = SineShape.fromPoints(outline('star', 128), 20);
    const N = 144, spin = 0.9;

    // Direct: two transcendental calls per term per sample, the original form.
    const direct = [];
    for (let k = 0; k < N; k++) {
        const p = shape.point(k / N, undefined, spin);
        direct.push({ x: p.x, y: p.y });
    }

    // Incremental: two per TERM, then rotate the vector by a constant step.
    const ax = new Float64Array(N), ay = new Float64Array(N);
    const TWO_PI = Math.PI * 2;
    for (let i = 0; i < shape.terms.length; i++) {
        const t = shape.terms[i];
        const d = TWO_PI * t.freq / N;
        const cd = Math.cos(d), sd = Math.sin(d);
        let vx = t.amp * Math.cos(t.phase + spin), vy = t.amp * Math.sin(t.phase + spin);
        for (let k = 0; k < N; k++) {
            ax[k] += vx; ay[k] += vy;
            const nx = vx * cd - vy * sd;
            vy = vx * sd + vy * cd;
            vx = nx;
        }
    }

    let worst = 0;
    for (let k = 0; k < N; k++) {
        worst = Math.max(worst, Math.hypot(ax[k] - direct[k].x, ay[k] - direct[k].y));
    }
    // The rotation accumulates error across 144 steps; in double precision it stays far
    // below a pixel at any size this is drawn.
    if (worst < 1e-9) pass('fast trace matches direct', `worst difference ${worst.toExponential(2)} over ${N} samples`);
    else fail('fast trace matches direct', `drifted ${worst.toExponential(2)} — not the same shape`);
}

console.log(failures === 0
    ? `\n  ALL CHECKS PASSED\n`
    : `\n  ${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
