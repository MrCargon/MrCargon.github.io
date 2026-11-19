// AtmosphereLayers.js - the five named atmospheric layers around Earth, revealed
// with a staggered "cascade" animation on explore enter and retracted on exit.
//
// Real layer order (Troposphere → Exosphere). All five are drawn by ONE shell with ONE
// shader (one draw call): for each pixel it measures how far the view ray travels inside
// each layer and adds that layer's faint colour in proportion. That is a thin-gas glow:
// bright in a soft band just past the limb, almost nothing over the face of the globe,
// no flat grey disc. Layer edges are feathered so the bands blend instead of ringing.
// Radii stay EXAGGERATED (true thicknesses are <0.2% of Earth's radius) but thin.
//
// The names sit in a screen-space ladder beside the limb with leader lines: one column,
// never overlapping itself, placed on the first side that clears the nav bar, footer and
// panels; hidden when no side is free, and shown again while the pointer hovers the limb.
//
// global THREE (r184, republished from an ES module by index.html), classic script (no modules). NASA Power-of-10 style:
// bounded loops, >=2 asserts/method, methods <=60 lines, no per-frame allocation.
class AtmosphereLayers {
    /**
     * @param {THREE.Mesh} earthMesh - globe mesh; the shell is parented to it
     * @param {number} radius - globe radius (sphere units)
     * @param {Object} [options]
     */
    constructor(earthMesh, radius, options) {
        console.assert(earthMesh && earthMesh.isObject3D, 'AtmosphereLayers: earthMesh required');
        console.assert(Number.isFinite(radius) && radius > 0, 'AtmosphereLayers: radius required');
        var opts = options || {};
        this.earthMesh = earthMesh;
        this.radius = radius;
        this.built = false;
        this._disposed = false;
        this._raf = 0;
        this.reducedMotion = (typeof window !== 'undefined' && window.matchMedia)
            ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
        // Fade the whole atmosphere out as the camera approaches (far/mid-view feature).
        this.fadeNear = Number.isFinite(opts.fadeNear) ? opts.fadeNear : 1.35; // gone below
        this.fadeFar = Number.isFinite(opts.fadeFar) ? opts.fadeFar : 1.9;     // full above
        this._zoomFade = 1;
        // name | top radius (R) | colour | glow per unit path (R) | real altitude | note
        this.defs = [
            { name: 'Troposphere',  top: 1.012, color: 0x7cc4ff, peak: 0.55, alt: '0–12 km', info: 'weather, clouds, airliners' },
            { name: 'Stratosphere', top: 1.028, color: 0x5d9bf0, peak: 0.46, alt: '12–50 km', info: 'ozone layer, balloons' },
            { name: 'Mesosphere',   top: 1.046, color: 0x6a7ee0, peak: 0.38, alt: '50–85 km', info: 'meteors burn up here' },
            { name: 'Thermosphere', top: 1.085, color: 0x8b6fd6, peak: 0.28, alt: '85–600 km', info: 'aurora, the ISS orbits here' },
            { name: 'Exosphere',    top: 1.160, color: 0x7a62b8, peak: 0.18, alt: '600–10,000 km', info: 'thins out into space' }
        ];
        this.shells = [];        // per-layer runtime state (cascade); all share this.mesh
        this.mesh = null;        // the single banded shell
        this.material = null;
        this.labels = [];        // DOM label elements (one per layer)
        this._ladder = null;     // the labels' container
        this._svg = null;        // leader lines
        this._lines = [];
        this._labelsShown = false;
        this._obst = [];         // cached obstacle rects {l,t,r,b}
        this._obstAt = -1e9;
        this._pointer = { x: -1, y: -1, at: -1e9 };
        this._onPointer = null;
        this._labelW = new Float32Array(5);
        this._labelH = new Float32Array(5);
        this._wr = new Float64Array(AtmosphereLayers.WR_SIZE).fill(NaN);   // last written ladder values
        this._scale = null;      // R1 #6: "not to scale" caption under the ladder
        this._scaleW = 0; this._scaleH = 0;
        var V = (typeof THREE !== 'undefined') ? THREE.Vector3 : null;
        this._sCenter = V ? new V() : null; this._sRight = V ? new V() : null;
        this._sUp = V ? new V() : null; this._sZ = V ? new V() : null;
        this._sAnchor = V ? new V() : null; this._sCam = V ? new V() : null;
        this._sToCam = V ? new V() : null;
        this._ax = new Float32Array(5); this._ay = new Float32Array(5);   // anchors (px)
    }

    // Lazily build the single banded shell (hidden, every layer at 0). Rule 4: <=60 lines.
    build() {
        console.assert(this.earthMesh, 'AtmosphereLayers.build: earthMesh required');
        console.assert(Array.isArray(this.defs) && this.defs.length === 5, 'AtmosphereLayers.build: 5 defs required');
        if (this.built || this._disposed || typeof THREE === 'undefined') return false;
        var n = this.defs.length, tops = [], cols = [], amt = [];
        for (var i = 0; i < n; i++) {
            tops.push(this.defs[i].top);
            var h = this.defs[i].color;    // display-space colour, no sRGB lift: a thin haze stays thin
            cols.push(new THREE.Vector3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255));
            amt.push(0);
        }
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uR: { value: this.radius }, uTop: { value: tops },
                uColor: { value: cols }, uAmt: { value: amt }
            },
            vertexShader: AtmosphereLayers.VERT, fragmentShader: AtmosphereLayers.FRAG,
            transparent: true, depthWrite: false, side: THREE.DoubleSide,
            // Pure additive light on a transparent canvas: colour ONE+ONE, and alpha grows
            // only by the glow's own strength, so the halo never turns the canvas opaque
            // (plain AdditiveBlending with alpha 1 hid the page backdrop around the globe).
            blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
            blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
            blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor
        });
        var outer = this.radius * this.defs[n - 1].top * 1.02;      // room for the feather
        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(outer, 64, 40), this.material);
        this.mesh.name = 'AtmosphereLayers';
        this.mesh.visible = false;
        this.mesh.renderOrder = 2;                                  // after the surface/overlays
        this.earthMesh.add(this.mesh);
        for (var j = 0; j < n; j++) {
            var d = this.defs[j];
            this.shells.push({ mesh: this.mesh, peak: d.peak, cur: 0, target: 0, startAt: 0,
                name: d.name, top: d.top, bottom: j ? this.defs[j - 1].top : 1.0 });
        }
        this._buildLabels();
        this.built = true;
        return true;
    }

    // Push each layer's cascade × zoom into the shader; show the mesh only if any is lit.
    _applyUniforms() {
        console.assert(Array.isArray(this.shells), '_applyUniforms: shells expected');
        console.assert(typeof this._zoomFade === 'number', '_applyUniforms: zoomFade expected');
        if (!this.material) return false;
        var amt = this.material.uniforms.uAmt.value, any = false;
        for (var i = 0; i < this.shells.length; i++) {
            var s = this.shells[i];
            amt[i] = s.cur * this._zoomFade;
            if (amt[i] > 0.002) any = true;
        }
        this.mesh.visible = any;
        return any;
    }

    // Create the ladder: one label per layer + one SVG of leader lines. Rule 4: <=60 lines.
    _buildLabels() {
        console.assert(Array.isArray(this.shells), '_buildLabels: shells expected');
        console.assert(typeof document !== 'undefined', '_buildLabels: document required');
        if (typeof document === 'undefined' || this.labels.length) return false;
        var NS = 'http://www.w3.org/2000/svg';
        this._wr.fill(NaN);                                    // new elements: nothing written yet
        this._svg = document.createElementNS(NS, 'svg');
        this._svg.setAttribute('aria-hidden', 'true');
        this._svg.style.cssText = 'position:fixed; inset:0; width:100vw; height:100vh; z-index:35; ' +
            'pointer-events:none; visibility:hidden; overflow:visible;';
        this._ladder = document.createElement('div');
        this._ladder.className = 'atmo-ladder';
        this._ladder.setAttribute('role', 'list');
        this._ladder.setAttribute('aria-label', 'Atmosphere layers');
        this._ladder.style.cssText = 'position:fixed; left:0; top:0; z-index:36; visibility:hidden; pointer-events:none;';
        for (var i = 0; i < this.shells.length; i++) {
            var d = this.defs[i];
            var ln = document.createElementNS(NS, 'line');
            ln.setAttribute('stroke', 'rgba(150,170,240,0.55)');
            ln.setAttribute('stroke-width', '1');
            this._svg.appendChild(ln);
            this._lines.push(ln);
            var el = document.createElement('div');
            el.className = 'atmo-label';
            el.setAttribute('role', 'listitem');
            el.tabIndex = i === 0 ? 0 : -1;                         // R3 #10: one Tab stop (roving)
            el.title = d.name + ' · ' + d.alt + ' · ' + d.info;
            el.setAttribute('aria-label', d.name + ', ' + d.alt + ': ' + d.info);
            el.innerHTML = '<span class="atmo-name"></span><span class="atmo-info"></span>';
            el.firstChild.textContent = d.name;
            el.lastChild.textContent = ' ' + d.alt + ' · ' + d.info;
            el.style.cssText = 'position:fixed; left:0; top:0; pointer-events:auto; cursor:default; ' +
                'font:600 11px/1.25 system-ui,-apple-system,sans-serif; color:#dfe4ff; white-space:nowrap; ' +
                'padding:2px 7px; border-radius:8px; background:rgba(10,16,36,0.62); ' +
                'border:1px solid ' + AtmosphereLayers._css(d.color, 0.55) + '; ' +
                'text-shadow:0 0 5px rgba(8,14,40,0.95); will-change:transform; outline-offset:1px;';
            el.lastChild.style.cssText = 'display:none; font-weight:400; color:#b9c2ee;';
            AtmosphereLayers._wireInfo(el);
            this._ladder.appendChild(el);
            this.labels.push(el);
        }
        this._ladder.addEventListener('keydown', this._onLadderKey.bind(this));
        document.body.appendChild(this._svg);
        document.body.appendChild(this._ladder);
        this._orderAfterPanel();
        this._buildScaleNote();
        this._onPointer = this._trackPointer.bind(this);
        window.addEventListener('pointermove', this._onPointer, { passive: true });
        return true;
    }

    // R1 #6: one small caption under the ladder. The bands are drawn stretched (the
    // troposphere x6.4, the exosphere x0.1 of its real depth) while the ISS and every
    // satellite sit at their true km, so objects can look like they are in the "wrong" band.
    // Its own element beside the list (a list may hold only listitems). Rule 5: 2 asserts.
    _buildScaleNote() {
        console.assert(typeof document !== 'undefined', '_buildScaleNote: document required');
        console.assert(this._ladder, '_buildScaleNote: ladder required');
        var el = document.createElement('div');
        el.className = 'atmo-scale';
        var lines = ['Bands not to scale (×0.1–×6)', 'Satellites: true scale'];
        for (var i = 0; i < lines.length; i++) {                  // Rule 2: bounded (2)
            var ln = document.createElement('span');
            ln.style.display = 'block'; ln.textContent = lines[i];
            el.appendChild(ln);
        }
        el.style.cssText = 'position:fixed; left:0; top:0; z-index:36; visibility:hidden; pointer-events:none; ' +
            'white-space:nowrap; font:400 10px/1.3 system-ui,-apple-system,sans-serif; ' +
            'color:#aab3dd; text-shadow:0 0 5px rgba(8,14,40,0.95); will-change:transform;';
        document.body.appendChild(el);
        this._scale = el;
        return true;
    }

    // R3 #10: the ladder is ONE Tab stop (roving tabindex); arrows / Home / End move
    // between the five labels, so a keyboard user is not walked through them one by one.
    _onLadderKey(ev) {
        console.assert(ev && typeof ev.key === 'string', '_onLadderKey: key event required');
        console.assert(Array.isArray(this.labels), '_onLadderKey: labels expected');
        var n = this.labels.length, at = this.labels.indexOf(document.activeElement);
        if (at < 0 || !n) return false;
        var to = at;
        if (ev.key === 'ArrowUp' || ev.key === 'ArrowRight') to = Math.min(n - 1, at + 1);
        else if (ev.key === 'ArrowDown' || ev.key === 'ArrowLeft') to = Math.max(0, at - 1);
        else if (ev.key === 'Home') to = 0;
        else if (ev.key === 'End') to = n - 1;
        else return false;
        ev.preventDefault();
        for (var i = 0; i < n; i++) this.labels[i].tabIndex = i === to ? 0 : -1;   // Rule 2: bounded (5)
        this.labels[to].focus();
        return true;
    }

    // R3 #10: keep the ladder AFTER the Explore panel in the DOM, so Tab reaches the
    // panel first. The panel is moved to <body> on entering Explore (after the ladder was
    // built), so this re-checks; both are position:fixed body children, so nothing moves
    // on screen. Never moves the ladder while it holds focus (a move would blur it).
    _orderAfterPanel() {
        console.assert(typeof document !== 'undefined', '_orderAfterPanel: document required');
        console.assert(this._ladder, '_orderAfterPanel: ladder required');
        var panel = document.getElementById('explore-panel'), lad = this._ladder;
        if (!panel || panel.parentNode !== document.body || lad.contains(document.activeElement)) return false;
        if (panel.compareDocumentPosition(lad) & Node.DOCUMENT_POSITION_FOLLOWING) return false;
        panel.after(lad);
        return true;
    }

    // Hover/focus a label → its altitude + note expand inline (bounded: 4 listeners).
    static _wireInfo(el) {
        console.assert(el && el.lastChild, '_wireInfo: label required');
        console.assert(typeof el.addEventListener === 'function', '_wireInfo: element required');
        var on = function () { el.lastChild.style.display = 'inline'; };
        var off = function () { if (document.activeElement !== el) el.lastChild.style.display = 'none'; };
        el.addEventListener('pointerenter', on); el.addEventListener('focus', on);
        el.addEventListener('pointerleave', off);
        el.addEventListener('blur', function () { el.lastChild.style.display = 'none'; });
        return true;
    }

    // Set an SVG attribute to v.toFixed(1), only when v moved to another tenth since the
    // last write in slot i of w (R2 #8: no string per frame). Rule 5: 2 asserts.
    static _attr1(el, name, v, w, i) {
        console.assert(el && typeof el.setAttribute === 'function', '_attr1: element required');
        console.assert(Number.isFinite(v) && i >= 0 && i < w.length, '_attr1: value/slot required');
        var t = Math.round(v * 10);
        if (w[i] === t) return false;
        w[i] = t;
        el.setAttribute(name, v.toFixed(1));
        return true;
    }

    static _css(hex, a) {
        return 'rgba(' + ((hex >> 16) & 255) + ',' + ((hex >> 8) & 255) + ',' + (hex & 255) + ',' + a + ')';
    }

    _trackPointer(ev) {
        this._pointer.x = ev.clientX; this._pointer.y = ev.clientY;
        this._pointer.at = AtmosphereLayers._now();
    }

    // Refresh the rects the ladder must avoid (nav, footer, panels), at most 2×/s.
    _refreshObstacles(now) {
        console.assert(Array.isArray(this._obst), '_refreshObstacles: cache expected');
        console.assert(Number.isFinite(now), '_refreshObstacles: time required');
        if (now - this._obstAt < 500) return false;
        this._obstAt = now;
        this._obst.length = 0;
        this._orderAfterPanel();
        var nodes = document.querySelectorAll(AtmosphereLayers.AVOID);
        for (var i = 0; i < nodes.length && i < 40; i++) {
            var el = nodes[i];
            if (el.hidden || el.closest('.atmo-ladder')) continue;
            var b = el.getBoundingClientRect();
            if (b.width < 1 || b.height < 1) continue;
            var cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
            this._obst.push({ l: b.left - 6, t: b.top - 6, r: b.right + 6, b: b.bottom + 6 });
        }
        for (var j = 0; j < this.labels.length; j++) {          // label sizes, measured while laid out
            var lb = this.labels[j].getBoundingClientRect();
            if (lb.width > 0) { this._labelW[j] = lb.width; this._labelH[j] = lb.height; }
            else if (!this._labelW[j]) { this._labelW[j] = 96; this._labelH[j] = 19; }
        }
        if (this._scale) {
            var sb = this._scale.getBoundingClientRect();
            if (sb.width > 0) { this._scaleW = sb.width; this._scaleH = sb.height; }
            else if (!this._scaleW) { this._scaleW = 150; this._scaleH = 26; }
        }
        return true;
    }

    // Screen-space limb geometry for this frame: centre (px), and anchor point of every
    // layer on its silhouette at screen angle `ang` (radians, y up). Rule 4: <=60.
    _limb(camera, rect, ang) {
        console.assert(camera && camera.isCamera, '_limb: camera required');
        console.assert(Number.isFinite(ang), '_limb: angle required');
        var C = this._sCenter, cam = this._sCam.setFromMatrixPosition(camera.matrixWorld);
        var d = cam.distanceTo(C);
        this._sToCam.copy(cam).sub(C).normalize();
        var ca = Math.cos(ang), sa = Math.sin(ang);
        for (var i = 0; i < this.shells.length; i++) {
            var s = this.shells[i];
            var r = this.radius * (s.bottom + s.top) * 0.5;      // middle of the layer
            if (r >= d) return false;
            var k = r / d, back = r * k, side = r * Math.sqrt(1 - k * k);   // silhouette circle
            this._sAnchor.copy(C).addScaledVector(this._sToCam, back)
                .addScaledVector(this._sRight, side * ca).addScaledVector(this._sUp, side * sa);
            this._sAnchor.project(camera);
            if (this._sAnchor.z > 1) return false;
            this._ax[i] = rect.left + (this._sAnchor.x * 0.5 + 0.5) * rect.width;
            this._ay[i] = rect.top + (-this._sAnchor.y * 0.5 + 0.5) * rect.height;
        }
        return true;
    }

    // Try to fit the ladder for the anchors in _ax/_ay. Writes the column into `out`
    // ({x, y, right}) and returns true when every label is on screen and clear. `inward`
    // (hover only) puts the column inside the limb, over the globe. Rule 4.
    _fitLadder(rect, ang, out, inward) {
        console.assert(out && typeof out === 'object', '_fitLadder: out required');
        console.assert(this._obst, '_fitLadder: obstacles expected');
        var n = this.shells.length, right = (Math.cos(ang) >= 0) !== !!inward, gap = 4, h = 0, w = 0, i, j;
        for (i = 0; i < n; i++) { h += this._labelH[i] + gap; w = Math.max(w, this._labelW[i]); }
        h -= gap;
        if (this._scale) { h += gap + this._scaleH; w = Math.max(w, this._scaleW); }   // caption row
        var reach = right ? -1e9 : 1e9;
        for (i = 0; i < n; i++) reach = right ? Math.max(reach, this._ax[i]) : Math.min(reach, this._ax[i]);
        var x = right ? reach + 26 : reach - 26 - w;
        var y = this._ay[n >> 1] - h * 0.5;
        var vw = (typeof window !== 'undefined') ? window.innerWidth : rect.width;
        var vh = (typeof window !== 'undefined') ? window.innerHeight : rect.height;
        if (x < 6 || x + w > vw - 6 || y < 6 || y + h > vh - 6) return false;
        for (j = 0; j < this._obst.length; j++) {
            var o = this._obst[j];
            if (x < o.r && o.l < x + w && y < o.b && o.t < y + h) return false;
        }
        out.x = x; out.y = y; out.right = right; out.w = w;
        return true;
    }

    // Place the ladder: hovered limb angle first, else the default sides. Rule 4: <=60.
    updateLabels(camera, rect) {
        console.assert(camera && camera.isCamera, 'updateLabels: camera required');
        console.assert(rect && Number.isFinite(rect.width), 'updateLabels: rect required');
        if (!this.built || this._disposed || !this._sCenter || !this._ladder) return false;
        var lit = 0;
        for (var i = 0; i < this.shells.length; i++) lit = Math.max(lit, this.shells[i].cur / this.shells[i].peak);
        var op = lit * this._zoomFade;
        if (op < 0.03) return this._showLadder(false);
        var now = AtmosphereLayers._now();
        this._refreshObstacles(now);
        this.earthMesh.getWorldPosition(this._sCenter);
        camera.matrixWorld.extractBasis(this._sRight, this._sUp, this._sZ);
        var fit = this._fitOut || (this._fitOut = { x: 0, y: 0, right: true, w: 0 });
        var ok = false, hoverAng = this._hoverAngle(camera, rect, now);
        var cands = AtmosphereLayers.ANGLES;
        if (hoverAng !== null) {                   // hovered: outside the limb, else just inside it
            ok = this._limb(camera, rect, hoverAng) &&
                (this._fitLadder(rect, hoverAng, fit, false) || this._fitLadder(rect, hoverAng, fit, true));
        }
        for (var c = 0; !ok && c < cands.length; c++) {
            ok = this._limb(camera, rect, cands[c]) && this._fitLadder(rect, cands[c], fit, false);
        }
        if (!ok) return this._showLadder(false);
        this._placeLadder(fit, Math.min(0.96, op));
        return this._showLadder(true);
    }

    // Pointer near the limb (between the globe edge and the outer glow, recent move) →
    // the screen angle it points at, else null. Rule 5: 2 asserts.
    _hoverAngle(camera, rect, now) {
        console.assert(camera && rect, '_hoverAngle: camera + rect required');
        console.assert(Number.isFinite(now), '_hoverAngle: time required');
        if (now - this._pointer.at > 4000) return null;
        this._sAnchor.copy(this._sCenter).project(camera);
        var cx = rect.left + (this._sAnchor.x * 0.5 + 0.5) * rect.width;
        var cy = rect.top + (-this._sAnchor.y * 0.5 + 0.5) * rect.height;
        if (!this._limb(camera, rect, 0)) return null;
        var rIn = this._ax[0] - cx, rOut = this._ax[this.shells.length - 1] - cx;
        var dx = this._pointer.x - cx, dy = this._pointer.y - cy, dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < rIn * 0.97 || dd > rOut + 18) return null;
        return Math.atan2(-dy, dx);
    }

    // Write the ladder column + leader lines (transform/attr writes only). Rule 4: <=60.
    _placeLadder(fit, op) {
        console.assert(fit && Number.isFinite(fit.x), '_placeLadder: fit required');
        console.assert(Number.isFinite(op), '_placeLadder: opacity required');
        // R2 #8: write a value only when its rounded form changes (the strings were ~470 KB
        // of garbage per 4 s). _wr holds the last written whole px / tenths per slot.
        var n = this.shells.length, y = fit.y, w = this._wr, b;
        for (var k = n - 1; k >= 0; k--) {                    // Exosphere on top, Troposphere at the bottom
            var el = this.labels[k], h = this._labelH[k];
            var lx = fit.right ? fit.x : fit.x + fit.w - this._labelW[k];
            var tx = Math.round(lx), ty = Math.round(y);
            b = k * 6;
            if (w[b] !== tx || w[b + 1] !== ty) {
                w[b] = tx; w[b + 1] = ty;
                el.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
            }
            var ln = this._lines[k];
            AtmosphereLayers._attr1(ln, 'x1', this._ax[k], w, b + 2);
            AtmosphereLayers._attr1(ln, 'y1', this._ay[k], w, b + 3);
            AtmosphereLayers._attr1(ln, 'x2', fit.right ? lx - 2 : lx + this._labelW[k] + 2, w, b + 4);
            AtmosphereLayers._attr1(ln, 'y2', y + h * 0.5, w, b + 5);
            y += h + 4;
        }
        if (this._scale) {                                    // caption under the Troposphere label
            var sx = Math.round(fit.right ? fit.x : fit.x + fit.w - this._scaleW), sy = Math.round(y);
            b = AtmosphereLayers.WR_SCALE;
            if (w[b] !== sx || w[b + 1] !== sy) {
                w[b] = sx; w[b + 1] = sy;
                this._scale.style.transform = 'translate(' + sx + 'px,' + sy + 'px)';
            }
            var side = fit.right ? 1 : 0;
            if (w[b + 2] !== side) { w[b + 2] = side; this._scale.style.textAlign = side ? 'left' : 'right'; }
        }
        var oi = Math.round(op * 100);
        if (w[AtmosphereLayers.WR_OP] !== oi) {             // only writer of these opacities
            var o = op.toFixed(2);
            w[AtmosphereLayers.WR_OP] = oi;
            this._ladder.style.opacity = o; this._svg.style.opacity = o;
            if (this._scale) this._scale.style.opacity = o;
        }
        return true;
    }

    // Show/hide the ladder; writes the DOM only when the state changes.
    _showLadder(on) {
        console.assert(typeof on === 'boolean', '_showLadder: boolean required');
        console.assert(this._ladder !== undefined, '_showLadder: ladder field expected');
        if (!this._ladder || this._labelsShown === on) return on;
        this._labelsShown = on;
        this._ladder.style.visibility = on ? 'visible' : 'hidden';
        this._svg.style.visibility = on ? 'visible' : 'hidden';
        if (this._scale) this._scale.style.visibility = on ? 'visible' : 'hidden';
        return on;
    }

    // Cascade the layers IN (inner→outer, staggered). Rule 5: 2 asserts.
    cascadeIn() {
        console.assert(this.earthMesh, 'cascadeIn: earthMesh required');
        console.assert(this.shells, 'cascadeIn: shells expected');
        if (!this.built) this.build();
        var now = AtmosphereLayers._now();
        for (var i = 0; i < this.shells.length; i++) {
            var s = this.shells[i];
            s.target = s.peak;
            s.startAt = this.reducedMotion ? now : (now + i * 130);  // staggered reveal
        }
        this._start();
        return true;
    }

    // Cascade the layers OUT (outer→inner, staggered). Rule 5: 2 asserts.
    cascadeOut() {
        console.assert(this.shells, 'cascadeOut: shells expected');
        console.assert(typeof this._start === 'function', 'cascadeOut: animator expected');
        var now = AtmosphereLayers._now();
        var n = this.shells.length;
        for (var i = 0; i < n; i++) {
            var s = this.shells[i];
            s.target = 0;
            s.startAt = this.reducedMotion ? now : (now + (n - 1 - i) * 110);  // outer first
        }
        // Hide the ladder now: the explore loop (which places it) stops on exit.
        this._showLadder(false);
        this._start();
        return true;
    }

    // Per-frame zoom fade: hide the atmosphere as the camera zooms close. Rule 5: 2 asserts.
    update(cameraDistInRadii) {
        console.assert(Number.isFinite(cameraDistInRadii), 'update: distance required');
        console.assert(this.shells, 'update: shells expected');
        var k = (cameraDistInRadii - this.fadeNear) / (this.fadeFar - this.fadeNear);
        k = Math.max(0, Math.min(1, k));
        this._zoomFade = k * k * (3 - 2 * k);                 // smoothstep: no visible kink
        this._applyUniforms();
        return true;
    }

    // ---- internal animator -------------------------------------------------

    static _now() {
        return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    }

    // Start the single rAF that eases every layer toward its target. Rule 5: 2 asserts.
    _start() {
        console.assert(this.shells, '_start: shells expected');
        console.assert(!this._disposed, '_start: not disposed');
        if (this._raf || this._disposed) return;
        if (typeof requestAnimationFrame === 'undefined') { this._settleInstant(); return; }
        var self = this;
        var tick = function () {
            self._raf = 0;
            if (self._disposed) return;
            if (self._step()) self._raf = requestAnimationFrame(tick);   // keep going until settled
        };
        this._raf = requestAnimationFrame(tick);
    }

    // Advance all layers one frame; returns true while any is still animating. Rule 4: <=60.
    _step() {
        console.assert(this.shells, '_step: shells expected');
        console.assert(typeof this._zoomFade === 'number', '_step: zoomFade expected');
        var now = AtmosphereLayers._now();
        var moving = false;
        for (var i = 0; i < this.shells.length; i++) {
            var s = this.shells[i];
            if (now < s.startAt) { moving = true; continue; }            // still in its stagger delay
            var diff = s.target - s.cur;
            if (Math.abs(diff) > 0.0008) {
                s.cur += diff * (this.reducedMotion ? 1 : 0.12);
                moving = true;
            } else {
                s.cur = s.target;
            }
        }
        this._applyUniforms();
        return moving;
    }

    _settleInstant() {
        for (var i = 0; i < this.shells.length; i++) this.shells[i].cur = this.shells[i].target;
        this._applyUniforms();
    }

    // Free the shell (geometry + material), the ladder + cancel the rAF. Rule 5: 2 asserts.
    dispose() {
        console.assert(this.earthMesh !== undefined, 'dispose: earthMesh field expected');
        console.assert(Array.isArray(this.shells), 'dispose: shells array expected');
        this._disposed = true;
        if (this._raf && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this._raf);
        this._raf = 0;
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.material.dispose();
            if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
        }
        this.mesh = null; this.material = null; this.shells = [];
        if (this._onPointer && typeof window !== 'undefined') window.removeEventListener('pointermove', this._onPointer);
        if (this._ladder && this._ladder.parentNode) this._ladder.parentNode.removeChild(this._ladder);
        if (this._svg && this._svg.parentNode) this._svg.parentNode.removeChild(this._svg);
        if (this._scale && this._scale.parentNode) this._scale.parentNode.removeChild(this._scale);
        this._scale = null;
        this._ladder = null; this._svg = null; this._lines = []; this.labels = [];
        this.built = false;
        return true;
    }
}

AtmosphereLayers.WR_SCALE = 30;      // _wr slots: 6 per label (5 labels), then the caption x, y, side,
AtmosphereLayers.WR_OP = 33;         // then the opacity in hundredths
AtmosphereLayers.WR_SIZE = 34;
// Elements the ladder must never cover (nav bar, footer, Explore panel, planet bar, popups).
AtmosphereLayers.AVOID = '#header-container > *, #footer-container > *, header, footer, nav, ' +
    '#explore-panel, .planet-selector-wrapper, .action-buttons-row, #time-panel-inline, ' +
    '.side-popup .popup-content, .side-popup .popup-tab, [data-atmo-avoid]';
// Default ladder sides (screen angle of the anchor, y up): upper right, lower right,
// upper left, lower left, then straight right/left.
AtmosphereLayers.ANGLES = [0.62, -0.62, Math.PI - 0.62, Math.PI + 0.62, 0, Math.PI];

AtmosphereLayers.VERT = [
    'varying vec3 vWorld;',
    'varying vec3 vCenter;',
    'varying float vScale;',
    'void main() {',
    '  vec4 w = modelMatrix * vec4(position, 1.0);',
    '  vWorld = w.xyz;',
    '  vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;',
    '  vScale = length(modelMatrix[0].xyz);',
    '  gl_Position = projectionMatrix * viewMatrix * w;',
    '}'
].join('\n');

// Path length of the view ray inside each layer, feathered over 3 radii so the band
// edges blend, times that layer's colour and amount. Ray is clipped at the planet.
AtmosphereLayers.FRAG = [
    'uniform float uR;',
    'uniform float uTop[5];',
    'uniform vec3 uColor[5];',
    'uniform float uAmt[5];',
    'varying vec3 vWorld;',
    'varying vec3 vCenter;',
    'varying float vScale;',
    'float inside(float b, float c0, float r, float t0, float t1) {',
    '  float d = b * b - (c0 - r * r);',
    '  if (d <= 0.0) return 0.0;',
    '  float s = sqrt(d);',
    '  return max(0.0, min(t1, -b + s) - max(t0, -b - s));',
    '}',
    'float soft(float b, float c0, float r, float f, float t0, float t1) {',
    '  return (inside(b, c0, r - f, t0, t1) + inside(b, c0, r, t0, t1) + inside(b, c0, r + f, t0, t1)) / 3.0;',
    '}',
    'void main() {',
    '  float R = uR * vScale;',
    '  vec3 oc = cameraPosition - vCenter;',
    '  vec3 rd = normalize(vWorld - cameraPosition);',
    '  float b = dot(oc, rd), c0 = dot(oc, oc);',
    '  float Ro = R * uTop[4] * 1.02;',
    '  bool outside = c0 > Ro * Ro;',
    '  if (outside != gl_FrontFacing) discard;',          // one fragment per ray
    '  float t0 = 0.0, t1 = 1e9;',
    '  float dp = b * b - (c0 - R * R);',
    '  if (dp > 0.0) { float tp = -b - sqrt(dp); if (tp > 0.0) t1 = tp; }',
    '  vec3 col = vec3(0.0);',
    '  float lo = 0.0, bot = 1.0;',                   // the planet clips the ray: nothing below 1R
    '  for (int i = 0; i < 5; i++) {',
    '    float hi = soft(b, c0, uTop[i] * R, 0.35 * (uTop[i] - bot) * R, t0, t1);',
    '    col += uColor[i] * uAmt[i] * max(0.0, hi - lo) / R;',
    '    lo = hi; bot = uTop[i];',
    '  }',
    '  gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)));',
    '}'
].join('\n');

if (typeof window !== 'undefined') window.AtmosphereLayers = AtmosphereLayers;
if (typeof module !== 'undefined' && module.exports) module.exports = AtmosphereLayers;
