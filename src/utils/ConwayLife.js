// ConwayLife.js — Conway's Game of Life, and every other B/S rule, on the GPU.
//
// The rule (B3/S23): a live cell with 2 or 3 live neighbours survives; a dead cell with
// exactly 3 is born; everything else dies. Four lines, and the result is Turing complete.
// See CELLULAR_AUTOMATA.md for the patterns, the universality argument, and the rule space.
//
// THE RULE IS A UNIFORM, NOT A CONSTANT
// Birth and survival are passed as two 9-element arrays of 0.0/1.0 — one slot per possible
// neighbour count 0..8. So B3/S23 is birth[3]=1, survive[2]=survive[3]=1, and any of the
// 262,144 possible rules is a uniform update rather than a shader recompile. That is what
// makes the "Conway Multiverse" (HighLife, Day & Night, Seeds, Maze...) switchable live.
//
// Arrays rather than bitmasks deliberately: GLSL ES 1.00 has no integer bitwise operators,
// and three.js ShaderMaterial still compiles in that dialect by default even on WebGL2.
// A 9-float array indexed by an unrolled loop works in every dialect this site can hit.
//
// WHY UNSIGNED BYTE TARGETS, NOT FLOAT
// Lenia next door needs FloatType because its state is continuous. Life's state is one bit.
// Byte targets are universally supported (no float-render-target extension to probe for),
// use a quarter of the bandwidth, and 0 vs 255 is exact — there is no precision question
// when the only comparison is "> 0.5".
//
// NEAREST FILTERING IS LOAD-BEARING
// With linear filtering the neighbour taps return blends of adjacent cells and the
// automaton is silently wrong — it looks plausible and is not Life. NearestFilter is
// correctness here, not performance.
//
// Zero asset bytes: the entire simulation is this file.
class ConwayLife {
    /**
     * @param {THREE.WebGLRenderer} renderer - shared with the rest of the site
     * @param {Object} [opts]
     */
    constructor(renderer, opts) {
        console.assert(renderer && renderer.domElement, 'ConwayLife: renderer required');
        console.assert(typeof THREE !== 'undefined', 'ConwayLife: THREE required');
        const o = opts || {};
        this.renderer = renderer;
        this.size = o.size || 512;              // grid is size x size, power of two
        this.birth = new Float32Array(9);       // birth[n] = 1 -> a dead cell with n neighbours is born
        this.survive = new Float32Array(9);     // survive[n] = 1 -> a live cell with n neighbours lives
        this._disposed = false;
        this._targets = null;
        this._cur = 0;
        this._simScene = null;
        this._simCam = null;
        this._simMat = null;
        this.outputTexture = null;
        this.generation = 0;
        this.setRule(o.birth || [3], o.survive || [2, 3]);   // default: Conway's B3/S23
    }

    /**
     * Set the rule from neighbour-count lists, e.g. setRule([3],[2,3]) for Life.
     * Ignores out-of-range entries rather than throwing — a malformed rule string from
     * the UI should give a dull universe, not a broken page. Rule 5: 2 asserts.
     */
    setRule(birthCounts, surviveCounts) {
        console.assert(Array.isArray(birthCounts), 'setRule: birth list required');
        console.assert(Array.isArray(surviveCounts), 'setRule: survive list required');
        this.birth.fill(0);
        this.survive.fill(0);
        for (let i = 0; i < birthCounts.length && i < 9; i++) {        // Rule 2: bounded
            const n = birthCounts[i] | 0;
            if (n >= 0 && n <= 8) this.birth[n] = 1;
        }
        for (let i = 0; i < surviveCounts.length && i < 9; i++) {      // Rule 2: bounded
            const n = surviveCounts[i] | 0;
            if (n >= 0 && n <= 8) this.survive[n] = 1;
        }
        if (this._simMat) {
            this._simMat.uniforms.uBirth.value = this.birth;
            this._simMat.uniforms.uSurvive.value = this.survive;
        }
        return true;
    }

    /** Build the ping-pong targets and the simulation quad. Rule 5: 2 asserts. */
    init() {
        console.assert(!this._disposed, 'init: not disposed');
        console.assert(this.size > 0, 'init: positive size');
        const opts = {
            minFilter: THREE.NearestFilter,   // see header: filtering would blend cells
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
            wrapS: THREE.RepeatWrapping,      // torus: a glider leaving the right edge
            wrapT: THREE.RepeatWrapping,      // re-enters on the left, forever
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
                uBirth: { value: this.birth },
                uSurvive: { value: this.survive }
            },
            vertexShader: ConwayLife.VERT,
            fragmentShader: ConwayLife.FRAG
        });
        this._simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._simMat));
        this.clear();
        return true;
    }

    /**
     * Upload a full grid of bytes into BOTH targets, so a step from either is defined.
     * Rule 5: 2 asserts.
     */
    _upload(data) {
        console.assert(this._targets, '_upload: init first');
        console.assert(data && data.length === this.size * this.size * 4, '_upload: RGBA grid required');
        const tex = new THREE.DataTexture(data, this.size, this.size, THREE.RGBAFormat, THREE.UnsignedByteType);
        tex.minFilter = tex.magFilter = THREE.NearestFilter;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.needsUpdate = true;
        const prev = this.renderer.getRenderTarget();
        const mat = new THREE.MeshBasicMaterial({ map: tex });
        const scene = new THREE.Scene();
        scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
        for (let i = 0; i < 2; i++) {                     // Rule 2: bounded
            this.renderer.setRenderTarget(this._targets[i]);
            this.renderer.render(scene, this._simCam);
        }
        this.renderer.setRenderTarget(prev);
        mat.dispose();
        tex.dispose();
        this._cur = 0;
        this.generation = 0;
        this.outputTexture = this._targets[0].texture;
        return true;
    }

    /** Allocate a blank RGBA grid. Rule 3: one allocation, reused by the callers below. */
    _blankGrid() {
        console.assert(this.size > 0, '_blankGrid: size required');
        console.assert(!this._disposed, '_blankGrid: not disposed');
        if (!this._grid || this._grid.length !== this.size * this.size * 4) {
            this._grid = new Uint8Array(this.size * this.size * 4);
        } else {
            this._grid.fill(0);
        }
        return this._grid;
    }

    /** Empty the world. Rule 5: 2 asserts. */
    clear() {
        console.assert(this._targets, 'clear: init first');
        console.assert(!this._disposed, 'clear: not disposed');
        return this._upload(this._blankGrid());
    }

    /**
     * Random soup at the given density.
     *
     * Unlike Lenia, white noise is exactly right here: Life's interesting behaviour comes
     * from chaotic soup settling into still lifes, oscillators and escaping gliders, and a
     * structured seed would bias which of those appear. Density ~0.3 is conventional.
     * Rule 5: 2 asserts.
     */
    seed(density) {
        console.assert(this._targets, 'seed: init first');
        console.assert(!this._disposed, 'seed: not disposed');
        const d = (typeof density === 'number') ? density : 0.3;
        const g = this._blankGrid();
        for (let i = 0; i < g.length; i += 4) {           // Rule 2: bounded by grid size
            const alive = Math.random() < d ? 255 : 0;
            g[i] = alive; g[i + 1] = alive; g[i + 2] = alive; g[i + 3] = 255;
        }
        return this._upload(g);
    }

    /**
     * Place a pattern (array of [x,y] live cells) with its top-left at (ox,oy).
     * Wraps rather than clipping, matching the torus the shader simulates.
     * Rule 5: 2 asserts.
     */
    setPattern(cells, ox, oy, keepExisting) {
        console.assert(Array.isArray(cells), 'setPattern: cell list required');
        console.assert(this._targets, 'setPattern: init first');
        const n = this.size;
        const g = keepExisting && this._grid ? this._grid : this._blankGrid();
        const x0 = (typeof ox === 'number') ? ox : 0;
        const y0 = (typeof oy === 'number') ? oy : 0;
        for (let i = 0; i < cells.length; i++) {         // Rule 2: bounded by pattern size
            const c = cells[i];
            if (!c || c.length < 2) continue;
            const px = ((x0 + c[0]) % n + n) % n;
            const py = ((y0 + c[1]) % n + n) % n;
            const k = (py * n + px) * 4;
            g[k] = 255; g[k + 1] = 255; g[k + 2] = 255; g[k + 3] = 255;
        }
        return this._upload(g);
    }

    /**
     * Paint cells directly into the CURRENT state, without resetting the generation.
     *
     * Done as a GPU stamp rather than a CPU round trip: reading 512x512 back, editing one
     * cell and re-uploading would stall the pipeline on every mouse-move event. Instead a
     * small quad is rendered straight into the live target with autoClear off, so the rest
     * of the world is untouched.
     *
     * @param {number} cx  cell x
     * @param {number} cy  cell y
     * @param {boolean} alive  true to birth, false to erase
     * @param {number} [radius=0]  brush radius in cells (0 = a single cell)
     * Rule 5: 2 asserts.
     */
    paint(cx, cy, alive, radius) {
        console.assert(this._targets, 'paint: init first');
        console.assert(Number.isFinite(cx) && Number.isFinite(cy), 'paint: finite cell coords');
        const n = this.size;
        const r = Math.max(0, Math.min(64, radius | 0));      // Rule 2: bounded brush
        const span = (2 * r + 1) / n;                          // quad size in UV
        const u = (((cx % n) + n) % n + 0.5) / n;
        const v = (((cy % n) + n) % n + 0.5) / n;

        if (!this._stamp) {
            this._stampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            this._stamp = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this._stampMat);
            this._stampScene = new THREE.Scene();
            this._stampScene.add(this._stamp);
        }
        this._stampMat.color.setScalar(alive ? 1 : 0);
        this._stamp.scale.set(span * 2, span * 2, 1);          // UV span -> NDC span
        this._stamp.position.set(u * 2 - 1, v * 2 - 1, 0);

        const prevTarget = this.renderer.getRenderTarget();
        const prevAutoClear = this.renderer.autoClear;
        this.renderer.autoClear = false;                       // keep the existing world
        this.renderer.setRenderTarget(this._targets[this._cur]);
        this.renderer.render(this._stampScene, this._simCam);
        this.renderer.autoClear = prevAutoClear;
        this.renderer.setRenderTarget(prevTarget);
        this.outputTexture = this._targets[this._cur].texture;
        return true;
    }

    /** Advance one generation. Rule 5: 2 asserts. */
    step() {
        console.assert(this._targets, 'step: init first');
        console.assert(!this._disposed, 'step: not disposed');
        const src = this._targets[this._cur];
        const dst = this._targets[1 - this._cur];
        this._simMat.uniforms.uState.value = src.texture;
        this._simMat.uniforms.uBirth.value = this.birth;
        this._simMat.uniforms.uSurvive.value = this.survive;
        const prev = this.renderer.getRenderTarget();
        this.renderer.setRenderTarget(dst);
        this.renderer.render(this._simScene, this._simCam);
        this.renderer.setRenderTarget(prev);
        this._cur = 1 - this._cur;
        this.generation++;
        this.outputTexture = dst.texture;
        return this.outputTexture;
    }

    /**
     * Read the live grid back as a Uint8Array (RGBA).
     *
     * readRenderTargetPixels STALLS the pipeline — the CPU waits for everything queued.
     * Callers must throttle it; it exists for tests and population stats, not per frame.
     * Rule 5: 2 asserts.
     */
    readPixels(out) {
        console.assert(this._targets, 'readPixels: init first');
        console.assert(!this._disposed, 'readPixels: not disposed');
        const n = this.size;
        const buf = (out && out.length === n * n * 4) ? out : new Uint8Array(n * n * 4);
        try {
            this.renderer.readRenderTargetPixels(this._targets[this._cur], 0, 0, n, n, buf);
        } catch (e) {
            return null;
        }
        return buf;
    }

    dispose() {
        console.assert(!this._disposed, 'dispose: once only');
        console.assert(this !== undefined, 'dispose: instance');
        this._disposed = true;
        if (this._targets) { this._targets.forEach(t => t.dispose()); this._targets = null; }
        if (this._simMat) this._simMat.dispose();
        if (this._stamp) { this._stamp.geometry.dispose(); this._stampMat.dispose(); this._stamp = null; }
        this._grid = null;
        this.outputTexture = null;
        return true;
    }
}

ConwayLife.VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// The whole automaton. Eight taps, unrolled — no loop, no branching on cell state.
//
// The neighbour offsets are exactly one texel. A fragment's vUv sits at the texel CENTRE,
// (i + 0.5) / size, so adding 1.0/size lands precisely on the next centre; with
// NearestFilter and RepeatWrapping that reads the neighbouring cell and wraps at the edge.
ConwayLife.FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uState;
uniform float uSize;
uniform float uBirth[9];
uniform float uSurvive[9];

float cellAt(vec2 uv) {
    return texture2D(uState, uv).r > 0.5 ? 1.0 : 0.0;
}

void main() {
    float t = 1.0 / uSize;

    float n = 0.0;
    n += cellAt(vUv + vec2(-t, -t));
    n += cellAt(vUv + vec2( 0.0, -t));
    n += cellAt(vUv + vec2( t, -t));
    n += cellAt(vUv + vec2(-t, 0.0));
    n += cellAt(vUv + vec2( t, 0.0));
    n += cellAt(vUv + vec2(-t, t));
    n += cellAt(vUv + vec2( 0.0, t));
    n += cellAt(vUv + vec2( t, t));

    float self = cellAt(vUv);

    // Look the neighbour count up in the rule. Unrolled compare rather than an array
    // index by a computed value: GLSL ES 1.00 only guarantees constant-index access to
    // uniform arrays, so indexing by n is not portable.
    float b = 0.0;
    float s = 0.0;
    for (int i = 0; i <= 8; i++) {
        if (float(i) == n) {
            b = uBirth[i];
            s = uSurvive[i];
        }
    }

    float alive = mix(b, s, self);      // self==0 -> birth rule, self==1 -> survival rule
    gl_FragColor = vec4(vec3(alive), 1.0);
}
`;

if (typeof window !== 'undefined') window.ConwayLife = ConwayLife;
if (typeof module !== 'undefined' && module.exports) module.exports = ConwayLife;
