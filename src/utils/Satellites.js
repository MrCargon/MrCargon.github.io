// Satellites.js - real satellites around the Explore globe: GPS, weather and crewed
// stations, placed by SGP4 from CelesTrak orbital elements (OMM JSON, not TLE text:
// catalogue numbers already pass 99999, which the TLE format cannot hold).
//
// Nothing here loads until Explore asks for it (Earth.startSatellites injects this very
// file), and the constructor allocates no buffers. start() then loads the vendored satellite.js, the bundled snapshot
// and any cached elements, and draws one THREE.Points (a single draw call).
//
// CelesTrak blocks an IP that fetches more than once per 2 hours, and SafeFetch's cache is
// in memory, so a reload would fetch again. So there is ONE live fetch per FETCH_GAP_MS
// per browser, over all groups: the stamp is written BEFORE the request (a failure counts
// too) and kept in localStorage. If the stamp cannot be stored there is no live fetch at
// all. Only the live site fetches: dev servers and test runs (which reload all day, with
// fresh storage) stay on the snapshot, so they cannot get the home IP blocked. The bundled
// snapshot means the layer still shows every group on the first visit;
// each later fetch refreshes the stalest group.
//
// Positions are Earth-fixed and use the wall clock, like the live ISS marker: the layer
// says where the satellites are now, whatever the simulation clock is doing.
//
// global THREE (r184, republished from an ES module by index.html), classic script (no modules).
// Dots are RoundPoints (src/utils/RoundPoints.js, loaded by index.html) when present.
/* global RoundPoints */
// NASA Power-of-10 style: bounded counts, >=2 asserts/method, methods <=60 lines, no
// per-frame allocation in our own code, graceful dispose, reduced-motion aware.
class Satellites {
    /**
     * @param {THREE.Mesh} earthMesh - globe mesh; the points ride its rotation
     * @param {number} radius - globe radius (sphere units)
     */
    constructor(earthMesh, radius) {
        console.assert(earthMesh && earthMesh.isObject3D, 'Satellites: earthMesh required');
        console.assert(Number.isFinite(radius) && radius > 0, 'Satellites: radius required');
        this.earthMesh = earthMesh;
        this.radius = radius;
        this.kmToUnits = radius / Satellites.EARTH_RADIUS_KM;
        this.points = null;
        this.visible = false;       // on screen right now (the button shows this)
        this.count = 0;             // objects drawn
        this.perGroup = {};         // group id -> object count
        this.dataTime = {};         // group id -> ms epoch of the data in use (for rotation)
        this._groups = {};          // group id -> raw OMM records
        this._records = [];         // { satrec, group } flat, bounded by MAX_OBJECTS
        this._lastTick = -Infinity;
        this._fade = 1;             // zoom fade (setView): 1 far out, 0 below ~1.4R
        this.hideIss = false;       // true while the ISS marker layer draws the ISS
        this.hiddenCount = 0;       // records not drawn (stacked, or the ISS by marker)
        this._starting = null;
        this._disposed = false;
        this.reducedMotion = (typeof window !== 'undefined' && window.matchMedia)
            ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
    }

    /**
     * Show the layer, building it on first use. Safe to call repeatedly.
     * Never rejects: a dead feed or a missing script leaves the globe as it was.
     * @returns {Promise<boolean>} true when the layer is built
     */
    start() {
        console.assert(!this._disposed, 'Satellites.start: disposed');
        console.assert(this.earthMesh, 'Satellites.start: earthMesh required');
        this.visible = true;
        if (this.points) this.points.visible = this._fade > Satellites.FADE_MIN;
        if (!this._starting) {
            this._starting = this._load().catch((err) => {
                console.warn('Satellites: could not start:', err && err.message);
                this._starting = null;      // a later toggle may retry
                this.visible = false;       // the button must not claim a missing layer
                return false;
            });
        }
        return this._starting;
    }

    /** @param {boolean} on @returns {boolean} the new state */
    setVisible(on) {
        console.assert(typeof on === 'boolean', 'Satellites.setVisible: boolean required');
        console.assert(!this._disposed, 'Satellites.setVisible: disposed');
        this.visible = on;
        if (this.points) this.points.visible = on && this._fade > Satellites.FADE_MIN;
        return on;
    }

    /**
     * Per-frame view state from Explore. Dots clutter close views (they sat over the
     * ground at 1.08R), so they fade out between FADE_FAR_R and FADE_NEAR_R and are not
     * drawn below it. hideIss: the ISS marker layer is on, so this layer skips the ISS.
     * @param {number} rr - camera distance / Earth radius
     * @param {boolean} hideIss
     * @returns {number} the fade in [0,1]
     */
    setView(rr, hideIss) {
        console.assert(Number.isFinite(rr) && rr > 0, 'Satellites.setView: bad rr');
        console.assert(typeof hideIss === 'boolean', 'Satellites.setView: boolean required');
        const t = Math.max(0, Math.min(1, (rr - Satellites.FADE_NEAR_R) / (Satellites.FADE_FAR_R - Satellites.FADE_NEAR_R)));
        this._fade = t * t * (3 - 2 * t);
        if (hideIss !== this.hideIss) {
            this.hideIss = hideIss;
            if (this.points) this._markHidden();
        }
        if (this.points) {
            this.points.material.opacity = Satellites.OPACITY * this._fade;
            this.points.visible = this.visible && this._fade > Satellites.FADE_MIN;
        }
        return this._fade;
    }

    // Rank 1 (not drawn) for the ISS while its marker shows it, and for any object within
    // STACK_KM of an earlier drawn one (docked modules/vehicles). O(n^2) on <=300 objects,
    // ~45k adds, run on the position tick only.
    _markHidden() {
        console.assert(this._ranks && this._positions, 'Satellites._markHidden: buffers required');
        console.assert(Satellites.STACK_KM > 0, 'Satellites._markHidden: bound required');
        const pos = this._positions;
        const lim = Satellites.STACK_KM * this.kmToUnits;
        const lim2 = lim * lim;
        const n = this._records.length;
        const lead = this._lead || (this._lead = new Uint8Array(Satellites.MAX_OBJECTS));
        let hidden = 0;
        for (let i = 0; i < n; i++) {
            let stacked = false;
            for (let j = 0; j < i && !stacked; j++) {
                if (!lead[j]) continue;     // compare against stack leads only
                const dx = pos[i * 3] - pos[j * 3], dy = pos[i * 3 + 1] - pos[j * 3 + 1], dz = pos[i * 3 + 2] - pos[j * 3 + 2];
                stacked = (dx * dx + dy * dy + dz * dz) < lim2;
            }
            // A parked (failed) object sits at the centre: never a lead, never drawn usefully.
            lead[i] = stacked ? 0 : 1;
            const issByMarker = this.hideIss && this._records[i].norad === Satellites.ISS_NORAD;
            this._ranks[i] = (stacked || issByMarker) ? 1 : 0;
            if (this._ranks[i]) hidden++;
        }
        this.hiddenCount = hidden;
        this.points.geometry.attributes.rpRank.needsUpdate = true;
        return hidden;
    }

    // Script, then snapshot + cache, then draw; the one live fetch runs last and unawaited
    // so a slow or blocked CelesTrak can never hold the layer back.
    async _load() {
        console.assert(typeof THREE !== 'undefined', 'Satellites._load: THREE required');
        console.assert(typeof document !== 'undefined', 'Satellites._load: document required');
        await Satellites._loadLibrary();
        await this._loadStored();
        if (this._disposed) return false;
        this._rebuildRecords();
        if (this.count > 0) {
            this._buildPoints();
            if (this.visible) this._refreshOneGroup();      // hidden mid-load: keep the slot
            return true;
        }
        // Everything aged out (see MAX_EPOCH_AGE_MS): only a live fetch can help now.
        if (!(await this._refreshOneGroup())) throw new Error('no fresh orbital data');
        return true;
    }

    // Injects the vendored library once. CSP: same origin, so script-src 'self' covers it.
    static _loadLibrary() {
        console.assert(typeof document !== 'undefined', 'Satellites._loadLibrary: document required');
        console.assert(typeof Satellites.LIB_URL === 'string', 'Satellites._loadLibrary: url required');
        if (typeof satellite !== 'undefined') return Promise.resolve(true);
        if (!Satellites._libPromise) {
            Satellites._libPromise = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = Satellites.LIB_URL;
                s.onload = () => resolve(true);
                s.onerror = () => {
                    Satellites._libPromise = null;
                    reject(new Error('satellite.js failed to load'));
                };
                document.head.appendChild(s);
            });
        }
        return Satellites._libPromise;
    }

    // The newest copy of each group wins: cached live data, else the bundled snapshot.
    async _loadStored() {
        console.assert(this._groups && this.dataTime, 'Satellites._loadStored: state required');
        console.assert(typeof fetch === 'function', 'Satellites._loadStored: fetch required');
        let snap = null;
        try {
            const res = await fetch(Satellites.SNAPSHOT_URL);
            if (res.ok) snap = await res.json();
        } catch (err) {
            console.warn('Satellites: snapshot unavailable:', err.message);
        }
        const snapTime = snap ? Date.parse(snap.fetched) || 0 : 0;
        for (let i = 0; i < Satellites.GROUPS.length; i++) {
            const id = Satellites.GROUPS[i].id;
            const fromSnap = snap && snap.groups && snap.groups[id];
            if (Satellites._validGroup(fromSnap)) {
                this._groups[id] = fromSnap;
                this.dataTime[id] = snapTime;
            }
            const cached = Satellites._readCache(id);
            if (cached && (cached.t > (this.dataTime[id] || 0))) {
                this._groups[id] = cached.data;
                this.dataTime[id] = cached.t;
            }
        }
    }

    static _validGroup(data) {
        console.assert(Satellites.MAX_OBJECTS > 0, 'Satellites._validGroup: bound required');
        console.assert(data === undefined || data === null || typeof data === 'object',
            'Satellites._validGroup: bad data');
        // some(): a reply of only stale or broken records must not replace good data.
        return Array.isArray(data) && data.length > 0 && data.length <= Satellites.MAX_OBJECTS
            && data.some(Satellites._usableRecord);
    }

    // Every record, not just the first: an absurd epoch makes SGP4 integrate for seconds on
    // each tick, a bad cache would come back on every reload, and old elements are both
    // wrong on the map and slower (3 ms a pass at a year, 13 ms at five, 0.2 ms when fresh).
    static _usableRecord(rec) {
        console.assert(Satellites.MAX_EPOCH_AGE_MS > 0, 'Satellites._usableRecord: bound required');
        console.assert(rec === null || typeof rec === 'object', 'Satellites._usableRecord: bad record');
        if (!rec || !Number.isFinite(rec.MEAN_MOTION)) return false;
        if (rec.MEAN_MOTION < 0.1 || rec.MEAN_MOTION > 20) return false;
        const age = Math.abs(Date.now() - Date.parse(rec.EPOCH));
        return age < Satellites.MAX_EPOCH_AGE_MS;     // NaN fails this too
    }

    static _readCache(id) {
        console.assert(typeof id === 'string', 'Satellites._readCache: id required');
        console.assert(typeof Satellites.CACHE_PREFIX === 'string', 'Satellites._readCache: prefix');
        try {
            const parsed = JSON.parse(localStorage.getItem(Satellites.CACHE_PREFIX + id));
            if (parsed && Number.isFinite(parsed.t) && parsed.t <= Date.now()
                && Satellites._validGroup(parsed.data)) return parsed;
        } catch (err) {
            // Storage blocked or corrupt: treated as no cache.
        }
        return null;
    }

    // Parse every group into satrecs, bounded by MAX_OBJECTS overall.
    _rebuildRecords() {
        console.assert(typeof satellite !== 'undefined', 'Satellites._rebuildRecords: library required');
        console.assert(Satellites.GROUPS.length > 0, 'Satellites._rebuildRecords: groups required');
        const out = [];
        const perGroup = {};
        for (let g = 0; g < Satellites.GROUPS.length; g++) {
            const group = Satellites.GROUPS[g];
            const list = this._groups[group.id] || [];
            let n = 0;
            for (let i = 0; i < list.length && out.length < Satellites.MAX_OBJECTS; i++) {
                let satrec = null;
                try {
                    if (Satellites._usableRecord(list[i])) satrec = satellite.json2satrec(list[i]);
                } catch (err) {
                    satrec = null;
                }
                if (satrec && !satrec.error) {
                    out.push({ satrec: satrec, group: group, name: list[i].OBJECT_NAME,
                        norad: Number(list[i].NORAD_CAT_ID) });
                    n++;
                }
            }
            perGroup[group.id] = n;
        }
        this._records = out;
        this.perGroup = perGroup;
        this.count = out.length;
    }

    _buildPoints() {
        console.assert(this.count > 0, 'Satellites._buildPoints: records required');
        console.assert(!this.points, 'Satellites._buildPoints: already built');
        const max = Satellites.MAX_OBJECTS;
        const geometry = new THREE.BufferGeometry();
        this._positions = new Float32Array(max * 3);
        this._colors = new Float32Array(max * 3);
        geometry.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(this._colors, 3));
        // rpRank 1 = not drawn: a docked module or vehicle stacked on another object (the
        // ISS alone was ~9 records on one spot), or the ISS itself while the ISS marker
        // layer shows it (audit F8: one ISS, the marker with its click card).
        this._ranks = new Float32Array(max);
        geometry.setAttribute('rpRank', new THREE.BufferAttribute(this._ranks, 1));
        const rounded = (typeof RoundPoints !== 'undefined');
        const material = new THREE.PointsMaterial({
            size: Satellites.DOT_PX,
            sizeAttenuation: false,     // real sizes would be invisible; keep a steady dot
            vertexColors: true,
            transparent: true,
            opacity: Satellites.OPACITY,
            depthWrite: false,
            map: rounded ? null : Satellites._dotTexture(),
            alphaTest: rounded ? 0 : 0.2,
            toneMapped: false           // tone mapping washed the three group colours to cream
        });
        // Round analytic 3 px disc (no texture, ~1 px AA rim), clamped 2-4 CSS px.
        if (rounded) RoundPoints.apply(material, { minPx: 2, maxPx: 4, soft: 0, rank: true }).uRankCut.value = 0.5;
        this.points = new THREE.Points(geometry, material);
        if (rounded) RoundPoints.attach(this.points);
        this.points.name = 'satellites';
        this.points.frustumCulled = false;       // positions change without a bounding sphere
        this.points.raycast = () => {};          // the planet picker recurses into children
        this.points.visible = this.visible && this._fade > Satellites.FADE_MIN;
        this.earthMesh.add(this.points);
        this._paintColors();
        this._propagate(Date.now());
    }

    static _dotTexture() {
        console.assert(typeof document !== 'undefined', 'Satellites._dotTexture: document required');
        console.assert(typeof THREE !== 'undefined', 'Satellites._dotTexture: THREE required');
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
        ctx.fill();
        return new THREE.CanvasTexture(canvas);
    }

    _paintColors() {
        console.assert(this._colors, 'Satellites._paintColors: buffer required');
        console.assert(this.points, 'Satellites._paintColors: points required');
        const c = new THREE.Color();
        for (let i = 0; i < this._records.length; i++) {
            c.setHex(this._records[i].group.color);
            this._colors[i * 3] = c.r;
            this._colors[i * 3 + 1] = c.g;
            this._colors[i * 3 + 2] = c.b;
        }
        this.points.geometry.attributes.color.needsUpdate = true;
        this.points.geometry.setDrawRange(0, this._records.length);
    }

    /**
     * Per-frame hook from Explore. Throttled: one pass is under a millisecond and low
     * orbits move about 7.7 km/s, a tiny step on screen at this rate.
     * @param {number} [nowMs] - wall clock, injectable for tests
     * @returns {boolean} true when positions were refreshed
     */
    update(nowMs) {
        console.assert(nowMs === undefined || Number.isFinite(nowMs), 'Satellites.update: bad time');
        console.assert(!this._disposed, 'Satellites.update: disposed');
        if (!this.points || !this.visible || !this.points.visible) return false;   // off or zoomed past
        const now = nowMs === undefined ? Date.now() : nowMs;
        const gap = this.reducedMotion ? Satellites.TICK_REDUCED_MS : Satellites.TICK_MS;
        // abs: after the clock moves back, the plain difference would stay negative and
        // the dots would freeze until the clock caught up.
        if (Math.abs(now - this._lastTick) < gap) return false;
        this._propagate(now);
        return true;
    }

    // SGP4 -> Earth-fixed km -> globe-local units. A decayed or failed object parks at the
    // globe's centre, hidden by the sphere, so one bad record cannot throw NaN at the GPU.
    _propagate(now) {
        console.assert(this._positions, 'Satellites._propagate: buffer required');
        console.assert(Number.isFinite(now), 'Satellites._propagate: time required');
        this._lastTick = now;
        const date = new Date(now);
        const gmst = satellite.gstime(date);
        const k = this.kmToUnits;
        const pos = this._positions;
        for (let i = 0; i < this._records.length; i++) {
            const state = satellite.propagate(this._records[i].satrec, date);
            const eci = state && state.position;
            let x = 0, y = 0, z = 0;
            if (eci) {
                const ecf = satellite.eciToEcf(eci, gmst);
                // GlobeMath: lng 0 is +x, lng 90E is -z, north is +y.
                if (Number.isFinite(ecf.x + ecf.y + ecf.z)) {
                    x = ecf.x * k;
                    y = ecf.z * k;
                    z = -ecf.y * k;
                }
            }
            pos[i * 3] = x;
            pos[i * 3 + 1] = y;
            pos[i * 3 + 2] = z;
        }
        this.points.geometry.attributes.position.needsUpdate = true;
        this._markHidden();
    }

    // The single live request of this window of FETCH_GAP_MS, for the stalest group.
    async _refreshOneGroup() {
        console.assert(this._groups, 'Satellites._refreshOneGroup: state required');
        console.assert(Satellites.FETCH_GAP_MS >= 7200000, 'Satellites: gap below the CelesTrak rule');
        if (typeof SafeFetch === 'undefined' || !Satellites._liveAllowed()) return false;
        if (!Satellites._claimFetchSlot()) return false;
        let id = Satellites.GROUPS[0].id;
        for (let i = 1; i < Satellites.GROUPS.length; i++) {
            const other = Satellites.GROUPS[i].id;
            if ((this.dataTime[other] || 0) < (this.dataTime[id] || 0)) id = other;
        }
        const url = Satellites.API_URL + '?GROUP=' + encodeURIComponent(id) + '&FORMAT=json';
        const data = await SafeFetch.json(url, { ttl: Satellites.FETCH_GAP_MS, timeout: 15000 });
        if (this._disposed || !Satellites._validGroup(data)) return false;
        const t = Date.now();
        this._groups[id] = data;
        this.dataTime[id] = t;
        try {
            localStorage.setItem(Satellites.CACHE_PREFIX + id, JSON.stringify({ t: t, data: data }));
        } catch (err) {
            console.warn('Satellites: could not cache orbital data:', err.message);
        }
        this._rebuildRecords();
        if (!this.points && this.count > 0) this._buildPoints();
        if (!this.points) return false;
        this._paintColors();
        this._propagate(t);
        return true;
    }

    // The live site only. A test opts in with this flag and must stub CelesTrak.
    static _liveAllowed() {
        console.assert(typeof location !== 'undefined', 'Satellites._liveAllowed: location required');
        console.assert(typeof Satellites.LIVE_HOST === 'string', 'Satellites._liveAllowed: host required');
        if (location.hostname === Satellites.LIVE_HOST) return true;
        try {
            return localStorage.getItem(Satellites.TEST_FLAG) === '1';
        } catch (err) {
            return false;
        }
    }

    // Stamp first, then verify it stuck: no provable stamp means no request, because a
    // browser that forgets the stamp would fetch on every reload and get the IP blocked.
    static _claimFetchSlot() {
        console.assert(typeof Satellites.STAMP_KEY === 'string', 'Satellites._claimFetchSlot: key');
        console.assert(Satellites.FETCH_GAP_MS > 0, 'Satellites._claimFetchSlot: gap');
        try {
            const now = Date.now();
            const last = Number(localStorage.getItem(Satellites.STAMP_KEY)) || 0;
            // A stamp far in the future is a broken clock, not a recent fetch; one inside a
            // window still blocks and ages out by itself.
            if (last > now + Satellites.FETCH_GAP_MS) localStorage.removeItem(Satellites.STAMP_KEY);
            else if (now - last < Satellites.FETCH_GAP_MS) return false;
            localStorage.setItem(Satellites.STAMP_KEY, String(now));
            return localStorage.getItem(Satellites.STAMP_KEY) === String(now);
        } catch (err) {
            return false;
        }
    }

    dispose() {
        console.assert(!this._disposed, 'Satellites.dispose: already disposed');
        console.assert(this.earthMesh, 'Satellites.dispose: earthMesh required');
        this._disposed = true;
        this.visible = false;
        if (this.points) {
            this.earthMesh.remove(this.points);
            this.points.geometry.dispose();
            if (this.points.material.map) this.points.material.map.dispose();
            this.points.material.dispose();
            this.points = null;
        }
        this._records = [];
        this._groups = {};
    }
}

Satellites.EARTH_RADIUS_KM = 6371;
Satellites.MAX_OBJECTS = 300;           // the buffers are this big; extras are dropped
Satellites.TICK_MS = 250;
Satellites.DOT_PX = 3;                  // CSS px, round (RoundPoints)
Satellites.OPACITY = 0.95;
Satellites.FADE_FAR_R = 1.6;            // full above this camera distance (Earth radii)
Satellites.FADE_NEAR_R = 1.4;           // gone below this one (audit F8: ~1.5R)
Satellites.FADE_MIN = 0.02;
Satellites.STACK_KM = 25;               // closer than this to a drawn object = docked/stacked
Satellites.ISS_NORAD = 25544;           // ISS (ZARYA); the ISS marker layer owns it when on
Satellites.TICK_REDUCED_MS = 10000;     // reduced motion: an occasional step, no glide
Satellites.FETCH_GAP_MS = 2.25 * 3600000;   // CelesTrak: 1 fetch per 2 h per IP, plus margin
// A snapshot older than this is dropped and the layer waits for live data. Rebuild it from
// time to time: src/data/satellites-snapshot.json.
Satellites.MAX_EPOCH_AGE_MS = 90 * 86400000;
Satellites.LIVE_HOST = 'mrcargon.github.io';
Satellites.TEST_FLAG = 'mrcargon-sats-allow-live';
Satellites.API_URL = 'https://celestrak.org/NORAD/elements/gp.php';
Satellites.SNAPSHOT_URL = 'src/data/satellites-snapshot.json';
Satellites.LIB_URL = 'src/assets/vendor/satellite.min.js';
Satellites.CACHE_PREFIX = 'mrcargon-sats-gp-';
Satellites.STAMP_KEY = 'mrcargon-sats-last-fetch';
Satellites.GROUPS = [
    { id: 'gps-ops', label: 'GPS', color: 0x7dffb0 },
    { id: 'weather', label: 'Weather', color: 0xffc24a },
    { id: 'stations', label: 'Stations', color: 0xff6ad3 }
];
Satellites._libPromise = null;

if (typeof window !== 'undefined') window.Satellites = Satellites;
if (typeof module !== 'undefined' && module.exports) module.exports = Satellites;
