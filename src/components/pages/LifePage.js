// LifePage.js — drives the Artificial Life page: Lenia on the GPU, plus optional
// generated ambient audio. Owns its own renderer and tears everything down on
// navigation, because a leaked WebGL context is not garbage collected and browsers
// hard-cap how many a tab may hold (typically 8-16) — leak one per visit and the page
// silently stops rendering after a handful of navigations.
class LifePage {
    constructor() {
        this.renderer = null;
        this.sim = null;
        this.audio = null;
        this.raf = null;
        this.generation = 0;
        this.paused = false;
        this.soundOn = false;
        this._quad = null;
        this._scene = null;
        this._cam = null;
        this._lastStatsAt = 0;
        this._lastNoteAt = 0;
    }

    /** Build renderer + simulation and start the loop. Rule 5: 2 asserts. */
    init() {
        console.assert(typeof THREE !== 'undefined', 'LifePage.init: THREE required');
        console.assert(typeof Lenia !== 'undefined', 'LifePage.init: Lenia required');
        const canvas = document.getElementById('life-canvas');
        if (!canvas || typeof THREE === 'undefined' || typeof Lenia === 'undefined') return false;

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
        this.renderer.setPixelRatio(1);          // the sim is fixed-resolution; DPR would only cost fill
        this.sim = new Lenia(this.renderer, { size: 256, R: 10, dt: 0.12 });
        this.sim.init();

        // Display pass: draw the simulation texture through a palette so the organisms
        // read as living tissue rather than a greyscale heightmap.
        this._cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this._scene = new THREE.Scene();
        this._quad = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            new THREE.ShaderMaterial({
                uniforms: { uTex: { value: this.sim.outputTexture } },
                vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.0,1.0); }',
                fragmentShader: [
                    'precision highp float; varying vec2 vUv; uniform sampler2D uTex;',
                    'void main(){',
                    '  float v = clamp(texture2D(uTex, vUv).r, 0.0, 1.0);',
                    // Deep blue void -> teal membrane -> hot amber core. Non-linear so the
                    // thin high-value rim that defines each organism stays visible.
                    '  vec3 c = mix(vec3(0.02,0.03,0.06), vec3(0.10,0.65,0.62), pow(v,0.55));',
                    '  c = mix(c, vec3(1.0,0.72,0.25), pow(v,3.0));',
                    '  gl_FragColor = vec4(c, 1.0);',
                    '}'
                ].join('\n')
            })
        );
        this._scene.add(this._quad);

        // Reduced motion: start paused. The simulation IS motion, so honouring the
        // preference means not running it, not animating it more gently.
        this.paused = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        this._wire();
        this._syncPauseButton();
        this._loop();
        return true;
    }

    /** Wire the controls. Rule 4: <=60 lines | Rule 5: 2 asserts. */
    _wire() {
        console.assert(typeof document !== 'undefined', '_wire: document required');
        console.assert(this.sim, '_wire: sim required');
        const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };

        on('life-reseed', 'click', () => { this.sim.seed(); this.generation = 0; });

        on('life-pause', 'click', () => { this.paused = !this.paused; this._syncPauseButton(); });

        on('life-sound', 'click', () => {
            // AudioContext must be created inside a user gesture or the browser leaves
            // it suspended — hence creating it here rather than in init().
            if (!this.audio && typeof SineAudio !== 'undefined') this.audio = new SineAudio({ volume: 0.18 });
            this.soundOn = !this.soundOn;
            const b = document.getElementById('life-sound');
            if (b) { b.setAttribute('aria-pressed', String(this.soundOn)); b.textContent = this.soundOn ? '🔊 Sound' : '🔈 Sound'; }
            if (this.soundOn && this.audio) this.audio.ensure();
        });

        on('life-mu', 'input', (e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isFinite(v)) return;
            this.sim.mu = v;
            const out = document.getElementById('life-mu-out');
            if (out) out.textContent = v.toFixed(3);
        });
    }

    _syncPauseButton() {
        console.assert(typeof document !== 'undefined', '_syncPauseButton: document required');
        console.assert(typeof this.paused === 'boolean', '_syncPauseButton: bool required');
        const b = document.getElementById('life-pause');
        if (!b) return false;
        b.setAttribute('aria-pressed', String(this.paused));
        b.textContent = this.paused ? '▶ Run' : '⏸ Pause';
        return true;
    }

    /** Step, draw, and occasionally report population. Rule 5: 2 asserts. */
    _loop() {
        console.assert(this.renderer, '_loop: renderer required');
        console.assert(this.sim, '_loop: sim required');
        this.raf = requestAnimationFrame(() => this._loop());
        if (!this.paused) { this.sim.step(); this.generation++; }
        this._quad.material.uniforms.uTex.value = this.sim.outputTexture;
        this.renderer.setRenderTarget(null);
        this.renderer.render(this._scene, this._cam);

        const now = performance.now();
        if (now - this._lastStatsAt > 500) { this._lastStatsAt = now; this._reportStats(now); }
    }

    /**
     * Population readback, throttled hard.
     *
     * readRenderTargetPixels STALLS the GPU pipeline — it forces the CPU to wait for
     * everything queued to finish. Doing it per frame would cost far more than the
     * simulation itself, so it runs twice a second on a downsampled read.
     * Rule 5: 2 asserts.
     */
    _reportStats(now) {
        console.assert(Number.isFinite(now), '_reportStats: timestamp required');
        console.assert(this.sim, '_reportStats: sim required');
        const n = this.sim.size;
        if (!this._readBuf) this._readBuf = new Float32Array(n * n * 4);
        try {
            this.renderer.readRenderTargetPixels(this.sim._targets[this.sim._cur], 0, 0, n, n, this._readBuf);
        } catch (e) { return false; }
        let alive = 0;
        const step = 4 * 4;                       // sample every 4th pixel; plenty for a percentage
        let count = 0;
        for (let i = 0; i < this._readBuf.length; i += step) { if (this._readBuf[i] > 0.05) alive++; count++; }
        const pct = count ? (100 * alive / count) : 0;
        const g = document.getElementById('life-gen');
        const pEl = document.getElementById('life-pop');
        if (g) g.textContent = 'generation ' + this.generation;
        if (pEl) pEl.textContent = 'population ' + pct.toFixed(1) + '%';

        // Sonify the ecosystem: pitch follows population, so a thriving world sings
        // higher. Rate-limited so it stays ambient rather than a stream of beeps.
        if (this.soundOn && this.audio && pct > 0.5 && now - this._lastNoteAt > 2600) {
            this._lastNoteAt = now;
            this.audio.ambientPhrase(110 * Math.pow(2, Math.min(2, pct / 18)), 2);
        }
        return true;
    }

    /** Free the WebGL context and everything hanging off it. Rule 5: 2 asserts. */
    cleanup() {
        console.assert(this !== undefined, 'cleanup: instance');
        console.assert(typeof cancelAnimationFrame === 'function', 'cleanup: rAF required');
        if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
        if (this.sim) { this.sim.dispose(); this.sim = null; }
        if (this._quad) { this._quad.geometry.dispose(); this._quad.material.dispose(); this._quad = null; }
        if (this.audio) { this.audio.dispose(); this.audio = null; }
        if (this.renderer) {
            // forceContextLoss is what actually releases the GPU context; dispose()
            // alone leaves it held and the tab's context budget slowly fills up.
            this.renderer.dispose();
            if (this.renderer.forceContextLoss) this.renderer.forceContextLoss();
            this.renderer = null;
        }
        this._readBuf = null;
        return true;
    }
}

if (typeof window !== 'undefined') window.LifePage = LifePage;
