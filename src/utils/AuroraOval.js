// AuroraOval.js - the aurora ovals in the Thermosphere shell, sized by the live Kp index.
//
// Step 1 of the KNOWLEDGE-WATCH plan (yt:dMwerCOPKxc): a STATIC oval per pole, not the
// NOAA OVATION grid (0.9 MB per fetch). The planetary Kp index (NOAA SWPC, keyless,
// CORS *, ~5 KB) sets its size: the equatorward edge sits near 67 deg geomagnetic
// latitude at Kp 0 and moves about 2 deg toward the equator per Kp step. The rings are
// centred on the geomagnetic (dipole) poles, ~80.7N 72.7W and its antipode, not on the
// geographic ones. A failed or offline fetch keeps a quiet default of Kp 3; nothing here
// ever throws into the render loop.
//
// Drawing: one cap mesh per pole sharing ONE geometry and ONE shader material. The shader
// turns each fragment's angle from the pole into a soft band (sharp equatorward edge,
// softer poleward glow, green core, a red-violet top). Shown only while the Thermosphere
// layer of AtmosphereLayers is lit (its cascade x zoom fade comes in as `level`). Reduced
// motion: the slow ray shimmer holds still. No per-frame allocation: update() only writes
// numbers into uniforms.
//
// Night only (P43): an aurora cannot be seen in daylight, so the shader multiplies the
// glow by a night factor from the SAME world sun vector the globe's day/night shader and
// city lights use (Earth._sunDir, passed to update()). Full glow where the sun is below
// -6 deg at that point, a smooth fade through twilight, and DAY_FLOOR in full day.
//
// global THREE (r184, republished from an ES module by index.html), classic script (no
// modules). NASA Power-of-10 style: bounded loops, >=2 asserts/method, methods <=60 lines.
class AuroraOval {
    /**
     * @param {THREE.Mesh} earthMesh - globe mesh; the ovals are parented to it
     * @param {number} radius - globe radius (sphere units)
     * @param {Object} [options]
     */
    constructor(earthMesh, radius, options) {
        console.assert(earthMesh && earthMesh.isObject3D, 'AuroraOval: earthMesh required');
        console.assert(Number.isFinite(radius) && radius > 0, 'AuroraOval: radius required');
        var opts = options || {};
        this.earthMesh = earthMesh;
        this.radius = radius;
        this.built = false;
        this._disposed = false;
        this.group = null;
        this.meshes = [];          // [north, south]
        this.material = null;
        this.geometry = null;
        this.reducedMotion = (typeof window !== 'undefined' && window.matchMedia)
            ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
        this.shellR = Number.isFinite(opts.shellR) ? opts.shellR : AuroraOval.SHELL_R;
        // Live Kp state. kp starts at the quiet default until the feed answers.
        this.kp = AuroraOval.DEFAULT_KP;
        this.kpAt = 0;             // time of the Kp value (ms UTC, from time_tag), 0 = default
        this.feed = { okAt: 0, failAt: 0, triedAt: -1e15 };
        this._inFlight = null;
        this._level = 0;           // last thermosphere level (0..1)
        this._t = 0;               // shimmer clock (s)
        this.nightFade = true;     // P43: dim on the sunlit side (false = control, as P42)
    }

    // Build the two pole caps (hidden) and ask for the Kp once. Rule 4: <=60 lines.
    build() {
        console.assert(this.earthMesh, 'AuroraOval.build: earthMesh required');
        console.assert(Number.isFinite(this.shellR) && this.shellR > 1, 'AuroraOval.build: shell radius > 1R');
        if (this.built || this._disposed || typeof THREE === 'undefined') return false;
        var maxColat = AuroraOval.MAX_COLAT_DEG * Math.PI / 180;
        // A cap around local +Y; the shader measures the angle from +Y per fragment.
        this.geometry = new THREE.SphereGeometry(this.radius * this.shellR, 128, 24, 0, Math.PI * 2, 0, maxColat);
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uEdge: { value: 0 }, uWidth: { value: 0 },
                uAmt: { value: 0 }, uTime: { value: 0 },
                // World sun direction (copied each frame from Earth's), and 0/1 for the
                // night fade: 0 until a sun vector has arrived, so nothing dims on a guess.
                uSunDir: { value: new THREE.Vector3(1, 0, 0) },
                uNightFade: { value: 0 },
                uTwilight: { value: Math.sin(AuroraOval.TWILIGHT_DEG * Math.PI / 180) },
                uDayFloor: { value: AuroraOval.DAY_FLOOR }
            },
            vertexShader: AuroraOval.VERT, fragmentShader: AuroraOval.FRAG,
            transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
            // Same pure-additive blend as the atmosphere shell: light only, the canvas
            // never turns opaque around the globe.
            blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
            blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
            blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor
        });
        this.group = new THREE.Group();
        this.group.name = 'AuroraOval';
        this.group.visible = false;
        var up = new THREE.Vector3(0, 1, 0);
        var poles = AuroraOval.POLES;
        for (var i = 0; i < poles.length; i++) {           // Rule 2: two poles
            var m = new THREE.Mesh(this.geometry, this.material);
            m.name = 'AuroraOval-' + poles[i].name;
            var dir = AuroraOval._poleDir(poles[i].lat, poles[i].lng);
            m.quaternion.setFromUnitVectors(up, dir);
            m.renderOrder = 3;                              // after the atmosphere shell (2)
            this.group.add(m);
            this.meshes.push(m);
        }
        this.earthMesh.add(this.group);
        this.built = true;
        this._applyKp();
        this.refreshKp();
        return true;
    }

    // Unit vector to a lat/lng in the globe's local frame (GlobeMath's convention).
    static _poleDir(lat, lng) {
        console.assert(Number.isFinite(lat) && Math.abs(lat) <= 90, 'AuroraOval._poleDir: bad lat');
        console.assert(Number.isFinite(lng), 'AuroraOval._poleDir: bad lng');
        if (typeof GlobeMath !== 'undefined' && GlobeMath.latLngToVector3) {
            return GlobeMath.latLngToVector3(lat, lng, 1).normalize();
        }
        var phi = (90 - lat) * Math.PI / 180, th = (lng + 180) * Math.PI / 180;
        return new THREE.Vector3(-Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
    }

    /**
     * Equatorward edge of the oval in geomagnetic latitude (deg) for a Kp. Rule 5.
     * @param {number} kp - 0..9
     * @returns {number}
     */
    static edgeLat(kp) {
        console.assert(Number.isFinite(kp), 'AuroraOval.edgeLat: kp required');
        var k = Math.max(0, Math.min(9, kp));
        console.assert(AuroraOval.EDGE_LAT0 > 40, 'AuroraOval.edgeLat: bad base');
        return AuroraOval.EDGE_LAT0 - AuroraOval.EDGE_PER_KP * k;
    }

    // Band width (deg of latitude): a quiet oval is thin, a storm oval is broad.
    static bandWidth(kp) {
        console.assert(Number.isFinite(kp), 'AuroraOval.bandWidth: kp required');
        var k = Math.max(0, Math.min(9, kp));
        console.assert(k >= 0 && k <= 9, 'AuroraOval.bandWidth: clamped');
        return AuroraOval.WIDTH0 + AuroraOval.WIDTH_PER_KP * k;
    }

    /**
     * The newest Kp in a SWPC planetary K-index reply. Accepts the current list of
     * objects ({time_tag, Kp}) and the older array-of-arrays with a header row. Returns
     * null for anything else. Rule 2: bounded scan from the end. Rule 5: 2 asserts.
     * @param {*} data
     * @returns {{kp:number, at:number}|null}
     */
    static parseKp(data) {
        console.assert(typeof AuroraOval.MAX_ROWS === 'number', 'AuroraOval.parseKp: bound required');
        if (!Array.isArray(data) || !data.length) return null;
        var stop = Math.max(0, data.length - AuroraOval.MAX_ROWS);
        for (var i = data.length - 1; i >= stop; i--) {
            var r = data[i], tag = null, kp = NaN;
            if (Array.isArray(r)) { tag = r[0]; kp = parseFloat(r[1]); }
            else if (r && typeof r === 'object') { tag = r.time_tag; kp = typeof r.Kp === 'number' ? r.Kp : parseFloat(r.Kp); }
            if (!Number.isFinite(kp) || kp < 0 || kp > 9 || typeof tag !== 'string') continue;
            // SWPC time tags are UTC without a zone ("2026-11-20T03:00:00").
            var iso = tag.replace(' ', 'T');
            var at = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z');
            if (!Number.isFinite(at)) continue;
            return { kp: kp, at: at };
        }
        console.assert(stop >= 0, 'AuroraOval.parseKp: bounded');
        return null;
    }

    /**
     * Fetch the Kp (SafeFetch: TTL cache + breaker) and resize the ovals. A failure keeps
     * the last good Kp, or the Kp 3 default. Never rejects. Rule 5: 2 asserts.
     * @returns {Promise<boolean>} true when the Kp came from a fresh reply
     */
    refreshKp() {
        console.assert(this.feed, 'AuroraOval.refreshKp: feed state required');
        console.assert(typeof AuroraOval.KP_URL === 'string', 'AuroraOval.refreshKp: url required');
        if (this._inFlight) return this._inFlight;
        this.feed.triedAt = Date.now();
        if (typeof SafeFetch === 'undefined') { this.feed.failAt = Date.now(); return Promise.resolve(false); }
        var self = this, url = AuroraOval.KP_URL;
        this._inFlight = (async function () {
            try {
                var data = await SafeFetch.json(url, { ttl: AuroraOval.KP_TTL_MS });
                var got = SafeFetch.failing(url) ? null : AuroraOval.parseKp(data);
                if (!got) { self.feed.failAt = Date.now(); return false; }
                self.kp = got.kp;
                self.kpAt = got.at;
                self.feed.okAt = SafeFetch.fetchedAt(url) || Date.now();
                self.feed.failAt = 0;
                self._applyKp();
                return true;
            } catch (err) {
                self.feed.failAt = Date.now();
                console.warn('AuroraOval.refreshKp: ' + (err && err.message));
                return false;
            }
        })().finally(function () { self._inFlight = null; });
        return this._inFlight;
    }

    // Push the Kp into the shader (edge + width, as angles from the pole). Rule 5.
    _applyKp() {
        console.assert(Number.isFinite(this.kp), 'AuroraOval._applyKp: kp required');
        if (!this.material) return false;
        var u = this.material.uniforms;
        u.uEdge.value = (90 - AuroraOval.edgeLat(this.kp)) * Math.PI / 180;
        u.uWidth.value = AuroraOval.bandWidth(this.kp) * Math.PI / 180;
        console.assert(u.uEdge.value > u.uWidth.value, 'AuroraOval._applyKp: band must not cross the pole');
        return true;
    }

    /**
     * Per frame from Explore. level = how lit the Thermosphere layer is (0..1, cascade x
     * zoom fade). Also re-asks for the Kp once its TTL has passed (sooner after a
     * failure); no timers of its own. sunDir = the world direction to the Sun that the
     * globe's day/night shader uses this frame (copied, never kept). Rule 5: 2 asserts.
     * @param {number} level
     * @param {number} [dt] - seconds
     * @param {THREE.Vector3} [sunDir] - world, toward the Sun
     * @returns {boolean} visible
     */
    update(level, dt, sunDir) {
        console.assert(Number.isFinite(level), 'AuroraOval.update: level required');
        console.assert(dt === undefined || Number.isFinite(dt), 'AuroraOval.update: bad dt');
        console.assert(sunDir === undefined || (sunDir && sunDir.isVector3), 'AuroraOval.update: bad sunDir');
        if (!this.built || !this.material) return false;
        var lv = Math.max(0, Math.min(1, level));
        this._level = lv;
        var u = this.material.uniforms;
        u.uAmt.value = lv * AuroraOval.STRENGTH;
        if (!this.reducedMotion && Number.isFinite(dt)) this._t = (this._t + Math.min(dt, 0.1)) % 3600;
        u.uTime.value = this._t;
        var hasSun = !!(sunDir && sunDir.lengthSq() > 1e-8);
        if (hasSun) u.uSunDir.value.copy(sunDir);
        u.uNightFade.value = (hasSun && this.nightFade) ? 1 : 0;
        u.uDayFloor.value = AuroraOval.DAY_FLOOR;
        var vis = lv > 0.01;
        this.group.visible = vis;
        if (vis) this._refreshIfDue(Date.now());
        return vis;
    }

    // Ask again once the TTL passed (KP_RETRY_MS after a failure); never while hidden.
    _refreshIfDue(now) {
        console.assert(Number.isFinite(now), 'AuroraOval._refreshIfDue: time required');
        console.assert(this.feed, 'AuroraOval._refreshIfDue: feed state required');
        if (this._inFlight || (typeof document !== 'undefined' && document.hidden)) return false;
        var failed = this.feed.failAt > this.feed.okAt;
        var gap = failed ? AuroraOval.KP_RETRY_MS : AuroraOval.KP_TTL_MS;
        if (now - this.feed.triedAt < gap) return false;
        this.refreshKp();
        return true;
    }

    // Hide (Explore exit). update() owns visibility while Explore runs. Rule 5.
    setVisible(vis) {
        console.assert(typeof vis === 'boolean', 'AuroraOval.setVisible: boolean required');
        console.assert(this.group !== undefined, 'AuroraOval.setVisible: group field expected');
        if (!this.group) return false;
        this.group.visible = vis && this._level > 0.01;
        return this.group.visible;
    }

    /**
     * One status line for the Layers tab, like the other feeds: "Kp 2.3 at 03:00 UTC ·
     * oval from 62° mag. lat". Rule 5: 2 asserts.
     * @param {number} [now]
     * @returns {{state:string, text:string}} state: off | loading | live | stale | offline
     */
    status(now) {
        console.assert(this.feed, 'AuroraOval.status: feed state required');
        var t = Number.isFinite(now) ? now : Date.now();
        console.assert(Number.isFinite(t), 'AuroraOval.status: time');
        if (!this.built) return { state: 'off', text: 'off' };
        var hm = function (ms) { return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
        var edge = '· oval from ' + Math.round(AuroraOval.edgeLat(this.kp)) + '° mag. lat';
        var kpTxt = 'Kp ' + this.kp.toFixed(1);
        if (!this.feed.okAt && !this.feed.failAt) return { state: 'loading', text: 'loading… ' + edge };
        if (!this.feed.okAt) return { state: 'offline', text: kpTxt + ' (quiet default) - feed offline ' + edge };
        var stale = this.feed.failAt > this.feed.okAt || t - this.feed.okAt > 2 * AuroraOval.KP_TTL_MS + 60000;
        // The Kp's own time stamp is UTC (3-hour slots), so say it in UTC, like quake times.
        var at = this.kpAt ? ' at ' + new Date(this.kpAt).toISOString().slice(11, 16) + ' UTC' : '';
        if (stale) return { state: 'stale', text: kpTxt + at + ' - stale since ' + hm(this.feed.okAt) + ' ' + edge };
        return { state: 'live', text: kpTxt + at + ' ' + edge };
    }

    // Free the caps (shared geometry + material). Rule 5: 2 asserts.
    dispose() {
        console.assert(Array.isArray(this.meshes), 'AuroraOval.dispose: meshes array expected');
        console.assert(this.earthMesh !== undefined, 'AuroraOval.dispose: earthMesh field expected');
        this._disposed = true;
        if (this.group && this.group.parent) this.group.parent.remove(this.group);
        if (this.geometry) this.geometry.dispose();
        if (this.material) this.material.dispose();
        this.group = null; this.geometry = null; this.material = null; this.meshes = [];
        this.built = false;
        return true;
    }
}

// Planetary K-index, 3-hour values for the last week (NOAA SWPC; ~5 KB, CORS *).
AuroraOval.KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
AuroraOval.KP_TTL_MS = 30 * 60000;     // Kp is a 3-hour index: 30 min is plenty
AuroraOval.KP_RETRY_MS = 5 * 60000;    // after a failure (SafeFetch's breaker also cools 60 s)
AuroraOval.DEFAULT_KP = 3;             // quiet default when the feed never answered
AuroraOval.MAX_ROWS = 200;             // parseKp scans at most this many rows from the end
AuroraOval.EDGE_LAT0 = 67;             // equatorward edge at Kp 0 (deg geomagnetic latitude)
AuroraOval.EDGE_PER_KP = 2;            // ...moving this many degrees lower per Kp step
AuroraOval.WIDTH0 = 7;                 // band width at Kp 0 (deg)
AuroraOval.WIDTH_PER_KP = 1;           // ...and its growth per Kp step
AuroraOval.MAX_COLAT_DEG = 48;         // cap size: holds the Kp 9 oval (edge 49 deg) + feather
AuroraOval.SHELL_R = 1.065;            // inside the exaggerated Thermosphere band (1.046-1.085 R)
AuroraOval.STRENGTH = 0.9;
// P43 night fade: full glow below -TWILIGHT_DEG sun elevation, gone above +TWILIGHT_DEG
// (civil twilight, both ways), DAY_FLOOR of the glow in full day (kept as a knob).
AuroraOval.TWILIGHT_DEG = 6;
AuroraOval.DAY_FLOOR = 0;               // no floor: the lit day side is bright imagery, not dark blue;
                                       // a faint green there reads as haze, not aurora
// Approximate dipole (geomagnetic) poles; the south one is the antipode.
AuroraOval.POLES = [
    { name: 'north', lat: 80.7, lng: -72.7 },
    { name: 'south', lat: -80.7, lng: 107.3 }
];

AuroraOval.VERT = [
    'varying vec3 vLocal;',
    'varying vec3 vWorldDir;',
    'void main() {',
    '  vLocal = position;',
    // The cap is centred on the globe, so its rotated position is the world up direction
    // at that point (normalised in the fragment shader; uniform scale drops out).
    '  vWorldDir = mat3(modelMatrix) * position;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
].join('\n');

// d = angle from the pole minus the band centre. Equatorward of the centre the glow ends
// sharply (the real lower border), poleward it fades softly into a red-violet top.
AuroraOval.FRAG = [
    'uniform float uEdge;',
    'uniform float uWidth;',
    'uniform float uAmt;',
    'uniform float uTime;',
    'uniform vec3 uSunDir;',
    'uniform float uNightFade;',
    'uniform float uTwilight;',
    'uniform float uDayFloor;',
    'varying vec3 vLocal;',
    'varying vec3 vWorldDir;',
    'void main() {',
    '  vec3 n = normalize(vLocal);',
    '  float colat = acos(clamp(n.y, -1.0, 1.0));',
    '  float lon = atan(n.z, n.x);',
    '  float c = uEdge - 0.4 * uWidth;',
    '  float d = colat - c;',
    '  float s = d > 0.0 ? 0.22 * uWidth : 0.42 * uWidth;',
    '  float g = exp(-0.5 * d * d / (s * s));',
    '  float rays = 0.86 + 0.14 * sin(lon * 23.0 + uTime * 0.7) * sin(lon * 9.0 - uTime * 0.4);',
    '  vec3 green = vec3(0.25, 1.0, 0.55);',
    '  vec3 top = vec3(0.75, 0.3, 0.75);',
    // sin(sun elevation) at this point; night = 1 below -uTwilight, 0 above +uTwilight.
    '  float sunEl = dot(normalize(vWorldDir), normalize(uSunDir));',
    '  float night = 1.0 - smoothstep(-uTwilight, uTwilight, sunEl);',
    '  float dark = mix(1.0, max(night, uDayFloor), uNightFade);',
    '  vec3 col = mix(green, top, smoothstep(0.0, 1.2, -d / uWidth)) * g * rays * uAmt * dark;',
    '  gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)));',
    '}'
].join('\n');

if (typeof window !== 'undefined') window.AuroraOval = AuroraOval;
if (typeof module !== 'undefined' && module.exports) module.exports = AuroraOval;
