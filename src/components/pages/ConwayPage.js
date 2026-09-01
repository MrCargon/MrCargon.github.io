// ConwayPage.js — drives the Conway's Game of Life page.
//
// Owns its own WebGL renderer and tears it down on navigation. This is not optional
// housekeeping: a leaked WebGL context is not garbage collected and browsers hard-cap how
// many a tab may hold (typically 8-16), so leaking one per visit means the page silently
// stops rendering after a handful of navigations. LifePage next door learned this first.
class ConwayPage {
    constructor() {
        this.renderer = null;
        this.sim = null;
        this.raf = null;
        this.paused = false;
        this.speed = 1;                 // generations per animation frame
        this._quad = null;
        this._scene = null;
        this._cam = null;
        this._lastStatsAt = 0;
        this._readBuf = null;
    }

    /** Build renderer + simulation and start the loop. Rule 5: 2 asserts. */
    init() {
        console.assert(typeof THREE !== 'undefined', 'ConwayPage.init: THREE required');
        console.assert(typeof ConwayLife !== 'undefined', 'ConwayPage.init: ConwayLife required');
        const canvas = document.getElementById('conway-canvas');
        if (!canvas || typeof THREE === 'undefined' || typeof ConwayLife === 'undefined') return false;

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
        this.renderer.setPixelRatio(1);      // fixed-resolution sim; DPR would only cost fill
        this.sim = new ConwayLife(this.renderer, { size: 512 });
        this.sim.init();

        this._buildDisplay();
        this._populatePickers();

        // Reduced motion: start paused. The simulation IS the motion, so honouring the
        // preference means not running it, not running it more gently.
        this.paused = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

        this._wire();
        this._syncPlayButton();
        this._loadPattern('gosperGun');      // opens on unbounded growth, not on soup
        this._loop();
        return true;
    }

    /** Palette pass: draw the 0/1 state as something legible. Rule 5: 2 asserts. */
    _buildDisplay() {
        console.assert(this.sim, '_buildDisplay: sim required');
        console.assert(typeof THREE !== 'undefined', '_buildDisplay: THREE required');
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
                    // Hard threshold, no smoothing: a cell is alive or it is not, and
                    // blending neighbouring cells would misrepresent the automaton.
                    '  float v = texture2D(uTex, vUv).r > 0.5 ? 1.0 : 0.0;',
                    '  vec3 dead = vec3(0.02, 0.03, 0.05);',
                    '  vec3 live = vec3(1.0, 0.62, 0.15);',
                    '  gl_FragColor = vec4(mix(dead, live, v), 1.0);',
                    '}'
                ].join('\n')
            })
        );
        this._scene.add(this._quad);
        return true;
    }

    /** Fill the pattern and universe dropdowns from the library. Rule 5: 2 asserts. */
    _populatePickers() {
        console.assert(typeof LifePatterns !== 'undefined', '_populatePickers: LifePatterns required');
        console.assert(typeof document !== 'undefined', '_populatePickers: document required');
        const pat = document.getElementById('conway-pattern');
        if (pat) {
            const groups = {};
            const names = LifePatterns.names();
            for (let i = 0; i < names.length; i++) {                 // Rule 2: bounded
                const m = LifePatterns.META[names[i]];
                if (!m) continue;
                if (!groups[m.group]) {
                    groups[m.group] = document.createElement('optgroup');
                    groups[m.group].label = m.group;
                    pat.appendChild(groups[m.group]);
                }
                const opt = document.createElement('option');
                opt.value = names[i];
                opt.textContent = m.label;
                groups[m.group].appendChild(opt);
            }
            pat.value = 'gosperGun';
        }
        const rules = document.getElementById('conway-ruleset');
        if (rules) {
            for (let i = 0; i < LifePatterns.RULES.length; i++) {    // Rule 2: bounded
                const r = LifePatterns.RULES[i];
                const opt = document.createElement('option');
                opt.value = r.rule;
                opt.textContent = r.name + '  (' + r.rule + ')';
                rules.appendChild(opt);
            }
            rules.value = 'B3/S23';
        }
        return true;
    }

    /** Wire the controls. Rule 4: <=60 lines | Rule 5: 2 asserts. */
    _wire() {
        console.assert(this.sim, '_wire: sim required');
        console.assert(typeof document !== 'undefined', '_wire: document required');
        const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };

        on('conway-play', 'click', () => { this.paused = !this.paused; this._syncPlayButton(); });
        on('conway-step', 'click', () => { this.paused = true; this._syncPlayButton(); this.sim.step(); });
        on('conway-seed', 'click', () => { this.sim.seed(0.3); this._note('Random soup at 30% density.'); });
        on('conway-clear', 'click', () => { this.sim.clear(); this._note('Cleared.'); });

        on('conway-speed', 'input', (e) => {
            const v = parseInt(e.target.value, 10);
            if (!Number.isFinite(v)) return;
            this.speed = Math.max(1, Math.min(16, v));
            const out = document.getElementById('conway-speed-out');
            if (out) out.textContent = this.speed + '×';
        });

        on('conway-pattern', 'change', (e) => this._loadPattern(e.target.value));

        on('conway-ruleset', 'change', (e) => {
            const input = document.getElementById('conway-rule-input');
            if (input) input.value = e.target.value;
            this._applyRule(e.target.value);
        });

        on('conway-rule-input', 'input', (e) => this._applyRule(e.target.value, e.target));
        return true;
    }

    /**
     * Apply a B/S rule string. On a parse failure the previous universe is KEPT and the
     * field is marked invalid — silently doing nothing reads as a broken input box.
     * Rule 5: 2 asserts.
     */
    _applyRule(str, inputEl) {
        console.assert(this.sim, '_applyRule: sim required');
        console.assert(typeof str === 'string', '_applyRule: string required');
        const parsed = (typeof LifePatterns !== 'undefined') ? LifePatterns.parseRule(str) : null;
        const el = inputEl || document.getElementById('conway-rule-input');
        if (!parsed) {
            if (el) el.classList.add('invalid');
            return false;
        }
        if (el) el.classList.remove('invalid');
        this.sim.setRule(parsed.birth, parsed.survive);
        const label = document.getElementById('conway-rule');
        if (label) label.textContent = str.toUpperCase();
        const known = (typeof LifePatterns !== 'undefined')
            ? LifePatterns.RULES.find(r => r.rule.toUpperCase() === str.trim().toUpperCase()) : null;
        this._note(known ? known.name + ' — ' + known.note : 'Custom rule ' + str.toUpperCase() + '.');
        return true;
    }

    /** Centre a named pattern on the grid. Rule 5: 2 asserts. */
    _loadPattern(name) {
        console.assert(this.sim, '_loadPattern: sim required');
        console.assert(typeof name === 'string', '_loadPattern: name required');
        if (typeof LifePatterns === 'undefined') return false;
        const p = LifePatterns.get(name);
        if (!p) return false;
        const ox = Math.floor((this.sim.size - p.width) / 2);
        const oy = Math.floor((this.sim.size - p.height) / 2);
        this.sim.setPattern(p.cells, ox, oy);
        const meta = LifePatterns.META[name];
        this._note(meta ? meta.label + ' — ' + meta.group.toLowerCase() + ', ' + p.cells.length + ' cells.' : '');
        return true;
    }

    _note(text) {
        console.assert(typeof text === 'string', '_note: string required');
        console.assert(typeof document !== 'undefined', '_note: document required');
        const el = document.getElementById('conway-note');
        if (el) el.textContent = text;
        return true;
    }

    _syncPlayButton() {
        console.assert(typeof document !== 'undefined', '_syncPlayButton: document required');
        console.assert(typeof this.paused === 'boolean', '_syncPlayButton: bool required');
        const b = document.getElementById('conway-play');
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
        if (!this.paused) {
            for (let i = 0; i < this.speed; i++) this.sim.step();   // Rule 2: bounded (<=16)
        }
        this._quad.material.uniforms.uTex.value = this.sim.outputTexture;
        this.renderer.setRenderTarget(null);
        this.renderer.render(this._scene, this._cam);

        const now = performance.now();
        if (now - this._lastStatsAt > 500) { this._lastStatsAt = now; this._reportStats(); }
    }

    /**
     * Population readback, throttled hard.
     *
     * readRenderTargetPixels STALLS the GPU pipeline — the CPU waits for everything queued
     * to finish. Per frame it would cost far more than the simulation itself, so it runs
     * twice a second. Rule 5: 2 asserts.
     */
    _reportStats() {
        console.assert(this.sim, '_reportStats: sim required');
        console.assert(typeof document !== 'undefined', '_reportStats: document required');
        const n = this.sim.size;
        if (!this._readBuf) this._readBuf = new Uint8Array(n * n * 4);
        const buf = this.sim.readPixels(this._readBuf);
        if (!buf) return false;
        let alive = 0;
        for (let i = 0; i < buf.length; i += 4) { if (buf[i] > 127) alive++; }   // Rule 2: bounded
        const g = document.getElementById('conway-gen');
        const p = document.getElementById('conway-pop');
        if (g) g.textContent = 'generation ' + this.sim.generation;
        if (p) p.textContent = 'population ' + alive;
        return true;
    }

    /** Free the WebGL context and everything hanging off it. Rule 5: 2 asserts. */
    cleanup() {
        console.assert(this !== undefined, 'cleanup: instance');
        console.assert(typeof cancelAnimationFrame === 'function', 'cleanup: rAF required');
        if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
        if (this.sim) { this.sim.dispose(); this.sim = null; }
        if (this._quad) { this._quad.geometry.dispose(); this._quad.material.dispose(); this._quad = null; }
        if (this.renderer) {
            // forceContextLoss is what actually releases the GPU context; dispose() alone
            // leaves it held and the tab's context budget slowly fills up.
            this.renderer.dispose();
            if (this.renderer.forceContextLoss) this.renderer.forceContextLoss();
            this.renderer = null;
        }
        this._readBuf = null;
        return true;
    }
}

if (typeof window !== 'undefined') window.ConwayPage = ConwayPage;
