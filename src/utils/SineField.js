// SineField.js — a drifting shoal of creatures whose entire geometry is sine waves.
//
// The fourth backdrop, and the one that exists to make a point rather than to simulate
// anything. Every outline here is a FOURIER SERIES: a chain of rotating circles whose tip
// traces the shape. Store the chain and you have stored the shape — a few dozen numbers,
// no vertices, no image, no file.
//
// Requires SineShape.js, which does the actual maths and had been sitting in this repo
// loaded on every page and called from nowhere. This is what it is for.
//
// Technique from Zanzlanz, "How I released a game that has no assets".
//
// WHY THIS IS WORTH A SCENE
// Three properties fall out of the representation, and all three are visible here:
//
//   MORPHING is free. Crossfading two coefficient lists gives a smooth, never
//   self-intersecting transition — try that with vertex tweening and shapes turn inside
//   out. Every creature is permanently morphing between two of the base shapes.
//
//   LEVEL OF DETAIL is free. Drop the high-frequency terms and the shape degrades
//   gracefully towards a circle. The Detail control does exactly that, live, and it is
//   the clearest demonstration on the site of what a Fourier series actually is.
//
//   SIZE is absurd. The whole shoal reports its own byte count in the panel. It is
//   smaller than a single small PNG, and that number is not a guess — SineShape.byteSize
//   counts three float32 per term.
//
// Rotation is free too: adding a constant to every phase spins the whole outline, with no
// matrix and no re-sampling.
class SineField {
    /**
     * @param {THREE.WebGLRenderer} renderer - shared with SpaceEnvironment
     * @param {Object} [opts]
     */
    constructor(renderer, opts) {
        console.assert(renderer && renderer.domElement, 'SineField: renderer required');
        console.assert(typeof SineShape !== 'undefined', 'SineField: SineShape must load first');
        const o = opts || {};
        this.renderer = renderer;
        this.count = Math.max(1, Math.min(SineField.MAX_CREATURES, o.count || 26));
        this.detail = (o.detail !== undefined) ? o.detail : 1;   // fraction of terms kept
        this.morphSpeed = (o.morphSpeed !== undefined) ? o.morphSpeed : 0.22;
        this.spin = (o.spin !== undefined) ? o.spin : 0.04;      // camera drift, rad/sec
        this.generation = 0;

        this.shapes = null;          // the base library, shared by every creature
        this._creatures = [];
        this.scene = null; this.camera = null;
        this._angle = 0;
        this._scratchBasis = new Float64Array(6);   // Rule 3: allocated once, not per frame
        this._accX = new Float64Array(SineField.SAMPLES);
        this._accY = new Float64Array(SineField.SAMPLES);
        this._pairs = null;
        this._disposed = false;
    }

    // ── the base shapes, generated rather than authored ──────────────────────

    /**
     * Outlines to build the library from. Each returns evenly spaced points around a
     * closed curve — the input the DFT wants.
     *
     * Every one is a formula. There is no vertex data in this file and no asset behind
     * it, which is the whole claim being demonstrated. Rule 5: 2 asserts.
     */
    static outline(kind, n) {
        console.assert(typeof kind === 'string', 'outline: kind required');
        console.assert(n > 8, 'outline: enough points to transform');
        const pts = [];
        for (let i = 0; i < n; i++) {                        // Rule 2: bounded
            const t = (i / n) * Math.PI * 2;
            let r;
            switch (kind) {
                case 'star':  r = 1 + 0.45 * Math.cos(5 * t); break;
                case 'gear':  r = 1 + 0.16 * Math.sign(Math.cos(11 * t)); break;
                case 'leaf':  r = Math.pow(Math.abs(Math.cos(t / 2)), 0.7) * 1.35; break;
                case 'cross': r = 1 / (Math.pow(Math.abs(Math.cos(2 * t)), 4) + 0.55); break;
                case 'bloom': r = 1 + 0.3 * Math.sin(3 * t) + 0.14 * Math.sin(7 * t + 1.1); break;
                // A wobbling blob: three harmonics is already enough to look organic.
                default:      r = 1 + 0.22 * Math.sin(2 * t + 0.7) + 0.12 * Math.cos(4 * t);
            }
            pts.push({ x: r * Math.cos(t), y: r * Math.sin(t) });
        }
        return pts;
    }

    /**
     * Transform every base outline once. O(n^2) per shape and never repeated — this is
     * authoring, not a per-frame cost. Rule 5: 2 asserts.
     */
    _buildLibrary() {
        console.assert(typeof SineShape !== 'undefined', '_buildLibrary: SineShape required');
        console.assert(!this._disposed, '_buildLibrary: not disposed');
        this.shapes = [];
        for (let i = 0; i < SineField.KINDS.length; i++) {   // Rule 2: bounded
            const pts = SineField.outline(SineField.KINDS[i], SineField.OUTLINE_POINTS);
            this.shapes.push(SineShape.fromPoints(pts, SineField.MAX_TERMS));
        }
        this._buildPairs();
        return true;
    }

    /**
     * Pre-align every ordered pair of shapes into flat typed arrays.
     *
     * MEASURED FIRST, THEN WRITTEN. The obvious implementation called
     * SineShape.morph() per creature per frame, and morph allocates a fresh SineShape
     * with a full array of term objects — about 900 objects a frame at the default
     * count, 53,000 a second, all garbage. Together with the trig in point() the trace
     * cost 12.66 ms/frame at 26 creatures and 23.94 at 48: 76% and 143% of a 60fps
     * budget, for a BACKDROP. The user reported the page lagging, and this was why.
     *
     * The shape library never changes, so the expensive part of a morph — matching the
     * two term lists up by frequency — can be done once for all 36 ordered pairs here
     * and reused forever. Per frame all that is left is a linear interpolation.
     *
     * Sorted by the LARGER of the two amplitudes so the level-of-detail cut keeps the
     * terms that matter at either end of the morph, not just at the start.
     * Rule 3: allocated once | Rule 5: 2 asserts.
     */
    _buildPairs() {
        console.assert(this.shapes && this.shapes.length > 1, '_buildPairs: library built');
        console.assert(!this._disposed, '_buildPairs: not disposed');
        const S = this.shapes.length;
        this._pairs = [];
        for (let a = 0; a < S; a++) {                        // Rule 2: bounded
            this._pairs.push([]);
            for (let b = 0; b < S; b++) {                    // Rule 2: bounded
                this._pairs[a].push(this._alignPair(this.shapes[a], this.shapes[b]));
            }
        }
        return true;
    }

    /** One ordered pair, matched by frequency. Rule 5: 2 asserts. */
    _alignPair(A, B) {
        console.assert(A && B, '_alignPair: two shapes required');
        console.assert(A.terms && B.terms, '_alignPair: terms required');
        const byFreq = new Map();
        for (let i = 0; i < A.terms.length; i++) {           // Rule 2: bounded
            const t = A.terms[i];
            if (!byFreq.has(t.freq)) byFreq.set(t.freq, { f: t.freq, aA: 0, pA: 0, aB: 0, pB: 0 });
            const e = byFreq.get(t.freq); e.aA = t.amp; e.pA = t.phase;
        }
        for (let i = 0; i < B.terms.length; i++) {           // Rule 2: bounded
            const t = B.terms[i];
            if (!byFreq.has(t.freq)) byFreq.set(t.freq, { f: t.freq, aA: 0, pA: t.phase, aB: 0, pB: 0 });
            const e = byFreq.get(t.freq); e.aB = t.amp; e.pB = t.phase;
        }
        const list = [...byFreq.values()];
        for (let i = 0; i < list.length; i++) {              // Rule 2: bounded
            const e = list[i];
            if (e.aA === 0) e.pA = e.pB;                     // absent side keeps the other's phase
            if (e.aB === 0) e.pB = e.pA;
        }
        list.sort((x, y) => Math.max(y.aA, y.aB) - Math.max(x.aA, x.aB));
        const n = list.length;
        const out = {
            n,
            freq: new Float64Array(n), ampA: new Float64Array(n), ampB: new Float64Array(n),
            phA: new Float64Array(n), dPh: new Float64Array(n)
        };
        for (let i = 0; i < n; i++) {                        // Rule 2: bounded
            const e = list[i];
            let d = e.pB - e.pA;
            while (d > Math.PI) d -= 2 * Math.PI;            // shortest arc, as SineShape.morph
            while (d < -Math.PI) d += 2 * Math.PI;
            out.freq[i] = e.f; out.ampA[i] = e.aA; out.ampB[i] = e.aB;
            out.phA[i] = e.pA; out.dPh[i] = d;
        }
        return out;
    }

    /** Total bytes of every stored coefficient. The headline number. Rule 5: 2 asserts. */
    byteSize() {
        console.assert(this.shapes, 'byteSize: library built');
        console.assert(this.shapes.length > 0, 'byteSize: library not empty');
        let n = 0;
        for (let i = 0; i < this.shapes.length; i++) n += this.shapes[i].byteSize();
        return n;
    }

    // ── the shoal ────────────────────────────────────────────────────────────

    /** Build the scene, the library and one line loop per creature. Rule 5: 2 asserts. */
    init() {
        console.assert(!this._disposed, 'init: not disposed');
        console.assert(typeof THREE !== 'undefined', 'init: THREE required');
        this._buildLibrary();
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(55, 1, 0.01, 100);

        for (let i = 0; i < SineField.MAX_CREATURES; i++) {  // Rule 3: allocate the ceiling
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position',
                new THREE.BufferAttribute(new Float32Array(SineField.SAMPLES * 3), 3));
            // linewidth is ignored by every browser's WebGL line rasteriser — lines are
            // always one pixel. Stated rather than set, so nobody adds it expecting an
            // effect. Weight comes from colour and count instead.
            const mat = new THREE.LineBasicMaterial({
                transparent: true, opacity: 0.85, depthWrite: false
            });
            const loop = new THREE.LineLoop(geom, mat);
            loop.frustumCulled = false;                      // vertices change every frame
            this.scene.add(loop);
            this._creatures.push({ geom, mat, loop });
        }
        this.seed();
        return true;
    }

    /** Scatter the shoal: new positions, drifts, shape pairings and colours. */
    seed(count) {
        console.assert(this._creatures.length > 0, 'seed: init first');
        console.assert(this.shapes, 'seed: library built');
        if (Number.isFinite(count)) {
            this.count = Math.max(1, Math.min(SineField.MAX_CREATURES, count | 0));
        }
        const S = this.shapes.length;
        for (let i = 0; i < this._creatures.length; i++) {   // Rule 2: bounded
            const c = this._creatures[i];
            c.a = (Math.random() * S) | 0;
            c.b = (c.a + 1 + ((Math.random() * (S - 1)) | 0)) % S;   // never morph to itself
            c.t = Math.random();
            c.speed = 0.5 + Math.random();
            c.spin = (Math.random() - 0.5) * 0.9;
            c.phase = Math.random() * Math.PI * 2;
            c.scale = 0.08 + Math.random() * 0.13;   // whole outlines fit the frame
            c.pos = [(Math.random() - 0.5) * 3.2, (Math.random() - 0.5) * 2.0, (Math.random() - 0.5) * 3.2];
            c.vel = [(Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.05];
            const hue = (i / this._creatures.length + 0.08) % 1;
            const rgb = OrbitalCloud.hueToRgb(hue);
            // LINEAR light: the renderer encodes to sRGB on output, and a material colour
            // set from sRGB numbers would be encoded twice. Same trap as the particle
            // palette — see ForceMatrix.TYPE_COLOURS_LINEAR.
            c.mat.color.setRGB(
                ForceMatrix.srgbToLinear(rgb[0]),
                ForceMatrix.srgbToLinear(rgb[1]),
                ForceMatrix.srgbToLinear(rgb[2])
            );
            c.loop.visible = i < this.count;
        }
        this.generation = 0;
        return true;
    }

    /**
     * Change how many creatures are drawn, and hide the rest IMMEDIATELY.
     *
     * Visibility used to be a side effect of _trace, which meant the extra creatures
     * stayed on screen until the next draw. That was invisible at 60fps and became a
     * real 33ms window once the ambient scenes were capped at 30 — the test caught it by
     * reading straight after the slider moved and finding 26 loops still visible with a
     * count of 8. A control should take effect when it is used, not when the next frame
     * happens to arrive. Rule 5: 2 asserts | Rule 2: clamped.
     */
    setCount(n) {
        console.assert(Number.isFinite(n), 'setCount: finite count');
        console.assert(this._creatures.length > 0, 'setCount: init first');
        this.count = Math.max(1, Math.min(SineField.MAX_CREATURES, n | 0));
        for (let i = 0; i < this._creatures.length; i++) {   // Rule 2: bounded
            this._creatures[i].loop.visible = i < this.count;
        }
        return true;
    }

    /**
     * Advance the morph and drift the shoal. When a creature completes a crossfade it
     * keeps its destination and picks a new one, so it wanders the shape library rather
     * than ping-ponging between two. Rule 5: 2 asserts.
     */
    step(deltaTime) {
        console.assert(this._creatures.length > 0, 'step: init first');
        console.assert(!this._disposed, 'step: not disposed');
        const dt = Math.max(0, Math.min(0.1, deltaTime || 0));   // Rule 2: bound a stalled tab
        const S = this.shapes.length;
        for (let i = 0; i < this.count; i++) {               // Rule 2: bounded
            const c = this._creatures[i];
            c.t += dt * this.morphSpeed * c.speed;
            if (c.t >= 1) {
                c.t -= 1;
                c.a = c.b;
                c.b = (c.a + 1 + ((Math.random() * (S - 1)) | 0)) % S;
            }
            c.phase += dt * c.spin;
            for (let k = 0; k < 3; k++) {                    // Rule 2: bounded
                c.pos[k] += c.vel[k] * dt;
                // Wrap through the box rather than bouncing: a bounce reads as a wall.
                if (c.pos[k] > SineField.BOX[k]) c.pos[k] = -SineField.BOX[k];
                else if (c.pos[k] < -SineField.BOX[k]) c.pos[k] = SineField.BOX[k];
            }
        }
        this.generation++;
        return true;
    }

    /**
     * Re-trace every visible outline. This is where SineShape.morph, .detailFor and
     * .point all do their work, once per creature per frame.
     * Rule 4: <=60 lines | Rule 5: 2 asserts.
     */
    _trace() {
        console.assert(this._pairs, '_trace: pairs precomputed');
        console.assert(this._creatures.length > 0, '_trace: creatures built');
        const N = SineField.SAMPLES;
        const b = this._basis();
        const rx = b[0], ry = b[1], rz = b[2], ux = b[3], uy = b[4], uz = b[5];
        for (let i = 0; i < this.count; i++) {               // Rule 2: bounded
            this._traceOne(this._creatures[i], N, rx, ry, rz, ux, uy, uz);
        }
        for (let i = this.count; i < this._creatures.length; i++) {   // Rule 2: bounded
            this._creatures[i].loop.visible = false;
        }
        return true;
    }

    /**
     * Trace one outline into its geometry, by ROTATING VECTORS rather than calling
     * trigonometry per point.
     *
     * The direct form evaluates amp*cos(2*pi*freq*k/N + phase) for every term at every
     * sample: 144 samples times up to 34 terms times two trig calls, about 9,800 per
     * creature per frame and 255,000 across the shoal. Measured at 12.66 ms/frame.
     *
     * But k advances in equal steps, so the angle advances by a CONSTANT delta, and each
     * term's contribution is a vector rotating by that fixed amount. Compute sin and cos
     * once per term, then step the vector with a 2x2 rotation: six arithmetic operations
     * instead of two transcendental ones. Trig drops from per-term-per-sample to
     * per-term — 34 calls per creature instead of 9,800.
     *
     * The accumulated rotation drifts, but over 144 steps in double precision that is
     * far below a pixel, and the loop is rebuilt from scratch every frame so nothing
     * accumulates across frames.
     *
     * Rule 4: <=60 lines | Rule 5: 2 asserts | Rule 3: no per-frame allocation.
     */
    _traceOne(c, N, rx, ry, rz, ux, uy, uz) {
        console.assert(c && c.geom, '_traceOne: creature has geometry');
        console.assert(N > 2, '_traceOne: enough samples');
        const P = this._pairs[c.a][c.b];
        const t = c.t;

        // Level of detail, and the running total it needs, in one pass over the terms.
        let total = 0;
        for (let i = 0; i < P.n; i++) total += P.ampA[i] + (P.ampB[i] - P.ampA[i]) * t;
        let terms = P.n;
        if (total > 0 && this.detail < 1) {
            let run = 0;
            for (let i = 0; i < P.n; i++) {                  // Rule 2: bounded
                run += P.ampA[i] + (P.ampB[i] - P.ampA[i]) * t;
                if (run / total >= this.detail) { terms = i + 1; break; }
            }
        }

        const ax = this._accX, ay = this._accY;
        for (let k = 0; k < N; k++) { ax[k] = 0; ay[k] = 0; }  // Rule 2: bounded

        const TWO_PI = Math.PI * 2;
        for (let i = 0; i < terms; i++) {                    // Rule 2: bounded
            const amp = P.ampA[i] + (P.ampB[i] - P.ampA[i]) * t;
            if (amp === 0) continue;
            const ph = P.phA[i] + P.dPh[i] * t + c.phase;
            const d = TWO_PI * P.freq[i] / N;
            const cd = Math.cos(d), sd = Math.sin(d);
            let vx = amp * Math.cos(ph), vy = amp * Math.sin(ph);
            for (let k = 0; k < N; k++) {                    // Rule 2: bounded
                ax[k] += vx; ay[k] += vy;
                const nx = vx * cd - vy * sd;                // rotate by the fixed step
                vy = vx * sd + vy * cd;
                vx = nx;
            }
        }

        const arr = c.geom.getAttribute('position').array;
        const sc = c.scale;
        for (let k = 0; k < N; k++) {                        // Rule 2: bounded
            const px = ax[k] * sc, py = ay[k] * sc;
            arr[k * 3] = c.pos[0] + rx * px + ux * py;
            arr[k * 3 + 1] = c.pos[1] + ry * px + uy * py;
            arr[k * 3 + 2] = c.pos[2] + rz * px + uz * py;
        }
        c.geom.getAttribute('position').needsUpdate = true;
        c.geom.setDrawRange(0, N);
        c.loop.visible = true;
        return true;
    }

    /**
     * The camera's right and up axes in world space, as [rx,ry,rz, ux,uy,uz].
     *
     * The outlines are BILLBOARDED — traced in this basis rather than in a fixed plane.
     * Without it every creature is a flat figure in the XY plane while the camera circles
     * them, so twice per lap the whole shoal turns edge-on and becomes a field of
     * vertical slivers. Screenshotted before the fix: at low detail, where every shape
     * should be a clean circle, most were flattened ellipses and several were straight
     * lines. A shape showcase whose shapes periodically vanish is not showing anything.
     *
     * Falls back to the world axes when the camera has no matrix — headless test stubs
     * have no matrixWorld, and the geometry is still correct, just not billboarded.
     * Rule 5: 2 asserts.
     */
    _basis() {
        console.assert(this.camera, '_basis: camera built');
        console.assert(this._scratchBasis.length === 6, '_basis: scratch allocated');
        const out = this._scratchBasis;                      // Rule 3: no per-frame allocation
        const m = this.camera.matrixWorld && this.camera.matrixWorld.elements;
        if (!m) {
            out[0] = 1; out[1] = 0; out[2] = 0;
            out[3] = 0; out[4] = 1; out[5] = 0;
            return out;
        }
        out[0] = m[0]; out[1] = m[1]; out[2] = m[2];         // right
        out[3] = m[4]; out[4] = m[5]; out[5] = m[6];         // up
        return out;
    }

    /** Trace, drift the camera, draw. Rule 5: 2 asserts. */
    render(deltaTime, width, height) {
        console.assert(this.scene, 'render: init first');
        console.assert(this.renderer, 'render: renderer required');
        if (width > 0 && height > 0) {
            const aspect = width / height;
            if (this.camera.aspect !== aspect) {
                this.camera.aspect = aspect;
                this.camera.updateProjectionMatrix();
            }
        }
        // Camera first: _trace billboards against this frame's orientation, and the world
        // matrix has to be refreshed for _basis to read anything but a stale one. Tracing
        // first meant billboarding to where the camera WAS, which at this drift rate is
        // invisible — but it would be a real lag at any faster spin.
        this._orbit(deltaTime || 0);
        if (this.camera.updateMatrixWorld) this.camera.updateMatrixWorld(true);
        this._trace();
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);
        return true;
    }

    /** Slow camera drift around the shoal. Rule 5: 2 asserts. */
    _orbit(deltaTime) {
        console.assert(this.camera, '_orbit: camera built');
        console.assert(Number.isFinite(deltaTime), '_orbit: finite delta');
        const dt = Math.max(0, Math.min(0.1, deltaTime));    // Rule 2: bound a stalled tab
        this._angle += dt * this.spin;
        const R = SineField.VIEW_RADIUS;
        this.camera.position.set(
            Math.cos(this._angle) * R,
            Math.sin(this._angle * 0.4) * R * 0.18,
            Math.sin(this._angle) * R
        );
        this.camera.lookAt(0, 0, 0);
        return true;
    }

    dispose() {
        console.assert(!this._disposed, 'dispose: once only');
        console.assert(this !== undefined, 'dispose: instance');
        this._disposed = true;
        for (let i = 0; i < this._creatures.length; i++) {   // Rule 2: bounded
            const c = this._creatures[i];
            if (c.geom) c.geom.dispose();
            if (c.mat) c.mat.dispose();
            if (this.scene && c.loop) this.scene.remove(c.loop);
        }
        this._creatures = [];
        this.scene = null;
        this.shapes = null;
        return true;
    }
}

// The base library. Every one is a formula in SineField.outline, not a vertex list.
SineField.KINDS = ['blob', 'star', 'gear', 'leaf', 'cross', 'bloom'];

// Points fed to the DFT. 256 is plenty to resolve the sharpest of these (the gear's
// square wave) and the transform is O(n^2) but runs six times, once, at startup.
SineField.OUTLINE_POINTS = 256;

// Terms kept per shape. Beyond ~28 the additions are below a pixel at these sizes, and
// this is the number the byte count is built from — 6 shapes * 28 terms * 12 bytes.
SineField.MAX_TERMS = 28;

SineField.MAX_CREATURES = 48;
SineField.SAMPLES = 144;              // points traced around each outline
SineField.VIEW_RADIUS = 3.1;
SineField.BOX = [1.9, 1.15, 1.9];     // drift bounds, wrapped

if (typeof window !== 'undefined') window.SineField = SineField;
if (typeof module !== 'undefined' && module.exports) module.exports = SineField;
