// AtmosphereLayers.js - the five named atmospheric shells around Earth, revealed
// with a staggered "cascade" animation on explore enter and retracted on exit.
//
// Real layer order (Troposphere → Exosphere); radii are EXAGGERATED for visibility
// (true thicknesses are <0.2% of Earth's radius and would be invisible on the globe).
// Each shell is one translucent additive sphere (BackSide → a coloured limb haze),
// parented to the Earth mesh so it tracks the globe. The whole set fades out as the
// camera zooms close so it never blocks the surface/streets view.
//
// global THREE r128, classic script (no modules). NASA Power-of-10 style:
// bounded loops, >=2 asserts/method, methods <=60 lines, no per-frame allocation.
class AtmosphereLayers {
    /**
     * @param {THREE.Mesh} earthMesh - globe mesh; shells are parented to it
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
        // Fade the whole atmosphere out as the camera approaches (it's a far/mid-view
        // feature; up close you're inside the shells looking at the surface).
        this.fadeNear = Number.isFinite(opts.fadeNear) ? opts.fadeNear : 1.35; // gone below
        this.fadeFar = Number.isFinite(opts.fadeFar) ? opts.fadeFar : 1.9;     // full above
        this._zoomFade = 1;

        // name | exaggerated radius offset | colour | peak opacity (real order, inner→outer)
        this.defs = [
            { name: 'Troposphere',  rOffset: 1.03, color: 0x4aa3e0, peak: 0.13 },
            { name: 'Stratosphere', rOffset: 1.07, color: 0x5a86d8, peak: 0.11 },
            { name: 'Mesosphere',   rOffset: 1.12, color: 0x6f74cc, peak: 0.09 },
            { name: 'Thermosphere', rOffset: 1.18, color: 0x8a64bb, peak: 0.07 },
            { name: 'Exosphere',    rOffset: 1.26, color: 0x7a55a0, peak: 0.045 }
        ];
        // Per-shell runtime state (pre-allocated; Rule 3). Filled in build().
        this.shells = [];
        this.labels = [];                       // DOM label elements (one per shell)
        // Pre-allocated scratch for per-frame label projection (no per-frame alloc).
        this._sCenter = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
        this._sRight = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
        this._sUp = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
        this._sZ = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
        this._sAnchor = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
    }

    // Lazily build the five shells (hidden, opacity 0). Rule 4: <=60 lines.
    build() {
        console.assert(this.earthMesh, 'AtmosphereLayers.build: earthMesh required');
        console.assert(Array.isArray(this.defs), 'AtmosphereLayers.build: defs required');
        if (this.built || this._disposed || typeof THREE === 'undefined') return false;
        for (var i = 0; i < this.defs.length; i++) {
            var d = this.defs[i];
            var geo = new THREE.SphereGeometry(this.radius * d.rOffset, 48, 32);
            var mat = new THREE.MeshBasicMaterial({
                color: d.color, transparent: true, opacity: 0,
                side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending
            });
            var mesh = new THREE.Mesh(geo, mat);
            mesh.visible = false;
            mesh.renderOrder = 2;                  // after the surface/overlays
            this.earthMesh.add(mesh);
            this.shells.push({ mesh: mesh, mat: mat, peak: d.peak, cur: 0, target: 0, startAt: 0,
                name: d.name, rWorld: this.radius * d.rOffset });
        }
        this._buildLabels();
        this.built = true;
        return true;
    }

    // Create one DOM label per shell (reparented to <body> so it's above the canvas).
    // Positioned per-frame by updateLabels(). Rule 4: <=60 lines.
    _buildLabels() {
        console.assert(Array.isArray(this.shells), '_buildLabels: shells expected');
        console.assert(typeof document !== 'undefined', '_buildLabels: document required');
        if (typeof document === 'undefined' || this.labels.length) return false;
        for (var i = 0; i < this.shells.length; i++) {
            var el = document.createElement('div');
            el.className = 'atmo-label';
            el.textContent = this.shells[i].name;
            el.setAttribute('aria-hidden', 'true');
            el.style.cssText = 'position:fixed; z-index:36; pointer-events:none; opacity:0; ' +
                'font:600 12px system-ui,-apple-system,sans-serif; color:#dcdcff; white-space:nowrap; ' +
                'padding:2px 7px; border-radius:9px; background:rgba(12,18,40,0.55); ' +
                'border:1px solid rgba(120,140,220,0.35); text-shadow:0 0 6px rgba(10,20,50,0.95); ' +
                'transform:translate(-50%,-50%); transition:none;';
            document.body.appendChild(el);
            this.labels.push(el);
        }
        return true;
    }

    // Project each shell's upper-limb anchor to screen + place its label. Opacity
    // follows the shell's cascade × zoom fade. Rule 4: <=60 | no per-frame alloc.
    updateLabels(camera, rect) {
        console.assert(camera && camera.isCamera, 'updateLabels: camera required');
        console.assert(rect && Number.isFinite(rect.width), 'updateLabels: rect required');
        if (!this.built || this._disposed || !this._sCenter) return false;
        this.earthMesh.getWorldPosition(this._sCenter);
        camera.matrixWorld.extractBasis(this._sRight, this._sUp, this._sZ);  // right, up, fwd
        for (var i = 0; i < this.labels.length; i++) {
            var s = this.shells[i], el = this.labels[i];
            var op = s.cur * this._zoomFade;
            if (op < 0.01) { el.style.opacity = '0'; continue; }
            // Anchor on the upper-right limb at this shell's radius (a stacked cutaway).
            this._sAnchor.copy(this._sCenter)
                .addScaledVector(this._sRight, 0.45 * s.rWorld)
                .addScaledVector(this._sUp, 0.9 * s.rWorld);
            this._sAnchor.project(camera);
            var x = rect.left + (this._sAnchor.x * 0.5 + 0.5) * rect.width;
            var y = rect.top + (-this._sAnchor.y * 0.5 + 0.5) * rect.height;
            el.style.left = x + 'px'; el.style.top = y + 'px';
            // Readable even for the faint outer shells: floor + gain, so all 5 names
            // are legible while still tracking the cascade fade-in/out.
            el.style.opacity = String(Math.max(0, Math.min(0.96, 0.35 + op * 7)));
        }
        return true;
    }

    // Cascade the shells IN (inner→outer, staggered). Rule 5: 2 asserts.
    cascadeIn() {
        console.assert(this.earthMesh, 'cascadeIn: earthMesh required');
        console.assert(this.shells, 'cascadeIn: shells expected');
        if (!this.built) this.build();
        var now = AtmosphereLayers._now();
        for (var i = 0; i < this.shells.length; i++) {
            var s = this.shells[i];
            s.target = s.peak;
            s.startAt = this.reducedMotion ? now : (now + i * 130);  // staggered reveal
            if (s.mesh) s.mesh.visible = true;
        }
        this._start();
        return true;
    }

    // Cascade the shells OUT (outer→inner, staggered). Rule 5: 2 asserts.
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
        // Hide the DOM labels now — the explore loop (which positions them) stops on
        // exit, so they can't be faded per-frame; the shells still animate out.
        for (var j = 0; j < this.labels.length; j++) {
            if (this.labels[j]) this.labels[j].style.opacity = '0';
        }
        this._start();
        return true;
    }

    // Per-frame zoom fade: hide the atmosphere as the camera zooms close. Rule 5: 2 asserts.
    update(cameraDistInRadii) {
        console.assert(Number.isFinite(cameraDistInRadii), 'update: distance required');
        console.assert(this.shells, 'update: shells expected');
        var rr = cameraDistInRadii;
        var k = (rr - this.fadeNear) / (this.fadeFar - this.fadeNear);
        this._zoomFade = Math.max(0, Math.min(1, k));
        // Apply the zoom fade on top of each shell's current cascade opacity.
        for (var i = 0; i < this.shells.length; i++) {
            var s = this.shells[i];
            if (s.mat) s.mat.opacity = s.cur * this._zoomFade;
            if (s.mesh) s.mesh.visible = (s.cur * this._zoomFade) > 0.002;
        }
        return true;
    }

    // ---- internal animator -------------------------------------------------

    static _now() {
        return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    }

    // Start the single rAF that eases every shell toward its target. Rule 5: 2 asserts.
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

    // Advance all shells one frame; returns true while any is still animating. Rule 4: <=60.
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
            if (s.mat) s.mat.opacity = s.cur * this._zoomFade;
            if (s.mesh) s.mesh.visible = (s.cur * this._zoomFade) > 0.002;
        }
        return moving;
    }

    _settleInstant() {
        for (var i = 0; i < this.shells.length; i++) {
            var s = this.shells[i];
            s.cur = s.target;
            if (s.mat) s.mat.opacity = s.cur * this._zoomFade;
            if (s.mesh) s.mesh.visible = s.cur > 0.002;
        }
    }

    // Free all shells (geometry + material) + cancel the rAF. Rule 5: 2 asserts.
    dispose() {
        console.assert(this.earthMesh !== undefined, 'dispose: earthMesh field expected');
        console.assert(Array.isArray(this.shells), 'dispose: shells array expected');
        this._disposed = true;
        if (this._raf && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this._raf);
        this._raf = 0;
        for (var i = 0; i < this.shells.length; i++) {
            var s = this.shells[i];
            if (s.mesh) {
                if (s.mesh.geometry) s.mesh.geometry.dispose();
                if (s.mesh.material) s.mesh.material.dispose();
                if (s.mesh.parent) s.mesh.parent.remove(s.mesh);
            }
        }
        this.shells = [];
        for (var j = 0; j < this.labels.length; j++) {
            var el = this.labels[j];
            if (el && el.parentNode) el.parentNode.removeChild(el);
        }
        this.labels = [];
        this.built = false;
        return true;
    }
}

if (typeof window !== 'undefined') window.AtmosphereLayers = AtmosphereLayers;
if (typeof module !== 'undefined' && module.exports) module.exports = AtmosphereLayers;
