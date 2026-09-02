// ForceMatrix.js — the Particle Life MODEL, shared by the 2D page sim and the 3D scene.
//
// WHY THIS FILE EXISTS
// ParticleLife (2D, on the Life page) and ParticleField3D (the main-page background) are
// the same physics in different numbers of dimensions. What genuinely differs between
// them is the SPATIAL INDEX — 9 buckets versus 27, two coordinates versus three — and
// that difference lives in the hot loop, where templating it would cost more than it
// saves. What does NOT differ is the model: the type palette, the interaction matrix, and
// the force curve. Those live here, once, so a change to the rule cannot land in one
// simulation and silently miss the other.
//
// THE FORCE CURVE, which is the whole model in four lines:
//
//     q = d / R, the distance as a fraction of the interaction radius
//     q <  beta   f = (q/beta - 1) * REPULSION      universal push, hardest at q=0
//     q >= beta   f = m * (1 - |2q - 1 - beta| / (1 - beta))
//
// The second branch is a tent: zero at beta, peaking at q = (1 + beta)/2, back to zero at
// q = 1. So a pair feels nothing at the edge of the radius, is pulled hardest at
// mid-range, and is pushed apart when it gets too close. m is the matrix entry, in
// [-1, 1] — positive attracts, negative repels.
//
// M IS ASYMMETRIC ON PURPOSE. Coral may chase mint while mint flees coral. That
// one-sidedness is where chasing, orbiting and self-propelling clusters come from; a
// symmetric matrix gives you crystals and blobs, which is prettier and much less alive.
//
// INLINING. Both sims inline the curve into their innermost loop rather than calling
// curve() a few hundred thousand times a step. That is a real duplication risk, so
// tests/verify-field3d.cjs sweeps q across [0, 1] for several matrix values and asserts
// each inlined copy matches curve() bit for bit. If someone edits one and not the others,
// the test says so.
class ForceMatrix {
    /** @param {number} [types] active species count; storage is always MAX_TYPES square. */
    constructor(types) {
        console.assert(ForceMatrix.MAX_TYPES > 0, 'ForceMatrix: MAX_TYPES defined');
        console.assert(types === undefined || types > 0, 'ForceMatrix: positive type count');
        const N = ForceMatrix.MAX_TYPES;
        this.types = Math.max(2, Math.min(N, types || 5));
        this.m = new Float32Array(N * N);        // Rule 3: allocate the ceiling once
        this.randomise();
    }

    /** Read one entry: how type a feels about type b. Rule 5: 2 asserts. */
    get(a, b) {
        console.assert(a >= 0 && a < ForceMatrix.MAX_TYPES, 'ForceMatrix.get: a in range');
        console.assert(b >= 0 && b < ForceMatrix.MAX_TYPES, 'ForceMatrix.get: b in range');
        return this.m[a * ForceMatrix.MAX_TYPES + b];
    }

    /** Write one entry, clamped to [-1, 1]. Returns false out of range. Rule 5: 2 asserts. */
    set(a, b, v) {
        console.assert(Number.isFinite(v), 'ForceMatrix.set: finite value');
        console.assert(a >= 0 && b >= 0, 'ForceMatrix.set: non-negative types');
        if (a >= ForceMatrix.MAX_TYPES || b >= ForceMatrix.MAX_TYPES) return false;
        this.m[a * ForceMatrix.MAX_TYPES + b] = Math.max(-1, Math.min(1, v));
        return true;
    }

    /** Fill with random asymmetric values — see the header on why not symmetric. */
    randomise() {
        console.assert(this.m, 'ForceMatrix.randomise: allocated');
        console.assert(ForceMatrix.MAX_TYPES > 0, 'ForceMatrix.randomise: MAX_TYPES defined');
        const N = ForceMatrix.MAX_TYPES;
        for (let a = 0; a < N; a++) {                       // Rule 2: bounded
            for (let b = 0; b < N; b++) {                   // Rule 2: bounded
                this.m[a * N + b] = Math.random() * 2 - 1;
            }
        }
        return true;
    }

    /** Mirror the upper triangle onto the lower, making every relationship mutual. */
    symmetrise() {
        console.assert(this.m, 'ForceMatrix.symmetrise: allocated');
        console.assert(ForceMatrix.MAX_TYPES > 0, 'ForceMatrix.symmetrise: MAX_TYPES defined');
        const N = ForceMatrix.MAX_TYPES;
        for (let a = 0; a < N; a++) {                       // Rule 2: bounded
            for (let b = a + 1; b < N; b++) {               // Rule 2: bounded
                this.m[b * N + a] = this.m[a * N + b];
            }
        }
        return true;
    }

    /** Zero every entry: particles then only ever push apart. Rule 5: 2 asserts. */
    clear() {
        console.assert(this.m, 'ForceMatrix.clear: allocated');
        console.assert(this.m.fill, 'ForceMatrix.clear: typed array');
        this.m.fill(0);
        return true;
    }

    /**
     * The reference force curve. Both sims inline this; verify-field3d.cjs proves the
     * copies still agree with it. Rule 5: 2 asserts.
     * @param {number} q distance / radius, in [0, 1]
     * @param {number} beta repulsion cutoff as a fraction of radius, in (0, 1)
     * @param {number} m matrix entry for the ordered pair, in [-1, 1]
     */
    static curve(q, beta, m) {
        console.assert(Number.isFinite(q) && Number.isFinite(beta), 'curve: finite q, beta');
        console.assert(beta > 0 && beta < 1, 'curve: beta strictly inside (0,1)');
        if (q < beta) return (q / beta - 1) * ForceMatrix.REPULSION;
        return m * (1 - Math.abs(2 * q - 1 - beta) / (1 - beta));
    }
}

// How much stronger close-range repulsion is than the strongest attraction. Must be well
// above 1: a particle can be pulled by many neighbours at once but is pushed by only the
// few that are truly close, so parity is not enough to keep them apart. Measured at
// parity: an all-attract matrix drove the closest pair to 0.00117, twenty times inside
// the repulsion radius — merged into a point.
ForceMatrix.REPULSION = 6;

ForceMatrix.MAX_TYPES = 6;

// Distinct hues that stay legible as small dots on a dark ground, and read as different
// SPECIES rather than as a gradient — the type is categorical, not a value.
//
// These are sRGB, the space CSS uses. Anything drawing a swatch, a legend or a matrix
// cell wants THESE numbers. Anything writing a WebGL vertex-colour attribute wants
// TYPE_COLOURS_LINEAR below — see the note there, it is not a nicety.
ForceMatrix.TYPE_COLOURS = [
    [1.00, 0.42, 0.28],   // coral
    [0.36, 0.86, 0.62],   // mint
    [0.44, 0.68, 1.00],   // sky
    [1.00, 0.82, 0.35],   // amber
    [0.80, 0.52, 1.00],   // violet
    [0.98, 0.98, 0.98]    // white
];
ForceMatrix.TYPE_NAMES = ['Coral', 'Mint', 'Sky', 'Amber', 'Violet', 'White'];

/** The sRGB transfer function, inverted: display value -> linear light. */
ForceMatrix.srgbToLinear = function (c) {
    console.assert(Number.isFinite(c), 'srgbToLinear: finite channel');
    console.assert(c >= 0 && c <= 1, 'srgbToLinear: channel in [0,1]');
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

// The palette again, in LINEAR light, for WebGL vertex colours.
//
// WHY THIS EXISTS, because it cost an afternoon. three.js renders with
// outputColorSpace = 'srgb', which means the final shader encodes linear light to sRGB
// on the way out. Material colours get converted on the way IN to match. Vertex colour
// attributes never do — they are raw floats, assumed to be linear already. So feeding
// sRGB numbers straight into the attribute gets them encoded a second time, and every
// channel is pushed towards white.
//
// This was not subtle once measured. Sampling the rendered frame: the species colours
// came back at saturation 0.08 — five shades of cream — while forcing the material to a
// flat red gave 0.92 through the same pipeline. Coral (255, 107, 71) was arriving as
// (224, 192, 176). The types were categorical and indistinguishable, which defeats the
// entire point of a simulation about who is chasing whom.
//
// Note this is INDEPENDENT of THREE.ColorManagement.enabled, which was false here and
// misled the first diagnosis: that flag governs automatic conversion of inputs, not the
// output encoding, and the output encoding is what does the damage.
ForceMatrix.TYPE_COLOURS_LINEAR = ForceMatrix.TYPE_COLOURS.map(
    (c) => c.map(ForceMatrix.srgbToLinear));

if (typeof window !== 'undefined') window.ForceMatrix = ForceMatrix;
if (typeof module !== 'undefined' && module.exports) module.exports = ForceMatrix;
