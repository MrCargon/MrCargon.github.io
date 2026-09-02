// LifePage.js — the Artificial Life page: three simulations behind one mode switch.
//
// Conway and Lenia were once two separate pages. They are one subject — the discrete and
// continuous ends of the same family — so they became one page, and Particle Life then
// joined them as a third axis: no grid at all, just typed particles in free space. All
// three share a canvas, a view (zoom/pan/palette), a stats bar and one set of prose.
//
// Owns its own WebGL renderer and tears everything down on navigation, because a leaked
// WebGL context is not garbage collected and browsers hard-cap how many a tab may hold
// (typically 8-16) — leak one per visit and the page silently stops rendering after a
// handful of navigations.
//
// ALL THREE STAY ALIVE ACROSS A MODE SWITCH. Together they are a few MB (Conway 512^2
// bytes x2, Lenia 256^2 floats x2, particles a handful of Float32Arrays), which is
// nothing, and it means flipping between them preserves each world rather than resetting
// the one you just set up.
class LifePage {
    constructor() {
        this.renderer = null;
        this.view = null;
        this.sims = { conway: null, lenia: null, particles: null };
        this.mode = 'conway';
        this.audio = null;
        this.raf = null;
        this.paused = false;
        this.speed = 1;
        this.tool = 'pan';              // pan | draw | erase
        this.brush = 1;
        this.density = 0.3;             // Conway reseed density
        this.volume = 0.18;             // Lenia ambient audio
        this._pointer = { down: false, lastX: 0, lastY: 0, id: null };
        this._pinch = null;
        this._lastStatsAt = 0;
        this._lastNoteAt = 0;
        this._readBuf = null;
    }

    get sim() { return this.sims[this.mode]; }

    /** Build renderer, both simulations and the shared view. Rule 5: 2 asserts. */
    init() {
        console.assert(typeof THREE !== 'undefined', 'LifePage.init: THREE required');
        console.assert(typeof LifeView !== 'undefined', 'LifePage.init: LifeView required');
        const canvas = document.getElementById('life-canvas');
        if (!canvas || typeof THREE === 'undefined' || typeof LifeView === 'undefined') return false;

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
        this.renderer.setPixelRatio(1);   // fixed-resolution sims; DPR would only cost fill

        if (typeof ConwayLife !== 'undefined') {
            this.sims.conway = new ConwayLife(this.renderer, { size: 512 });
            this.sims.conway.init();
        }
        if (typeof Lenia !== 'undefined') {
            this.sims.lenia = new Lenia(this.renderer, { size: 256, R: 10, dt: 0.12 });
            this.sims.lenia.init();
        }
        if (typeof ParticleLife !== 'undefined') {
            this.sims.particles = new ParticleLife(this.renderer, { count: 1800, types: 5 });
            this.sims.particles.init();
        }
        if (!this.sims.conway && !this.sims.lenia && !this.sims.particles) return false;

        // Both routes land here; the hash decides which mode opens. #conway therefore
        // still means "show me Conway" for every existing link and bookmark, and #life
        // opens on Lenia, which is what that URL has always shown.
        const hash = (typeof location !== 'undefined' ? location.hash : '').toLowerCase();
        this.mode = hash.indexOf('conway') !== -1 ? 'conway'
                  : (hash.indexOf('particle') !== -1 ? 'particles' : 'lenia');
        if (!this.sims[this.mode]) this.mode = this.sims.conway ? 'conway' : 'lenia';

        this.view = new LifeView(this.renderer);
        this.view.init();

        this._populatePickers();
        this._wire();
        // Reduced motion: start paused. The simulation IS the motion, so honouring the
        // preference means not running it, not running it more gently.
        this.paused = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        this._setMode(this.mode, true);
        this._syncSwatches();
        this._syncPauseButton();
        this._loop();
        return true;
    }

    /** Fill the pattern, universe and palette dropdowns. Rule 5: 2 asserts. */
    _populatePickers() {
        console.assert(typeof document !== 'undefined', '_populatePickers: document required');
        console.assert(this.view, '_populatePickers: view required');
        const pat = document.getElementById('life-pattern');
        if (pat && typeof LifePatterns !== 'undefined') {
            const groups = {};
            const names = LifePatterns.names();
            for (let i = 0; i < names.length; i++) {                  // Rule 2: bounded
                const m = LifePatterns.META[names[i]];
                if (!m) continue;
                if (!groups[m.group]) {
                    groups[m.group] = document.createElement('optgroup');
                    groups[m.group].label = m.group;
                    pat.appendChild(groups[m.group]);
                }
                const o = document.createElement('option');
                o.value = names[i]; o.textContent = m.label;
                groups[m.group].appendChild(o);
            }
            pat.value = 'gosperGun';
        }
        const rules = document.getElementById('life-ruleset');
        if (rules && typeof LifePatterns !== 'undefined') {
            for (let i = 0; i < LifePatterns.RULES.length; i++) {     // Rule 2: bounded
                const r = LifePatterns.RULES[i];
                const o = document.createElement('option');
                o.value = r.rule; o.textContent = r.name + '  (' + r.rule + ')';
                rules.appendChild(o);
            }
            rules.value = 'B3/S23';
        }
        const pal = document.getElementById('life-palette');
        if (pal) {
            const keys = Object.keys(LifeView.PALETTES);
            for (let i = 0; i < keys.length; i++) {                   // Rule 2: bounded
                const o = document.createElement('option');
                o.value = keys[i]; o.textContent = LifeView.PALETTES[keys[i]].label;
                pal.appendChild(o);
            }
            pal.value = this.view.palette;
        }
        return true;
    }

    /**
     * Switch simulation. Conway-only and Lenia-only controls are shown/hidden rather than
     * disabled, because a greyed-out control that never applies is just clutter.
     * Rule 5: 2 asserts.
     */
    _setMode(mode, force) {
        console.assert(['conway', 'lenia', 'particles'].indexOf(mode) !== -1, '_setMode: known mode');
        console.assert(this.view, '_setMode: view required');
        if (!this.sims[mode]) return false;
        if (mode === this.mode && !force) return true;
        this.mode = mode;
        this.view.setContinuous(mode === 'lenia');

        const show = (id, on) => { const e = document.getElementById(id); if (e) e.hidden = !on; };
        show('pick-pattern-wrap', mode === 'conway');
        show('pick-rule-wrap', mode === 'conway');
        show('pick-custom-wrap', mode === 'conway');
        show('pick-mu-wrap', mode === 'lenia');
        show('pick-sigma-wrap', mode === 'lenia');
        show('pick-kmu-wrap', mode === 'lenia');
        show('pick-dt-wrap', mode === 'lenia');
        show('pick-sound-wrap', mode === 'lenia');
        show('pick-vol-wrap', mode === 'lenia');
        show('pick-density-wrap', mode === 'conway');
        show('pick-count-wrap', mode === 'particles');
        show('pick-ptypes-wrap', mode === 'particles');
        show('pick-prange-wrap', mode === 'particles');
        show('pick-pfriction-wrap', mode === 'particles');
        show('pick-pforce-wrap', mode === 'particles');
        show('matrix-wrap', mode === 'particles');

        const modeBtns = { conway: 'mode-conway', lenia: 'mode-lenia', particles: 'mode-particles' };
        for (const k of Object.keys(modeBtns)) {                  // Rule 2: bounded (3)
            const b = document.getElementById(modeBtns[k]);
            if (!b) continue;
            b.classList.toggle('is-active', mode === k);
            b.setAttribute('aria-selected', String(mode === k));
        }

        const ruleEl = document.getElementById('life-rule');
        if (ruleEl) {
            if (mode === 'conway') ruleEl.textContent = 'B3/S23';
            else if (mode === 'lenia') ruleEl.textContent = 'Lenia μ=' + this.sims.lenia.mu.toFixed(3);
            else ruleEl.textContent = 'range ' + this.sims.particles.radius.toFixed(3);
        }
        if (mode === 'particles') this._drawMatrix();

        // Seed Conway with the gun when its world is EMPTY, not merely on first entry.
        //
        // The original condition was `force` only, which meant: open the page on #life
        // (Lenia), press Conway, and you got a black square. Conway had been constructed
        // and cleared at init but never seeded, so the generation counter ticked up while
        // population sat at 0 — measured in a playthrough: gen 101, population 0, nothing
        // on screen. A blank grid is a legitimate state to WANT (Clear exists), so the
        // test is emptiness at the moment of switching, which leaves a world the user
        // built or cleared themselves untouched.
        if (mode === 'conway' && (force || this._isEmpty(this.sims.conway))) {
            this._loadPattern('gosperGun');
        } else {
            this._note(mode === 'conway' ? 'Conway — discrete, B3/S23.' : 'Lenia — continuous cellular automata.');
        }
        return true;
    }

    /**
     * Is this simulation's world empty? Sampled, not exhaustive: readPixels stalls the
     * pipeline, and one live cell anywhere in a 512x512 grid is enough to mean "not
     * empty", so a stride of 64 pixels finds any real pattern while costing a fraction of
     * a full scan. Rule 5: 2 asserts.
     */
    _isEmpty(sim) {
        console.assert(sim === null || typeof sim === 'object', '_isEmpty: sim or null');
        console.assert(this.renderer, '_isEmpty: renderer required');
        if (!sim || typeof sim.readPixels !== 'function') return false;
        const buf = sim.readPixels();
        if (!buf) return false;
        for (let i = 0; i < buf.length; i += 256) {        // Rule 2: bounded
            if (buf[i] > 127) return false;
        }
        return true;
    }

    /** Wire every control. Rule 4: <=60 lines | Rule 5: 2 asserts. */
    /**
     * Wire every control.
     *
     * Split by SUBJECT rather than left as one block. This was 208 lines — well past the
     * project's own 60-line rule — and it bound six unrelated groups of controls in a row.
     * Each helper below owns one group, so adding a fourth simulation touches one of them
     * instead of lengthening a function nobody can hold in their head.
     * Rule 4: <=60 lines | Rule 5: 2 asserts.
     */
    _wire() {
        console.assert(typeof document !== 'undefined', '_wire: document required');
        console.assert(this.view, '_wire: view required');
        this._wireModesAndTransport();
        this._wireViewAndRules();
        this._wireParticles();
        this._wireLeniaExtras();
        this._wireColour();
        this._wireKeys();
        this._wirePointer();
        return true;
    }

    /** Bind a handler if the element exists. Shared by every _wireX below. */
    _on(id, ev, fn) {
        console.assert(typeof id === 'string', '_on: id required');
        console.assert(typeof fn === 'function', '_on: handler required');
        const el = document.getElementById(id);
        if (el) el.addEventListener(ev, fn);
        return !!el;
    }

    /** The three simulation tabs, plus play/step/reseed/clear/speed and the brush and tool buttons. Rule 5: 2 asserts. */
    _wireModesAndTransport() {
        console.assert(typeof document !== 'undefined', '_wireModesAndTransport: document required');
        console.assert(this.view, '_wireModesAndTransport: view required');
        const on = (a, b, c) => this._on(a, b, c);
        on('mode-conway', 'click', () => this._setMode('conway'));
        on('mode-lenia', 'click', () => this._setMode('lenia'));
        on('mode-particles', 'click', () => this._setMode('particles'));

        on('life-pause', 'click', () => { this.paused = !this.paused; this._syncPauseButton(); });
        on('life-step', 'click', () => { this.paused = true; this._syncPauseButton(); if (this.sim) this.sim.step(); });
        on('life-clear', 'click', () => {
            if (!this.sim) return;
            if (this.mode === 'particles') { this.sim.seed(); this._note('Particles reset.'); }
            else if (this.sim.clear) { this.sim.clear(); this._note('Cleared.'); }
        });
        on('life-reseed', 'click', () => {
            if (!this.sim) return;
            if (this.mode === 'particles') {
                this.sim.seed();
                this._note('Reseeded ' + this.sim.count + ' particles.');
            } else if (this.mode === 'conway') {
                const d = this.density || 0.3;
                this.sim.seed(d);
                this._note('Random soup at ' + Math.round(d * 100) + '% density.');
            }
            else { this.sim.seed(); this._note('New Lenia world.'); }
        });

        on('life-speed', 'input', (e) => {
            const v = parseInt(e.target.value, 10);
            if (!Number.isFinite(v)) return;
            this.speed = Math.max(1, Math.min(16, v));
            const o = document.getElementById('life-speed-out'); if (o) o.textContent = this.speed + '×';
        });
        on('life-brush', 'input', (e) => {
            const v = parseInt(e.target.value, 10);
            if (!Number.isFinite(v)) return;
            this.brush = Math.max(0, Math.min(12, v));
            const o = document.getElementById('life-brush-out'); if (o) o.textContent = String(this.brush);
        });

        on('tool-pan', 'click', () => this._setTool('pan'));
        on('tool-draw', 'click', () => this._setTool('draw'));
        on('tool-erase', 'click', () => this._setTool('erase'));
        return true;
    }

    /** Zoom buttons, Conway's pattern and universe pickers, and the palette preset. Rule 5: 2 asserts. */
    _wireViewAndRules() {
        console.assert(typeof document !== 'undefined', '_wireViewAndRules: document required');
        console.assert(this.view, '_wireViewAndRules: view required');
        const on = (a, b, c) => this._on(a, b, c);
        on('life-zoom-in', 'click', () => { this.view.zoomAt(1.5, 0.5, 0.5); this._syncZoom(); });
        on('life-zoom-out', 'click', () => { this.view.zoomAt(1 / 1.5, 0.5, 0.5); this._syncZoom(); });
        on('life-zoom-reset', 'click', () => { this.view.reset(); this._syncZoom(); this._note('View reset.'); });

        on('life-pattern', 'change', (e) => this._loadPattern(e.target.value));
        on('life-ruleset', 'change', (e) => {
            const i = document.getElementById('life-rule-input'); if (i) i.value = e.target.value;
            this._applyRule(e.target.value);
        });
        on('life-rule-input', 'input', (e) => this._applyRule(e.target.value, e.target));
        on('life-palette', 'change', (e) => {
            this.view.setPalette(e.target.value);
            this._syncSwatches();                                 // swatches show the preset
            this._note('Palette: ' + e.target.value + '.');
        });
        on('life-mu', 'input', (e) => this._setMu(parseFloat(e.target.value)));
        on('life-sound', 'click', () => this._toggleSound());
        return true;
    }

    /** Particle count, species, range, friction, force, and the matrix actions. Rule 5: 2 asserts. */
    _wireParticles() {
        console.assert(typeof document !== 'undefined', '_wireParticles: document required');
        console.assert(this.view, '_wireParticles: view required');
        const on = (a, b, c) => this._on(a, b, c);
        // Particle controls. Count and species need a reseed (the buffers change meaning);
        // range, friction and force are live and can be dragged while it runs.
        on('life-pcount', 'input', (e) => {
            const v = parseInt(e.target.value, 10);
            if (!Number.isFinite(v) || !this.sims.particles) return;
            this.sims.particles.seed(v, this.sims.particles.types);
            const o = document.getElementById('life-pcount-out'); if (o) o.textContent = String(v);
        });
        on('life-ptypes', 'input', (e) => {
            const v = parseInt(e.target.value, 10);
            if (!Number.isFinite(v) || !this.sims.particles) return;
            this.sims.particles.seed(this.sims.particles.count, v);
            const o = document.getElementById('life-ptypes-out'); if (o) o.textContent = String(v);
            const r = document.getElementById('life-rule');
            this._drawMatrix();
        });
        on('life-prange', 'input', (e) => {
            const v = parseInt(e.target.value, 10) / 1000;
            if (!Number.isFinite(v) || !this.sims.particles) return;
            this.sims.particles.radius = v;
            this.sims.particles._buildGrid();      // bucket size follows the radius
            const o = document.getElementById('life-prange-out'); if (o) o.textContent = v.toFixed(3);
            const r = document.getElementById('life-rule');
            if (r && this.mode === 'particles') r.textContent = 'range ' + v.toFixed(3);
        });
        on('life-pfriction', 'input', (e) => {
            const v = parseInt(e.target.value, 10) / 100;
            if (!Number.isFinite(v) || !this.sims.particles) return;
            this.sims.particles.friction = v;
            const o = document.getElementById('life-pfriction-out'); if (o) o.textContent = v.toFixed(2);
        });
        on('life-pforce', 'input', (e) => {
            const v = parseInt(e.target.value, 10) / 100;
            if (!Number.isFinite(v) || !this.sims.particles) return;
            this.sims.particles.forceScale = v;
            const o = document.getElementById('life-pforce-out'); if (o) o.textContent = v.toFixed(2);
        });

        on('matrix-random', 'click', () => {
            if (!this.sims.particles) return;
            this.sims.particles.randomiseMatrix(); this._drawMatrix();
            this._note('New random matrix — every species feels differently about every other.');
        });
        on('matrix-symmetric', 'click', () => {
            if (!this.sims.particles) return;
            this.sims.particles.symmetriseMatrix(); this._drawMatrix();
            this._note('Made mutual. Expect crystals and blobs rather than chasing.');
        });
        on('matrix-zero', 'click', () => {
            if (!this.sims.particles) return;
            this.sims.particles.clearMatrix();
            this._drawMatrix();
            this._note('Cleared — only short-range repulsion remains, so it will spread out evenly.');
        });
        return true;
    }

    /** Lenia's sigma, kernel ring and time step, Conway's seed density, and audio volume. Rule 5: 2 asserts. */
    _wireLeniaExtras() {
        console.assert(typeof document !== 'undefined', '_wireLeniaExtras: document required');
        console.assert(this.view, '_wireLeniaExtras: view required');
        const on = (a, b, c) => this._on(a, b, c);
        // Lenia's other three parameters. mu alone is the famous one, but sigma decides how
        // forgiving the growth band is, the kernel ring is what makes organisms rather than
        // mush, and dt is how hard each step lands. All are live uniforms.
        on('life-sigma', 'input', (e) => this._setLenia('sigma', parseFloat(e.target.value), 'life-sigma-out', 3));
        on('life-kmu', 'input', (e) => this._setLenia('kmu', parseFloat(e.target.value), 'life-kmu-out', 2));
        on('life-dt', 'input', (e) => this._setLenia('dt', parseFloat(e.target.value), 'life-dt-out', 2));

        on('life-density', 'input', (e) => {
            const v = parseInt(e.target.value, 10);
            if (!Number.isFinite(v)) return;
            this.density = v / 100;
            const o = document.getElementById('life-density-out'); if (o) o.textContent = v + '%';
        });

        on('life-volume', 'input', (e) => {
            const v = parseInt(e.target.value, 10);
            if (!Number.isFinite(v)) return;
            this.volume = v / 100;
            if (this.audio && typeof this.audio.setVolume === 'function') this.audio.setVolume(this.volume);
            else if (this.audio) this.audio.volume = this.volume;
            const o = document.getElementById('life-volume-out'); if (o) o.textContent = v + '%';
        });
        return true;
    }

    /** Custom palette stops, the per-cell gradient swatches and the shading amounts. Rule 5: 2 asserts. */
    _wireColour() {
        console.assert(typeof document !== 'undefined', '_wireColour: document required');
        console.assert(this.view, '_wireColour: view required');
        const on = (a, b, c) => this._on(a, b, c);
        // Custom colour: each swatch writes one palette stop straight to the shader.
        const stops = { 'life-col-low': 'low', 'life-col-mid': 'mid', 'life-col-high': 'high' };
        for (const id of Object.keys(stops)) {                    // Rule 2: bounded (3)
            on(id, 'input', (e) => {
                this.view.setStop(stops[id], e.target.value);
                const sel = document.getElementById('life-palette');
                if (sel) sel.value = '';                          // no preset matches an edit
                this._note('Custom colour.');
            });
        }
        // Per-cell gradient: two more swatches and three shading amounts.
        const cellStops = { 'life-col-inner': 'inner', 'life-col-outer': 'outer' };
        for (const id of Object.keys(cellStops)) {                // Rule 2: bounded (2)
            on(id, 'input', (e) => {
                this.view.setCellStop(cellStops[id], e.target.value);
                const sel = document.getElementById('life-palette');
                if (sel) sel.value = '';
                this._note('Custom cell gradient.');
            });
        }
        const shading = [
            ['life-cellmix', 'mix', 'life-cellmix-out', (v) => Math.round(v * 100) + '%'],
            ['life-edge', 'edge', 'life-edge-out', (v) => v.toFixed(2)],
            ['life-glow', 'glow', 'life-glow-out', (v) => Math.round(v * 100) + '%']
        ];
        for (const [id, key, outId, fmt] of shading) {            // Rule 2: bounded (3)
            on(id, 'input', (e) => {
                const v = parseInt(e.target.value, 10) / 100;
                if (!Number.isFinite(v)) return;
                this.view.setShading(key, v);
                const o = document.getElementById(outId);
                if (o) o.textContent = fmt(v);
            });
        }

        on('life-col-reset', 'click', () => {
            const sel = document.getElementById('life-palette');
            const name = (sel && sel.value) || 'ember';
            this.view.setPalette(name === '' ? 'ember' : name);
            if (sel) sel.value = this.view.palette;
            this._syncSwatches();
            this._note('Back to the ' + this.view.palette + ' preset.');
        });
        return true;
    }

    /** Keyboard shortcuts and the hash listener that keeps the mode matching the URL. Rule 5: 2 asserts. */
    _wireKeys() {
        console.assert(typeof document !== 'undefined', '_wireKeys: document required');
        console.assert(this.view, '_wireKeys: view required');
        const on = (a, b, c) => this._on(a, b, c);
        // Escape leaves the page - the same exit the header link offers, for the keyboard.
        this._onKey = (e) => {
            if (e.key === 'Escape' && e.target && !e.target.matches('input,select,textarea')) {
                location.hash = '#projects';
            }
        };
        document.addEventListener('keydown', this._onKey);



        // #life and #conway are the same page. The router does not re-initialise on a
        // hash change, so without this, navigating from one to the other inside the SPA
        // would leave you on whichever mode happened to load first — the URL would say
        // conway while the page showed Lenia.
        this._onHash = () => {
            const h = (location.hash || '').toLowerCase();
            if (h.indexOf('conway') !== -1) this._setMode('conway');
            else if (h.indexOf('life') !== -1) this._setMode('lenia');
        };
        window.addEventListener('hashchange', this._onHash);
        return true;
    }

    /** Pointer: wheel zooms, drag pans or paints, two fingers pinch. Rule 5: 2 asserts. */
    _wirePointer() {
        console.assert(this.view, '_wirePointer: view required');
        console.assert(typeof document !== 'undefined', '_wirePointer: document required');
        const c = document.getElementById('life-canvas');
        if (!c) return false;
        this._canvas = c;

        this._onWheel = (e) => {
            e.preventDefault();
            const p = this._norm(e);
            this.view.zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.u, p.v);
            this._syncZoom();
        };
        this._onDown = (e) => {
            c.setPointerCapture && c.setPointerCapture(e.pointerId);
            this._pointer.down = true; this._pointer.id = e.pointerId;
            const p = this._norm(e);
            this._pointer.lastX = p.u; this._pointer.lastY = p.v;
            if (this.tool !== 'pan') { e.preventDefault(); this._paintAt(p); }
        };
        this._onMove = (e) => {
            if (!this._pointer.down || e.pointerId !== this._pointer.id) return;
            const p = this._norm(e);
            if (this.tool === 'pan') {
                this.view.panBy(p.u - this._pointer.lastX, p.v - this._pointer.lastY);
                this._syncZoom();
            } else {
                e.preventDefault();
                this._paintAt(p);
            }
            this._pointer.lastX = p.u; this._pointer.lastY = p.v;
        };
        this._onUp = (e) => {
            if (e.pointerId === this._pointer.id) { this._pointer.down = false; this._pointer.id = null; }
        };

        c.addEventListener('wheel', this._onWheel, { passive: false });
        c.addEventListener('pointerdown', this._onDown);
        c.addEventListener('pointermove', this._onMove);
        c.addEventListener('pointerup', this._onUp);
        c.addEventListener('pointercancel', this._onUp);
        c.addEventListener('pointerleave', this._onUp);
        return true;
    }

    /**
     * Pointer event -> normalised canvas coords with y flipped into texture space.
     * WebGL's origin is bottom-left and the DOM's is top-left; getting this backwards is
     * what makes drawing land mirrored. Rule 5: 2 asserts.
     */
    _norm(e) {
        console.assert(this._canvas, '_norm: canvas required');
        console.assert(e && typeof e.clientX === 'number', '_norm: pointer event required');
        const r = this._canvas.getBoundingClientRect();
        return {
            u: (e.clientX - r.left) / Math.max(1, r.width),
            v: 1 - (e.clientY - r.top) / Math.max(1, r.height)
        };
    }

    /** Paint under the pointer with the current tool. Rule 5: 2 asserts. */
    _paintAt(p) {
        console.assert(p && Number.isFinite(p.u), '_paintAt: point required');
        console.assert(this.view, '_paintAt: view required');
        const s = this.sim;
        if (!s || typeof s.paint !== 'function') return false;
        const cell = this.view.screenToCell(p.u, p.v, s.size);
        s.paint(cell.x, cell.y, this.tool === 'draw', this.brush);
        return true;
    }

    _setTool(tool) {
        console.assert(typeof tool === 'string', '_setTool: string required');
        console.assert(this._canvas !== undefined, '_setTool: canvas looked up');
        this.tool = tool;
        const ids = { pan: 'tool-pan', draw: 'tool-draw', erase: 'tool-erase' };
        for (const k of Object.keys(ids)) {                      // Rule 2: bounded (3)
            const b = document.getElementById(ids[k]);
            if (b) { b.classList.toggle('is-active', k === tool); b.setAttribute('aria-pressed', String(k === tool)); }
        }
        const c = document.getElementById('life-canvas');
        if (c) {
            c.classList.toggle('is-drawing', tool !== 'pan');
            c.classList.toggle('is-panning', tool === 'pan');
        }
        this._note(tool === 'pan' ? 'Drag to pan, wheel to zoom.' : 'Drag on the grid to ' + tool + '.');
        return true;
    }

    /**
     * Set one Lenia parameter and echo it. These are live uniforms read every step, so a
     * drag changes the world in real time rather than needing a reseed. Rule 5: 2 asserts.
     */
    _setLenia(key, v, outId, dp) {
        console.assert(typeof key === 'string', '_setLenia: key required');
        console.assert(Number.isFinite(v), '_setLenia: finite value');
        if (!this.sims.lenia || !Number.isFinite(v)) return false;
        this.sims.lenia[key] = v;
        const o = document.getElementById(outId);
        if (o) o.textContent = v.toFixed(dp);
        return true;
    }

    /** Point the three swatches at whatever the palette currently is. Rule 5: 2 asserts. */
    _syncSwatches() {
        console.assert(this.view, '_syncSwatches: view required');
        console.assert(typeof document !== 'undefined', '_syncSwatches: document required');
        if (typeof this.view.getStops !== 'function') return false;
        const st = this.view.getStops();
        const cs = (typeof this.view.getCellStops === 'function') ? this.view.getCellStops() : {};
        const map = { 'life-col-low': st.low, 'life-col-mid': st.mid, 'life-col-high': st.high,
                      'life-col-inner': cs.inner, 'life-col-outer': cs.outer };
        for (const id of Object.keys(map)) {                      // Rule 2: bounded (5)
            const el = document.getElementById(id);
            if (el && map[id]) el.value = map[id];
        }
        return true;
    }

    _setMu(v) {
        console.assert(Number.isFinite(v), '_setMu: finite value');
        console.assert(this.sims.lenia, '_setMu: lenia required');
        if (!Number.isFinite(v) || !this.sims.lenia) return false;
        this.sims.lenia.mu = v;
        const o = document.getElementById('life-mu-out'); if (o) o.textContent = v.toFixed(3);
        const r = document.getElementById('life-rule');
        if (r && this.mode === 'lenia') r.textContent = 'Lenia μ=' + v.toFixed(3);
        return true;
    }

    _toggleSound() {
        console.assert(typeof document !== 'undefined', '_toggleSound: document required');
        console.assert(this.mode !== undefined, '_toggleSound: mode set');
        // AudioContext must be created inside a user gesture or the browser leaves it
        // suspended — hence creating it here rather than in init().
        if (!this.audio && typeof SineAudio !== 'undefined') this.audio = new SineAudio({ volume: this.volume });
        this.soundOn = !this.soundOn;
        const b = document.getElementById('life-sound');
        if (b) { b.setAttribute('aria-pressed', String(this.soundOn)); b.textContent = this.soundOn ? '🔊 Sound' : '🔈 Sound'; }
        if (this.soundOn && this.audio) this.audio.ensure();
        return true;
    }

    /** Apply a B/S rule string; keep the old universe if it will not parse. Rule 5: 2 asserts. */
    _applyRule(str, inputEl) {
        console.assert(typeof str === 'string', '_applyRule: string required');
        console.assert(this.sims.conway !== undefined, '_applyRule: conway slot exists');
        const parsed = (typeof LifePatterns !== 'undefined') ? LifePatterns.parseRule(str) : null;
        const el = inputEl || document.getElementById('life-rule-input');
        if (!parsed || !this.sims.conway) { if (el) el.classList.add('invalid'); return false; }
        if (el) el.classList.remove('invalid');
        this.sims.conway.setRule(parsed.birth, parsed.survive);
        const label = document.getElementById('life-rule');
        if (label && this.mode === 'conway') label.textContent = str.toUpperCase();
        const known = LifePatterns.RULES.find(r => r.rule.toUpperCase() === str.trim().toUpperCase());
        this._note(known ? known.name + ' — ' + known.note : 'Custom rule ' + str.toUpperCase() + '.');
        return true;
    }

    /**
     * Draw the interaction matrix as a grid of cells, one per ordered species pair.
     * Rebuilt rather than diffed: it is at most 6x6 = 36 cells and only changes on an
     * explicit action, so a rebuild is simpler and cannot drift out of sync with the
     * simulation. Rule 4: <=60 lines | Rule 5: 2 asserts.
     */
    _drawMatrix() {
        console.assert(typeof document !== 'undefined', '_drawMatrix: document required');
        console.assert(this.sims !== undefined, '_drawMatrix: sims required');
        const host = document.getElementById('life-matrix');
        const sim = this.sims.particles;
        if (!host || !sim || typeof ParticleLife === 'undefined') return false;
        const N = sim.types;
        host.innerHTML = '';
        host.style.gridTemplateColumns = 'auto repeat(' + N + ', 1fr)';

        const swatch = (t) => {
            const c = ParticleLife.TYPE_COLOURS[t];
            return 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')';
        };
        const corner = document.createElement('div');
        corner.className = 'lm-corner';
        corner.textContent = '';
        host.appendChild(corner);
        for (let b = 0; b < N; b++) {                             // Rule 2: bounded (<=6)
            const h = document.createElement('div');
            h.className = 'lm-head';
            h.style.background = swatch(b);
            h.title = ParticleLife.TYPE_NAMES[b];
            host.appendChild(h);
        }
        for (let a = 0; a < N; a++) {                             // Rule 2: bounded (<=6)
            const rh = document.createElement('div');
            rh.className = 'lm-head';
            rh.style.background = swatch(a);
            rh.title = ParticleLife.TYPE_NAMES[a];
            host.appendChild(rh);
            for (let b = 0; b < N; b++) {                         // Rule 2: bounded (<=6)
                const v = sim.getForce(a, b);
                const cell = document.createElement('input');
                cell.type = 'range';
                cell.className = 'lm-cell';
                cell.min = '-100'; cell.max = '100'; cell.step = '5';
                cell.value = String(Math.round(v * 100));
                cell.setAttribute('aria-label',
                    ParticleLife.TYPE_NAMES[a] + ' towards ' + ParticleLife.TYPE_NAMES[b]);
                cell.title = ParticleLife.TYPE_NAMES[a] + ' \u2192 ' + ParticleLife.TYPE_NAMES[b] + ': ' + v.toFixed(2);
                this._paintMatrixCell(cell, v);
                cell.addEventListener('input', (e) => {
                    const nv = parseInt(e.target.value, 10) / 100;
                    sim.setForce(a, b, nv);
                    this._paintMatrixCell(e.target, nv);
                    e.target.title = ParticleLife.TYPE_NAMES[a] + ' \u2192 ' + ParticleLife.TYPE_NAMES[b] + ': ' + nv.toFixed(2);
                });
                host.appendChild(cell);
            }
        }
        return true;
    }

    /** Green pulls, red pushes, dark is indifference. Rule 5: 2 asserts. */
    _paintMatrixCell(el, v) {
        console.assert(el && el.style, '_paintMatrixCell: element required');
        console.assert(Number.isFinite(v), '_paintMatrixCell: finite value');
        const m = Math.min(1, Math.abs(v));
        const col = v >= 0 ? [60, 200, 120] : [220, 70, 60];
        el.style.background = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (0.12 + m * 0.75).toFixed(3) + ')';
        return true;
    }

    /** Centre a named Conway pattern. Rule 5: 2 asserts. */
    _loadPattern(name) {
        console.assert(typeof name === 'string', '_loadPattern: name required');
        console.assert(this.sims.conway !== undefined, '_loadPattern: conway slot exists');
        if (typeof LifePatterns === 'undefined' || !this.sims.conway) return false;
        const p = LifePatterns.get(name);
        if (!p) return false;
        const s = this.sims.conway;
        s.setPattern(p.cells, Math.floor((s.size - p.width) / 2), Math.floor((s.size - p.height) / 2));
        const m = LifePatterns.META[name];
        this._note(m ? m.label + ' — ' + m.group.toLowerCase() + ', ' + p.cells.length + ' cells.' : '');
        return true;
    }

    _note(text) {
        console.assert(typeof text === 'string', '_note: string required');
        console.assert(typeof document !== 'undefined', '_note: document required');
        const el = document.getElementById('life-note');
        if (el) el.textContent = text;
        return true;
    }

    _syncZoom() {
        console.assert(this.view, '_syncZoom: view required');
        console.assert(typeof document !== 'undefined', '_syncZoom: document required');
        const el = document.getElementById('life-zoom-out-label');
        if (el) el.textContent = this.view.zoom.toFixed(1) + '×';
        return true;
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

    /** Step the ACTIVE sim, draw it through the shared view. Rule 5: 2 asserts. */
    _loop() {
        console.assert(this.renderer, '_loop: renderer required');
        console.assert(this.view, '_loop: view required');
        this.raf = requestAnimationFrame(() => this._loop());
        const s = this.sim;
        if (!s) return;
        if (!this.paused) {
            const n = (this.mode === 'conway') ? this.speed : 1;   // Lenia's dt is its speed
            for (let i = 0; i < n; i++) s.step();                  // Rule 2: bounded (<=16)
        }
        if (this.mode === 'particles') {
            // Particles are geometry, not a state texture, so they draw themselves. The
            // shared view still supplies zoom and pan so the mode feels identical.
            s.render(this.view);
        } else {
            this.view.render(s.outputTexture, s.size);   // grid size drives the per-cell gradient
        }
        const now = performance.now();
        if (now - this._lastStatsAt > 500) { this._lastStatsAt = now; this._reportStats(now); }
    }

    /**
     * Population readback, throttled hard.
     *
     * readRenderTargetPixels STALLS the GPU pipeline — the CPU waits for everything queued
     * to finish. Per frame it would cost more than the simulation itself, so twice a
     * second. Rule 5: 2 asserts.
     */
    _reportStats(now) {
        console.assert(Number.isFinite(now), '_reportStats: timestamp required');
        console.assert(this.view, '_reportStats: view required');
        const s = this.sim;
        if (!s) return false;
        if (this.mode === 'particles') {
            const g = document.getElementById('life-gen');
            const p = document.getElementById('life-pop');
            if (g) g.textContent = 'step ' + s.generation;
            if (p) p.textContent = s.count + ' particles, ' + s.types + ' species';
            return true;
        }
        const n = s.size;
        const isConway = (this.mode === 'conway');
        const need = n * n * 4;
        if (!this._readBuf || this._readBuf.length !== need || this._readBufConway !== isConway) {
            this._readBuf = isConway ? new Uint8Array(need) : new Float32Array(need);
            this._readBufConway = isConway;
        }
        try {
            this.renderer.readRenderTargetPixels(s._targets[s._cur], 0, 0, n, n, this._readBuf);
        } catch (e) { return false; }
        let alive = 0, count = 0;
        const stride = isConway ? 4 : 16;                          // Lenia samples every 4th px
        const thresh = isConway ? 127 : 0.05;
        for (let i = 0; i < this._readBuf.length; i += stride) {   // Rule 2: bounded
            if (this._readBuf[i] > thresh) alive++;
            count++;
        }
        const g = document.getElementById('life-gen');
        const p = document.getElementById('life-pop');
        if (g) g.textContent = 'generation ' + (isConway ? s.generation : this._leniaGen(s));
        if (p) p.textContent = isConway ? ('population ' + alive)
                                        : ('population ' + (count ? (100 * alive / count).toFixed(1) : '0') + '%');
        if (this.soundOn && this.audio && !isConway && count && now - this._lastNoteAt > 2600) {
            const pct = 100 * alive / count;
            if (pct > 0.5) { this._lastNoteAt = now; this.audio.ambientPhrase(110 * Math.pow(2, Math.min(2, pct / 18)), 2); }
        }
        return true;
    }

    /** Lenia has no generation counter of its own; keep one here. */
    _leniaGen(s) {
        console.assert(s !== undefined, '_leniaGen: sim required');
        console.assert(typeof this._lgen === 'number' || this._lgen === undefined, '_leniaGen: counter');
        this._lgen = (this._lgen || 0) + 1;
        return this._lgen;
    }

    /** Free the WebGL context and everything hanging off it. Rule 5: 2 asserts. */
    cleanup() {
        console.assert(this !== undefined, 'cleanup: instance');
        console.assert(typeof cancelAnimationFrame === 'function', 'cleanup: rAF required');
        if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
        if (this._onHash) { window.removeEventListener('hashchange', this._onHash); this._onHash = null; }
        if (this._onKey) { document.removeEventListener('keydown', this._onKey); this._onKey = null; }
        const c = this._canvas;
        if (c) {
            if (this._onWheel) c.removeEventListener('wheel', this._onWheel);
            if (this._onDown) c.removeEventListener('pointerdown', this._onDown);
            if (this._onMove) c.removeEventListener('pointermove', this._onMove);
            if (this._onUp) {
                c.removeEventListener('pointerup', this._onUp);
                c.removeEventListener('pointercancel', this._onUp);
                c.removeEventListener('pointerleave', this._onUp);
            }
            this._canvas = null;
        }
        for (const k of Object.keys(this.sims)) {                 // Rule 2: bounded (3)
            if (this.sims[k]) { this.sims[k].dispose(); this.sims[k] = null; }
        }
        if (this.view) { this.view.dispose(); this.view = null; }
        if (this.audio) { this.audio.dispose(); this.audio = null; }
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

if (typeof window !== 'undefined') window.LifePage = LifePage;
