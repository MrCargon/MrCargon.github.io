// TroposphereObjects.js - populates the lowest atmosphere shell (Troposphere) with
// living detail: hot-air balloons (low), weather balloons (mid), and high jets with
// short contrails (top of the troposphere). They are revealed when the camera sits in
// the troposphere VIEWING BAND (mid zoom) and fade out far away (you see the whole
// atmosphere) and very close (you're at the surface). Parented to the Earth mesh so
// they ride the globe's rotation, and animated each frame (bob / drift / fly).
//
// This is layer 1 of the staged "atmosphere objects" vision; mesosphere meteors,
// thermosphere auroras and exosphere stations follow as sibling modules.
//
// global THREE (r184, republished from an ES module by index.html), classic script (no modules). NASA Power-of-10 style: bounded
// object counts, >=2 asserts/method, methods <=60 lines, no per-frame allocation
// (pooled scratch + pre-seeded arrays), graceful dispose, reduced-motion aware.
class TroposphereObjects {
    /**
     * @param {THREE.Mesh} earthMesh - globe mesh; objects are parented to it
     * @param {number} radius - globe radius (sphere units)
     * @param {Object} [options]
     */
    constructor(earthMesh, radius, options) {
        console.assert(earthMesh && earthMesh.isObject3D, 'TroposphereObjects: earthMesh required');
        console.assert(Number.isFinite(radius) && radius > 0, 'TroposphereObjects: radius required');
        var opts = options || {};
        this.earthMesh = earthMesh;
        this.radius = radius;
        this.built = false;
        this._disposed = false;
        // Viewing band in Earth radii: full inside, fading to 0 outside. The troposphere
        // is the "weather" layer, best seen at a regional/mid zoom.
        this.showFar = Number.isFinite(opts.showFar) ? opts.showFar : 1.7;
        this.showNear = Number.isFinite(opts.showNear) ? opts.showNear : 1.04;
        this._opacity = 0;          // current eased master opacity (0..1)
        this._target = 0;           // target master opacity
        this._t = 0;                // accumulated time (s) for bob/flight
        this._lastAt = 0;           // wall clock (ms) of the last update, for a missing dt
        this.reducedMotion = (typeof window !== 'undefined' && window.matchMedia)
            ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
        this.balloons = [];         // { mesh, lat, lng, baseR, phase, bob }
        this.jets = [];             // { mesh, a, b, omega, f, dir, speed, rOff } (great-circle route)
        this.weather = [];          // { mesh, lat, lng, baseR, phase }
        // Pre-seeded placements (bounded). Hot-air balloons cluster over scenic spots;
        // jets cruise common corridors; weather balloons scatter. lat/lng + colour.
        // Spread across the globe (NOT clustered over SF, where they overlapped the
        // "Based in SF" marker and read as floating pins). One near the Bay, the rest
        // on other continents.
        this.balloonSeeds = opts.balloonSeeds || [
            { lat: 38.6, lng: -121.5, color: 0xff5a4a }, { lat: 45.5, lng: -98.0, color: 0x4aa3ff },
            // R1 #5: these two sat exactly on the London and Rome pins and hid them; moved
            // to real balloon-festival sites (Cappadocia, Albuquerque) away from every POI.
            { lat: 38.6, lng: 34.8, color: 0xc08bff }, { lat: 35.1, lng: -106.6, color: 0x6ad36a },
            { lat: -23.5, lng: -46.6, color: 0xff6ad3 }, { lat: -33.9, lng: 151.2, color: 0x4ad3d3 }
        ];
        // Jets fly great-circle routes between real hubs (none at a POI city), back and
        // forth. speed = degrees of arc per SECOND (dt-scaled, so frame-rate independent),
        // capped at JET_MAX_DEG_S: a believable on-screen pace, not the real 0.002 deg/s.
        // f = starting fraction along the route. Illustrative, not live flight data.
        this.jetSeeds = opts.jetSeeds || [
            { from: [33.94, -118.41], to: [-33.95, 151.18], speed: 0.05, f: 0.35 },  // LAX-SYD
            { from: [33.64, -84.43], to: [40.49, -3.57], speed: 0.045, f: 0.55 },    // ATL-MAD
            { from: [25.25, 55.36], to: [1.36, 103.99], speed: 0.05, f: 0.2 },       // DXB-SIN
            { from: [-23.43, -46.47], to: [-26.14, 28.25], speed: 0.04, f: 0.6 },    // GRU-JNB
            { from: [41.26, 28.74], to: [28.56, 77.10], speed: 0.05, f: 0.3 }        // IST-DEL
        ];
        this.weatherSeeds = opts.weatherSeeds || [
            { lat: 10, lng: -50 }, { lat: -20, lng: 60 }, { lat: 60, lng: -100 }, { lat: 25, lng: 100 }
        ];
        // Per-frame scratch (no allocation in update()).
        this._sUp = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
        this._sPos = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
        this._sAhead = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
        this._sWorld = null;        // clamp scratch, created in build() (THREE present)
        this._sScale = null;
        // Screen-size clamp: each object's largest on-screen extent is capped at this
        // many CSS px, so a world-size balloon can never grow into a blob that covers
        // the view up close. The camera + canvas height are captured by an
        // onBeforeRender hook on the lead mesh of each object (no SpaceEnvironment
        // plumbing needed); the clamp then runs in update() on the next frame.
        this.maxPx = opts.maxPx || { balloon: 22, jet: 34, weather: 9 };
        this._cam = null;           // last camera that rendered us (PerspectiveCamera)
        this._viewH = 0;            // canvas CSS height (px) at that render
        var self = this;
        this._captureCam = function (renderer, _scene, camera) {
            self._cam = camera;
            var el = renderer && renderer.domElement;
            self._viewH = el ? (el.clientHeight || el.height || 0) : 0;
        };
    }

    // Lazily build all objects (hidden, opacity 0). Rule 4: <=60 lines.
    build() {
        console.assert(this.earthMesh, 'TroposphereObjects.build: earthMesh required');
        console.assert(!this._disposed, 'TroposphereObjects.build: not disposed');
        if (this.built || this._disposed || typeof THREE === 'undefined') return false;
        this._sWorld = new THREE.Vector3();
        this._sScale = new THREE.Vector3();
        this.group = new THREE.Group();
        this.group.visible = false;
        this.earthMesh.add(this.group);
        this._buildBalloons();
        this._buildJets();
        this._buildWeather();
        this.built = true;
        return true;
    }

    // Hot-air balloon = teardrop envelope (coloured) + tiny basket, low in the
    // troposphere (~1.012R), oriented so "up" is the local surface normal. Rule 4: <=60.
    _buildBalloons() {
        console.assert(Array.isArray(this.balloonSeeds), '_buildBalloons: seeds required');
        console.assert(this.group, '_buildBalloons: group required');
        var rOff = 1.012, size = this.radius * 0.012;
        for (var i = 0; i < this.balloonSeeds.length; i++) {     // Rule 2: bounded by seeds
            var s = this.balloonSeeds[i];
            var holder = new THREE.Group();
            var envGeo = new THREE.SphereGeometry(size, 12, 10);
            var envMat = new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0 });
            envMat._tropoScale = 1;
            var env = new THREE.Mesh(envGeo, envMat);
            env.scale.set(1, 1.25, 1); env.position.y = size * 1.1;
            var baskGeo = new THREE.BoxGeometry(size * 0.4, size * 0.4, size * 0.4);
            var baskMat = new THREE.MeshBasicMaterial({ color: 0x5a3a1a, transparent: true, opacity: 0 });
            baskMat._tropoScale = 1;
            holder.add(env); holder.add(new THREE.Mesh(baskGeo, baskMat));
            env.onBeforeRender = this._captureCam;
            this._placeOnGlobe(holder, s.lat, s.lng, rOff);
            this.group.add(holder);
            // extent = basket bottom to envelope top (~2.6 x size), for the px clamp.
            this.balloons.push({ mesh: holder, baseR: this.radius * rOff, phase: i * 1.7,
                mats: [envMat, baskMat], extent: size * 2.6, maxPx: this.maxPx.balloon });
        }
        return true;
    }

    // Jet = small bright wedge + a short tapered contrail, inside the drawn troposphere
    // band (1.008R; it tops out at 1.012R), flying its great-circle route. Rule 4: <=60.
    _buildJets() {
        console.assert(Array.isArray(this.jetSeeds), '_buildJets: seeds required');
        console.assert(this.group, '_buildJets: group required');
        var rOff = TroposphereObjects.JET_R, size = this.radius * 0.01;
        for (var i = 0; i < this.jetSeeds.length; i++) {         // Rule 2: bounded by seeds
            var s = this.jetSeeds[i];
            var holder = new THREE.Group();
            var bodyMat = new THREE.MeshBasicMaterial({ color: 0xf0f6ff, transparent: true, opacity: 0 });
            bodyMat._tropoScale = 1;
            var body = new THREE.Mesh(new THREE.ConeGeometry(size * 0.35, size * 1.6, 8), bodyMat);
            body.rotation.z = -Math.PI / 2;                       // point +X (travel dir)
            var trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true,
                opacity: 0, side: THREE.DoubleSide, depthWrite: false,
                forceSinglePass: true });              // flat plane: one draw, no per-frame program re-check (R2 #3)
            trailMat._tropoScale = 0.45;                          // contrail fainter than the jet
            var trail = new THREE.Mesh(new THREE.PlaneGeometry(size * 4, size * 0.5), trailMat);
            trail.position.x = -size * 2.2;
            holder.add(body); holder.add(trail);
            body.onBeforeRender = this._captureCam;
            // extent = contrail tail to nose (~5 x size), for the px clamp.
            var jet = TroposphereObjects._route(s);
            jet.mesh = holder; jet.rOff = rOff; jet.mats = [bodyMat, trailMat];
            jet.extent = size * 5; jet.maxPx = this.maxPx.jet;
            this.jets.push(jet);
            this.group.add(holder);
            this._placeJet(jet);
        }
        return true;
    }

    // Route state for one jet seed: unit end vectors, arc angle (rad), speed capped at
    // JET_MAX_DEG_S. Build-time only (allocates). Rule 5: 2 asserts.
    static _route(s) {
        console.assert(s && Array.isArray(s.from) && Array.isArray(s.to), '_route: from/to required');
        console.assert(typeof GlobeMath !== 'undefined', '_route: GlobeMath required');
        var a = GlobeMath.latLngToVector3(s.from[0], s.from[1], 1);
        var b = GlobeMath.latLngToVector3(s.to[0], s.to[1], 1);
        var A = new THREE.Vector3(a.x, a.y, a.z).normalize(), B = new THREE.Vector3(b.x, b.y, b.z).normalize();
        var omega = Math.acos(Math.max(-1, Math.min(1, A.dot(B))));
        var sp = Math.min(Number.isFinite(s.speed) ? s.speed : 0.05, TroposphereObjects.JET_MAX_DEG_S);
        return { a: A, b: B, omega: Math.max(omega, 1e-4), f: Number.isFinite(s.f) ? s.f : 0.5,
            dir: 1, speed: sp };
    }

    // Write the point at fraction f along a jet's great circle (slerp A->B) into out,
    // at radius r. No allocation. Rule 5: 2 asserts.
    static _slerp(j, f, r, out) {
        console.assert(j && j.a && j.b, '_slerp: route required');
        console.assert(out && out.isVector3, '_slerp: out vector required');
        var so = Math.sin(j.omega), k0 = Math.sin((1 - f) * j.omega) / so, k1 = Math.sin(f * j.omega) / so;
        out.set(j.a.x * k0 + j.b.x * k1, j.a.y * k0 + j.b.y * k1, j.a.z * k0 + j.b.z * k1);
        return out.setLength(r);
    }

    // Place + orient one jet at its route fraction, nose along the direction of travel.
    _placeJet(j) {
        console.assert(j && j.mesh, '_placeJet: jet required');
        console.assert(this._sAhead && this._sUp, '_placeJet: scratch required');
        var r = j.rOff * this.radius, step = (0.5 * Math.PI / 180) / j.omega;   // 0.5 deg ahead
        TroposphereObjects._slerp(j, j.f, r, j.mesh.position);
        TroposphereObjects._slerp(j, j.f + j.dir * step, r, this._sAhead);
        j.mesh.up.copy(this._sUp.copy(j.mesh.position).normalize());
        j.mesh.lookAt(this._sAhead);                              // nose toward travel
        return true;
    }

    // Weather balloon = small pale sphere higher up (~1.026R), slow vertical bob. Rule 5.
    _buildWeather() {
        console.assert(Array.isArray(this.weatherSeeds), '_buildWeather: seeds required');
        console.assert(this.group, '_buildWeather: group required');
        var rOff = 1.026, size = this.radius * 0.006;
        for (var i = 0; i < this.weatherSeeds.length; i++) {     // Rule 2: bounded
            var s = this.weatherSeeds[i];
            var mat = new THREE.MeshBasicMaterial({ color: 0xdfe8f5, transparent: true, opacity: 0 });
            mat._tropoScale = 0.9;
            var m = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), mat);
            m.onBeforeRender = this._captureCam;
            this._placeOnGlobe(m, s.lat, s.lng, rOff);
            this.group.add(m);
            this.weather.push({ mesh: m, baseR: this.radius * rOff, phase: i * 2.3, mats: [mat],
                extent: size * 2, maxPx: this.maxPx.weather });
        }
        return true;
    }

    // Position an object at lat/lng on a shell + orient its local +Y to the surface
    // normal (so "up" points away from Earth's centre). Rule 5: 2 asserts.
    _placeOnGlobe(obj, lat, lng, rOff) {
        console.assert(obj && obj.isObject3D, '_placeOnGlobe: object required');
        console.assert(typeof GlobeMath !== 'undefined', '_placeOnGlobe: GlobeMath required');
        var p = GlobeMath.latLngToVector3(lat, lng, this.radius * rOff);
        obj.position.set(p.x, p.y, p.z);
        if (this._sUp) { this._sUp.set(p.x, p.y, p.z).normalize(); obj.up.copy(this._sUp);
            obj.lookAt(p.x * 2, p.y * 2, p.z * 2); }   // face outward; up = normal
        return true;
    }

    // Per-frame: ease master opacity by the viewing band, bob balloons, fly jets.
    // dt in seconds. Rule 4: <=60 | no per-frame allocation.
    update(cameraDistInRadii, dt) {
        console.assert(Number.isFinite(cameraDistInRadii), 'update: distance required');
        console.assert(this.group, 'update: group required');
        if (!this.built || this._disposed) return false;
        // No dt passed: measure it from the wall clock, never assume a 60 Hz frame (R1 #5).
        var now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        var d = Number.isFinite(dt) ? dt : (this._lastAt ? (now - this._lastAt) / 1000 : 0);
        this._lastAt = now;
        d = Math.max(0, Math.min(d, 0.1));
        // The bob clock runs only while animating, so turning reduced motion off resumes
        // the bob where it froze instead of jumping (R3 #13).
        if (!this.reducedMotion) this._t += d;
        // Band: 0 at/below showNear, ramps up to 1 at showNear+m, 1 up to showFar, then
        // ramps to 0 at showFar+m. (The lower ramp used to start at showNear-m, which
        // left it at ~0.78 at the closest zoom, so the objects never faded out up close.)
        var rr = cameraDistInRadii, m = 0.18;
        var below = Math.max(0, Math.min(1, (rr - this.showNear) / m));
        var above = Math.max(0, Math.min(1, ((this.showFar + m) - rr) / m));
        this._target = Math.max(0, Math.min(1, below * above));
        var ease = this.reducedMotion ? 1 : 0.1;
        this._opacity += (this._target - this._opacity) * ease;
        this.group.visible = this._opacity > 0.01;
        if (!this.group.visible) return true;
        this._applyOpacity(this._opacity);
        this._clampScreenSize();
        if (!this.reducedMotion) { this._animBalloons(); this._animJets(d); this._animWeather(); }
        return true;
    }

    // Apply the master opacity to every object's materials. Rule 5: 2 asserts.
    _applyOpacity(o) {
        console.assert(Number.isFinite(o), '_applyOpacity: number required');
        console.assert(this.group, '_applyOpacity: group required');
        var sets = [this.balloons, this.jets, this.weather];
        for (var g = 0; g < sets.length; g++) {                  // Rule 2: bounded (3)
            var arr = sets[g];
            for (var i = 0; i < arr.length; i++) {               // Rule 2: bounded
                var mats = arr[i].mats;
                for (var k = 0; k < mats.length; k++) mats[k].opacity = o * mats[k]._tropoScale;
            }
        }
        return true;
    }

    // Cap every object's on-screen size at its maxPx (scale <= 1, never enlarged), so
    // none can cover the view at any zoom. Uses the camera captured at the last render.
    // Rule 4: <=60 lines | no per-frame allocation (scratch vectors).
    _clampScreenSize() {
        console.assert(this.group, '_clampScreenSize: group required');
        console.assert(this._sWorld, '_clampScreenSize: scratch required');
        var cam = this._cam;
        if (!cam || !cam.isPerspectiveCamera || !(this._viewH > 0)) return false;
        var tanHalf = Math.tan(cam.fov * Math.PI / 360);
        if (!(tanHalf > 0)) return false;
        this.group.getWorldScale(this._sScale);
        var worldK = this._sScale.x;                              // group world scale
        var ce = cam.matrixWorld.elements;                        // camera world position
        var sets = [this.balloons, this.jets, this.weather];
        for (var g = 0; g < sets.length; g++) {                  // Rule 2: bounded (3)
            var arr = sets[g];
            for (var i = 0; i < arr.length; i++) {               // Rule 2: bounded
                var o = arr[i];
                o.mesh.getWorldPosition(this._sWorld);
                var dx = this._sWorld.x - ce[12], dy = this._sWorld.y - ce[13], dz = this._sWorld.z - ce[14];
                var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (!(dist > 1e-6)) { o.mesh.scale.setScalar(0.001); continue; }
                var px = (o.extent * worldK * this._viewH) / (2 * dist * tanHalf);
                var s = px > o.maxPx ? o.maxPx / px : 1;
                o.mesh.scale.setScalar(Math.max(0.001, s));
            }
        }
        return true;
    }

    // Gentle vertical bob (altitude oscillation) for the balloons. Rule 5: 2 asserts.
    _animBalloons() {
        console.assert(Array.isArray(this.balloons), '_animBalloons: array required');
        console.assert(this._sPos, '_animBalloons: scratch required');
        for (var i = 0; i < this.balloons.length; i++) {         // Rule 2: bounded
            var b = this.balloons[i];
            var scale = 1 + 0.02 * Math.sin(this._t * 0.6 + b.phase);
            b.mesh.position.setLength(b.baseR * scale);
        }
        return true;
    }

    // Advance each jet along its great-circle route by speed (deg/s) x dt (s); at either
    // hub it turns round and flies back. Rule 4: <=60 | no per-frame allocation.
    _animJets(dt) {
        console.assert(Array.isArray(this.jets), '_animJets: array required');
        console.assert(Number.isFinite(dt) && dt >= 0, '_animJets: dt (s) required');
        for (var i = 0; i < this.jets.length; i++) {             // Rule 2: bounded
            var j = this.jets[i];
            j.f += j.dir * (j.speed * Math.PI / 180) * dt / j.omega;
            if (j.f >= 1) { j.f = 1; j.dir = -1; } else if (j.f <= 0) { j.f = 0; j.dir = 1; }
            this._placeJet(j);
        }
        return true;
    }

    // Slow vertical bob for the weather balloons (drifting upward feel). Rule 5: 2 asserts.
    _animWeather() {
        console.assert(Array.isArray(this.weather), '_animWeather: array required');
        console.assert(this._sPos, '_animWeather: scratch required');
        for (var i = 0; i < this.weather.length; i++) {          // Rule 2: bounded
            var w = this.weather[i];
            var scale = 1 + 0.01 * Math.sin(this._t * 0.3 + w.phase);
            w.mesh.position.setLength(w.baseR * scale);
        }
        return true;
    }

    // Show/hide convenience (the band in update() owns opacity). Rule 5: 2 asserts.
    setVisible(vis) {
        console.assert(typeof vis === 'boolean', 'setVisible: boolean required');
        console.assert(this.group !== undefined, 'setVisible: group field expected');
        if (this.group) this.group.visible = !!vis && this._opacity > 0.01;
        return true;
    }

    // Free every object (geometry + material) + unparent the group. Rule 4: <=60 lines.
    dispose() {
        console.assert(this.earthMesh !== undefined, 'dispose: earthMesh field expected');
        console.assert(this.group !== undefined, 'dispose: group field expected');
        this._disposed = true;
        if (this.group) {
            this.group.traverse(function (o) {
                if (o.geometry && o.geometry.dispose) o.geometry.dispose();
                if (o.material && o.material.dispose) o.material.dispose();
            });
            if (this.group.parent) this.group.parent.remove(this.group);
        }
        this.balloons = []; this.jets = []; this.weather = [];
        this.built = false;
        return true;
    }
}

// Jet altitude (inside the drawn troposphere band, top 1.012R) and the on-screen pace cap.
TroposphereObjects.JET_R = 1.008;
TroposphereObjects.JET_MAX_DEG_S = 0.05;

if (typeof window !== 'undefined') window.TroposphereObjects = TroposphereObjects;
if (typeof module !== 'undefined' && module.exports) module.exports = TroposphereObjects;
