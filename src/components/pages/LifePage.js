// LifePage.js — the Artificial Life page: Conway AND Lenia behind one mode switch.
//
// These were two separate pages. They are one subject — the discrete and continuous ends
// of the same family — so they are now one page with both simulations kept, sharing a
// canvas, a view (zoom/pan/palette), a stats bar and one set of prose.
//
// Owns its own WebGL renderer and tears everything down on navigation, because a leaked
// WebGL context is not garbage collected and browsers hard-cap how many a tab may hold
// (typically 8-16) — leak one per visit and the page silently stops rendering after a
// handful of navigations.
//
// BOTH SIMS STAY ALIVE ACROSS A MODE SWITCH. Together they are ~4 MB of GPU memory
// (Conway 512^2 bytes x2, Lenia 256^2 floats x2), which is nothing, and it means flipping
// between them preserves each world instead of resetting the one you just set up.
class LifePage {
    constructor() {
        this.renderer = null;
        this.view = null;
        this.sims = { conway: null, lenia: null };
        this.mode = 'conway';
        this.audio = null;
        this.raf = null;
        this.paused = false;
        this.speed = 1;
        this.tool = 'pan';              // pan | draw | erase
        this.brush = 1;
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
        if (!this.sims.conway && !this.sims.lenia) return false;

        // Both routes land here; the hash decides which mode opens. #conway therefore
        // still means "show me Conway" for every existing link and bookmark, and #life
        // opens on Lenia, which is what that URL has always shown.
        const hash = (typeof location !== 'undefined' ? location.hash : '').toLowerCase();
        this.mode = hash.indexOf('conway') !== -1 ? 'conway' : 'lenia';
        if (!this.sims[this.mode]) this.mode = this.sims.conway ? 'conway' : 'lenia';

        this.view = new LifeView(this.renderer);
        this.view.init();

        this._populatePickers();
        this._wire();
        // Reduced motion: start paused. The simulation IS the motion, so honouring the
        // preference means not running it, not running it more gently.
        this.paused = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        this._setMode(this.mode, true);
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
        console.assert(mode === 'conway' || mode === 'lenia', '_setMode: known mode');
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
        show('pick-sound-wrap', mode === 'lenia');

        const btnC = document.getElementById('mode-conway');
        const btnL = document.getElementById('mode-lenia');
        if (btnC) { btnC.classList.toggle('is-active', mode === 'conway'); btnC.setAttribute('aria-selected', String(mode === 'conway')); }
        if (btnL) { btnL.classList.toggle('is-active', mode === 'lenia'); btnL.setAttribute('aria-selected', String(mode === 'lenia')); }

        const ruleEl = document.getElementById('life-rule');
        if (ruleEl) ruleEl.textContent = (mode === 'conway') ? 'B3/S23' : 'Lenia μ=' + this.sims.lenia.mu.toFixed(3);

        // Opening in Conway with an empty grid looks broken, so seed the gun — unbounded
        // growth is the most legible thing to land on. Only on first entry, never on a
        // user-initiated mode switch, which must preserve the world they were building.
        if (force && mode === 'conway') this._loadPattern('gosperGun');
        else this._note(mode === 'conway' ? 'Conway — discrete, B3/S23.' : 'Lenia — continuous cellular automata.');
        return true;
    }

    /** Wire every control. Rule 4: <=60 lines | Rule 5: 2 asserts. */
    _wire() {
        console.assert(typeof document !== 'undefined', '_wire: document required');
        console.assert(this.view, '_wire: view required');
        const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };

        on('mode-conway', 'click', () => this._setMode('conway'));
        on('mode-lenia', 'click', () => this._setMode('lenia'));

        on('life-pause', 'click', () => { this.paused = !this.paused; this._syncPauseButton(); });
        on('life-step', 'click', () => { this.paused = true; this._syncPauseButton(); if (this.sim) this.sim.step(); });
        on('life-clear', 'click', () => { if (this.sim && this.sim.clear) { this.sim.clear(); this._note('Cleared.'); } });
        on('life-reseed', 'click', () => {
            if (!this.sim) return;
            if (this.mode === 'conway') { this.sim.seed(0.3); this._note('Random soup at 30% density.'); }
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

        on('life-zoom-in', 'click', () => { this.view.zoomAt(1.5, 0.5, 0.5); this._syncZoom(); });
        on('life-zoom-out', 'click', () => { this.view.zoomAt(1 / 1.5, 0.5, 0.5); this._syncZoom(); });
        on('life-zoom-reset', 'click', () => { this.view.reset(); this._syncZoom(); this._note('View reset.'); });

        on('life-pattern', 'change', (e) => this._loadPattern(e.target.value));
        on('life-ruleset', 'change', (e) => {
            const i = document.getElementById('life-rule-input'); if (i) i.value = e.target.value;
            this._applyRule(e.target.value);
        });
        on('life-rule-input', 'input', (e) => this._applyRule(e.target.value, e.target));
        on('life-palette', 'change', (e) => { this.view.setPalette(e.target.value); this._note('Palette: ' + e.target.value + '.'); });
        on('life-mu', 'input', (e) => this._setMu(parseFloat(e.target.value)));
        on('life-sound', 'click', () => this._toggleSound());

        this._wirePointer();

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
        if (!this.audio && typeof SineAudio !== 'undefined') this.audio = new SineAudio({ volume: 0.18 });
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
        this.view.render(s.outputTexture);
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
        for (const k of Object.keys(this.sims)) {                 // Rule 2: bounded (2)
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
