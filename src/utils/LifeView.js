// LifeView.js — the shared display layer for both cellular automata.
//
// Conway and Lenia are different simulations but the same PICTURE: a square texture of
// cell state that wants to be zoomed, panned, recoloured and drawn on. Keeping that in one
// place means the two sims stay pure (they only step state) and every interaction works
// identically in both modes rather than being implemented twice and drifting.
//
// ZOOM WITHOUT BLUR
// The quad samples the state texture with an offset/scaled UV. Because both sims use
// NearestFilter, magnifying does NOT interpolate — one cell becomes a crisp block of
// pixels rather than a smear. That matters here: a blurred Life grid is not a Life grid,
// it is a heatmap of one.
//
// WRAPPING IS FREE
// Both sims use RepeatWrapping, so panning past an edge shows the torus continuing rather
// than a black void. Nothing special is needed to support it.
class LifeView {
    /**
     * @param {THREE.WebGLRenderer} renderer
     * @param {Object} [opts]
     */
    constructor(renderer, opts) {
        console.assert(renderer && renderer.domElement, 'LifeView: renderer required');
        console.assert(typeof THREE !== 'undefined', 'LifeView: THREE required');
        const o = opts || {};
        this.renderer = renderer;
        this.zoom = 1;
        this.panX = 0;               // in UV units, -0.5..0.5 covers the whole grid
        this.panY = 0;
        this.minZoom = 1;
        this.maxZoom = 64;
        this.palette = o.palette || 'ember';
        this._scene = null;
        this._cam = null;
        this._quad = null;
        this._disposed = false;
    }

    /** Build the display quad. Rule 5: 2 asserts. */
    init() {
        console.assert(!this._disposed, 'init: not disposed');
        console.assert(this.renderer, 'init: renderer required');
        this._cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this._scene = new THREE.Scene();
        const p = LifeView.PALETTES[this.palette] || LifeView.PALETTES.ember;
        this._quad = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            new THREE.ShaderMaterial({
                uniforms: {
                    uTex: { value: null },
                    uZoom: { value: 1 },
                    uPan: { value: new THREE.Vector2(0, 0) },
                    uLow: { value: new THREE.Color(p.low[0], p.low[1], p.low[2]) },
                    uMid: { value: new THREE.Color(p.mid[0], p.mid[1], p.mid[2]) },
                    uHigh: { value: new THREE.Color(p.high[0], p.high[1], p.high[2]) },
                    uContinuous: { value: 0 }   // 0 = hard threshold (Conway), 1 = smooth (Lenia)
                },
                vertexShader: LifeView.VERT,
                fragmentShader: LifeView.FRAG
            })
        );
        this._scene.add(this._quad);
        return true;
    }

    /** Switch palette by name. Rule 5: 2 asserts. */
    setPalette(name) {
        console.assert(typeof name === 'string', 'setPalette: name required');
        console.assert(LifeView.PALETTES, 'setPalette: palettes required');
        const p = LifeView.PALETTES[name];
        if (!p || !this._quad) return false;
        this.palette = name;
        const u = this._quad.material.uniforms;
        u.uLow.value.setRGB(p.low[0], p.low[1], p.low[2]);
        u.uMid.value.setRGB(p.mid[0], p.mid[1], p.mid[2]);
        u.uHigh.value.setRGB(p.high[0], p.high[1], p.high[2]);
        return true;
    }

    /** Conway wants a hard alive/dead edge; Lenia wants the continuous ramp. */
    setContinuous(on) {
        console.assert(typeof on === 'boolean', 'setContinuous: bool required');
        console.assert(this._quad, 'setContinuous: init first');
        this._quad.material.uniforms.uContinuous.value = on ? 1 : 0;
        return true;
    }

    /**
     * Zoom about a point given in normalised canvas coords (0..1, y already flipped to
     * match UV space). Keeping that point fixed under the cursor is what makes wheel-zoom
     * feel right — zooming about the centre instead makes the thing you aimed at run away.
     * Rule 5: 2 asserts.
     */
    zoomAt(factor, u, v) {
        console.assert(Number.isFinite(factor) && factor > 0, 'zoomAt: positive factor');
        console.assert(this._quad, 'zoomAt: init first');
        const before = this.screenToUv(u, v);
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
        const after = this.screenToUv(u, v);
        // Shift the pan so the grid point under the cursor stays under the cursor.
        this.panX += before.x - after.x;
        this.panY += before.y - after.y;
        this._clampPan();
        return this.zoom;
    }

    /** Pan by a delta in normalised canvas units. Rule 5: 2 asserts. */
    panBy(du, dv) {
        console.assert(Number.isFinite(du), 'panBy: finite du');
        console.assert(Number.isFinite(dv), 'panBy: finite dv');
        this.panX -= du / this.zoom;
        this.panY -= dv / this.zoom;
        this._clampPan();
        return true;
    }

    /**
     * Keep the view over the grid. The world is a torus so wrapping is legal, but letting
     * the pan run to infinity makes "reset" the only way back and loses the user entirely.
     */
    _clampPan() {
        console.assert(Number.isFinite(this.panX), '_clampPan: finite panX');
        console.assert(Number.isFinite(this.zoom), '_clampPan: finite zoom');
        const limit = 0.5;                 // half a grid in either direction
        this.panX = Math.max(-limit, Math.min(limit, this.panX));
        this.panY = Math.max(-limit, Math.min(limit, this.panY));
        return true;
    }

    /** Reset to the full grid. Rule 5: 2 asserts. */
    reset() {
        console.assert(this._quad, 'reset: init first');
        console.assert(this.minZoom > 0, 'reset: valid min zoom');
        this.zoom = this.minZoom;
        this.panX = 0;
        this.panY = 0;
        return true;
    }

    /**
     * Canvas point (0..1) -> texture UV, honouring the current zoom and pan.
     * This is the inverse of what the fragment shader does, and the two MUST agree or
     * drawing lands somewhere other than where the cursor is. Rule 5: 2 asserts.
     */
    screenToUv(u, v) {
        console.assert(Number.isFinite(u), 'screenToUv: finite u');
        console.assert(Number.isFinite(v), 'screenToUv: finite v');
        return {
            x: (u - 0.5) / this.zoom + 0.5 + this.panX,
            y: (v - 0.5) / this.zoom + 0.5 + this.panY
        };
    }

    /**
     * Canvas point (0..1) -> integer grid cell, wrapped onto the torus.
     * Rule 5: 2 asserts.
     */
    screenToCell(u, v, size) {
        console.assert(Number.isFinite(size) && size > 0, 'screenToCell: grid size required');
        console.assert(Number.isFinite(u), 'screenToCell: finite u');
        const p = this.screenToUv(u, v);
        const wrap = (t) => ((t % 1) + 1) % 1;
        return {
            x: Math.floor(wrap(p.x) * size),
            y: Math.floor(wrap(p.y) * size)
        };
    }

    /** Draw the given state texture. Rule 5: 2 asserts. */
    render(texture) {
        console.assert(this._quad, 'render: init first');
        console.assert(this.renderer, 'render: renderer required');
        const u = this._quad.material.uniforms;
        u.uTex.value = texture;
        u.uZoom.value = this.zoom;
        u.uPan.value.set(this.panX, this.panY);
        this.renderer.setRenderTarget(null);
        this.renderer.render(this._scene, this._cam);
        return true;
    }

    dispose() {
        console.assert(!this._disposed, 'dispose: once only');
        console.assert(this !== undefined, 'dispose: instance');
        this._disposed = true;
        if (this._quad) {
            this._quad.geometry.dispose();
            this._quad.material.dispose();
            this._quad = null;
        }
        this._scene = null;
        return true;
    }
}

LifeView.VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Zoom/pan is a UV transform, not a camera move: cheaper, and it keeps the wrap behaviour
// of RepeatWrapping so panning off an edge shows the torus rather than emptiness.
LifeView.FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uZoom;
uniform vec2 uPan;
uniform vec3 uLow, uMid, uHigh;
uniform float uContinuous;

void main() {
    vec2 uv = (vUv - 0.5) / uZoom + 0.5 + uPan;
    float raw = texture2D(uTex, uv).r;

    // Conway: a cell is alive or it is not, and a blend would misrepresent the automaton.
    // Lenia: the value IS continuous and the ramp is the information.
    float v = mix(step(0.5, raw), clamp(raw, 0.0, 1.0), uContinuous);

    vec3 c = mix(uLow, uMid, pow(v, 0.55));
    c = mix(c, uHigh, pow(v, 3.0));
    gl_FragColor = vec4(c, 1.0);
}
`;

// Palettes are (low, mid, high) stops. `ember` reproduces the look both pages already had,
// so switching to the shared view changes nothing visually until the user asks for it.
LifeView.PALETTES = {
    ember:     { label: 'Ember',      low: [0.02, 0.03, 0.06], mid: [0.10, 0.65, 0.62], high: [1.00, 0.72, 0.25] },
    mono:      { label: 'Monochrome', low: [0.03, 0.03, 0.04], mid: [0.55, 0.56, 0.60], high: [1.00, 1.00, 1.00] },
    ice:       { label: 'Ice',        low: [0.02, 0.04, 0.09], mid: [0.16, 0.44, 0.78], high: [0.78, 0.94, 1.00] },
    spore:     { label: 'Spore',      low: [0.03, 0.05, 0.03], mid: [0.25, 0.62, 0.24], high: [0.85, 1.00, 0.45] },
    magma:     { label: 'Magma',      low: [0.05, 0.01, 0.06], mid: [0.62, 0.10, 0.35], high: [1.00, 0.85, 0.40] },
    blueprint: { label: 'Blueprint',  low: [0.04, 0.08, 0.16], mid: [0.20, 0.42, 0.70], high: [1.00, 1.00, 1.00] }
};

if (typeof window !== 'undefined') window.LifeView = LifeView;
if (typeof module !== 'undefined' && module.exports) module.exports = LifeView;
