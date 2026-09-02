// ParticleLife.js — the 2D Particle Life on the Life page. Requires ForceMatrix.js.
//
// The third axis on this page. Conway is a discrete grid of binary cells; Lenia is a
// discrete grid of continuous values; this has NO GRID AT ALL — particles move freely in
// continuous space, and the only rule is how each type feels about every other type.
//
// THE RULE, the type palette and the interaction matrix all live in ForceMatrix.js, which
// this shares with ParticleField3D (the main-page scene) so the model cannot drift apart
// between the two. Read that file for what the force curve is and why the matrix is
// asymmetric. What is specific to THIS file is everything below: the 2D spatial index,
// the integrator, and the orthographic point rendering.
//
// The short-range repulsion is not decoration: without it every attracting pair collapses
// to a point and the simulation dies as a handful of infinitely dense dots. It is scaled
// by ForceMatrix.REPULSION so it OUTWEIGHS attraction close in.
//
// THE SPEED LIMIT
// A step never moves a particle further than the repulsion zone is wide. Without that
// cap, a particle deep inside the zone feels an enormous repulsive force, is thrown clean
// past its neighbour in one step, and the pair swap places instead of separating —
// repulsion then barely works however strong it is. Measured before the cap: closest pair
// 2.7e-3 with repulsion versus 1.5e-3 without, a mere 1.8x when it should be an order of
// magnitude. This is the standard stability condition for explicit integration: the step
// must not skip over the feature it is trying to resolve. It costs one sqrt per particle.
//
// WHY CPU, WHEN THE OTHER TWO SIMS ARE GPU SHADERS
// Conway and Lenia are stencil operations — every cell reads a fixed neighbourhood at a
// fixed offset, which is exactly what a fragment shader does well. This is not: each
// particle must find its neighbours, which on the WebGL1-style ShaderMaterial this site
// uses would mean encoding a spatial structure into textures and reading it back. A CPU
// implementation with a uniform-grid spatial hash runs a few thousand particles in a
// couple of milliseconds, is testable without a GPU, and I can prove it is correct.
// An unverifiable GPU version would be the worse engineering trade here.
//
// Cost is O(n * k) with k the average neighbours in the 9 surrounding buckets, not
// O(n^2): at 3000 particles the naive form is 9,000,000 pair tests per step and this is
// closer to 150,000.
//
// Zero asset bytes: the entire simulation is this file.
class ParticleLife {
    /**
     * @param {THREE.WebGLRenderer} renderer - shared with the rest of the site
     * @param {Object} [opts]
     */
    constructor(renderer, opts) {
        console.assert(renderer && renderer.domElement, 'ParticleLife: renderer required');
        console.assert(typeof ForceMatrix !== 'undefined', 'ParticleLife: ForceMatrix must load first');
        const o = opts || {};
        this.renderer = renderer;
        this.size = 1;                       // world is the unit square, wrapped
        this.count = Math.max(1, Math.min(ParticleLife.MAX_PARTICLES, o.count || 1800));
        this.types = Math.max(2, Math.min(ParticleLife.MAX_TYPES, o.types || 5));
        this.radius = o.radius || 0.075;     // interaction range, world units
        this.beta = o.beta || 0.3;           // repulsion cutoff, fraction of radius
        // Terminal speed is forceScale * dt / (1 - friction). At the original
        // 1.0 / 0.012 / 0.86 that is 0.086 world-units per step — a particle crossing
        // 8% of the world every tick, which mixes everything instead of letting
        // structure form. Measured: clustering under an all-attract matrix moved the
        // spread only 0.402 -> 0.375 in 500 steps. 0.30 brings terminal speed to
        // ~0.026 and structures actually hold together.
        this.forceScale = (o.forceScale !== undefined) ? o.forceScale : 0.30;
        this.friction = (o.friction !== undefined) ? o.friction : 0.86;  // per-step velocity retained
        this.dt = o.dt || 0.012;
        this.generation = 0;
        // Density regulation — see ForceMatrix.densityScale. Defaults chosen by
        // measurement, not taste: see tests/verify-particles.cjs.
        this.densityRegulation = (o.densityRegulation !== undefined) ? o.densityRegulation : true;
        this.densityTarget = (o.densityTarget !== undefined) ? o.densityTarget : 4.0;
        this.densityStrength = (o.densityStrength !== undefined) ? o.densityStrength : 0.25;

        // The model lives in ForceMatrix; `matrix` is the SAME Float32Array, exposed
        // directly because the inner loop indexes it and a property hop per pair test is
        // not free at ~150,000 tests a step.
        this._fm = new ForceMatrix(this.types);
        this.matrix = this._fm.m;
        this._px = null; this._py = null; this._vx = null; this._vy = null; this._type = null;
        this._points = null; this._geom = null; this._mat = null;
        this._scene = null; this._cam = null;
        this._cellCount = 0; this._cellHead = null; this._cellNext = null;
        this._density = null; this._dscale = null;
        this._disposed = false;
    }

    // --- matrix API: thin passes through to the shared model -----------------------------
    // Kept as methods on the sim (rather than making callers reach for sim._fm) because the
    // page's matrix editor talks to the simulation, not to its internals.

    /** Read one matrix entry: how type a feels about type b. Rule 5: 2 asserts. */
    getForce(a, b) {
        console.assert(this._fm, 'getForce: model built');
        console.assert(a >= 0 && b >= 0, 'getForce: non-negative types');
        return this._fm.get(a, b);
    }

    /** Write one matrix entry, clamped to [-1, 1]. Rule 5: 2 asserts. */
    setForce(a, b, v) {
        console.assert(this._fm, 'setForce: model built');
        console.assert(Number.isFinite(v), 'setForce: finite value');
        return this._fm.set(a, b, v);
    }

    /** Fill the matrix with random asymmetric values. Rule 5: 2 asserts. */
    randomiseMatrix() {
        console.assert(this._fm, 'randomiseMatrix: model built');
        console.assert(this.matrix === this._fm.m, 'randomiseMatrix: buffer still shared');
        return this._fm.randomise();
    }

    /** Mirror the upper triangle onto the lower, making every relationship mutual. */
    symmetriseMatrix() {
        console.assert(this._fm, 'symmetriseMatrix: model built');
        console.assert(this.matrix === this._fm.m, 'symmetriseMatrix: buffer still shared');
        return this._fm.symmetrise();
    }

    /** Zero every entry: particles then only ever push apart. Rule 5: 2 asserts. */
    clearMatrix() {
        console.assert(this._fm, 'clearMatrix: model built');
        console.assert(this.matrix === this._fm.m, 'clearMatrix: buffer still shared');
        return this._fm.clear();
    }

    /** Build buffers and the point cloud. Rule 5: 2 asserts. */
    init() {
        console.assert(!this._disposed, 'init: not disposed');
        console.assert(this.count > 0, 'init: positive count');
        console.assert(typeof THREE !== 'undefined', 'init: THREE required');
        const n = ParticleLife.MAX_PARTICLES;               // Rule 3: allocate the ceiling once
        this._px = new Float32Array(n); this._py = new Float32Array(n);
        this._vx = new Float32Array(n); this._vy = new Float32Array(n);
        this._type = new Uint8Array(n);
        this._density = new Float32Array(n);
        this._dscale = new Float32Array(n).fill(1);         // full attraction until measured

        this._cam = new THREE.OrthographicCamera(0, 1, 1, 0, 0, 1);
        this._scene = new THREE.Scene();
        this._geom = new THREE.BufferGeometry();
        this._geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
        this._geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
        // size is in PIXELS because sizeAttenuation is off. It was 0.008, which is
        // sub-pixel — the particles rendered as barely-visible specks and their species
        // colours aliased away to near-white. 3.5px is a visible dot that still reads as
        // a point rather than a blob at 1800 particles.
        this._mat = new THREE.PointsMaterial({ size: 3.5, vertexColors: true, sizeAttenuation: false });
        this._points = new THREE.Points(this._geom, this._mat);
        this._points.frustumCulled = false;                 // positions change every frame
        this._scene.add(this._points);

        this._buildGrid();
        this.seed();
        return true;
    }

    /**
     * Size the spatial hash so a bucket is one interaction radius across: then every
     * neighbour within range is in this bucket or one of the 8 around it, and no more
     * distant particle is ever tested. Rule 5: 2 asserts.
     */
    _buildGrid() {
        console.assert(this.radius > 0, '_buildGrid: positive radius');
        console.assert(!this._disposed, '_buildGrid: not disposed');
        this._cells = Math.max(3, Math.min(64, Math.floor(1 / this.radius)));
        this._cellCount = this._cells * this._cells;
        this._cellHead = new Int32Array(this._cellCount);
        this._cellNext = new Int32Array(ParticleLife.MAX_PARTICLES);
        return true;
    }

    /** Scatter particles with random types and zero velocity. Rule 5: 2 asserts. */
    seed(count, types) {
        console.assert(this._px, 'seed: init first');
        console.assert(!this._disposed, 'seed: not disposed');
        if (Number.isFinite(count)) this.count = Math.max(1, Math.min(ParticleLife.MAX_PARTICLES, count | 0));
        if (Number.isFinite(types)) this.types = Math.max(2, Math.min(ParticleLife.MAX_TYPES, types | 0));
        for (let i = 0; i < this.count; i++) {              // Rule 2: bounded
            this._px[i] = Math.random();
            this._py[i] = Math.random();
            this._vx[i] = 0; this._vy[i] = 0;
            this._density[i] = 0; this._dscale[i] = 1;
            this._type[i] = (Math.random() * this.types) | 0;
        }
        this.generation = 0;
        this._writeColours();
        return true;
    }

    /** Push type colours into the geometry once; positions update every step. */
    _writeColours() {
        console.assert(this._geom, '_writeColours: init first');
        console.assert(this.types > 0, '_writeColours: types set');
        const col = this._geom.getAttribute('color');
        // LINEAR, not the sRGB palette. PointsMaterial is a built-in material, so its
        // output goes through the renderer's sRGB encoding; vertex-colour attributes are
        // never converted on input, so sRGB numbers here get encoded twice and every
        // species washes out to cream. Measured on the 3D field before the fix:
        // saturation 0.08 against 0.92 for a forced flat colour through the same
        // pipeline. Conway and Lenia are unaffected because a raw ShaderMaterial without
        // <colorspace_fragment> skips that encoding entirely — which is why the palette
        // in LifeView is NOT converted. See ForceMatrix.TYPE_COLOURS_LINEAR.
        const PAL = ForceMatrix.TYPE_COLOURS_LINEAR;
        for (let i = 0; i < this.count; i++) {              // Rule 2: bounded
            const c = PAL[this._type[i] % PAL.length];
            col.array[i * 3] = c[0]; col.array[i * 3 + 1] = c[1]; col.array[i * 3 + 2] = c[2];
        }
        col.needsUpdate = true;
        return true;
    }

    /** Rebuild the spatial hash for this step. Rule 5: 2 asserts. */
    _hash() {
        console.assert(this._cellHead, '_hash: grid built');
        console.assert(this._px, '_hash: buffers built');
        this._cellHead.fill(-1);
        const g = this._cells;
        for (let i = 0; i < this.count; i++) {              // Rule 2: bounded
            const cx = Math.min(g - 1, (this._px[i] * g) | 0);
            const cy = Math.min(g - 1, (this._py[i] * g) | 0);
            const c = cy * g + cx;
            this._cellNext[i] = this._cellHead[c];
            this._cellHead[c] = i;
        }
        return true;
    }

    /**
     * One step: rebuild the neighbour index, accumulate forces, then move.
     * Split into three so each part stays inside Rule 4's 60 lines and can be reasoned
     * about on its own — the force loop is the only interesting one.
     * Rule 5: 2 asserts.
     */
    step() {
        console.assert(this._px, 'step: init first');
        console.assert(!this._disposed, 'step: not disposed');
        this._hash();
        this._accumulate();
        this._integrate();
        this.generation++;
        return true;
    }

    /**
     * Sum the force on every particle from the 9 buckets around it, and turn that into a
     * new velocity. Rule 4: <=60 lines | Rule 5: 2 asserts.
     */
    _accumulate() {
        console.assert(this._cellHead, '_accumulate: hash built');
        console.assert(this.count >= 0, '_accumulate: count valid');
        const g = this._cells, R = this.radius, R2 = R * R, N = ParticleLife.MAX_TYPES;
        const beta = this.beta;
        const dReg = this.densityRegulation;

        for (let i = 0; i < this.count; i++) {              // Rule 2: bounded
            let fx = 0, fy = 0;
            let same = 0, other = 0;                        // crowding, this step
            // Density scale from the PREVIOUS step. Using this step's own value would
            // need a second pass over every neighbour — the crowding is not known until
            // the sweep finishes — for a one-frame lag nobody can see: a particle moves
            // at most beta*radius per step, so its neighbourhood barely changes between
            // frames. One pass, same answer.
            const ds = dReg ? this._dscale[i] : 1;
            const xi = this._px[i], yi = this._py[i], ti = this._type[i];
            const cx = Math.min(g - 1, (xi * g) | 0), cy = Math.min(g - 1, (yi * g) | 0);

            for (let oy = -1; oy <= 1; oy++) {              // Rule 2: bounded (9 buckets)
                for (let ox = -1; ox <= 1; ox++) {
                    const bx = ((cx + ox) % g + g) % g, by = ((cy + oy) % g + g) % g;
                    let j = this._cellHead[by * g + bx];
                    let guard = 0;
                    while (j !== -1 && guard++ < ParticleLife.MAX_PARTICLES) {   // Rule 2: bounded
                        if (j !== i) {
                            // Shortest offset on the torus, so forces wrap with the world.
                            let dx = this._px[j] - xi, dy = this._py[j] - yi;
                            if (dx > 0.5) dx -= 1; else if (dx < -0.5) dx += 1;
                            if (dy > 0.5) dy -= 1; else if (dy < -0.5) dy += 1;
                            const d2 = dx * dx + dy * dy;
                            if (d2 > 1e-12 && d2 < R2) {
                                // INLINED ForceMatrix.curve — see that file on why, and
                                // verify-field3d.cjs, which proves this copy still agrees
                                // with the reference across the whole range of q.
                                const d = Math.sqrt(d2), q = d / R;
                                const tj = this._type[j];
                                // Crowding for the NEXT step: linear falloff so a
                                // neighbour at the edge of the radius counts for nothing.
                                if (tj === ti) same += 1 - q; else other += 1 - q;
                                let f;
                                if (q < beta) f = (q / beta - 1) * ParticleLife.REPULSION;
                                // ds damps ATTRACTION only — see ForceMatrix.densityScale.
                                else f = this.matrix[ti * N + tj] *
                                         (1 - Math.abs(2 * q - 1 - beta) / (1 - beta)) * ds;
                                fx += (dx / d) * f; fy += (dy / d) * f;
                            }
                        }
                        j = this._cellNext[j];
                    }
                }
            }
            this._applyForce(i, fx, fy, same, other);
        }
        return true;
    }

    /**
     * Turn accumulated force into a capped velocity for one particle, and record its
     * crowding for the next step. Split out of _accumulate to stay inside Rule 4's 60
     * lines, and named to match ParticleField3D._applyForce so the two files read the
     * same way. Rule 5: 2 asserts.
     */
    _applyForce(i, fx, fy, same, other) {
        console.assert(i >= 0 && i < ParticleLife.MAX_PARTICLES, '_applyForce: index in range');
        console.assert(Number.isFinite(fx + fy), '_applyForce: finite force');
        // Crowding for the next step: the EXCESS of same-type neighbours over mixed
        // ones. A difference, not a ratio — see ForceMatrix.densityScale.
        this._density[i] = same - other;
        this._dscale[i] = this.densityRegulation
            ? ForceMatrix.densityScale(this._density[i], this.densityTarget, this.densityStrength)
            : 1;

        let nvx = this._vx[i] * this.friction + fx * this.forceScale * this.dt;
        let nvy = this._vy[i] * this.friction + fy * this.forceScale * this.dt;

        // Speed limit — see THE SPEED LIMIT in the header.
        const sp2 = nvx * nvx + nvy * nvy;
        const lim = this.beta * this.radius;
        if (sp2 > lim * lim) {
            const s = lim / Math.sqrt(sp2);
            nvx *= s; nvy *= s;
        }
        this._vx[i] = nvx;
        this._vy[i] = nvy;
        return true;
    }

    /** Move every particle by its velocity and wrap it back into the unit square. */
    _integrate() {
        console.assert(this._px, '_integrate: buffers built');
        console.assert(this._vx, '_integrate: velocities built');
        for (let i = 0; i < this.count; i++) {              // Rule 2: bounded
            const x = this._px[i] + this._vx[i], y = this._py[i] + this._vy[i];
            this._px[i] = x - Math.floor(x);                // wrap to [0,1)
            this._py[i] = y - Math.floor(y);
        }
        return true;
    }

    /** Copy positions into the geometry and draw. Rule 5: 2 asserts. */
    render(view) {
        console.assert(this._geom, 'render: init first');
        console.assert(this.renderer, 'render: renderer required');
        const pos = this._geom.getAttribute('position');
        for (let i = 0; i < this.count; i++) {              // Rule 2: bounded
            pos.array[i * 3] = this._px[i];
            pos.array[i * 3 + 1] = this._py[i];
            pos.array[i * 3 + 2] = 0;
        }
        pos.needsUpdate = true;
        this._geom.setDrawRange(0, this.count);
        // Zoom/pan come from the shared view so this mode behaves like the other two.
        if (view) {
            const z = view.zoom || 1;
            this._cam.left = 0.5 + view.panX - 0.5 / z;
            this._cam.right = 0.5 + view.panX + 0.5 / z;
            this._cam.bottom = 0.5 + view.panY - 0.5 / z;
            this._cam.top = 0.5 + view.panY + 0.5 / z;
            // Grow with zoom so magnifying shows bigger particles rather than the same
            // specks further apart, but sub-linearly or they merge into sheets.
            this._mat.size = Math.max(2, Math.min(14, 3.5 * Math.sqrt(z)));
            this._cam.updateProjectionMatrix();
        }
        this.renderer.setRenderTarget(null);
        this.renderer.render(this._scene, this._cam);
        return true;
    }

    dispose() {
        console.assert(!this._disposed, 'dispose: once only');
        console.assert(this !== undefined, 'dispose: instance');
        this._disposed = true;
        if (this._geom) this._geom.dispose();
        if (this._mat) this._mat.dispose();
        this._geom = null; this._mat = null; this._points = null; this._scene = null;
        this._px = this._py = this._vx = this._vy = null;
        this._type = null; this._cellHead = null; this._cellNext = null;
        this._density = null; this._dscale = null;
        return true;
    }
}

// The model's constants are ForceMatrix's. Re-exported here rather than copied so the
// existing call sites (the page, the tests) keep reading ParticleLife.MAX_TYPES and get
// the one true value — there is no second definition that can fall out of step.
ParticleLife.REPULSION = ForceMatrix.REPULSION;
ParticleLife.MAX_TYPES = ForceMatrix.MAX_TYPES;
ParticleLife.TYPE_COLOURS = ForceMatrix.TYPE_COLOURS;
ParticleLife.TYPE_NAMES = ForceMatrix.TYPE_NAMES;

// Specific to the 2D page sim: the ceiling it allocates for. The 3D scene has its own.
ParticleLife.MAX_PARTICLES = 6000;

if (typeof window !== 'undefined') window.ParticleLife = ParticleLife;
if (typeof module !== 'undefined' && module.exports) module.exports = ParticleLife;
