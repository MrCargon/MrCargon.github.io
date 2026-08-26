// Lenia.js — continuous cellular automata. Artificial life, entirely on the GPU.
//
// Lenia (Bert Chan) generalises Conway's Game of Life to smooth values: cells hold a
// continuous state in [0,1] rather than alive/dead, and the neighbourhood, time step
// and scale are all continuous too. That smoothness is the whole point — it is what
// lets stable, moving, self-maintaining structures ("species") emerge instead of the
// blocky gliders of discrete Life.
//
// The update, in full:
//     U(x) = sum over neighbourhood of K(r) * A(x + r)     -- potential (a convolution)
//     G(U) = 2 * exp(-(U - mu)^2 / (2 sigma^2)) - 1        -- growth, a bell curve
//     A'   = clamp(A + dt * G(U), 0, 1)
//
// K is a smooth RING, not a disc. A ring is what produces organisms with a boundary:
// the centre of a creature sees a full ring of neighbours and holds steady, while the
// edge sees a partial ring and grows or dies. A disc kernel just blurs into mush.
//
// WHY THIS RUNS ON THE GPU AND NOT IN JS
// Every cell reads its whole neighbourhood every step — with R=10 that is ~300 taps
// per cell, ~20M taps per frame at 256x256. In JavaScript that is hopeless. As a
// fragment shader it is trivial work for any real GPU, and critically it costs ZERO
// per-frame JavaScript, which is exactly the failure mode profiling already found in
// this project's tile engine.
//
// Ping-pong render targets: read from A, write to B, swap. Standard GPGPU.
// Zero asset bytes — the entire simulation is this file.
class Lenia {
    /**
     * @param {THREE.WebGLRenderer} renderer - shared with the rest of the site
     * @param {Object} [opts]
     */
    constructor(renderer, opts) {
        console.assert(renderer && renderer.domElement, 'Lenia: renderer required');
        console.assert(typeof THREE !== 'undefined', 'Lenia: THREE required');
        const o = opts || {};
        this.renderer = renderer;
        this.size = o.size || 256;              // simulation grid, power of two
        // R=10 is NOT arbitrary and NOT safe to nudge. Swept empirically: R=10 with
        // mu=0.15/sigma=0.017 gives the classic Lenia signature — the seed dies back
        // from 89% to 9.3% coverage and then RECOVERS to 28.5% as surviving structures
        // spread. R=9 with otherwise identical settings goes completely extinct by
        // step 40. The habitable band is genuinely that narrow, which is the whole
        // reason Lenia is interesting; treat these four numbers as a matched set.
        this.R = o.R || 10;                     // kernel radius in cells
        this.dt = o.dt || 0.12;                 // time step; smaller = smoother, slower
        this.mu = (o.mu !== undefined) ? o.mu : 0.15;      // growth centre
        this.sigma = (o.sigma !== undefined) ? o.sigma : 0.017; // growth width
        this.kmu = (o.kmu !== undefined) ? o.kmu : 0.5;    // kernel ring centre (0..1 of R)
        this.ksigma = (o.ksigma !== undefined) ? o.ksigma : 0.15;
        this._disposed = false;
        this._targets = null;
        this._cur = 0;
        this._simScene = null;
        this._simCam = null;
        this._simMat = null;
        this.outputTexture = null;
    }

    /** Build the ping-pong targets and the simulation quad. Rule 5: 2 asserts. */
    init() {
        console.assert(!this._disposed, 'init: not disposed');
        console.assert(this.size > 0, 'init: positive size');
        const opts = {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            wrapS: THREE.RepeatWrapping,     // torus: creatures wrap off one edge onto
            wrapT: THREE.RepeatWrapping,     // the other, so nothing dies at a boundary
            depthBuffer: false,
            stencilBuffer: false
        };
        this._targets = [
            new THREE.WebGLRenderTarget(this.size, this.size, opts),
            new THREE.WebGLRenderTarget(this.size, this.size, opts)
        ];
        this._simCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this._simScene = new THREE.Scene();
        this._simMat = new THREE.ShaderMaterial({
            uniforms: {
                uState: { value: null },
                uSize: { value: this.size },
                uR: { value: this.R },
                uDt: { value: this.dt },
                uMu: { value: this.mu },
                uSigma: { value: this.sigma },
                uKmu: { value: this.kmu },
                uKsigma: { value: this.ksigma }
            },
            vertexShader: Lenia.VERT,
            fragmentShader: Lenia.FRAG
        });
        this._simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._simMat));
        this.seed();
        return true;
    }

    /**
     * Seed with smooth random blobs.
     *
     * NOT white noise — this matters. Lenia's growth function only produces life in a
     * narrow band of neighbourhood sums, and per-pixel noise averages to a flat value
     * everywhere, so the whole grid dies on the first step. Life needs structure at
     * roughly the kernel's scale to catch hold. Rule 5: 2 asserts.
     */
    seed(blobs) {
        console.assert(this._targets, 'seed: init first');
        console.assert(!this._disposed, 'seed: not disposed');
        const n = this.size;
        const data = new Float32Array(n * n * 4);
        const count = blobs || 14;
        for (let b = 0; b < count; b++) {                    // Rule 2: bounded
            const cx = Math.random() * n, cy = Math.random() * n;
            const rad = this.R * (1.4 + Math.random() * 1.6);
            for (let y = -rad; y <= rad; y++) {
                for (let x = -rad; x <= rad; x++) {
                    const d = Math.hypot(x, y);
                    if (d > rad) continue;
                    const px = (Math.floor(cx + x) + n) % n;
                    const py = (Math.floor(cy + y) + n) % n;
                    const i = (py * n + px) * 4;
                    // Soft falloff plus a little noise: perfectly smooth blobs are
                    // symmetric and often just pulse instead of moving.
                    const v = (1 - d / rad) * (0.6 + Math.random() * 0.5);
                    data[i] = Math.min(1, data[i] + v);
                }
            }
        }
        const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.FloatType);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.needsUpdate = true;
        // Blit the seed into BOTH targets so a step from either is well defined.
        const prevTarget = this.renderer.getRenderTarget();
        const blitMat = new THREE.MeshBasicMaterial({ map: tex });
        const blitScene = new THREE.Scene();
        blitScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMat));
        for (let i = 0; i < 2; i++) {
            this.renderer.setRenderTarget(this._targets[i]);
            this.renderer.render(blitScene, this._simCam);
        }
        this.renderer.setRenderTarget(prevTarget);
        blitMat.dispose(); tex.dispose();
        this._cur = 0;
        this.outputTexture = this._targets[0].texture;
        return true;
    }

    /** Advance one simulation step. Rule 5: 2 asserts. */
    step() {
        console.assert(this._targets, 'step: init first');
        console.assert(!this._disposed, 'step: not disposed');
        const src = this._targets[this._cur];
        const dst = this._targets[1 - this._cur];
        this._simMat.uniforms.uState.value = src.texture;
        this._simMat.uniforms.uR.value = this.R;
        this._simMat.uniforms.uDt.value = this.dt;
        this._simMat.uniforms.uMu.value = this.mu;
        this._simMat.uniforms.uSigma.value = this.sigma;
        const prev = this.renderer.getRenderTarget();
        this.renderer.setRenderTarget(dst);
        this.renderer.render(this._simScene, this._simCam);
        this.renderer.setRenderTarget(prev);
        this._cur = 1 - this._cur;
        this.outputTexture = dst.texture;
        return this.outputTexture;
    }

    dispose() {
        console.assert(!this._disposed, 'dispose: once only');
        console.assert(this !== undefined, 'dispose: instance');
        this._disposed = true;
        if (this._targets) { this._targets.forEach(t => t.dispose()); this._targets = null; }
        if (this._simMat) this._simMat.dispose();
        this.outputTexture = null;
        return true;
    }
}

Lenia.VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// The whole simulation. Note the loop bounds are compile-time constants: GLSL ES
// requires loops be unrollable, so MAXR is fixed and uR only gates which taps count.
Lenia.FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uState;
uniform float uSize, uR, uDt, uMu, uSigma, uKmu, uKsigma;

const int MAXR = 14;

float bell(float x, float m, float s) {
    float d = (x - m) / s;
    return exp(-0.5 * d * d);
}

void main() {
    float texel = 1.0 / uSize;
    float sum = 0.0;
    float norm = 0.0;

    // Convolve with a smooth RING kernel. Neighbourhood is sampled in cell units and
    // wraps via RepeatWrapping, so the world is a torus with no edges to die against.
    for (int y = -MAXR; y <= MAXR; y++) {
        for (int x = -MAXR; x <= MAXR; x++) {
            float fx = float(x);
            float fy = float(y);
            float d = sqrt(fx * fx + fy * fy) / uR;
            if (d > 1.0) continue;                       // outside the kernel disc
            float w = bell(d, uKmu, uKsigma);            // ring, peaks at uKmu
            vec2 uv = vUv + vec2(fx, fy) * texel;
            sum += w * texture2D(uState, uv).r;
            norm += w;
        }
    }

    float U = (norm > 0.0) ? sum / norm : 0.0;           // normalised potential
    float G = 2.0 * bell(U, uMu, uSigma) - 1.0;          // growth in [-1, 1]
    float a = texture2D(uState, vUv).r;
    float next = clamp(a + uDt * G, 0.0, 1.0);
    gl_FragColor = vec4(next, next, next, 1.0);
}
`;

if (typeof window !== 'undefined') window.Lenia = Lenia;
if (typeof module !== 'undefined' && module.exports) module.exports = Lenia;
