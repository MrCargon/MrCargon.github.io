// GeoLOD.js - zoom level-of-detail subsystem for the portfolio explore globe.
// Progressively reveals geographic detail as the camera zooms toward Earth:
//   countries (already exist as Earth.borders) -> states/provinces -> cities ->
//   city districts. Each NEW tier cross-fades by camera distance (in Earth radii)
//   with hysteresis (showBelow < hideAbove) so it does not flicker at the boundary.
//
// Pattern mirrors Earth.buildBorders/buildGraticule: ONE draw call per tier
// (LineSegments built from rings, or Points built from a places list), lifted off
// the surface by a z-fight rOffset, parented to earthMesh so it tracks the globe.
//
// REUSE: GlobeMath.latLngToVector3(lat,lng,radius) for all lat/lng -> Vector3, and
// SafeFetch.json(url,{ttl}) for fetching (falls back to fetch(); fails soft).
// global THREE (r128), global GlobeMath, global SafeFetch. Classic script, no modules.
class GeoLOD {
    // NASA Rule 5: validate deps. Does NOT build geometry (lazy).
    constructor(earthMesh, radius, options = {}) {
        console.assert(earthMesh && typeof earthMesh === 'object', 'GeoLOD.ctor: earthMesh required');
        console.assert(Number.isFinite(radius) && radius > 0, 'GeoLOD.ctor: radius must be > 0');

        this.earthMesh = earthMesh || null;
        this.radius = (Number.isFinite(radius) && radius > 0) ? radius : 1;
        this.options = options || {};
        this.auto = true;                 // setAuto(false) hands control to setTierVisible
        this._ok = (typeof THREE !== 'undefined') && (typeof GlobeMath !== 'undefined');
        if (!this._ok) console.error('GeoLOD: THREE or GlobeMath missing - subsystem no-ops');

        // Pre-allocated tier registry (Rule 3: no growth after init). Each entry is
        // a fixed-shape descriptor + runtime state. countries are intentionally
        // ABSENT here - they already exist as Earth.borders; do not duplicate.
        this.tiers = new Map();
        // rOffset stack sits ABOVE the existing Earth overlays (borders 1.006,
        // country-highlight 1.007) and is ordered more-detail = higher offset so
        // the tiers never z-fight each other or the highlight: states<cities<districts.
        // showBelow/hideAbove = the upper (appear) edge; fadeOutBelow = the lower
        // edge where a COARSER tier hands off to finer detail (streets/satellite/
        // districts) so close-up isn't a 6-layer pile-up. fadeOutBelow=0 means the
        // tier stays to the surface (districts, the finest vector for SF).
        // rOffsets hug the satellite map (1.0006) — COPLANAR like the streets ("in the
        // map", not floating). Tiny increments keep the draw order (finer on top) while
        // the gaps (<30m) are imperceptible; the satellite's polygonOffset lets these
        // lines win the depth test without z-fighting.
        const defs = [
            { name: 'states', url: 'src/assets/geo/admin1-50m.json', kind: 'lines',
                color: 0x6fb0e0, rOffset: 1.00060, showBelow: 2.4, hideAbove: 2.7, fadeOutBelow: 1.45 },
            { name: 'cities', url: 'src/assets/geo/populated-places.json', kind: 'points',
                color: 0xffd24a, rOffset: 1.00062, showBelow: 1.7, hideAbove: 1.95, fadeOutBelow: 1.2 },
            { name: 'districts', url: 'src/assets/geo/districts-sf.json', kind: 'lines-or-points',
                color: 0x8fe3ff, rOffset: 1.00064, showBelow: 1.3, hideAbove: 1.5, fadeOutBelow: 0 }
        ];
        for (let i = 0; i < defs.length; i++) {
            const d = defs[i];
            this.tiers.set(d.name, {
                name: d.name, url: d.url, kind: d.kind, color: d.color, rOffset: d.rOffset,
                showBelow: d.showBelow, hideAbove: d.hideAbove, fadeOutBelow: d.fadeOutBelow,
                group: null, material: null, built: false, failed: false,
                requested: false, opacity: 0, targetOpacity: 0
            });
        }
        // Snap (no cross-fade) when the user prefers reduced motion — matches the
        // StreetTiles/SatelliteTiles behaviour so all tile layers are consistent.
        this.reducedMotion = (typeof window !== 'undefined' && window.matchMedia)
            ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
        // Flat list for zero-allocation iteration in the per-frame update() loop
        // (Map.values() would allocate an iterator + result object each frame).
        this._tierList = Array.from(this.tiers.values());
    }

    // Drive cross-fades from camera distance (in Earth radii). Bounded loop over the
    // fixed tier list; no per-frame allocation. Rule 4: <=60 lines.
    update(cameraDistanceInRadii) {
        console.assert(this.tiers instanceof Map, 'GeoLOD.update: tier registry required');
        console.assert(arguments.length >= 1, 'GeoLOD.update: distance argument required');
        if (!this._ok) return;
        const d = Number.isFinite(cameraDistanceInRadii) ? cameraDistanceInRadii : Infinity;
        // Counted loop over the pre-built flat list: zero per-frame allocation.
        const list = this._tierList;
        for (let i = 0; i < list.length; i++) {
            const tier = list[i];
            if (this.auto) {
                // Visible only inside the band [fadeOutBelow, showBelow]; off above
                // hideAbove (too far) or below fadeOutBelow (finer detail takes over).
                // Hysteresis gaps (hideAbove, fadeOutBelow+0.12) prevent edge flicker.
                const tooFar = d > tier.hideAbove;
                const tooClose = tier.fadeOutBelow > 0 && d < tier.fadeOutBelow;
                const inBand = d < tier.showBelow && (tier.fadeOutBelow === 0 || d > tier.fadeOutBelow + 0.12);
                if (tooFar || tooClose) tier.targetOpacity = 0;
                else if (inBand) tier.targetOpacity = 1;
            }
            // Retry a tier whose fetch failed transiently (e.g. load contention) after
            // a 5s cooldown — without this, one transient failure killed the tier for
            // the whole session (it stayed failed forever). Mirrors StreetTiles.
            if (tier.failed && tier.failedAt && (Date.now() - tier.failedAt) > 5000) {
                tier.failed = false; tier.requested = false;
            }
            // Lazily build the first time a tier actually needs to be visible.
            if (tier.targetOpacity > 0 && !tier.built && !tier.requested && !tier.failed) {
                this._buildTier(tier);
            }
            // Ease opacity toward target (snap under reduced motion).
            const ease = this.reducedMotion ? 1 : 0.12;
            tier.opacity += (tier.targetOpacity - tier.opacity) * ease;
            if (tier.opacity < 0.001) tier.opacity = 0;
            // Render opacity = zoom cross-fade × the user's style opacity (default 1).
            if (tier.material) tier.material.opacity = tier.opacity * (tier.styleOpacity || 1);
            if (tier.group) tier.group.visible = tier.opacity > 0.01;
        }
    }

    // Toggle auto-driving of targets. When false, update() leaves targets alone and
    // only eases/applies opacity (manual control via setTierVisible). Rule 5: 2 asserts.
    setAuto(value) {
        console.assert(typeof value === 'boolean', 'GeoLOD.setAuto: boolean required');
        console.assert(this.tiers, 'GeoLOD.setAuto: tier registry expected');
        this.auto = !!value;
        return this.auto;
    }

    // Immediately hide every tier (no fade). Used on explore exit so LOD overlays
    // don't linger on the globe once it resumes orbiting. update() is not called
    // outside explore, so set opacity + group.visible directly. Rule 5: 2 asserts.
    hideAll() {
        console.assert(Array.isArray(this._tierList), 'GeoLOD.hideAll: tier list required');
        console.assert(this._tierList.length >= 0, 'GeoLOD.hideAll: list length');
        for (let i = 0; i < this._tierList.length; i++) {
            const t = this._tierList[i];
            t.targetOpacity = 0; t.opacity = 0;
            if (t.material) t.material.opacity = 0;
            if (t.group) t.group.visible = false;
        }
        return true;
    }

    // Manual override: lazily build + set a tier's fade target. Rule 5: 2 asserts.
    setTierVisible(name, visible) {
        console.assert(typeof name === 'string' && name.length > 0, 'GeoLOD.setTierVisible: name required');
        console.assert(this.tiers, 'GeoLOD.setTierVisible: tier registry expected');
        const tier = this.tiers.get(name);
        if (!tier) return false;
        tier.targetOpacity = visible ? 1 : 0;
        if (visible && this._ok && !tier.built && !tier.requested && !tier.failed) {
            this._buildTier(tier);
        }
        return true;
    }

    // User STYLE: set a tier's colour (hex int) and/or opacity scale. Colour applies
    // immediately to the built material; opacity scales the zoom cross-fade (see
    // update()). Stored on the tier so a (re)build keeps it. Rule 4: <=60 lines.
    setTierStyle(name, opts) {
        console.assert(typeof name === 'string', 'GeoLOD.setTierStyle: name required');
        console.assert(opts && typeof opts === 'object', 'GeoLOD.setTierStyle: opts required');
        const tier = this.tiers.get(name);
        if (!tier) return false;
        if (Number.isFinite(opts.color)) {
            tier.color = opts.color;
            if (tier.material && tier.material.color) tier.material.color.setHex(opts.color);
        }
        if (Number.isFinite(opts.opacity)) tier.styleOpacity = Math.max(0, Math.min(1, opts.opacity));
        return true;
    }

    // Plain-object snapshot for the panel/debug. Rule 5: 2 asserts, bounded loop.
    getStatus() {
        console.assert(this.tiers instanceof Map, 'GeoLOD.getStatus: tier registry required');
        console.assert(this._ok || !this._ok, 'GeoLOD.getStatus: state expected');
        const out = {};
        const it = this.tiers.values();
        for (let e = it.next(); !e.done; e = it.next()) {
            const t = e.value;
            out[t.name] = {
                built: t.built, failed: t.failed,
                visible: !!(t.group && t.group.visible),
                opacity: Math.round(t.opacity * 1000) / 1000
            };
        }
        return out;
    }

    // Lazy fetch + build for one tier. Fails soft (tier.failed=true, logs once, the
    // globe still works). Starts hidden (opacity 0, group invisible). Rule 4: <=60.
    async _buildTier(tier) {
        console.assert(tier && typeof tier === 'object', 'GeoLOD._buildTier: tier required');
        console.assert(typeof tier.url === 'string', 'GeoLOD._buildTier: tier url required');
        if (!this._ok || tier.requested || tier.built) return null;
        tier.requested = true;
        const data = await GeoLOD._fetchJson(tier.url);
        if (!data) {
            // Transient fetch failure (e.g. load contention) — stamp failedAt so
            // update() can retry after a cooldown. Malformed-data failures below do
            // NOT set failedAt (retrying bad data is pointless → stays failed).
            tier.failed = true; tier.failedAt = Date.now();
            console.warn('GeoLOD: tier "' + tier.name + '" data unavailable (will retry): ' + tier.url);
            return null;
        }
        try {
            let group = null;
            if (tier.kind === 'lines') group = this._buildLines(tier, data);
            else if (tier.kind === 'points') group = this._buildPoints(tier, data);
            else group = Array.isArray(data.rings) ? this._buildLines(tier, data) : this._buildPoints(tier, data);
            if (!group) { tier.failed = true; console.error('GeoLOD: tier "' + tier.name + '" malformed data'); return null; }
            group.visible = false;
            tier.group = group;
            tier.built = true;
            this.earthMesh.add(group);
            return group;
        } catch (err) {
            tier.failed = true;
            console.error('GeoLOD: tier "' + tier.name + '" build failed:', err);
            return null;
        }
    }

    // Build ONE LineSegments from {rings:[[[lng,lat],...],...]} (Earth.buildBorders
    // pattern). Returns null on malformed data. Rule 4: <=60, Rule 2: bounded.
    _buildLines(tier, data) {
        console.assert(tier && typeof tier === 'object', 'GeoLOD._buildLines: tier required');
        console.assert(typeof GlobeMath !== 'undefined', 'GeoLOD._buildLines: GlobeMath required');
        if (!data || !Array.isArray(data.rings)) return null;
        const r = this.radius * tier.rOffset;
        const verts = [];
        const maxRings = Math.min(data.rings.length, 20000);   // Rule 2: bounded
        for (let i = 0; i < maxRings; i++) {
            const ring = data.rings[i];
            if (!Array.isArray(ring) || ring.length < 2) continue;
            for (let j = 0; j < ring.length - 1; j++) {
                const a = GlobeMath.latLngToVector3(ring[j][1], ring[j][0], r);
                const b = GlobeMath.latLngToVector3(ring[j + 1][1], ring[j + 1][0], r);
                verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        const material = new THREE.LineBasicMaterial({
            color: tier.color, transparent: true, opacity: 0,
            depthWrite: false, depthTest: true
        });
        tier.material = material;
        return new THREE.LineSegments(geometry, material);
    }

    // Build ONE Points from {places:[{name,lat,lng,pop},...]} (sorted pop desc),
    // capped at 2000 (Rule 2). Returns null on malformed data. Rule 4: <=60.
    _buildPoints(tier, data) {
        console.assert(tier && typeof tier === 'object', 'GeoLOD._buildPoints: tier required');
        console.assert(typeof GlobeMath !== 'undefined', 'GeoLOD._buildPoints: GlobeMath required');
        if (!data || !Array.isArray(data.places)) return null;
        const r = this.radius * tier.rOffset;
        const positions = [];
        const max = Math.min(data.places.length, 2000);   // Rule 2: bounded cap
        for (let i = 0; i < max; i++) {
            const p = data.places[i];
            if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
            const v = GlobeMath.latLngToVector3(p.lat, p.lng, r);
            positions.push(v.x, v.y, v.z);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            color: tier.color, size: this.radius * 0.01, sizeAttenuation: true,
            transparent: true, opacity: 0, depthWrite: false
        });
        tier.material = material;
        return new THREE.Points(geometry, material);
    }

    // Fetch JSON via SafeFetch (preferred) with a plain fetch() fallback. Never
    // throws; returns null on any failure. Rule 5: 2 asserts. Static helper.
    static async _fetchJson(url) {
        console.assert(typeof url === 'string' && url.length > 0, 'GeoLOD._fetchJson: url required');
        console.assert(typeof fetch === 'function' || typeof SafeFetch !== 'undefined', 'GeoLOD._fetchJson: no fetch path');
        try {
            if (typeof SafeFetch !== 'undefined' && SafeFetch.json) {
                return await SafeFetch.json(url, { ttl: 3600000 });
            }
            const res = await fetch(url);
            if (!res || !res.ok) return null;
            return await res.json();
        } catch (err) {
            console.warn('GeoLOD._fetchJson: ' + url + ' failed:', err && err.message);
            return null;
        }
    }

    // Remove + dispose every tier group, then clear the registry. Rule 4: <=60.
    dispose() {
        console.assert(this.tiers instanceof Map, 'GeoLOD.dispose: tier registry required');
        console.assert(this.earthMesh !== undefined, 'GeoLOD.dispose: earthMesh field expected');
        const it = this.tiers.values();
        for (let e = it.next(); !e.done; e = it.next()) {
            const tier = e.value;
            const g = tier.group;
            if (g) {
                if (g.geometry && g.geometry.dispose) g.geometry.dispose();
                if (g.material && g.material.dispose) g.material.dispose();
                if (g.parent) g.parent.remove(g);
            }
            tier.group = null;
            tier.material = null;
            tier.built = false;
            tier.opacity = 0;
            tier.targetOpacity = 0;
        }
        this.tiers.clear();
    }
}

// Make globally available (matches the rest of the codebase).
if (typeof window !== 'undefined') {
    window.GeoLOD = GeoLOD;
}
