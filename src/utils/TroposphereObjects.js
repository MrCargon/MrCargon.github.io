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
// global THREE r128, classic script (no modules). NASA Power-of-10 style: bounded
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
        this.reducedMotion = (typeof window !== 'undefined' && window.matchMedia)
            ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
        this.balloons = [];         // { mesh, lat, lng, baseR, phase, bob }
        this.jets = [];             // { mesh, lat, lng, heading, speed, contrail }
        this.weather = [];          // { mesh, lat, lng, baseR, phase }
        // Pre-seeded placements (bounded). Hot-air balloons cluster over scenic spots;
        // jets cruise common corridors; weather balloons scatter. lat/lng + colour.
        // Spread across the globe (NOT clustered over SF, where they overlapped the
        // "Based in SF" marker and read as floating pins). One near the Bay, the rest
        // on other continents.
        this.balloonSeeds = opts.balloonSeeds || [
            { lat: 38.6, lng: -121.5, color: 0xff5a4a }, { lat: 45.5, lng: -98.0, color: 0x4aa3ff },
            { lat: 51.5, lng: 0.1, color: 0xffc24a }, { lat: 41.9, lng: 12.5, color: 0x6ad36a },
            { lat: -23.5, lng: -46.6, color: 0xff6ad3 }, { lat: -33.9, lng: 151.2, color: 0x4ad3d3 }
        ];
        this.jetSeeds = opts.jetSeeds || [
            { lat: 40, lng: -120, heading: 1, speed: 0.06 }, { lat: 20, lng: 0, heading: 1, speed: 0.05 },
            { lat: 50, lng: 30, heading: -1, speed: 0.07 }, { lat: -10, lng: 120, heading: 1, speed: 0.055 },
            { lat: 33, lng: -90, heading: -1, speed: 0.05 }
        ];
        this.weatherSeeds = opts.weatherSeeds || [
            { lat: 10, lng: -50 }, { lat: -20, lng: 60 }, { lat: 60, lng: -100 }, { lat: 25, lng: 100 }
        ];
        // Per-frame scratch (no allocation in update()).
        this._sUp = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
        this._sPos = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
        this._sAhead = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;
    }

    // Lazily build all objects (hidden, opacity 0). Rule 4: <=60 lines.
    build() {
        console.assert(this.earthMesh, 'TroposphereObjects.build: earthMesh required');
        console.assert(!this._disposed, 'TroposphereObjects.build: not disposed');
        if (this.built || this._disposed || typeof THREE === 'undefined') return false;
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
            this._placeOnGlobe(holder, s.lat, s.lng, rOff);
            this.group.add(holder);
            this.balloons.push({ mesh: holder, baseR: this.radius * rOff, phase: i * 1.7,
                mats: [envMat, baskMat] });
        }
        return true;
    }

    // Jet = small bright wedge + a short tapered contrail, near the top of the
    // troposphere (~1.02R), flying along its heading. Rule 4: <=60 lines.
    _buildJets() {
        console.assert(Array.isArray(this.jetSeeds), '_buildJets: seeds required');
        console.assert(this.group, '_buildJets: group required');
        var rOff = 1.02, size = this.radius * 0.01;
        for (var i = 0; i < this.jetSeeds.length; i++) {         // Rule 2: bounded by seeds
            var s = this.jetSeeds[i];
            var holder = new THREE.Group();
            var bodyMat = new THREE.MeshBasicMaterial({ color: 0xf0f6ff, transparent: true, opacity: 0 });
            bodyMat._tropoScale = 1;
            var body = new THREE.Mesh(new THREE.ConeGeometry(size * 0.35, size * 1.6, 8), bodyMat);
            body.rotation.z = -Math.PI / 2;                       // point +X (travel dir)
            var trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true,
                opacity: 0, side: THREE.DoubleSide, depthWrite: false });
            trailMat._tropoScale = 0.45;                          // contrail fainter than the jet
            var trail = new THREE.Mesh(new THREE.PlaneGeometry(size * 4, size * 0.5), trailMat);
            trail.position.x = -size * 2.2;
            holder.add(body); holder.add(trail);
            this.jets.push({ mesh: holder, lat: s.lat, lng: s.lng, heading: s.heading,
                speed: s.speed, rOff: rOff, mats: [bodyMat, trailMat] });
            this.group.add(holder);
        }
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
            this._placeOnGlobe(m, s.lat, s.lng, rOff);
            this.group.add(m);
            this.weather.push({ mesh: m, baseR: this.radius * rOff, phase: i * 2.3, mats: [mat] });
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
        var d = Number.isFinite(dt) ? Math.min(dt, 0.1) : 0.016;
        this._t += d;
        // Bell-ish band: 1 inside [showNear,showFar], ramps to 0 over a margin each side.
        var rr = cameraDistInRadii, m = 0.18;
        var below = Math.max(0, Math.min(1, (rr - (this.showNear - m)) / m));
        var above = Math.max(0, Math.min(1, ((this.showFar + m) - rr) / m));
        this._target = Math.max(0, Math.min(1, below * above));
        var ease = this.reducedMotion ? 1 : 0.1;
        this._opacity += (this._target - this._opacity) * ease;
        this.group.visible = this._opacity > 0.01;
        if (!this.group.visible) return true;
        this._applyOpacity(this._opacity);
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

    // Advance each jet along its heading (longitude drift) + re-place/orient. Rule 4: <=60.
    _animJets(dt) {
        console.assert(Array.isArray(this.jets), '_animJets: array required');
        console.assert(this._sAhead, '_animJets: scratch required');
        for (var i = 0; i < this.jets.length; i++) {             // Rule 2: bounded
            var j = this.jets[i];
            j.lng += j.heading * j.speed * dt * 12;
            if (j.lng > 180) j.lng -= 360; else if (j.lng < -180) j.lng += 360;
            var p = GlobeMath.latLngToVector3(j.lat, j.lng, j.rOff * this.radius);
            j.mesh.position.set(p.x, p.y, p.z);
            var a = GlobeMath.latLngToVector3(j.lat, j.lng + j.heading * 0.5, j.rOff * this.radius);
            j.mesh.up.copy(this._sUp.set(p.x, p.y, p.z).normalize());
            j.mesh.lookAt(a.x, a.y, a.z);                         // nose toward travel
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

if (typeof window !== 'undefined') window.TroposphereObjects = TroposphereObjects;
if (typeof module !== 'undefined' && module.exports) module.exports = TroposphereObjects;
