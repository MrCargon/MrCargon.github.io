// OrbitalCloud.js — the hydrogen atom, drawn the way it actually is.
//
// A third backdrop next to the solar system and the particle field. Every dot is one
// POSSIBLE position of a single electron; the cloud of them is the probability density
// |psi|^2 of the state (n, l, m). Nothing orbits. The electron is not somewhere in here
// moving around — until measured it is in all of these places at once, and the shape you
// see IS the electron.
//
// Technique from kavan, "Simulating Atoms in C++". The chain of reasoning that gets you
// here is worth keeping, because each step exists to break the one before it:
//
//   circular orbit    an accelerating charge radiates, so it should spiral into the nucleus
//   Bohr's levels     fixes that by decree — but then how does it accelerate at all?
//   standing wave     it doesn't. The electron is a wave wrapped round the proton, and
//                     only whole numbers of wavelengths fit
//   this file         so sample where that wave is dense, and draw those points
//
// The good part is that the energy levels are not an extra rule. Tune the energy
// continuously and the wave only closes on itself at particular values — and those values
// are exactly Bohr's.
//
// WHAT IS ACTUALLY COMPUTED
// The wavefunction separates because the atom is spherically symmetric:
//
//     psi(r, theta, phi) = R_nl(r) . Theta_lm(theta) . e^(i m phi)
//
//   R_nl       associated LAGUERRE polynomials. Radial probability is |R|^2 r^2 — the r^2
//              is the shell volume element and it is why the 1s peak sits at r = 1 rather
//              than at the nucleus, where |R|^2 is largest.
//   Theta_lm   associated LEGENDRE polynomials. Density |Theta|^2 sin(theta).
//   phi        UNIFORM. It carries no positional information at all — what it carries is
//              PHASE, and that is what the drift below animates.
//
// Sampling is inverse-transform (CDF) sampling: build a cumulative table, draw a uniform
// number, binary-search where it lands. No rejection loop, fixed cost per point, and it
// reproduces any tabulated density exactly. Tables are rebuilt only when (n, l, m) change.
//
// UNITS: Bohr radii, a0 = 1. The scene is scaled at draw time.
//
// Zero asset bytes: the entire visual is this arithmetic.
class OrbitalCloud {
    /**
     * @param {THREE.WebGLRenderer} renderer - shared with SpaceEnvironment
     * @param {Object} [opts]
     */
    constructor(renderer, opts) {
        console.assert(renderer && renderer.domElement, 'OrbitalCloud: renderer required');
        console.assert(typeof ParticleField3D !== 'undefined', 'OrbitalCloud: needs ParticleField3D for the sprite');
        const o = opts || {};
        this.renderer = renderer;
        this.count = Math.max(500, Math.min(OrbitalCloud.MAX_POINTS, o.count || 14000));
        this.n = 3; this.l = 2; this.m = 1;
        this.spin = (o.spin !== undefined) ? o.spin : 0.05;    // camera drift, rad/sec
        this.flow = (o.flow !== undefined) ? o.flow : 1.0;     // probability-current speed
        this.generation = 0;

        this._r = null; this._theta = null; this._phi = null;
        this._rCdf = null; this._rEdge = null; this._tCdf = null;
        this._geom = null; this._mat = null; this._points = null;
        this.scene = null; this.camera = null;
        this._angle = 0; this._scale = 1;
        this._disposed = false;
        if (Number.isFinite(o.n)) this.setState(o.n, o.l, o.m);
    }

    // ── the special functions ────────────────────────────────────────────────

    /**
     * Associated Laguerre polynomial L_k^alpha(x), by the standard three-term recurrence.
     * Rule 2: bounded by k | Rule 5: 2 asserts.
     */
    static laguerre(k, alpha, x) {
        console.assert(Number.isInteger(k) && k >= 0, 'laguerre: non-negative order');
        console.assert(Number.isFinite(x), 'laguerre: finite argument');
        if (k === 0) return 1;
        let prev = 1, cur = 1 + alpha - x;
        for (let i = 1; i < k; i++) {                        // Rule 2: bounded
            const next = ((2 * i + 1 + alpha - x) * cur - (i + alpha) * prev) / (i + 1);
            prev = cur; cur = next;
        }
        return cur;
    }

    /**
     * Associated Legendre P_l^m(x) for m >= 0, by recurrence.
     * Rule 2: bounded by l | Rule 5: 2 asserts.
     */
    static legendre(l, m, x) {
        console.assert(m >= 0 && m <= l, 'legendre: 0 <= m <= l');
        console.assert(x >= -1.0000001 && x <= 1.0000001, 'legendre: |x| <= 1');
        // P_m^m = (-1)^m (2m-1)!! (1-x^2)^(m/2)
        let pmm = 1;
        if (m > 0) {
            const somx2 = Math.sqrt(Math.max(0, 1 - x * x));
            let fact = 1;
            for (let i = 1; i <= m; i++) {                   // Rule 2: bounded
                pmm *= -fact * somx2;
                fact += 2;
            }
        }
        if (l === m) return pmm;
        let pmmp1 = x * (2 * m + 1) * pmm;
        if (l === m + 1) return pmmp1;
        let pll = 0;
        for (let ll = m + 2; ll <= l; ll++) {                // Rule 2: bounded
            pll = ((2 * ll - 1) * x * pmmp1 - (ll + m - 1) * pmm) / (ll - m);
            pmm = pmmp1; pmmp1 = pll;
        }
        return pll;
    }

    /** n! for the small n these formulas need. Rule 5: 2 asserts. */
    static fact(n) {
        console.assert(Number.isInteger(n) && n >= 0, 'fact: non-negative integer');
        console.assert(n <= 20, 'fact: stays inside double precision');
        let f = 1;
        for (let i = 2; i <= n; i++) f *= i;                 // Rule 2: bounded
        return f;
    }

    /**
     * Radial wavefunction R_nl(r) in Bohr radii. Normalised so that the integral of
     * |R|^2 r^2 over [0, inf) is 1 — verify-orbitals.cjs checks that numerically.
     * Rule 5: 2 asserts.
     */
    static radial(n, l, r) {
        console.assert(n >= 1 && l >= 0 && l < n, 'radial: 0 <= l < n');
        console.assert(r >= 0, 'radial: non-negative radius');
        const rho = 2 * r / n;
        const norm = Math.sqrt(
            Math.pow(2 / n, 3) * OrbitalCloud.fact(n - l - 1) /
            (2 * n * OrbitalCloud.fact(n + l))
        );
        return norm * Math.exp(-rho / 2) * Math.pow(rho, l) *
            OrbitalCloud.laguerre(n - l - 1, 2 * l + 1, rho);
    }

    /**
     * Theta_lm(theta), normalised so the integral of |Theta|^2 sin(theta) over [0, pi]
     * is 1. Rule 5: 2 asserts.
     */
    static angular(l, m, theta) {
        console.assert(l >= 0 && Math.abs(m) <= l, 'angular: |m| <= l');
        console.assert(Number.isFinite(theta), 'angular: finite angle');
        const am = Math.abs(m);
        const norm = Math.sqrt(
            (2 * l + 1) / 2 * OrbitalCloud.fact(l - am) / OrbitalCloud.fact(l + am)
        );
        return norm * OrbitalCloud.legendre(l, am, Math.cos(theta));
    }

    // ── state and tables ─────────────────────────────────────────────────────

    /**
     * Set the quantum numbers, clamped to a physically valid combination, and rebuild
     * the sampling tables. Invalid states are CLAMPED rather than rejected because these
     * come from three independent sliders: dragging n down past l would otherwise put the
     * UI in a state with no legal value. Rule 5: 2 asserts | Rule 6: always ends valid.
     */
    setState(n, l, m) {
        console.assert(Number.isFinite(n), 'setState: finite n');
        console.assert(!this._disposed, 'setState: not disposed');
        this.n = Math.max(1, Math.min(OrbitalCloud.MAX_N, Math.round(n)));
        this.l = Math.max(0, Math.min(this.n - 1, Math.round(Number.isFinite(l) ? l : this.l)));
        const lm = Math.round(Number.isFinite(m) ? m : this.m);
        this.m = Math.max(-this.l, Math.min(this.l, lm));
        this._buildTables();
        if (this._r) this.resample();
        return true;
    }

    /**
     * Cumulative tables for r and theta. Built once per state, not per point: sampling
     * 14,000 points then costs one binary search each instead of re-evaluating Laguerre
     * and Legendre polynomials 14,000 times. Rule 5: 2 asserts.
     */
    _buildTables() {
        console.assert(this.n >= 1 && this.l < this.n, '_buildTables: valid state');
        console.assert(!this._disposed, '_buildTables: not disposed');
        const RB = OrbitalCloud.R_BINS, TB = OrbitalCloud.T_BINS;
        // Far enough out to hold essentially all the probability: <r> is
        // (3n^2 - l(l+1))/2, and the tail decays like exp(-r/n).
        this._rMax = 3 * this.n * this.n + 12 * this.n;
        this._rCdf = new Float64Array(RB + 1);
        const dr = this._rMax / RB;
        let acc = 0;
        for (let i = 0; i < RB; i++) {                       // Rule 2: bounded
            const r = (i + 0.5) * dr;
            const R = OrbitalCloud.radial(this.n, this.l, r);
            acc += R * R * r * r * dr;                       // |R|^2 r^2 dr
            this._rCdf[i + 1] = acc;
        }
        for (let i = 0; i <= RB; i++) this._rCdf[i] /= acc;  // Rule 2: bounded

        this._tCdf = new Float64Array(TB + 1);
        const dt = Math.PI / TB;
        let tacc = 0;
        for (let i = 0; i < TB; i++) {                       // Rule 2: bounded
            const th = (i + 0.5) * dt;
            const A = OrbitalCloud.angular(this.l, this.m, th);
            tacc += A * A * Math.sin(th) * dt;               // |Theta|^2 sin(theta) dtheta
            this._tCdf[i + 1] = tacc;
        }
        for (let i = 0; i <= TB; i++) this._tCdf[i] /= tacc; // Rule 2: bounded
        // Scale so the cloud fills a similar volume whatever n is; without this, 1s is a
        // dot and 6h overflows the view.
        this._scale = OrbitalCloud.VIEW_RADIUS / (this._rMax * 0.42);
        return true;
    }

    /**
     * Invert a normalised CDF table: binary-search for a uniform draw, then interpolate
     * inside the bin so the result is continuous rather than quantised to bin edges.
     * Rule 2: the search is bounded by log2(bins) | Rule 5: 2 asserts.
     */
    static sampleCdf(cdf, u, lo, hi) {
        console.assert(cdf && cdf.length > 1, 'sampleCdf: table required');
        console.assert(u >= 0 && u <= 1, 'sampleCdf: u in [0,1]');
        let a = 0, b = cdf.length - 1;
        while (b - a > 1) {                                  // Rule 2: bounded, halves each pass
            const mid = (a + b) >> 1;
            if (cdf[mid] <= u) a = mid; else b = mid;
        }
        const span = cdf[b] - cdf[a];
        const frac = span > 0 ? (u - cdf[a]) / span : 0;
        const step = (hi - lo) / (cdf.length - 1);
        return lo + (a + frac) * step;
    }

    // ── the cloud ────────────────────────────────────────────────────────────

    /** Build buffers, scene and point cloud. Rule 5: 2 asserts. */
    init() {
        console.assert(!this._disposed, 'init: not disposed');
        console.assert(typeof THREE !== 'undefined', 'init: THREE required');
        const n = OrbitalCloud.MAX_POINTS;                   // Rule 3: allocate the ceiling once
        this._r = new Float32Array(n);
        this._theta = new Float32Array(n);
        this._phi = new Float32Array(n);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(55, 1, 0.01, 100);
        this._geom = new THREE.BufferGeometry();
        this._geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
        this._geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
        this._mat = new THREE.PointsMaterial({
            size: OrbitalCloud.POINT_SIZE, vertexColors: true, sizeAttenuation: true,
            map: ParticleField3D.dotTexture(), alphaTest: 0.15,
            transparent: true, opacity: 0.85, depthWrite: false
        });
        this._points = new THREE.Points(this._geom, this._mat);
        this._points.frustumCulled = false;
        this.scene.add(this._points);

        this._buildTables();
        this.resample();
        return true;
    }

    /**
     * Draw a fresh set of points from the current state's distributions.
     * Rule 5: 2 asserts.
     */
    resample(count) {
        console.assert(this._r, 'resample: init first');
        console.assert(this._rCdf, 'resample: tables built');
        if (Number.isFinite(count)) {
            this.count = Math.max(500, Math.min(OrbitalCloud.MAX_POINTS, count | 0));
        }
        for (let i = 0; i < this.count; i++) {               // Rule 2: bounded
            this._r[i] = OrbitalCloud.sampleCdf(this._rCdf, Math.random(), 0, this._rMax);
            this._theta[i] = OrbitalCloud.sampleCdf(this._tCdf, Math.random(), 0, Math.PI);
            this._phi[i] = Math.random() * Math.PI * 2;      // uniform: phi carries phase only
        }
        this.generation = 0;
        this._writeColours();
        return true;
    }

    /**
     * Colour by PHASE, m*phi around the wheel.
     *
     * The video's choice, and it is the right one: |psi| does not vary with phi at all, so
     * colouring by density would give a single flat colour and waste the channel. Phase is
     * the information that is actually there, and once the current below starts turning it
     * you can see the wave move rather than infer it. At m = 0 there is no phase
     * dependence and no current — the orbital is genuinely static, and it looks it.
     *
     * Written in LINEAR light: three.js encodes linear to sRGB on output and never
     * converts vertex attributes on input, so an sRGB palette here would be encoded twice
     * and wash out. See ForceMatrix.TYPE_COLOURS_LINEAR for the measurement.
     * Rule 5: 2 asserts.
     */
    _writeColours() {
        console.assert(this._geom, '_writeColours: init first');
        console.assert(this._phi, '_writeColours: samples exist');
        const col = this._geom.getAttribute('color');
        const toLin = ForceMatrix.srgbToLinear;
        for (let i = 0; i < this.count; i++) {               // Rule 2: bounded
            const h = this.m === 0 ? OrbitalCloud.NEUTRAL_HUE
                : (((this.m * this._phi[i]) / (Math.PI * 2)) % 1 + 1) % 1;
            const c = OrbitalCloud.hueToRgb(h);
            col.array[i * 3] = toLin(c[0]);
            col.array[i * 3 + 1] = toLin(c[1]);
            col.array[i * 3 + 2] = toLin(c[2]);
        }
        col.needsUpdate = true;
        return true;
    }

    /**
     * Hue to sRGB at fixed saturation and lightness. Kept off full saturation so the
     * cloud reads as luminous rather than as a colour wheel. Rule 5: 2 asserts.
     */
    static hueToRgb(h) {
        console.assert(Number.isFinite(h), 'hueToRgb: finite hue');
        console.assert(h >= 0 && h <= 1, 'hueToRgb: hue in [0,1]');
        const S = 0.72, L = 0.62;
        const c = (1 - Math.abs(2 * L - 1)) * S;
        const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
        const mm = L - c / 2;
        const seg = Math.floor(h * 6) % 6;
        const t = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][seg];
        return [t[0] + mm, t[1] + mm, t[2] + mm];
    }

    /**
     * Advance the probability current. For a state with azimuthal number m the electron
     * has a real circulating current around the z axis; its angular velocity goes like
     * m / (r sin(theta))^2, so points near the axis race and points far out crawl. That
     * spread is the whole visual: the cloud does not rotate rigidly, it SHEARS.
     *
     * Clamped, because the true expression diverges on the axis where sin(theta) -> 0 and
     * would spin those points arbitrarily fast — a real singularity in the formula, not a
     * bug, but one that has to be bounded for a fixed timestep. Rule 5: 2 asserts.
     */
    step(deltaTime) {
        console.assert(this._phi, 'step: init first');
        console.assert(!this._disposed, 'step: not disposed');
        const dt = Math.max(0, Math.min(0.1, deltaTime || 0));  // Rule 2: bound a stalled tab
        if (this.m !== 0 && this.flow > 0) {
            const k = this.flow * this.m * OrbitalCloud.FLOW_SCALE;
            const CAP = OrbitalCloud.MAX_FLOW;
            for (let i = 0; i < this.count; i++) {           // Rule 2: bounded
                const s = this._r[i] * Math.sin(this._theta[i]);
                let w = k / (s * s + OrbitalCloud.FLOW_EPS);
                if (w > CAP) w = CAP; else if (w < -CAP) w = -CAP;
                this._phi[i] += w * dt;
            }
        }
        this.generation++;
        return true;
    }

    /** Project to Cartesian, drift the camera, draw. Rule 5: 2 asserts. */
    render(deltaTime, width, height) {
        console.assert(this._geom, 'render: init first');
        console.assert(this.renderer, 'render: renderer required');
        const pos = this._geom.getAttribute('position');
        const S = this._scale;
        for (let i = 0; i < this.count; i++) {               // Rule 2: bounded
            const r = this._r[i] * S, th = this._theta[i], ph = this._phi[i];
            const st = Math.sin(th);
            pos.array[i * 3] = r * st * Math.cos(ph);
            pos.array[i * 3 + 1] = r * Math.cos(th);         // z is the quantisation axis
            pos.array[i * 3 + 2] = r * st * Math.sin(ph);
        }
        pos.needsUpdate = true;
        this._geom.setDrawRange(0, this.count);

        if (width > 0 && height > 0) {
            const aspect = width / height;
            if (this.camera.aspect !== aspect) {
                this.camera.aspect = aspect;
                this.camera.updateProjectionMatrix();
            }
        }
        this._orbit(deltaTime || 0);
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);
        return true;
    }

    /**
     * Drift the camera around the cloud. Tilted off the equator so the z-axis structure
     * — which is where all the angular detail lives — is never edge-on. Rule 5: 2 asserts.
     */
    _orbit(deltaTime) {
        console.assert(this.camera, '_orbit: camera built');
        console.assert(Number.isFinite(deltaTime), '_orbit: finite delta');
        const dt = Math.max(0, Math.min(0.1, deltaTime));    // Rule 2: bound a stalled tab
        this._angle += dt * this.spin;
        const R = OrbitalCloud.VIEW_RADIUS * 2.4;
        this.camera.position.set(
            Math.cos(this._angle) * R,
            Math.sin(this._angle * 0.31) * R * 0.35 + R * 0.22,
            Math.sin(this._angle) * R
        );
        this.camera.lookAt(0, 0, 0);
        return true;
    }

    /** Human-readable name of the current state: 1s, 2p, 3d... Rule 5: 2 asserts. */
    label() {
        console.assert(this.n >= 1, 'label: valid n');
        console.assert(this.l < this.n, 'label: valid l');
        const letters = OrbitalCloud.SHELL_LETTERS;
        const s = letters[this.l] || ('l=' + this.l);
        return this.n + s + (this.m === 0 ? '' : (this.m > 0 ? ' m=+' : ' m=') + this.m);
    }

    dispose() {
        console.assert(!this._disposed, 'dispose: once only');
        console.assert(this !== undefined, 'dispose: instance');
        this._disposed = true;
        if (this._geom) this._geom.dispose();
        if (this._mat) this._mat.dispose();
        if (this.scene && this._points) this.scene.remove(this._points);
        this._geom = null; this._mat = null; this._points = null; this.scene = null;
        this._r = this._theta = this._phi = null;
        this._rCdf = null; this._tCdf = null;
        return true;
    }
}

// No neighbour search here — sampling is one binary search per point, once, and the only
// per-frame work is a sin/cos projection. So this affords far more points than the
// particle field can: the video used 100,000. 40,000 keeps the per-frame projection well
// inside a frame while still reading as a continuous cloud rather than a scatter plot.
OrbitalCloud.MAX_POINTS = 40000;

// n beyond 6 adds shells too faint and too large to read, and (n+l)! starts losing
// precision. 6 already reaches 6h, which is an absurdly ornate shape.
OrbitalCloud.MAX_N = 6;

OrbitalCloud.R_BINS = 2048;
OrbitalCloud.T_BINS = 1024;

OrbitalCloud.POINT_SIZE = 0.016;
OrbitalCloud.VIEW_RADIUS = 1.0;

// m = 0 has no phase to show, so it gets one fixed hue rather than an arbitrary slice of
// the wheel. Cyan, which reads as "cold and still" against the coloured rotating states.
OrbitalCloud.NEUTRAL_HUE = 0.52;

// Tuning for the probability current. FLOW_EPS keeps the axis singularity finite and
// MAX_FLOW bounds what is left, so a fixed timestep cannot alias.
OrbitalCloud.FLOW_SCALE = 0.6;
OrbitalCloud.FLOW_EPS = 0.35;
OrbitalCloud.MAX_FLOW = 3.0;

OrbitalCloud.SHELL_LETTERS = ['s', 'p', 'd', 'f', 'g', 'h'];

if (typeof window !== 'undefined') window.OrbitalCloud = OrbitalCloud;
if (typeof module !== 'undefined' && module.exports) module.exports = OrbitalCloud;
