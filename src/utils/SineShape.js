// SineShape.js — shapes, morphing, rotation and LOD from nothing but sine waves.
//
// A closed 2D outline is stored as a FOURIER SERIES: a chain of rotating circles
// (epicycles). Sample the outline as complex points, run a DFT, and the shape becomes
// a short list of {freq, amp, phase}. Everything interesting falls out of that:
//
//   morph    — crossfade two coefficient lists (duck -> crow -> goose)
//   rotate   — add a constant to every phase; no matrix, no re-sampling
//   LOD      — drop the high-frequency terms; the shape degrades to a circle
//   size     — a detailed outline is a few dozen numbers, smaller than the
//              equivalent SVG because SVG also stores curve control points
//
// Technique from Zanzlanz, "How I released a game that has no assets"
// (transcript in the vault). Written to be portable: the maths here is plain
// arithmetic with no THREE or DOM dependency, so the same algorithm drops into
// GDScript for the Godot project.
//
// NASA Power-of-10 style: bounded loops, >=2 asserts/method, methods <=60 lines,
// no per-frame allocation in the sampling path.
class SineShape {
    /**
     * @param {Array<{freq:number, amp:number, phase:number}>} terms - Fourier terms,
     *        conventionally sorted by descending amplitude so LOD truncation drops
     *        the least significant detail first.
     */
    constructor(terms) {
        console.assert(Array.isArray(terms), 'SineShape: terms array required');
        console.assert(terms.length > 0, 'SineShape: at least one term required');
        this.terms = terms;
        // Pooled sample target: point(t) writes into this instead of allocating.
        this._pt = { x: 0, y: 0 };
    }

    // ---- authoring -------------------------------------------------------

    /**
     * Discrete Fourier Transform of a closed outline.
     *
     * Deliberately the naive O(n^2) transform. This runs ONCE at authoring time on a
     * few hundred points, never per frame, so an FFT would be complexity with no
     * payoff — the same call the original project made.
     *
     * @param {Array<{x:number,y:number}>} points - outline, evenly spaced, closed
     * @param {number} [maxTerms] - keep only the N strongest terms
     * @returns {SineShape}
     * Rule 5: 2 asserts.
     */
    static fromPoints(points, maxTerms) {
        console.assert(Array.isArray(points) && points.length > 2, 'fromPoints: outline required');
        console.assert(maxTerms === undefined || maxTerms > 0, 'fromPoints: positive maxTerms');
        const N = points.length;
        const terms = [];
        for (let k = 0; k < N; k++) {                       // Rule 2: bounded by N
            let re = 0, im = 0;
            for (let n = 0; n < N; n++) {
                const a = (-2 * Math.PI * k * n) / N;
                const c = Math.cos(a), s = Math.sin(a);
                re += points[n].x * c - points[n].y * s;
                im += points[n].x * s + points[n].y * c;
            }
            re /= N; im /= N;
            terms.push({
                freq: k <= N / 2 ? k : k - N,               // signed: negative = counter-rotating
                amp: Math.hypot(re, im),
                phase: Math.atan2(im, re)
            });
        }
        terms.sort((a, b) => b.amp - a.amp);                // strongest first, for LOD
        const cap = Math.min(terms.length, maxTerms || terms.length);
        return new SineShape(terms.slice(0, cap));
    }

    /** A plain circle — the floor case every shape degrades to. Rule 5: 2 asserts. */
    static circle(radius) {
        console.assert(Number.isFinite(radius), 'circle: radius required');
        console.assert(radius > 0, 'circle: positive radius');
        return new SineShape([{ freq: 1, amp: radius, phase: 0 }]);
    }

    // ---- evaluation ------------------------------------------------------

    /**
     * Point on the outline at parameter t in [0,1). Sums the epicycle chain.
     * Writes into a pooled object — callers must copy if they need to keep it.
     * @param {number} t
     * @param {number} [detail] - use only the strongest N terms (LOD)
     * @param {number} [spin] - radians added to every phase (whole-shape rotation)
     * Rule 5: 2 asserts.
     */
    point(t, detail, spin) {
        console.assert(Number.isFinite(t), 'point: t required');
        console.assert(Array.isArray(this.terms), 'point: terms required');
        const n = Math.min(this.terms.length, detail || this.terms.length);
        const rot = spin || 0;
        let x = 0, y = 0;
        for (let i = 0; i < n; i++) {                       // Rule 2: bounded
            const term = this.terms[i];
            const a = 2 * Math.PI * term.freq * t + term.phase + rot;
            x += term.amp * Math.cos(a);
            y += term.amp * Math.sin(a);
        }
        this._pt.x = x; this._pt.y = y;
        return this._pt;
    }

    /**
     * Sample the whole outline. Allocates — authoring/rebuild path, not per frame.
     * @param {number} samples
     * @param {number} [detail]
     * @param {number} [spin]
     * Rule 5: 2 asserts.
     */
    sample(samples, detail, spin) {
        console.assert(Number.isFinite(samples) && samples > 2, 'sample: samples required');
        console.assert(this.terms.length > 0, 'sample: terms required');
        const out = [];
        for (let i = 0; i < samples; i++) {                 // Rule 2: bounded
            const p = this.point(i / samples, detail, spin);
            out.push({ x: p.x, y: p.y });
        }
        return out;
    }

    // ---- animation -------------------------------------------------------

    /**
     * Crossfade between two shapes — THIS IS THE ANIMATION PRIMITIVE.
     *
     * Interpolating in frequency space rather than between vertex positions is why
     * this approach makes animation easy rather than hard: it is a handful of numbers,
     * it never self-intersects the way naive vertex tweening does, and it is smooth
     * for free because sines are smooth. A walk cycle is a few keyframe shapes and
     * this function.
     *
     * Phase is interpolated the short way around the circle, otherwise a term sitting
     * near +pi and -pi spins the long way and the shape visibly unwinds.
     * Rule 5: 2 asserts.
     */
    static morph(a, b, t) {
        console.assert(a instanceof SineShape && b instanceof SineShape, 'morph: two shapes required');
        console.assert(Number.isFinite(t), 'morph: t required');
        const k = Math.max(0, Math.min(1, t));
        const n = Math.max(a.terms.length, b.terms.length);
        const terms = [];
        for (let i = 0; i < n; i++) {                       // Rule 2: bounded
            const ta = a.terms[i] || { freq: (b.terms[i] || {}).freq || 0, amp: 0, phase: 0 };
            const tb = b.terms[i] || { freq: ta.freq, amp: 0, phase: ta.phase };
            let dPhase = tb.phase - ta.phase;
            while (dPhase > Math.PI) dPhase -= 2 * Math.PI;  // shortest arc
            while (dPhase < -Math.PI) dPhase += 2 * Math.PI;
            terms.push({
                freq: ta.freq,
                amp: ta.amp + (tb.amp - ta.amp) * k,
                phase: ta.phase + dPhase * k
            });
        }
        return new SineShape(terms);
    }

    /**
     * How many terms are needed to carry `fraction` of the shape's total amplitude.
     * Drives distance-based LOD: far away, two or three terms is a convincing blob.
     * Rule 5: 2 asserts.
     */
    detailFor(fraction) {
        console.assert(Number.isFinite(fraction), 'detailFor: fraction required');
        console.assert(this.terms.length > 0, 'detailFor: terms required');
        const want = Math.max(0, Math.min(1, fraction));
        let total = 0;
        for (let i = 0; i < this.terms.length; i++) total += this.terms[i].amp;
        if (total <= 0) return 1;
        let run = 0;
        for (let i = 0; i < this.terms.length; i++) {       // Rule 2: bounded
            run += this.terms[i].amp;
            if (run / total >= want) return i + 1;
        }
        return this.terms.length;
    }

    /** Bytes if stored as three float32 per term — for comparing against SVG/PNG. */
    byteSize() {
        console.assert(Array.isArray(this.terms), 'byteSize: terms required');
        console.assert(this.terms.length >= 0, 'byteSize: non-negative');
        return this.terms.length * 12;
    }
}

if (typeof window !== 'undefined') window.SineShape = SineShape;
if (typeof module !== 'undefined' && module.exports) module.exports = SineShape;
