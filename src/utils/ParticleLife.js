// ParticleLife.js — lifelike structure from typed particles and one matrix of forces.
//
// The third axis on this page. Conway is a discrete grid of binary cells; Lenia is a
// discrete grid of continuous values; this has NO GRID AT ALL — particles move freely in
// continuous space, and the only rule is how each type feels about every other type.
//
// THE RULE
// Every particle has a type (a colour). For a pair (a, b) at distance d, within uRadius:
//
//     d < BETA          strong universal REPULSION, ramping to zero at BETA
//     BETA <= d < 1     attraction of strength M[a][b], peaking midway and tapering to 0
//
// M is asymmetric on purpose: red may chase green while green flees red. That asymmetry
// is where chasing, orbiting and self-propelling clusters come from — a symmetric matrix
// gives you crystals and blobs, which is pretty and much less alive.
//
// The short-range repulsion is not decoration either: without it every attracting pair
// collapses to a point and the simulation dies as a handful of infinitely dense dots.
// It is scaled by REPULSION so it OUTWEIGHS attraction close in. At parity it merely ties
// with a maximal attraction of 1.0 and then loses to the accumulated pull of many
// neighbours at once: measured, an all-attract matrix drove the closest pair to 0.00117,
// twenty times inside the repulsion radius — merged.
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
        console.assert(typeof THREE !== 'undefined', 'ParticleLife: THREE required');
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

        this.matrix = new Float32Array(ParticleLife.MAX_TYPES * ParticleLife.MAX_TYPES);
        this._px = null; this._py = null; this._vx = null; this._vy = null; this._type = null;
        this._points = null; this._geom = null; this._mat = null;
        this._scene = null; this._cam = null;
        this._cellCount = 0; this._cellHead = null; this._cellNext = null;
        this._disposed = false;
        this.randomiseMatrix();
    }

    /** Read one matrix entry: how type a feels about type b. */
    getForce(a, b) {
        console.assert(a >= 0 && a < ParticleLife.MAX_TYPES, 'getForce: type a in range');
        console.assert(b >= 0 && b < ParticleLife.MAX_TYPES, 'getForce: type b in range');
        return this.matrix[a * ParticleLife.MAX_TYPES + b];
    }

    /** Write one matrix entry, clamped to [-1, 1]. Rule 5: 2 asserts. */
    setForce(a, b, v) {
        console.assert(Number.isFinite(v), 'setForce: finite value');
        console.assert(a >= 0 && b >= 0, 'setForce: non-negative types');
        if (a >= ParticleLife.MAX_TYPES || b >= ParticleLife.MAX_TYPES) return false;
        this.matrix[a * ParticleLife.MAX_TYPES + b] = Math.max(-1, Math.min(1, v));
        return true;
    }

    /**
     * Fill the matrix with random asymmetric values.
     * Asymmetric because symmetry kills the interesting behaviour — see the header.
     * Rule 5: 2 asserts.
     */
    randomiseMatrix() {
        console.assert(this.matrix, 'randomiseMatrix: matrix allocated');
        console.assert(ParticleLife.MAX_TYPES > 0, 'randomiseMatrix: types defined');
        const N = ParticleLife.MAX_TYPES;
        for (let a = 0; a < N; a++) {                       // Rule 2: bounded
            for (let b = 0; b < N; b++) {                   // Rule 2: bounded
                this.matrix[a * N + b] = Math.random() * 2 - 1;
            }
        }
        return true;
    }

    /** Mirror the upper triangle onto the lower, making every relationship mutual. */
    symmetriseMatrix() {
        console.assert(this.matrix, 'symmetriseMatrix: matrix allocated');
        console.assert(ParticleLife.MAX_TYPES > 0, 'symmetriseMatrix: types defined');
        const N = ParticleLife.MAX_TYPES;
        for (let a = 0; a < N; a++) {                       // Rule 2: bounded
            for (let b = a + 1; b < N; b++) {               // Rule 2: bounded
                this.matrix[b * N + a] = this.matrix[a * N + b];
            }
        }
        return true;
    }

    /** Build buffers and the point cloud. Rule 5: 2 asserts. */
    init() {
        console.assert(!this._disposed, 'init: not disposed');
        console.assert(this.count > 0, 'init: positive count');
        const n = ParticleLife.MAX_PARTICLES;               // Rule 3: allocate the ceiling once
        this._px = new Float32Array(n); this._py = new Float32Array(n);
        this._vx = new Float32Array(n); this._vy = new Float32Array(n);
        this._type = new Uint8Array(n);

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
        for (let i = 0; i < this.count; i++) {              // Rule 2: bounded
            const c = ParticleLife.TYPE_COLOURS[this._type[i] % ParticleLife.TYPE_COLOURS.length];
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

        for (let i = 0; i < this.count; i++) {              // Rule 2: bounded
            let fx = 0, fy = 0;
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
                                const d = Math.sqrt(d2), q = d / R;
                                let f;
                                if (q < beta) f = (q / beta - 1) * ParticleLife.REPULSION;
                                else f = this.matrix[ti * N + this._type[j]] *
                                         (1 - Math.abs(2 * q - 1 - beta) / (1 - beta));
                                fx += (dx / d) * f; fy += (dy / d) * f;
                            }
                        }
                        j = this._cellNext[j];
                    }
                }
            }
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
        }
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
        return true;
    }
}

// How much stronger close-range repulsion is than the strongest attraction. Must be
// well above 1: a particle can be pulled by many neighbours at once but is pushed by
// only the few that are truly close, so parity is not enough to keep them apart.
ParticleLife.REPULSION = 6;

ParticleLife.MAX_TYPES = 6;
ParticleLife.MAX_PARTICLES = 6000;

// Distinct hues that stay legible as 8px dots on a dark ground, and read as different
// SPECIES rather than as a gradient — the type is categorical, not a value.
ParticleLife.TYPE_COLOURS = [
    [1.00, 0.42, 0.28],   // coral
    [0.36, 0.86, 0.62],   // mint
    [0.44, 0.68, 1.00],   // sky
    [1.00, 0.82, 0.35],   // amber
    [0.80, 0.52, 1.00],   // violet
    [0.98, 0.98, 0.98]    // white
];
ParticleLife.TYPE_NAMES = ['Coral', 'Mint', 'Sky', 'Amber', 'Violet', 'White'];

if (typeof window !== 'undefined') window.ParticleLife = ParticleLife;
if (typeof module !== 'undefined' && module.exports) module.exports = ParticleLife;
