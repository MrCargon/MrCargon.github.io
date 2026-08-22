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
// so it works anywhere — San Francisco is just the proof.
//
// Patterns mirrored from Earth.js (buildBorders/buildGraticule): lazy build, one
// draw call per unit, rOffset z-lift, opacity cross-fade, dispose, fail-soft.
// NASA Power-of-10 style: bounded loops, >=2 asserts/method, methods <=60 lines,
// no per-frame allocation in update(). global THREE r128, classic script.
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
        // Just above the districts layer (1.015) so streets sit on top, not z-fight.
        this.rOffset = Number.isFinite(opts.rOffset) ? opts.rOffset : 1.0006;   // COPLANAR with the satellite map (roads IN the map; satellite has polygonOffset)
        // Activate only when the camera is closer than this (in Earth radii).
        this.activateBelow = Number.isFinite(opts.activateBelow) ? opts.activateBelow : 1.3;
        this.minZoom = 12;
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
        this._desiredKeys = new Set();       // this frame's covering set, for abort checks
        this.failed = 0;
        this.visible = true;
        // User-stylable appearance (color, opacity, pixel width), applied to all line
        // tiles via a shared fat-line material. setStyle() updates them; host persists.
        this.styleColor = Number.isFinite(opts.styleColor) ? opts.styleColor : 0x9fd8ff;
        this.styleOpacity = Number.isFinite(opts.styleOpacity) ? opts.styleOpacity : 0.65;
        this.styleWidth = Number.isFinite(opts.styleWidth) ? opts.styleWidth : 2;   // px (fat lines)
        this._sharedMat = null;   // shared LineMaterial (lazy)

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
        // distInRadii ~1.3 → z12, ~1.02 → z16 (smooth-ish log ramp).
        var t = Math.max(0, Math.min(1, (this.activateBelow - distInRadii) / (this.activateBelow - 1.01)));
        var raw = this.minZoom + t * (this.maxZoom - this.minZoom);
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
        var HYST = 0.15;
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
            return false;
        }
        // Resolve the OpenFreeMap tile template once (keyless discovery). A7: after a
        // resolve failure, back off so we don't storm requests during an outage.
        if (!this.tileTemplate) {
            if (Date.now() - this._templateFailedAt >= 10000) this._resolveTemplate();
            return true;
        }

        var z = this.zoomForDistance(cameraDistInRadii);
        var fetchZ = Math.min(z, this.dataMaxZoom);
        var n = Math.pow(2, fetchZ);
        var c = StreetTiles.lngLatToTile(centerLng, centerLat, fetchZ);
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
        var allReady = true;
        for (var i = 0; i < keys.length; i++) {
            if (!this._touchOrBuild(keys[i], now)) allReady = false;
        }
        this._lastAllReady = allReady;   // gates the steady-state early-out above
        if (allReady) {
            this.tiles.forEach(function (rec) { if (rec.mesh) rec.mesh.visible = (rec.t === now); });
        }
        this._evict();
        return true;
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
                if (now - rec.failedAt > 30000) {
                    this.tiles.delete(key);
                    if (!this._building.has(key) && this._building.size < this.maxConcurrentBuilds) {
                        this._buildTileKey(key, now);
                    }
                }
                return false;                 // do not refresh t → stays evictable
            }
            rec.t = now;
            if (rec.mesh) rec.mesh.visible = true;
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
            if (self._disposed) { if (mesh) self._disposeMesh(mesh); return; }
            // A1: failed records keep an old t + failedAt so they stay evictable and
            // can retry after the backoff (see _touchOrBuild).
            if (!mesh) { self.failed++; self.tiles.set(key, { mesh: null, t: now, state: 'failed', failedAt: now }); return; }
            self.earthMesh.add(mesh);
            self.tiles.set(key, { mesh: mesh, t: now, state: 'built' });
            self._evict();
        }).catch(function (e) {
            self._building.delete(key);
            self._abortControllers.delete(key);
            // Cancelled because the key fell out of the desired set mid-flight (see
            // _abortStale) - not a real failure, don't apply the 30s retry backoff.
            if (e && e.name === 'AbortError') return;
            self.failed++;
            self.tiles.set(key, { mesh: null, t: now, state: 'failed', failedAt: now });
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
        if (!bytes.length) return null;
        var layers = MVT.decode(bytes);
        var verts = [];
        for (var li = 0; li < this.lineLayers.length; li++) {
            var layer = layers[this.lineLayers[li]];
            if (!layer || !layer.features) continue;
            this._appendLayer(layer, z, x, y, verts);
        }
        if (!verts.length) return null;
        var mesh;
        if (this._fatOK()) {
            // Fat lines: real PIXEL-width streets via a SHARED LineMaterial (colour/
            // opacity/linewidth + viewport resolution all live on the one material).
            var fatGeo = new THREE.LineSegmentsGeometry();
            fatGeo.setPositions(verts);
            mesh = new THREE.LineSegments2(fatGeo, this._ensureLineMat());
            mesh.userData.ownGeo = fatGeo;   // dispose per-tile; material is shared
        } else {
            // Graceful fallback (1px) if the fat-line classes didn't load.
            var geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
            var material = new THREE.LineBasicMaterial({
                color: this.styleColor, transparent: true, opacity: this.styleOpacity, depthWrite: false, depthTest: true
            });
            mesh = new THREE.LineSegments(geometry, material);
            mesh.userData.ownMat = material;
        }
        // Start hidden: update()/_touchOrBuild shows it next frame. Prevents a build
        // that resolves AFTER hide() (explore exit) from lingering visible on the globe.
        mesh.visible = false;
        return mesh;
    }

    // Append one decoded layer's line features as sphere-projected segment pairs.
    // Subdivides long chords so straight roads bend with the globe. Rule 4: <=60.
    _appendLayer(layer, z, x, y, verts) {
        console.assert(layer && layer.features, '_appendLayer: layer required');
        console.assert(Array.isArray(verts), '_appendLayer: verts array required');
        var extent = layer.extent || 4096;
        var r = this.radius * this.rOffset;
        var fmax = Math.min(layer.features.length, 4000);     // Rule 2: bounded
        for (var fi = 0; fi < fmax; fi++) {
            var f = layer.features[fi];
            if (!f || f.type !== MVT.GEOM_LINESTRING || !f.geometry) continue;
            for (var ri = 0; ri < f.geometry.length; ri++) {
                var ring = f.geometry[ri];
                if (!ring || ring.length < 2) continue;
                for (var pi = 0; pi < ring.length - 1; pi++) {
                    this._emitSegment(ring[pi], ring[pi + 1], extent, z, x, y, r, verts);
                }
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
        this._showTiles(this.visible);
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
            color: this.styleColor, linewidth: this.styleWidth, transparent: true,
            opacity: this.styleOpacity, depthTest: true, depthWrite: false, dashed: false
        });
        this._sharedMat.resolution.set(w, h);
        var self = this;
        this._onResize = function () { if (self._sharedMat && typeof window !== 'undefined') self._sharedMat.resolution.set(window.innerWidth, window.innerHeight); };
        if (typeof window !== 'undefined') window.addEventListener('resize', this._onResize);
        return this._sharedMat;
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
            this._sharedMat.opacity = this.styleOpacity;
            if ('linewidth' in this._sharedMat) this._sharedMat.linewidth = this.styleWidth;
            this._sharedMat.needsUpdate = true;
        }
        var col = this.styleColor, op = this.styleOpacity;
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
        this.tiles.forEach(function (rec) { if (rec.mesh) rec.mesh.visible = vis; });
        return vis;
    }

    // Hide all built tiles WITHOUT disabling the engine (preserves this.visible so a
    // later re-entry shows them again). Used on explore exit, since update() — which
    // normally drives range-based show/hide — stops being called outside explore.
    // Rule 5: 2 asserts.
    hide() {
        console.assert(this.tiles instanceof Map, 'StreetTiles.hide: tiles map required');
        console.assert(typeof this._showTiles === 'function', 'StreetTiles.hide: _showTiles required');
        this._showTiles(false);
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
            template: this.tileTemplate, building: this._building.size };
    }

    // Free everything (all tiles + geometry/material). Rule 5: 2 asserts.
    dispose() {
        console.assert(this.tiles instanceof Map, 'dispose: tiles map required');
        console.assert(this.earthMesh !== undefined, 'dispose: earthMesh field expected');
        this._disposed = true;   // A2: block any in-flight build from re-adding a mesh
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

// Make globally available (matches GlobeMath / SafeFetch / Earth pattern).
if (typeof window !== 'undefined') {
    window.StreetTiles = StreetTiles;
}
if (typeof module !== 'undefined' && module.exports) module.exports = StreetTiles;
