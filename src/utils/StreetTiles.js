// StreetTiles.js - Real OpenStreetMap streets projected onto the 3D globe.
//
// Stage 1 of the global street engine. At high zoom (camera close to the globe)
// this fetches keyless OpenFreeMap vector tiles (.pbf, CORS-enabled, no API key)
// for wherever the camera is looking, decodes the line layers (roads / rail /
// waterways) with the vendored MVT decoder, projects tile-local coords →
// lon/lat → sphere via GlobeMath.latLngToVector3, and draws ONE THREE.LineSegments
// per tile. Long road segments are subdivided so straight streets follow the
// sphere's curvature instead of chording through it.
//
// General by construction: the covering tiles are computed from (lat,lng,zoom),
// so it works anywhere — no place is special-cased.
//
// Patterns mirrored from Earth.js (buildBorders/buildGraticule): lazy build, one
// draw call per unit, rOffset z-lift, opacity cross-fade, dispose, fail-soft.
// NASA Power-of-10 style: bounded loops, >=2 asserts/method, methods <=60 lines,
// no per-frame allocation in update(). global THREE (r184, republished from an ES module by index.html), classic script.
class StreetTiles {
    /**
     * @param {THREE.Mesh} earthMesh - the globe mesh; built tiles are parented to it
     * @param {number} radius - globe radius (sphere units)
     * @param {Object} [options]
     */
    constructor(earthMesh, radius, options) {
        console.assert(earthMesh && earthMesh.isObject3D, 'StreetTiles: earthMesh required');
        console.assert(Number.isFinite(radius) && radius > 0, 'StreetTiles: radius required');
        var opts = options || {};
        this.earthMesh = earthMesh;
        this.radius = radius;
        // Just above the vector geography layers so streets sit on top, not z-fight.
        this.rOffset = Number.isFinite(opts.rOffset) ? opts.rOffset : 1.0006;   // COPLANAR with the satellite map (roads IN the map; satellite has polygonOffset)
        // Activate only when the camera is closer than this (in Earth radii).
        this.activateBelow = Number.isFinite(opts.activateBelow) ? opts.activateBelow : 1.3;
        // 2026-09-01: was 12, which is why the street map appeared as a small ISLAND in
        // the middle of a much larger view — the user's "only the edge can be seen".
        //
        // The covering set is a fixed ~7x7 of tiles (maxVisibleTiles 49). A z12 tile is
        // about 9.8 km across, so 7x7 spans ~68 km. Measured against the actual visible
        // footprint while exploring (globe radius 2 units = 6371 km, FOV narrowed by
        // updateExploreLOD):
        //
        //     rr=1.01   view ~32 km    7x7 @ z14 = ~17 km   covers
        //     rr=1.05   view ~82 km    7x7 @ z14 = ~17 km   21%
        //     rr=1.30   view ~750 km   7x7 @ z12 = ~68 km    9%
        //
        // So the layer only ever covered the screen at the very bottom of its activation
        // range, and spent most of it drawing a patch far smaller than what you are
        // looking at. The comment on maxVisibleTiles claiming 49 tiles "span the whole
        // view" was only ever true at z14, right at the surface.
        //
        // Raising the tile COUNT cannot fix this (it is quadratic — covering 750 km at
        // z12 needs ~77 tiles across, i.e. ~5900 fetches). Lowering the floor zoom does:
        // a z9 tile is ~78 km, so the same 49 tiles span ~547 km. Coarse levels also
        // carry fewer road classes, which is the right amount of detail from 900 km up.
        this.minZoom = 9;
        // OpenFreeMap line geometry / tiles only exist to z14; fetch clamps to
        // dataMaxZoom and there is no real overzoom, so maxZoom matches reality.
        this.maxZoom = 14;
        this.dataMaxZoom = 14;       // tiles only exist to z14 → clamp fetch
        // 12 tiles only covered the centre (streets stopped before the screen edges).
        // 49 (7x7) z14 tiles span the whole view + corners to match the satellite fill.
        this.maxVisibleTiles = Number.isFinite(opts.maxVisibleTiles) ? opts.maxVisibleTiles : 49;
        // 2026-08-22: was 90, i.e. LESS than two full covering sets (49 each). Crossing
        // one zoom level pushed the cache to 98 and instantly evicted the level you had
        // just left, so zooming back out refetched all 49 tiles from the network - the
        // in-and-out "reloading over and over". 150 holds two complete levels plus
        // margin, so a zoom round-trip is served entirely from cache.
        this.lruCap = Number.isFinite(opts.lruCap) ? opts.lruCap : 150;
        this.subdivideUnits = 512;   // insert a midpoint when a segment spans > this many tile units

        // OpenFreeMap discovery: fetch the TileJSON once → live {z}/{x}/{y}.pbf
        // template (the path is version-dated, so we never hard-code it).
        this.tileJsonUrl = opts.tileJsonUrl || 'https://tiles.openfreemap.org/planet';
        this.tileTemplate = null;        // resolved lazily on first update
        this._templatePromise = null;
        this._templateFailedAt = 0;      // A7: backoff clock for template retries

        // A2: guards against an in-flight fetch resolving after dispose().
        this._disposed = false;

        // A5: snap (no rAF) the per-tile fade when the user prefers reduced motion.
        this.reducedMotion = (typeof window !== 'undefined' && window.matchMedia)
            ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

        // LRU of built tiles: key "z/x/y" → { mesh, t (lastUsed), state }.
        this.tiles = new Map();
        this._building = new Set();      // in-flight keys (avoid double-fetch)
        // 2026-08-15 perf/cancellation fixes:
        // - maxConcurrentBuilds: crossing a zoom level can invalidate most of the
        //   covering set at once: without a cap, _touchOrBuild dispatched every
        //   uncached key's fetch simultaneously, competing for the browser's
        //   ~6-connections-per-origin HTTP/1.1 limit (near/important tiles queued
        //   behind far ones issued in the same burst). Skipped builds just retry
        //   next update() tick (already throttled upstream to ~9/sec).
        // - _abortControllers: fetch() is natively cancellable, unlike
        //   SatelliteTiles' THREE.TextureLoader. When a key falls out of the
        //   desired set mid-flight (fast zoom/pan), the in-flight fetch is now
        //   actually aborted instead of completing and being thrown away.
        this.maxConcurrentBuilds = Number.isFinite(opts.maxConcurrentBuilds) ? opts.maxConcurrentBuilds : 6;
        this._abortControllers = new Map();  // key -> AbortController
        this._retryAttempts = new Map();     // key -> consecutive failures, for backoff
        this._desiredKeys = new Set();       // this frame's covering set, for abort checks
        // R2 #5: after the layer goes idle (Explore exit / out of range / toggled off) the
        // LRU kept up to lruCap fat-line geometries forever. trimDelayMs after it goes
        // idle the cache is trimmed to the warmKeep most recently used tiles.
        this.trimDelayMs = Number.isFinite(opts.trimDelayMs) ? opts.trimDelayMs : 60000;
        this.warmKeep = Number.isFinite(opts.warmKeep) ? opts.warmKeep : 12;
        this._trimTimer = null;
        this.failed = 0;
        // R3 #5 (P44): failures since the last tile that loaded (see SatelliteTiles).
        this.failStreak = 0;
        this.visible = true;
        // User-stylable appearance (color, opacity, pixel width), applied to all line
        // tiles via a shared fat-line material. setStyle() updates them; host persists.
        // 2026-11-19 (F4): the user values are now the CEILING at the closest zoom; the
        // zoom style (_applyZoomStyle) scales width and opacity down from there. Default
        // colour was a bright 0x9fd8ff at 0.65 that read as a white web over the imagery;
        // a soft sand tone at 0.6 reads like a map overlay instead of paint.
        this.styleColor = Number.isFinite(opts.styleColor) ? opts.styleColor : 0xf2dcb0;
        this.styleOpacity = Number.isFinite(opts.styleOpacity) ? opts.styleOpacity : 0.6;
        this.styleWidth = Number.isFinite(opts.styleWidth) ? opts.styleWidth : 2;   // px (fat lines)
        this._sharedMat = null;   // shared LineMaterial (lazy)
        // Zoom style factors last applied (multiply the user ceiling). 0 = not yet drawn.
        this._zoomOpacity = 0;
        this._zoomWidth = 1;
        // Fade-in band: streets reach full strength at fadeFullBelow and are invisible at
        // activateBelow, so they ease in instead of switching on at 1.3R.
        this.fadeFullBelow = Number.isFinite(opts.fadeFullBelow) ? opts.fadeFullBelow : 1.2;

        // Line layers we care about (OpenMapTiles schema).
        this.lineLayers = opts.lineLayers || ['transportation', 'waterway'];

        // Per-frame scratch (Rule: no per-frame allocation in update()).
        this._scratchKeys = [];          // reused covering-tile key list
        this._scratchCands = [];         // A6: reused candidate {key,d} list for sorting
        this._tmpLng = 0; this._tmpLat = 0;
    }

    // ---- Slippy-map / web-mercator helpers (static, pure) ------------------

    // lon/lat → fractional tile x/y at zoom z. Rule 5: 2 asserts.
    static lngLatToTile(lng, lat, z) {
        console.assert(Number.isFinite(lng) && Number.isFinite(lat), 'lngLatToTile: coords required');
        console.assert(Number.isFinite(z) && z >= 0, 'lngLatToTile: zoom required');
        var n = Math.pow(2, z);
        var x = (lng + 180) / 360 * n;
        var latRad = lat * Math.PI / 180;
        var y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
        return { x: x, y: y };
    }

    // tile x/y (fractional) → lon/lat. Inverse of the above. Rule 5: 2 asserts.
    static tileToLngLat(x, y, z) {
        console.assert(Number.isFinite(x) && Number.isFinite(y), 'tileToLngLat: tile coords required');
        console.assert(Number.isFinite(z) && z >= 0, 'tileToLngLat: zoom required');
        var n = Math.pow(2, z);
        var lng = x / n * 360 - 180;
        var latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
        var lat = latRad * 180 / Math.PI;
        return { lng: lng, lat: lat };
    }

    // Choose the integer fetch zoom from camera distance (in Earth radii).
    // Closer camera → higher zoom. Clamped to [minZoom, maxZoom], fetch clamped
    // to dataMaxZoom. Rule 5: 2 asserts.
    zoomForDistance(distInRadii) {
        console.assert(Number.isFinite(distInRadii), 'zoomForDistance: distance required');
        console.assert(distInRadii > 0, 'zoomForDistance: positive distance');
        // Pick the zoom from COVERAGE, not from a distance ramp.
        //
        // The old rule was a linear ramp on distance: far → minZoom, near → maxZoom. It
        // chose a level for DETAIL and never asked whether the resulting tiles actually
        // reach the edges of the screen — which is why the street layer rendered as an
        // island in the middle of a much larger view, however many levels it had.
        //
        // The covering set is a square of about `span` tiles (maxVisibleTiles ~= span^2).
        // A tile at zoom z is 40075/2^z km wide, so covering a view V km across needs
        //
        //     40075 / 2^z * span >= V     =>     z <= log2(40075 * span / V)
        //
        // and the sharpest level that still covers is the floor of that. V comes from the
        // geometry actually in use: altitude above the surface and the (narrowing) FOV.
        // Sub-camera view half-width = altitude * tan(fov/2).
        var EARTH_KM = 40075;                                  // equatorial circumference
        var span = Math.max(3, Math.sqrt(this.maxVisibleTiles));
        var altKm = Math.max(1, (distInRadii - 1) * (EARTH_KM / (2 * Math.PI)));
        var fovDeg = this.viewFovDeg || 45;                    // set by the caller each tick
        var viewKm = Math.max(1, 2 * altKm * Math.tan((fovDeg * Math.PI / 180) / 2));
        // F4: a mercator tile is 40075*cos(lat)/2^z km wide ON THE GROUND, so at 49N
        // (Europe) the same z covered only 0.66 of the view the formula assumed.
        var latCos = Number.isFinite(this._latCos) ? this._latCos : 1;
        var raw = Math.log2(EARTH_KM * latCos * span / viewKm);
        // Never sharper than the data, never coarser than the floor.
        raw = Math.max(this.minZoom, Math.min(this.maxZoom, raw));
        // 2026-08-22 HYSTERESIS. Plain Math.round() has zero deadband at the level
        // boundary, and a zoom step invalidates EVERY key (the z prefix changes, so
        // all maxVisibleTiles keys miss the cache at once). Any camera jitter sitting
        // on a boundary therefore refetched the whole covering set, over and over -
        // the user-reported "reloading again and again while zooming in". Requiring
        // the continuous value to overshoot the midpoint by HYST before committing
        // makes the level sticky, so only real zoom intent crosses it.
        // 0.15 measured, not guessed: it takes boundary-hover flips from 116/200 ticks
        // to 0 at every tested jitter amplitude while settling on the SAME level as
        // before at every distance. 0.25 also works but this layer spans only 3 levels
        // (12-14) over 0.29 radii, so that wide a deadband loses a real detail level at
        // d=1.20 and d=1.05. (SatelliteTiles spans many more levels and does use 0.25.)
        // 2026-09-01: widened 0.15 -> 0.25 alongside minZoom 12 -> 9. The 0.15 figure was
        // chosen because this layer spanned only 3 levels over 0.29 radii, where a wider
        // deadband genuinely cost a detail level. It now spans 6, so each level occupies
        // roughly half the distance range it used to and boundaries are crossed twice as
        // often — the same deadband is effectively half as sticky. 0.25 is the value
        // SatelliteTiles already uses for exactly this reason (more levels, same problem).
        var HYST = 0.25;
        var z;
        if (!Number.isFinite(this._lastZoom)) {
            z = Math.round(raw);
        } else if (raw >= this._lastZoom + 0.5 + HYST || raw <= this._lastZoom - 0.5 - HYST) {
            z = Math.round(raw);
        } else {
            z = this._lastZoom;                       // inside the deadband → hold
        }
        z = Math.max(this.minZoom, Math.min(this.maxZoom, z));
        this._lastZoom = z;
        return z;
    }

    // ---- update: enumerate covering tiles, lazily build, LRU-evict ---------

    /**
     * Called per-frame while exploring. Active only below the zoom threshold.
     * Enumerates a bounded ring of tiles around (centerLat,centerLng), builds
     * the not-yet-built ones (async, fail-soft), and LRU-evicts beyond the cap.
     * No per-frame allocation. Rule 4: <=60 lines.
     * @param {number} centerLat
     * @param {number} centerLng
     * @param {number} cameraDistInRadii
     * @returns {boolean} whether the engine is active this frame
     */
    update(centerLat, centerLng, cameraDistInRadii) {
        console.assert(Number.isFinite(centerLat) && Number.isFinite(centerLng), 'update: center required');
        console.assert(Number.isFinite(cameraDistInRadii), 'update: distance required');
        // Hide (not disable) when the user toggled off OR the camera is out of the
        // street-zoom range; show again when back in range. Must NOT mutate
        // this.visible here — doing so conflated the user toggle with per-frame range
        // and permanently stuck the engine off after the first far frame.
        if (!this.visible || cameraDistInRadii >= this.activateBelow) {
            this._showTiles(false);
            // Invalidate the early-out: these tiles are now hidden, so re-entering
            // range at the SAME z/cx/cy must run the full path to show them again.
            this._lastAllReady = false;
            this._armTrim();              // idle: free the cache if it stays idle
            return false;
        }
        this._cancelTrim();
        // Resolve the OpenFreeMap tile template once (keyless discovery). A7: after a
        // resolve failure, back off so we don't storm requests during an outage.
        if (!this.tileTemplate) {
            if (Date.now() - this._templateFailedAt >= 10000) this._resolveTemplate();
            return true;
        }

        this._latCos = Math.max(0.1, Math.cos(centerLat * Math.PI / 180));
        var z = this.zoomForDistance(cameraDistInRadii);
        var fetchZ = Math.min(z, this.dataMaxZoom);
        this._applyZoomStyle(cameraDistInRadii, fetchZ);
        var n = Math.pow(2, fetchZ);
        var c = StreetTiles.lngLatToTile(centerLng, centerLat, fetchZ);
        this._applyLead(c, fetchZ);          // stream AHEAD of the camera, not behind it
        var cx = Math.floor(c.x), cy = Math.floor(c.y);
        // 2026-08-22 STEADY-STATE EARLY-OUT. The covering set is a pure function of
        // (fetchZ, cx, cy). Upstream calls this ~9x/sec regardless of whether the
        // camera moved, and the full body walks maxVisibleTiles keys, then walks the
        // ENTIRE lru (up to lruCap records) to set .visible, then runs _evict - all
        // to reach the identical state. Skipping when the inputs are unchanged and
        // nothing is in flight makes a stationary camera free. Any of those three
        // inputs changing, or a build landing, re-enters the full path below.
        if (this._lastZ === fetchZ && this._lastCx === cx && this._lastCy === cy &&
            this._building.size === 0 && this._lastAllReady === true) {
            return true;
        }
        this._lastZ = fetchZ; this._lastCx = cx; this._lastCy = cy;
        var keys = this._buildCoveringKeys(cx, cy, n, fetchZ, c.x, c.y);
        var now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        // 2026-08-15: was `_showTiles(false)` then rebuild every frame - hid ALL
        // tiles unconditionally before the new covering set finished loading, so
        // every zoom step that introduced new keys flashed to blank (confirmed
        // via user report + code read). Mirrors SatelliteTiles' allReady pattern:
        // keep the previous tiles visible as a fallback until the new covering
        // set is FULLY built, matching standard map-app behaviour.
        this._desiredKeys.clear();
        for (var k = 0; k < keys.length; k++) this._desiredKeys.add(keys[k]);
        this._abortStale();
        var allReady = true, settled = true;
        for (var i = 0; i < keys.length; i++) {
            if (this._touchOrBuild(keys[i], now)) continue;
            allReady = false;
            var r0 = this.tiles.get(keys[i]);
            if (!r0 || r0.state !== 'failed') settled = false;   // still loading
        }
        this._lastAllReady = allReady;   // gates the steady-state early-out above
        // F4: `settled` = every key is built OR failed (waiting on its backoff). Before,
        // one failed tile kept allReady false forever, so EVERY earlier level stayed up
        // as a "fallback": measured 104 tiles of z9-z12 stacked at 1.02R (1.26 M street
        // triangles, the white fill). A failed tile now leaves a hole until its retry
        // lands instead of pinning all the old levels on screen.
        var self = this;
        if (allReady || settled) {
            this.tiles.forEach(function (rec) { if (rec.mesh) self._setMeshVisible(rec.mesh, rec.t === now); });
        } else {
            // F4: while the new set loads, the previous tiles stay up as a fallback - but
            // never ones FINER than this level. A z13/z14 tile carries minor roads and
            // footpaths; shown from z9-z11 height it shrinks to a few dozen pixels of
            // solid line, i.e. a white square. Coarser fallbacks are sparse and fine.
            this.tiles.forEach(function (rec) {
                if (rec.mesh && rec.t !== now && rec.z > fetchZ + 1) self._setMeshVisible(rec.mesh, false);
            });
        }
        this._evict();
        return true;
    }

    // F4 STYLE BY ZOOM. Three factors multiply the user's ceiling (styleOpacity/Width):
    //   1. fade-in band: 0 at activateBelow (1.3R) -> 1 at fadeFullBelow (1.2R), so the
    //      layer eases in instead of popping on;
    //   2. coverage: the covering set is a fixed 7x7 square clamped at minZoom 9. From
    //      high up it covers only a small square in the middle of the view - the audit's
    //      "white square" (~280 px of dense lines at 1.3R over Europe). Its strength now
    //      follows how much of the view the set actually covers;
    //   3. a per-level ramp: thin and faint at z9-10, full only at z14.
    // Touches the material only when a factor moved. Rule 4: <=60. Rule 5: 2 asserts.
    _applyZoomStyle(distInRadii, fetchZ) {
        console.assert(Number.isFinite(distInRadii), '_applyZoomStyle: distance required');
        console.assert(Number.isFinite(fetchZ), '_applyZoomStyle: zoom required');
        var smooth = function (e0, e1, v) { var t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
        var band = smooth(this.activateBelow, this.fadeFullBelow, distInRadii);
        var EARTH_KM = 40075;
        var span = Math.max(3, Math.sqrt(this.maxVisibleTiles));
        var altKm = Math.max(1, (distInRadii - 1) * (EARTH_KM / (2 * Math.PI)));
        var fovDeg = this.viewFovDeg || 45;
        var viewKm = Math.max(1, 2 * altKm * Math.tan((fovDeg * Math.PI / 180) / 2));
        var coverKm = span * EARTH_KM * (Number.isFinite(this._latCos) ? this._latCos : 1) / Math.pow(2, fetchZ);
        this._lastCover = coverKm / viewKm;   // exposed for tests / debugging
        var cover = smooth(0.45, 0.9, this._lastCover);
        var lvl = Math.max(0, Math.min(5, fetchZ - this.minZoom));          // 0..5 for z9..z14
        var OP = [0.55, 0.62, 0.72, 0.82, 0.92, 1.0], WD = [0.42, 0.47, 0.56, 0.68, 0.82, 0.95];
        var op = band * cover * OP[lvl];
        var wd = WD[lvl];
        if (Math.abs(op - this._zoomOpacity) < 0.004 && wd === this._zoomWidth) return false;
        this._zoomOpacity = op; this._zoomWidth = wd;
        var m = this._sharedMat;
        // material.visible=false while faded out: no draw calls for invisible lines.
        if (m) { m.opacity = this.styleOpacity * op; m.linewidth = Math.max(0.75, this.styleWidth * wd); m.visible = op > 0.005; }
        var fop = this.styleOpacity * op;
        this.tiles.forEach(function (rec) {           // fallback per-tile materials
            var mm = rec.mesh && rec.mesh.userData && rec.mesh.userData.ownMat;
            if (mm) { mm.opacity = fop; mm.visible = op > 0.005; }
        });
        return true;
    }

    // PREDICTIVE STREAMING — shift the covering set toward where the camera is HEADING.
    //
    // Straight out of how open-world engines stream: the world is loaded just ahead of
    // where you are moving, and the faster you move the further ahead it reaches. This
    // engine previously centred the covering set on the camera's CURRENT look-at, so
    // while panning, every newly-needed tile was only requested at the moment it was
    // already on screen — guaranteeing it arrives late. Leading the centre by the
    // measured pan velocity buys the fetch a head start of roughly `LEAD_SECONDS`.
    //
    // The counterpart is already in place: _abortStale() cancels in-flight fetches whose
    // keys leave the desired set, which is exactly the "reprioritise the queue on a
    // U-turn" behaviour — reversing direction drops the now-wrong lead tiles instead of
    // letting them land unused.
    //
    // Mutates `c` in place (no per-frame allocation). Rule 5: 2 asserts.
    _applyLead(c, fetchZ) {
        console.assert(c && Number.isFinite(c.x), '_applyLead: tile coords required');
        console.assert(Number.isFinite(fetchZ), '_applyLead: zoom required');
        var now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        var LEAD_SECONDS = 0.6;      // how far ahead to reach
        var MAX_LEAD_TILES = 2.5;    // never overshoot the covering ring itself
        var prev = this._leadPrev;
        if (prev && prev.z === fetchZ) {
            var dt = (now - prev.t) / 1000;
            if (dt > 0.008 && dt < 0.5) {                 // ignore stalls and dupe ticks
                var vx = (c.x - prev.x) / dt;             // tiles per second
                var vy = (c.y - prev.y) / dt;
                var lx = vx * LEAD_SECONDS, ly = vy * LEAD_SECONDS;
                var mag = Math.hypot(lx, ly);
                if (mag > MAX_LEAD_TILES) { var s = MAX_LEAD_TILES / mag; lx *= s; ly *= s; }
                // Smooth so a single jittery tick cannot fling the covering set.
                this._leadX = (this._leadX || 0) * 0.6 + lx * 0.4;
                this._leadY = (this._leadY || 0) * 0.6 + ly * 0.4;
            }
        } else {
            this._leadX = 0; this._leadY = 0;             // new zoom level: no history
        }
        // Pooled, not reallocated: update() runs ~9x/sec and this file's contract is no
        // per-frame allocation. Stores the RAW look-at, never the lead-adjusted one —
        // measuring velocity from an already-led position would compound each tick and
        // run the covering set away from the camera.
        if (!this._leadPrev) this._leadPrev = { x: 0, y: 0, z: -1, t: 0 };
        this._leadPrev.x = c.x; this._leadPrev.y = c.y;
        this._leadPrev.z = fetchZ; this._leadPrev.t = now;
        c.x += (this._leadX || 0);
        c.y += (this._leadY || 0);
        return c;
    }

    // Exponential backoff with EQUAL JITTER for a failed tile.
    //
    // The old rule was a flat 30s retry, which is a textbook thundering herd: a zoom
    // step invalidates the whole covering set at once, so when the network or the
    // tile host has a bad moment ALL of them fail in the same tick, and a fixed delay
    // makes all of them retry in the same tick too - forever, every 30s. Measured in
    // a headless run: 49 of 49 street tiles failed together. A fixed backoff turns one
    // outage into a self-sustaining pulse against a host that is already unhappy.
    //
    // Equal jitter (half fixed + half random) spreads the retries across the window
    // while still guaranteeing a real minimum wait, and doubling the window per
    // attempt stops a persistently dead tile from being retried forever at full rate.
    // Attempts live in a side map because the tile record is deleted on each retry.
    // Rule 5: 2 asserts.
    _scheduleRetry(key, now) {
        console.assert(typeof key === 'string', '_scheduleRetry: key required');
        console.assert(Number.isFinite(now), '_scheduleRetry: timestamp required');
        var BASE = 30000, MAX = 300000, FLOOR = 2000;   // 30s → capped at 5 min
        var attempts = (this._retryAttempts.get(key) || 0) + 1;
        if (this._retryAttempts.size < 500) this._retryAttempts.set(key, attempts);  // Rule 2: bounded
        var window_ = Math.min(BASE * Math.pow(2, attempts - 1), MAX);
        // FULL jitter across the whole window, not half of it. Equal jitter
        // (window/2 + random(window/2)) was tried first and only cut the worst 5s
        // burst 2.6x, because it confines every retry to the back half. Spreading
        // across the full window cuts it ~5x. FLOOR keeps a just-failed tile from
        // retrying on the very next tick.
        return now + FLOOR + Math.random() * (window_ - FLOOR);
    }

    // Abort in-flight fetches for keys that fell out of the desired covering set
    // (fast zoom/pan moved on before the tile was needed) - real network-level
    // cancellation, not just discarding the result once it lands. Rule 5: 2 asserts.
    _abortStale() {
        console.assert(this._building instanceof Set, '_abortStale: building set required');
        console.assert(this._abortControllers instanceof Map, '_abortStale: controllers map required');
        var self = this;
        this._building.forEach(function (key) {
            if (self._desiredKeys.has(key)) return;
            var ctrl = self._abortControllers.get(key);
            if (ctrl) { ctrl.abort(); self._abortControllers.delete(key); }
            self._building.delete(key);
        });
    }

    // A6: enumerate the bounded ring of covering tiles, sort by Chebyshev distance
    // from centre (max(|dx|,|dy|)), keep the NEAREST maxVisibleTiles so the kept set
    // stays centred on the look-at (the old column-major break clipped east tiles).
    // No per-frame allocation: reuses _scratchCands + _scratchKeys. Rule 4: <=60.
    _buildCoveringKeys(cx, cy, n, fetchZ, fx, fy) {
        console.assert(Number.isFinite(cx) && Number.isFinite(cy), '_buildCoveringKeys: center required');
        console.assert(Number.isFinite(n) && n > 0, '_buildCoveringKeys: tile count required');
        var cands = this._scratchCands;     // pooled {key,d} objects (reused across frames)
        var count = 0;
        var hasFrac = Number.isFinite(fx) && Number.isFinite(fy);
        var ax = hasFrac ? fx : (cx + 0.5), ay = hasFrac ? fy : (cy + 0.5);
        var ring = (this.maxVisibleTiles > 25) ? 4 : ((this.maxVisibleTiles > 9) ? 2 : 1);  // up to 9x9, Rule 2 bounded
        for (var dx = -ring; dx <= ring; dx++) {
            for (var dy = -ring; dy <= ring; dy++) {
                var ty = cy + dy;
                if (ty < 0 || ty >= n) continue;
                var tx = ((cx + dx) % n + n) % n;
                var slot = cands[count] || (cands[count] = { key: '', d: 0 });
                slot.key = fetchZ + '/' + tx + '/' + ty;
                // Chebyshev from TILE CENTRE to the fractional look-at → kept set centred
                // on where the camera points (was floor-biased toward the lower-left).
                slot.d = Math.max(Math.abs((cx + dx + 0.5) - ax), Math.abs((cy + dy + 0.5) - ay));
                count++;
            }
        }
        // Sort only the live prefix [0,count) so pooled objects beyond it survive.
        this._sortCandsPrefix(count);
        var keys = this._scratchKeys; keys.length = 0;
        var max = Math.min(count, this.maxVisibleTiles);          // Rule 2 bounded
        for (var i = 0; i < max; i++) keys.push(cands[i].key);
        return keys;
    }

    // Stable insertion-sort of the first `count` pooled candidates by ascending d
    // (Chebyshev distance). In-place so pooled objects past `count` are untouched;
    // count <= ring set <= 25 so it's bounded. Rule 5: 2 asserts.
    _sortCandsPrefix(count) {
        console.assert(Number.isFinite(count) && count >= 0, '_sortCandsPrefix: count required');
        console.assert(Array.isArray(this._scratchCands), '_sortCandsPrefix: pool required');
        var c = this._scratchCands;
        for (var i = 1; i < count; i++) {
            var cur = c[i];
            var j = i - 1;
            while (j >= 0 && c[j].d > cur.d) { c[j + 1] = c[j]; j--; }
            c[j + 1] = cur;
        }
        return true;
    }

    // A1/A2: touch a built tile, or (re)dispatch a build. Failed records do NOT
    // refresh their timestamp (so they stay old and evictable); after 30s a failed
    // record is dropped and retried (handles transient 503/429). Rule 5: 2 asserts.
    _touchOrBuild(key, now) {
        console.assert(typeof key === 'string', '_touchOrBuild: string key required');
        console.assert(Number.isFinite(now), '_touchOrBuild: timestamp required');
        var rec = this.tiles.get(key);
        if (rec) {
            if (rec.state === 'failed') {
                if (now >= rec.retryAt) {
                    this.tiles.delete(key);
                    if (!this._building.has(key) && this._building.size < this.maxConcurrentBuilds) {
                        this._buildTileKey(key, now);
                    }
                }
                return false;                 // do not refresh t → stays evictable
            }
            rec.t = now;
            if (rec.mesh) this._setMeshVisible(rec.mesh, true);
            return true;
        }
        // Concurrency gate: skip dispatching if already at the in-flight budget -
        // retried automatically next update() tick, no bookkeeping needed. See
        // maxConcurrentBuilds note in the constructor.
        if (!this._building.has(key) && this._building.size < this.maxConcurrentBuilds) {
            this._buildTileKey(key, now);
        }
        return false;
    }

    // Resolve the version-dated OpenFreeMap tile URL template once. Fail-soft.
    _resolveTemplate() {
        console.assert(this.tileJsonUrl, '_resolveTemplate: tilejson url required');
        console.assert(!this.tileTemplate, '_resolveTemplate: only resolve once');
        if (this._templatePromise) return this._templatePromise;
        var self = this;
        this._templatePromise = fetch(this.tileJsonUrl)
            .then(function (r) { if (!r || !r.ok) throw new Error('tilejson ' + (r && r.status)); return r.json(); })
            .then(function (j) {
                if (j && Array.isArray(j.tiles) && j.tiles[0]) { self.tileTemplate = j.tiles[0]; }
                else { throw new Error('tilejson: no tiles[]'); }
            })
            .catch(function (e) {
                console.warn('StreetTiles: tilejson resolve failed:', e.message);
                self._templatePromise = null;
                self._templateFailedAt = Date.now();     // A7: start the backoff window
            });
        return this._templatePromise;
    }

    // Parse a "z/x/y" key and dispatch the async build. Rule 5: 2 asserts.
    _buildTileKey(key, now) {
        console.assert(typeof key === 'string', '_buildTileKey: string key required');
        console.assert(this.tileTemplate, '_buildTileKey: template resolved');
        var p = key.split('/');
        var z = parseInt(p[0], 10), x = parseInt(p[1], 10), y = parseInt(p[2], 10);
        if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) return;
        this._building.add(key);
        var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        if (controller) this._abortControllers.set(key, controller);
        var self = this;
        this._buildTile(z, x, y, controller ? controller.signal : undefined).then(function (mesh) {
            self._building.delete(key);
            self._abortControllers.delete(key);
            // A2: instance was disposed while this fetch was in flight — never re-add an
            // orphan mesh to the disposed engine; dispose the just-built mesh instead.
            if (self._disposed) { if (mesh && mesh !== StreetTiles.EMPTY) self._disposeMesh(mesh); return; }
            // A1: failed records keep an old t + failedAt so they stay evictable and
            // can retry after the backoff (see _touchOrBuild).
            // F4: an EMPTY tile (open sea, or no road of a class drawn at this zoom) is a
            // finished tile, not a failure. It used to be counted as failed, retried with
            // backoff forever, and it kept the covering set from ever being complete.
            if (mesh === StreetTiles.EMPTY) {
                self._retryAttempts.delete(key);
                self.failStreak = 0;           // an empty tile is still an answer
                self.tiles.set(key, { mesh: null, t: now, state: 'empty', z: z });
                return;
            }
            if (!mesh) { self.failed++; self.failStreak++; self.tiles.set(key, { mesh: null, t: now, state: 'failed', retryAt: self._scheduleRetry(key, now) }); return; }
            self.failStreak = 0;               // the host answered with a real tile
            // Not parented yet: the next update() attaches it when it is shown (R2 #5).
            self._retryAttempts.delete(key);   // recovered → next failure starts at attempt 1
            self.tiles.set(key, { mesh: mesh, t: now, state: 'built', z: z });
            self._evict();
        }).catch(function (e) {
            self._building.delete(key);
            self._abortControllers.delete(key);
            // Cancelled because the key fell out of the desired set mid-flight (see
            // _abortStale) - not a real failure, don't apply the 30s retry backoff.
            if (e && e.name === 'AbortError') return;
            self.failed++; self.failStreak++;
            self.tiles.set(key, { mesh: null, t: now, state: 'failed', retryAt: self._scheduleRetry(key, now) });
            console.warn('StreetTiles: tile ' + key + ' failed:', e && e.message);
        });
    }

    /**
     * Fetch + decode one .pbf tile, project its line features onto the sphere,
     * and return ONE THREE.LineSegments (merged layers). Long segments are
     * subdivided so roads follow the curvature. Fail-soft → resolves null.
     * Rule 4: <=60 lines.
     * @param {AbortSignal} [signal] - aborts the fetch if the tile falls out of the
     *   desired set mid-flight (see _abortStale)
     * @returns {Promise<THREE.LineSegments|null>}
     */
    async _buildTile(z, x, y, signal) {
        console.assert(typeof MVT !== 'undefined', '_buildTile: MVT decoder required');
        console.assert(typeof GlobeMath !== 'undefined', '_buildTile: GlobeMath required');
        if (typeof MVT === 'undefined' || typeof GlobeMath === 'undefined') return null;
        var url = this.tileTemplate.replace('{z}', z).replace('{x}', x).replace('{y}', y);
        var res = await fetch(url, signal ? { signal: signal } : undefined);
        if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status));
        var bytes = new Uint8Array(await res.arrayBuffer());
        if (!bytes.length) return StreetTiles.EMPTY;
        var layers = MVT.decode(bytes);
        var fat = this._fatOK();
        // Casing and per-class width need the patched fat-line shader (_widthOK).
        var out = { verts: [], cols: [], widths: [], caseVerts: [], caseCols: [], caseWidths: [],
            casing: fat && this._widthOK() };
        for (var li = 0; li < this.lineLayers.length; li++) {
            var layer = layers[this.lineLayers[li]];
            if (!layer || !layer.features) continue;
            this._appendLayer(layer, this.lineLayers[li], z, x, y, out);
        }
        var verts = out.verts, cols = out.cols;
        if (!verts.length) return StreetTiles.EMPTY;   // ocean, or no road of a drawn class
        var mesh;
        if (fat) {
            // Fat lines: real PIXEL-width streets via a SHARED LineMaterial (colour/
            // opacity/linewidth + viewport resolution all live on the one material).
            // R1 #10: casings first, then fills: one draw, drawn in buffer order.
            var fatGeo = new THREE.LineSegmentsGeometry();
            fatGeo.setPositions(out.caseVerts.length ? out.caseVerts.concat(verts) : verts);
            fatGeo.setColors(out.caseCols.length ? out.caseCols.concat(cols) : cols);   // per-class weight (roadWeight)
            var widths = out.caseWidths.length ? out.caseWidths.concat(out.widths) : out.widths;
            fatGeo.setAttribute('instanceWidth', new THREE.InstancedBufferAttribute(new Float32Array(widths), 2));
            fatGeo.userData.casingSegments = out.caseVerts.length / 6;    // for tests / stats
            mesh = new THREE.LineSegments2(fatGeo, this._ensureLineMat());
            mesh.userData.ownGeo = fatGeo;   // dispose per-tile; material is shared
        } else {
            // Graceful fallback (1px) if the fat-line classes didn't load.
            var geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
            var material = new THREE.LineBasicMaterial({
                color: this.styleColor, transparent: true, opacity: this.styleOpacity * this._zoomOpacity,
                depthWrite: false, depthTest: true, vertexColors: true
            });
            material.visible = this._zoomOpacity > 0.005;
            mesh = new THREE.LineSegments(geometry, material);
            mesh.userData.ownMat = material;
        }
        // Start hidden: update()/_touchOrBuild shows it next frame. Prevents a build
        // that resolves AFTER hide() (explore exit) from lingering visible on the globe.
        mesh.visible = false;
        mesh.matrixAutoUpdate = false;       // identity in globe-local space: never recompose
        return mesh;
    }

    // F4 ROAD-CLASS HIERARCHY. Before this every line in the tile was drawn at one
    // width and brightness: at z9 a single Stuttgart tile is ~10.5k segments, 4.8k of
    // them secondary roads, so 49 tiles painted the view white. Classes now appear by
    // zoom the way map styles do (motorways first, minor roads only when close), and
    // each class has a weight that dims its colour, so the hierarchy reads at a glance.
    // Weight 0 (a class missing from the table, or below its first zoom) = not drawn.
    // Pure. Rule 5: 2 asserts.
    static roadWeight(layerName, cls, z) {
        console.assert(typeof layerName === 'string', 'roadWeight: layer name required');
        console.assert(Number.isFinite(z), 'roadWeight: zoom required');
        var t = StreetTiles.ROAD_CLASSES[layerName];
        var c = t && t[String(cls || '').replace(/_construction$/, '')];
        if (!c || z < c[0]) return 0;
        return c[1];
    }

    // R1 #10: width multiplier of a road class (1 = the base width) and whether it is
    // cased. `_construction` variants map to their base class. Pure. Rule 5: 2 asserts.
    static roadWidth(layerName, cls) {
        console.assert(typeof layerName === 'string', 'roadWidth: layer name required');
        console.assert(StreetTiles.ROAD_WIDTHS, 'roadWidth: width table required');
        var key = String(cls || '').replace(/_construction$/, '');
        var t = StreetTiles.ROAD_WIDTHS[layerName];
        var c = StreetTiles.CASED_CLASSES[layerName];
        return { mul: (t && t[key]) || 1, cased: !!(c && c[key]) };
    }

    // Append one decoded layer's line features as sphere-projected segment pairs, with
    // a per-vertex colour weight per road class (cols, 3 floats per vertex) and a per-
    // segment width (widths: multiplier, extra px). Long chords are subdivided so straight
    // roads bend with the globe. R1 #10: cased classes are also copied into the case*
    // arrays (wider by CASING_PX, dark), which _buildTile puts FIRST in the buffer so
    // every fill is drawn over every casing of its tile. Rule 4: <=60.
    _appendLayer(layer, layerName, z, x, y, out) {
        console.assert(layer && layer.features, '_appendLayer: layer required');
        console.assert(out && Array.isArray(out.verts) && Array.isArray(out.cols), '_appendLayer: output arrays required');
        var extent = layer.extent || 4096;
        var r = this.radius * this.rOffset;
        var fmax = Math.min(layer.features.length, 4000);     // Rule 2: bounded
        var tint = (layerName === 'waterway') ? [0.62, 0.8, 1.0] : [1, 1, 1];
        var verts = out.verts, cw = StreetTiles.CASING_WEIGHT;
        for (var fi = 0; fi < fmax; fi++) {
            var f = layer.features[fi];
            if (!f || f.type !== MVT.GEOM_LINESTRING || !f.geometry) continue;
            var cls = f.properties && f.properties.class;
            var w = StreetTiles.roadWeight(layerName, cls, z);
            if (w <= 0) continue;
            var rw = StreetTiles.roadWidth(layerName, cls);
            var before = verts.length;
            for (var ri = 0; ri < f.geometry.length; ri++) {
                var ring = f.geometry[ri];
                if (!ring || ring.length < 2) continue;
                for (var pi = 0; pi < ring.length - 1; pi++) {
                    this._emitSegment(ring[pi], ring[pi + 1], extent, z, x, y, r, verts);
                }
            }
            var cased = rw.cased && out.casing && z >= StreetTiles.CASING_MIN_Z;
            for (var vi = before; vi < verts.length; vi += 6) {
                out.cols.push(tint[0] * w, tint[1] * w, tint[2] * w, tint[0] * w, tint[1] * w, tint[2] * w);
                out.widths.push(rw.mul, 0);
                if (!cased) continue;
                for (var k = 0; k < 6; k++) out.caseVerts.push(verts[vi + k]);
                out.caseCols.push(cw, cw, cw, cw, cw, cw);
                out.caseWidths.push(rw.mul, StreetTiles.CASING_PX);
            }
        }
    }

    // Emit one tile-local segment as 1+ sphere segment-pairs, subdividing long
    // chords at the lon/lat level so the line hugs the sphere. Rule 4: <=60.
    _emitSegment(a, b, extent, z, x, y, r, verts) {
        console.assert(a && b, '_emitSegment: endpoints required');
        console.assert(extent > 0, '_emitSegment: extent required');
        var span = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        var steps = 1 + Math.min(8, Math.floor(span / this.subdivideUnits));  // Rule 2: bounded
        var prev = this._tileLocalToVec3(a.x, a.y, extent, z, x, y, r);
        for (var s = 1; s <= steps; s++) {
            var t = s / steps;
            var mx = a.x + (b.x - a.x) * t, my = a.y + (b.y - a.y) * t;
            var cur = this._tileLocalToVec3(mx, my, extent, z, x, y, r);
            verts.push(prev.x, prev.y, prev.z, cur.x, cur.y, cur.z);
            prev = cur;
        }
    }

    // tile-local (0..extent) → lon/lat → sphere Vector3. Rule 5: 2 asserts.
    _tileLocalToVec3(px, py, extent, z, x, y, r) {
        console.assert(typeof GlobeMath !== 'undefined', '_tileLocalToVec3: GlobeMath required');
        console.assert(extent > 0, '_tileLocalToVec3: extent required');
        var fx = x + px / extent, fy = y + py / extent;
        var ll = StreetTiles.tileToLngLat(fx, fy, z);
        return GlobeMath.latLngToVector3(ll.lat, ll.lng, r);
    }

    // ---- fade / lifecycle --------------------------------------------------

    // Cross-fade a tile's opacity in (one short rAF, bounded). Rule 5: 2 asserts.
    _startFade(mesh) {
        console.assert(mesh && mesh.material, '_startFade: mesh required');
        console.assert(mesh.userData, '_startFade: userData required');
        // A5: snap to target (no animation) when the user prefers reduced motion.
        if (this.reducedMotion || typeof requestAnimationFrame === 'undefined') {
            mesh.material.opacity = mesh.userData.fadeTarget; return;
        }
        var step = function () {
            if (!mesh.material) return;
            var d = mesh.userData.fadeTarget - mesh.material.opacity;
            if (Math.abs(d) < 0.02) { mesh.material.opacity = mesh.userData.fadeTarget; return; }
            mesh.material.opacity += d * 0.15;
            requestAnimationFrame(step);
        };
        step();
    }

    // LRU-evict beyond lruCap, disposing geometry + material. Rule 4: <=60.
    _evict() {
        console.assert(this.tiles instanceof Map, '_evict: tiles map required');
        console.assert(this.lruCap > 0, '_evict: positive cap');
        if (this.tiles.size <= this.lruCap) return;
        // Collect [key, t] and sort oldest-first (bounded by map size).
        var entries = [];
        this.tiles.forEach(function (rec, key) { entries.push([key, rec.t]); });
        entries.sort(function (p, q) { return p[1] - q[1]; });
        var toRemove = this.tiles.size - this.lruCap;
        var max = Math.min(toRemove, entries.length);             // Rule 2: bounded
        for (var i = 0; i < max; i++) {
            var key = entries[i][0];
            var rec = this.tiles.get(key);
            if (rec && rec.mesh) this._disposeMesh(rec.mesh);
            this.tiles.delete(key);
        }
    }

    // Dispose one tile mesh (geometry + material) + unparent. Rule 5: 2 asserts.
    _disposeMesh(mesh) {
        console.assert(mesh === null || typeof mesh === 'object', '_disposeMesh: bad arg');
        console.assert(this.earthMesh, '_disposeMesh: earthMesh required');
        if (!mesh) return false;
        if (mesh.userData && mesh.userData.ownGeo && mesh.userData.ownGeo.dispose) mesh.userData.ownGeo.dispose();
        else if (mesh.geometry && mesh.geometry.dispose) mesh.geometry.dispose();
        // Only dispose a PER-TILE material (fallback path). The fat-line material is
        // SHARED across all tiles — disposing it per-tile would blank the whole layer;
        // it's freed in dispose().
        if (mesh.userData && mesh.userData.ownMat && mesh.userData.ownMat.dispose) mesh.userData.ownMat.dispose();
        mesh.material = null;
        if (mesh.parent) mesh.parent.remove(mesh);
        return true;
    }

    // ---- public API --------------------------------------------------------

    // User toggle: enable/disable the whole layer. Rule 5: 2 asserts.
    setVisible(vis) {
        console.assert(typeof vis === 'boolean', 'setVisible: boolean required');
        console.assert(this.tiles instanceof Map, 'setVisible: tiles map required');
        this.visible = !!vis;
        // F4: switching ON used to show EVERY cached tile (up to lruCap, any zoom, any
        // place), and the steady-state early-out then kept them all up - fine z13/14
        // tiles over a z9 view are exactly the dense white squares. Hide on off; on on,
        // let the next update() pick the current covering set.
        if (!this.visible) this._showTiles(false);
        this._lastAllReady = false;
        return this.visible;
    }

    // Are the fat-line classes available? (graceful fallback to 1px if not.) Rule 5.
    _fatOK() {
        console.assert(typeof THREE !== 'undefined', '_fatOK: THREE required');
        console.assert(this !== undefined, '_fatOK: instance');
        return !!(THREE.LineSegments2 && THREE.LineSegmentsGeometry && THREE.LineMaterial);
    }

    // Lazily create the ONE shared fat-line material (colour/opacity/px-width + the
    // viewport resolution fat lines need). Kept in sync with resize. Rule 4: <=60.
    _ensureLineMat() {
        console.assert(typeof THREE !== 'undefined', '_ensureLineMat: THREE required');
        console.assert(this._fatOK(), '_ensureLineMat: fat lines required');
        if (this._sharedMat) return this._sharedMat;
        var w = (typeof window !== 'undefined') ? window.innerWidth : 1280;
        var h = (typeof window !== 'undefined') ? window.innerHeight : 800;
        this._sharedMat = new THREE.LineMaterial({
            color: this.styleColor, linewidth: Math.max(0.75, this.styleWidth * this._zoomWidth), transparent: true,
            opacity: this.styleOpacity * this._zoomOpacity, depthTest: true, depthWrite: false, dashed: false,
            vertexColors: true
        });
        this._sharedMat.visible = this._zoomOpacity > 0.005;
        this._patchWidthShader(this._sharedMat);
        // CSS px on purpose, not device px: three's LineSegments2.onBeforeRender resets
        // resolution to renderer.getViewport() (CSS px) every draw, so linewidth stays in
        // CSS px and a pixel ratio > 1 only makes the same-width street sharper (R2 #9).
        this._sharedMat.resolution.set(w, h);
        var self = this;
        this._onResize = function () { if (self._sharedMat && typeof window !== 'undefined') self._sharedMat.resolution.set(window.innerWidth, window.innerHeight); };
        if (typeof window !== 'undefined') window.addEventListener('resize', this._onResize);
        return this._sharedMat;
    }

    // R1 #10: can the line shader take a per-segment width? Checks the exact r184 source
    // lines the patch replaces, so a three.js upgrade that changes them falls back to
    // the old look (one width, no casing) instead of drawing a wrong one. Rule 5.
    _widthOK() {
        console.assert(typeof THREE !== 'undefined', '_widthOK: THREE required');
        console.assert(this !== undefined, '_widthOK: instance');
        var lib = THREE.ShaderLib && THREE.ShaderLib.line;
        var vs = lib && lib.vertexShader;
        return !!(typeof vs === 'string' && THREE.InstancedBufferAttribute &&
            vs.indexOf(StreetTiles.WIDTH_ANCHOR_ATTR) >= 0 && vs.indexOf(StreetTiles.WIDTH_ANCHOR_MUL) >= 0);
    }

    // R1 #10 PER-SEGMENT WIDTH, the cheapest robust way to draw width classes. WebGL
    // lines are 1 px; LineMaterial already draws each segment as an instanced screen-
    // space quad whose half-width is the `linewidth` uniform. Adding one per-instance
    // vec2 (multiplier, extra px) to that one line keeps every class in ONE material and
    // ONE draw per tile, at 8 bytes per segment. The alternatives cost more: a material
    // per class = 2-3 draws per tile and the geometry split by class; casing as its own
    // mesh = another draw per tile. Casing segments ride in the same buffer, in front of
    // the fills, so in-order blending draws every fill over every casing. Rule 5.
    _patchWidthShader(mat) {
        console.assert(mat && mat.isShaderMaterial, '_patchWidthShader: line material required');
        console.assert(typeof StreetTiles.WIDTH_ANCHOR_MUL === 'string', '_patchWidthShader: anchors required');
        if (!this._widthOK()) { mat.userData.widthPatched = false; return false; }
        mat.onBeforeCompile = function (shader) {
            var vs = shader.vertexShader;
            if (vs.indexOf(StreetTiles.WIDTH_ANCHOR_MUL) < 0) return;      // not the r184 line shader
            vs = vs.replace(StreetTiles.WIDTH_ANCHOR_ATTR, StreetTiles.WIDTH_ANCHOR_ATTR + '\n\t\tattribute vec2 instanceWidth;');
            shader.vertexShader = vs.replace(StreetTiles.WIDTH_ANCHOR_MUL,
                'offset *= linewidth * instanceWidth.x + instanceWidth.y;');
            mat.userData.widthPatched = true;
        };
        mat.customProgramCacheKey = function () { return 'street-width-1'; };
        return true;
    }

    // User STYLE: set the street colour (hex int), opacity (0..1) and/or line WIDTH
    // (pixels, fat-lines only). With fat lines one SHARED material covers all tiles;
    // the fallback updates each per-tile material. Rule 4: <=60 lines.
    setStyle(opts) {
        console.assert(opts && typeof opts === 'object', 'setStyle: opts required');
        console.assert(this.tiles instanceof Map, 'setStyle: tiles map required');
        if (Number.isFinite(opts.color)) this.styleColor = opts.color;
        if (Number.isFinite(opts.opacity)) this.styleOpacity = Math.max(0, Math.min(1, opts.opacity));
        if (Number.isFinite(opts.width)) this.styleWidth = Math.max(0.5, Math.min(12, opts.width));
        if (this._sharedMat) {
            if (this._sharedMat.color) this._sharedMat.color.setHex(this.styleColor);
            this._sharedMat.opacity = this.styleOpacity * this._zoomOpacity;
            if ('linewidth' in this._sharedMat) this._sharedMat.linewidth = Math.max(0.75, this.styleWidth * this._zoomWidth);
            this._sharedMat.needsUpdate = true;
        }
        var col = this.styleColor, op = this.styleOpacity * this._zoomOpacity;
        this.tiles.forEach(function (rec) {           // fallback per-tile materials
            var m = rec.mesh && rec.mesh.userData && rec.mesh.userData.ownMat;
            if (m) { if (m.color) m.color.setHex(col); m.opacity = op; }
        });
        return true;
    }

    // Per-frame mesh show/hide WITHOUT touching the user-visible toggle. Rule 5: 2 asserts.
    _showTiles(vis) {
        console.assert(typeof vis === 'boolean', '_showTiles: boolean required');
        console.assert(this.tiles instanceof Map, '_showTiles: tiles map required');
        var self = this;
        this.tiles.forEach(function (rec) { if (rec.mesh) self._setMeshVisible(rec.mesh, vis); });
        return vis;
    }

    // R2 #5: show/hide one tile AND attach/detach it. A hidden tile is not rendered,
    // but while parented it was still walked by every updateMatrixWorld (render's and
    // GlobeMarkers') each frame. Detached tiles cost nothing; the matrix is identity in
    // globe-local space (matrixAutoUpdate off), so re-attaching needs no recompute.
    // Rule 5: 2 asserts.
    _setMeshVisible(mesh, vis) {
        console.assert(mesh && typeof mesh === 'object', '_setMeshVisible: mesh required');
        console.assert(this.earthMesh, '_setMeshVisible: earthMesh required');
        mesh.visible = !!vis;
        if (vis) { if (mesh.parent !== this.earthMesh) this.earthMesh.add(mesh); }
        else if (mesh.parent) mesh.parent.remove(mesh);
        return mesh.visible;
    }

    // R2 #5: start the idle-trim timer once (idempotent). Rule 5: 2 asserts.
    _armTrim() {
        console.assert(Number.isFinite(this.trimDelayMs), '_armTrim: delay required');
        console.assert(this.tiles instanceof Map, '_armTrim: tiles map required');
        if (this._trimTimer || this._disposed || typeof setTimeout === 'undefined') return false;
        if (this.tiles.size <= this.warmKeep && this._building.size === 0) return false;
        var self = this;
        this._trimTimer = setTimeout(function () {
            self._trimTimer = null;
            if (!self._disposed) self.trimCache(self.warmKeep);
        }, this.trimDelayMs);
        return true;
    }

    // Rule 5: 2 asserts.
    _cancelTrim() {
        console.assert(this !== undefined, '_cancelTrim: instance');
        console.assert(this.tiles instanceof Map, '_cancelTrim: tiles map required');
        if (!this._trimTimer) return false;
        clearTimeout(this._trimTimer);
        this._trimTimer = null;
        return true;
    }

    /**
     * R2 #5: shrink the cache to the `keep` most recently used built tiles, disposing
     * the rest and dropping failed/empty records; cancels in-flight fetches. Called by
     * the idle timer; safe any time (the next update() refetches what it needs).
     * @returns {number} tiles disposed. Rule 4: <=60 lines.
     */
    trimCache(keep) {
        console.assert(Number.isFinite(keep) && keep >= 0, 'trimCache: keep count required');
        console.assert(this.tiles instanceof Map, 'trimCache: tiles map required');
        this._abortControllers.forEach(function (ctrl) { ctrl.abort(); });
        this._abortControllers.clear();
        this._building.clear();
        var entries = [];
        this.tiles.forEach(function (rec, key) { entries.push([key, rec.mesh ? rec.t : -Infinity]); });
        entries.sort(function (p, q) { return q[1] - p[1]; });              // newest first
        var removed = 0;
        for (var i = 0; i < entries.length; i++) {                           // Rule 2: bounded
            var rec = this.tiles.get(entries[i][0]);
            if (i < keep && rec && rec.mesh) continue;
            if (rec && rec.mesh) { this._disposeMesh(rec.mesh); removed++; }
            this.tiles.delete(entries[i][0]);
        }
        this._retryAttempts.clear();
        this._lastAllReady = false;          // next update() must run the full path
        return removed;
    }

    // Hide all built tiles WITHOUT disabling the engine (preserves this.visible so a
    // later re-entry shows them again). Used on explore exit, since update() — which
    // normally drives range-based show/hide — stops being called outside explore.
    // Rule 5: 2 asserts.
    hide() {
        console.assert(this.tiles instanceof Map, 'StreetTiles.hide: tiles map required');
        console.assert(typeof this._showTiles === 'function', 'StreetTiles.hide: _showTiles required');
        this._showTiles(false);
        // R2 #5: nothing in flight is wanted after exit; arm the idle trim.
        this._abortControllers.forEach(function (ctrl) { ctrl.abort(); });
        this._abortControllers.clear();
        this._building.clear();
        this._lastAllReady = false;
        this._armTrim();
        return true;
    }

    // Status snapshot (built / failed / visible counts). Rule 5: 2 asserts.
    getStatus() {
        console.assert(this.tiles instanceof Map, 'getStatus: tiles map required');
        console.assert(typeof this.failed === 'number', 'getStatus: failed counter');
        var built = 0, vis = 0;
        this.tiles.forEach(function (rec) {
            if (rec.state === 'built') built++;
            if (rec.mesh && rec.mesh.visible) vis++;
        });
        return { built: built, failed: this.failed, visible: vis, total: this.tiles.size,
            template: this.tileTemplate, building: this._building.size, failStreak: this.failStreak,
            // The TileJSON lookup failed and no template is known yet: no street tile can load.
            templateDown: !this.tileTemplate && this._templateFailedAt > 0 };
    }

    // Free everything (all tiles + geometry/material). Rule 5: 2 asserts.
    dispose() {
        console.assert(this.tiles instanceof Map, 'dispose: tiles map required');
        console.assert(this.earthMesh !== undefined, 'dispose: earthMesh field expected');
        this._disposed = true;   // A2: block any in-flight build from re-adding a mesh
        this._cancelTrim();
        var self = this;
        this.tiles.forEach(function (rec) { if (rec.mesh) self._disposeMesh(rec.mesh); });
        this.tiles.clear();
        // Abort any still in-flight fetches rather than letting them complete
        // uselessly against a disposed engine.
        this._abortControllers.forEach(function (ctrl) { ctrl.abort(); });
        this._abortControllers.clear();
        this._building.clear();
        this._desiredKeys.clear();
        this._scratchKeys.length = 0;
        // Free the shared fat-line material + its resize listener.
        if (this._sharedMat && this._sharedMat.dispose) this._sharedMat.dispose();
        this._sharedMat = null;
        if (this._onResize && typeof window !== 'undefined') window.removeEventListener('resize', this._onResize);
        return true;
    }
}

// Sentinel _buildTile returns for a tile that decoded fine but has nothing to draw.
StreetTiles.EMPTY = 'empty';

// F4 road-class table (OpenMapTiles schema): class -> [first zoom drawn, colour weight].
// Majors show first and brightest; minor and service roads only when close.
// `_construction` variants map to their base class. Rail/transit and waterways stay (they
// are part of the street map) but enter later and dimmer. Footpaths and tracks (over half
// of a city z14 tile), ferry, pier, aerialway and raceway lines are left out: over
// imagery they read as a grey mesh or stray strokes, not as streets.
StreetTiles.ROAD_CLASSES = {
    transportation: {
        motorway: [9, 1.0], trunk: [9, 0.95], primary: [10, 0.85], secondary: [11, 0.75],
        tertiary: [12, 0.66], minor: [13, 0.56], busway: [13, 0.5], service: [14, 0.44],
        rail: [12, 0.5], transit: [13, 0.42]
    },
    waterway: { river: [11, 0.6], canal: [12, 0.55], stream: [14, 0.4] }
};

// R1 #10 ROAD-CLASS WIDTH. Brightness alone did not separate a motorway from a side
// street: every class shared one pixel width. Each class now has a width MULTIPLIER on
// the zoom-ramped base width (classes not listed draw at 1x), and the casing classes also
// get a dark outline drawn under them. Widths are per segment (instanceWidth attribute,
// see _ensureLineMat), so all classes still share ONE material and ONE draw per tile.
StreetTiles.ROAD_WIDTHS = {
    transportation: { motorway: 1.6, trunk: 1.6, primary: 1.2, secondary: 1.1,
        minor: 0.8, busway: 0.8, service: 0.75, rail: 0.8, transit: 0.8 }
};
StreetTiles.CASED_CLASSES = { transportation: { motorway: true, trunk: true } };
// Casing = the road's own width plus CASING_PX (1 px each side), colour weight
// CASING_WEIGHT of the street colour (a dark brown under the default sand).
StreetTiles.CASING_PX = 2;
// No casing below z12: there the base width is ~1 px, the outline does not read, and at
// z9-11 motorway/trunk are most of the tile, so it would nearly double the triangles.
StreetTiles.CASING_MIN_Z = 12;
StreetTiles.CASING_WEIGHT = 0.16;
// The two r184 LineMaterial vertex-shader lines _patchWidthShader hooks (screen-px path).
StreetTiles.WIDTH_ANCHOR_ATTR = 'attribute vec3 instanceEnd;';
StreetTiles.WIDTH_ANCHOR_MUL = 'offset *= linewidth;';

// Make globally available (matches GlobeMath / SafeFetch / Earth pattern).
if (typeof window !== 'undefined') {
    window.StreetTiles = StreetTiles;
}
if (typeof module !== 'undefined' && module.exports) module.exports = StreetTiles;
