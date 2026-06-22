// SatelliteTiles.js - Keyless Esri World Imagery satellite raster draped on the globe.
//
// Companion to StreetTiles.js. Where StreetTiles draws vector LineSegments at
// street zoom, this drapes real satellite IMAGERY as TEXTURED SPHERE PATCHES so
// the globe surface gains genuine per-zoom detail (like Google Earth / map apps)
// instead of looking like one flat blurry picture when you zoom in.
//
// For each covering slippy tile it builds a curved patch of (patchSegments+1)^2
// vertices spanning the tile's lon/lat bbox, projects each vertex onto the sphere
// via GlobeMath.latLngToVector3, UV-maps the Esri raster onto it, and fades it in.
// The patch sits just above the base globe (rOffset 1.0015) and BELOW the vector
// overlays (borders 1.006, streets 1.016) which still float over it.
//
// DATA: Esri World Imagery, keyless, CORS (ACAO:*), returns image/jpeg.
//   https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}
//   CRITICAL: Esri tile path is {z}/{y}/{x} (ROW before COL), NOT OSM's {z}/{x}/{y}.
//   The x/y/z math is otherwise identical Web Mercator — reuse StreetTiles math.
//
// Architecture MIRRORS StreetTiles: lazy build, LRU eviction, centered Chebyshev
// tile selection, _disposed guard, reduced-motion snap, failed-tile 30s retry,
// fail-soft. NASA Power-of-10 style: bounded loops, >=2 asserts/method, methods
// <=60 lines, no per-frame allocation in update(). global THREE r128, classic script.
class SatelliteTiles {
    /**
     * @param {THREE.Mesh} earthMesh - the globe mesh; built patches are parented to it
     * @param {number} radius - globe radius (sphere units)
     * @param {Object} [options]
     */
    constructor(earthMesh, radius, options) {
        console.assert(earthMesh && earthMesh.isObject3D, 'SatelliteTiles: earthMesh required');
        console.assert(Number.isFinite(radius) && radius > 0, 'SatelliteTiles: radius required');
        var opts = options || {};
        this.earthMesh = earthMesh;
        this.radius = radius;
        // Just above the base globe surface (1.0), BELOW borders (1.006) and streets
        // (1.016): satellite is the new crisp SURFACE; vectors still float above it.
        this.rOffset = Number.isFinite(opts.rOffset) ? opts.rOffset : 1.001;
        // Appear as soon as the camera zooms toward Earth (radii), so the whole
        // surface sharpens progressively, not only at street level.
        this.activateBelow = Number.isFinite(opts.activateBelow) ? opts.activateBelow : 2.8;
        this.minZoom = 3;            // Esri imagery starts shallow
        this.maxZoom = 17;           // upper clamp; zoomForDistance picks z to FILL the view
        // 12 tiles covered only a tiny patch (blurry base showing around it). Keep the
        // FULL 9x9 ring (81): the render zone must be LARGER than the visible view, or
        // the old blurry base globe shows around the satellite patch at close zoom
        // ("rendered map is a small cube, old picture on the sides"). lruCap bounds the
        // texture cache. zoomForDistance also picks slightly bigger tiles for coverage.
        this.maxVisibleTiles = Number.isFinite(opts.maxVisibleTiles) ? opts.maxVisibleTiles : 81;
        this.lruCap = Number.isFinite(opts.lruCap) ? opts.lruCap : 112;
        this.patchSegments = Number.isFinite(opts.patchSegments) ? opts.patchSegments : 12;

        // Keyless Esri basemap modes (all {z}/{y}/{x}, CORS-enabled). Switchable.
        this.modes = {
            satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            dark:      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
            street:    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
            topo:      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
            light:     'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
        };
        this.modeOrder = ['satellite', 'dark', 'street', 'topo', 'light'];
        this.mode = (opts.mode && this.modes[opts.mode]) ? opts.mode : 'satellite';
        this._isPhoto = (this.mode === 'satellite');   // only photographic modes get sun-dimmed
        // Esri uses {z}/{y}/{x} ORDER — see _buildTile for the substitution.
        this.urlTemplate = opts.urlTemplate || this.modes[this.mode];

        // A2: guards against an in-flight load resolving after dispose().
        this._disposed = false;

        // A5: snap (no rAF) the per-tile fade when the user prefers reduced motion.
        this.reducedMotion = (typeof window !== 'undefined' && window.matchMedia)
            ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

        // LRU of built tiles: key "z/x/y" → { mesh, t (lastUsed), state }.
        this.tiles = new Map();
        this._building = new Set();      // in-flight keys (avoid double-fetch)
        this.failed = 0;
        this.visible = true;
        this._lightFactor = 1;           // sun-lit dim factor (1=day, ~0.35=night)

        // Shared loader (crossOrigin once; CORS confirmed on the Esri service).
        this._loader = (typeof THREE !== 'undefined' && THREE.TextureLoader)
            ? new THREE.TextureLoader() : null;
        if (this._loader) this._loader.crossOrigin = 'anonymous';

        // Per-frame scratch (Rule: no per-frame allocation in update()).
        this._scratchKeys = [];          // reused covering-tile key list
        this._scratchCands = [];         // reused candidate {key,d} list for sorting
    }

    // ---- Slippy-map helpers: reuse StreetTiles' web-mercator math -----------

    // lon/lat → fractional tile x/y at zoom z. Rule 5: 2 asserts.
    static lngLatToTile(lng, lat, z) {
        console.assert(Number.isFinite(lng) && Number.isFinite(lat), 'lngLatToTile: coords required');
        console.assert(Number.isFinite(z) && z >= 0, 'lngLatToTile: zoom required');
        if (typeof StreetTiles !== 'undefined') return StreetTiles.lngLatToTile(lng, lat, z);
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
        if (typeof StreetTiles !== 'undefined') return StreetTiles.tileToLngLat(x, y, z);
        var n = Math.pow(2, z);
        var lng = x / n * 360 - 180;
        var latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
        var lat = latRad * 180 / Math.PI;
        return { lng: lng, lat: lat };
    }

    // Choose the fetch zoom so the covering tile grid actually FILLS the camera's
    // field of view. The old linear ramp picked a zoom by distance alone, so at
    // close range it chose tiny high-z tiles that covered only a speck of the view
    // (the rest fell back to the blurry base). Instead, derive z from the visible
    // ground footprint: footprint ≈ K·(rr-1) of the globe circumference, and we
    // want ~`coverAcross` tiles to span it → 2^z ≈ coverAcross / footprintFrac.
    // Result: the satellite always tiles the whole view, sharpening as you zoom in.
    // Rule 5: 2 asserts.
    zoomForDistance(distInRadii) {
        console.assert(Number.isFinite(distInRadii), 'zoomForDistance: distance required');
        console.assert(distInRadii > 0, 'zoomForDistance: positive distance');
        var alt = Math.max(distInRadii - 1, 1e-4);             // altitude in Earth radii
        // footprintFrac = (2·tan(fov/2)/2π)·alt ≈ 0.184·alt (fov≈60°). coverAcross≈4.5:
        // fewer tiles span the view → bigger tiles → the 9x9 ring extends well BEYOND
        // the visible edges, so the old base globe never shows on the sides.
        var twoPowZ = 4.5 / (0.184 * alt);
        var z = Math.round(Math.log(twoPowZ) / Math.LN2);
        return Math.max(this.minZoom, Math.min(this.maxZoom, z));
    }

    // ---- update: enumerate covering tiles, lazily build, LRU-evict ---------

    /**
     * Called per-frame while exploring. Active only below activateBelow. Mirrors
     * StreetTiles.update: hide + return false when off/out-of-range; else enumerate
     * a bounded centered ring of covering tiles, lazily build, LRU-evict. No
     * per-frame allocation. Rule 4: <=60 lines.
     * @returns {boolean} whether the engine is active this frame
     */
    update(centerLat, centerLng, cameraDistInRadii) {
        console.assert(Number.isFinite(centerLat) && Number.isFinite(centerLng), 'update: center required');
        console.assert(Number.isFinite(cameraDistInRadii), 'update: distance required');
        // Must NOT mutate this.visible here (per-frame range vs user toggle).
        if (!this.visible || cameraDistInRadii >= this.activateBelow) {
            this._showTiles(false);
            return false;
        }
        var fetchZ = this.zoomForDistance(cameraDistInRadii);
        var n = Math.pow(2, fetchZ);
        var c = SatelliteTiles.lngLatToTile(centerLng, centerLat, fetchZ);
        var cx = Math.floor(c.x), cy = Math.floor(c.y);
        var keys = this._buildCoveringKeys(cx, cy, n, fetchZ);
        var now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        // Hide ALL tiles, then show only the current covering set. Without this,
        // stale tiles from OTHER zoom levels stay visible and overlap → a patchwork
        // of mismatched-brightness/zoom tiles. _touchOrBuild re-shows the kept set.
        this._showTiles(false);
        for (var i = 0; i < keys.length; i++) {
            this._touchOrBuild(keys[i], now);
        }
        this._evict();
        return true;
    }

    // Enumerate the bounded ring of covering tiles, sort by Chebyshev distance from
    // centre (max(|dx|,|dy|)), keep the NEAREST maxVisibleTiles so the kept set
    // stays centred on the look-at. No per-frame allocation (pooled). Rule 4: <=60.
    _buildCoveringKeys(cx, cy, n, fetchZ) {
        console.assert(Number.isFinite(cx) && Number.isFinite(cy), '_buildCoveringKeys: center required');
        console.assert(Number.isFinite(n) && n > 0, '_buildCoveringKeys: tile count required');
        var cands = this._scratchCands;
        var count = 0;
        // 3x3 / 5x5 / 7x7 / 9x9 by budget (Rule 2 bounded ≤81). Bigger ring → the
        // satellite extends beyond the view edges instead of a small central patch.
        var ring = (this.maxVisibleTiles > 49) ? 4 : ((this.maxVisibleTiles > 25) ? 3 : ((this.maxVisibleTiles > 9) ? 2 : 1));
        for (var dx = -ring; dx <= ring; dx++) {
            for (var dy = -ring; dy <= ring; dy++) {
                var ty = cy + dy;
                if (ty < 0 || ty >= n) continue;
                var tx = ((cx + dx) % n + n) % n;
                var slot = cands[count] || (cands[count] = { key: '', d: 0 });
                slot.key = fetchZ + '/' + tx + '/' + ty;
                slot.d = Math.max(Math.abs(dx), Math.abs(dy));
                count++;
            }
        }
        this._sortCandsPrefix(count);
        var keys = this._scratchKeys; keys.length = 0;
        var max = Math.min(count, this.maxVisibleTiles);          // Rule 2 bounded
        for (var i = 0; i < max; i++) keys.push(cands[i].key);
        return keys;
    }

    // Stable insertion-sort of the first `count` pooled candidates by ascending d.
    // In-place; pooled objects past `count` untouched; count <= 25 so bounded.
    // Rule 5: 2 asserts.
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

    // Touch a built tile, or (re)dispatch a build. Failed records do NOT refresh
    // their timestamp (stay evictable); after 30s a failed record is dropped and
    // retried (transient 503/429). Rule 5: 2 asserts.
    _touchOrBuild(key, now) {
        console.assert(typeof key === 'string', '_touchOrBuild: string key required');
        console.assert(Number.isFinite(now), '_touchOrBuild: timestamp required');
        var rec = this.tiles.get(key);
        if (rec) {
            if (rec.state === 'failed') {
                if (now - rec.failedAt > 30000) {
                    this.tiles.delete(key);
                    if (!this._building.has(key)) this._buildTileKey(key, now);
                }
                return false;                 // do not refresh t → stays evictable
            }
            rec.t = now;
            if (rec.mesh) rec.mesh.visible = true;
            return true;
        }
        if (!this._building.has(key)) this._buildTileKey(key, now);
        return false;
    }

    // Parse a "z/x/y" key and dispatch the async build. Rule 5: 2 asserts.
    _buildTileKey(key, now) {
        console.assert(typeof key === 'string', '_buildTileKey: string key required');
        console.assert(Number.isFinite(now), '_buildTileKey: timestamp required');
        var p = key.split('/');
        var z = parseInt(p[0], 10), x = parseInt(p[1], 10), y = parseInt(p[2], 10);
        if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) return;
        this._building.add(key);
        var self = this;
        this._buildTile(z, x, y).then(function (mesh) {
            self._building.delete(key);
            // A2: disposed mid-flight → never re-add an orphan; dispose it instead.
            if (self._disposed) { if (mesh) self._disposeMesh(mesh); return; }
            if (!mesh) { self.failed++; self.tiles.set(key, { mesh: null, t: now, state: 'failed', failedAt: now }); return; }
            self.earthMesh.add(mesh);
            self.tiles.set(key, { mesh: mesh, t: now, state: 'built' });
            self._evict();
        }).catch(function (e) {
            self._building.delete(key);
            self.failed++;
            self.tiles.set(key, { mesh: null, t: now, state: 'failed', failedAt: now });
            console.warn('SatelliteTiles: tile ' + key + ' failed:', e && e.message);
        });
    }

    /**
     * Build the curved PATCH geometry for one slippy tile, then load the Esri
     * raster (z/y/x!) onto it. Resolves with a THREE.Mesh once the texture loads,
     * or null on load error (fail-soft). Rule 4: <=60 lines.
     * @returns {Promise<THREE.Mesh|null>}
     */
    _buildTile(z, x, y) {
        console.assert(typeof GlobeMath !== 'undefined', '_buildTile: GlobeMath required');
        console.assert(this._loader, '_buildTile: TextureLoader required');
        if (typeof GlobeMath === 'undefined' || !this._loader) return Promise.resolve(null);
        var geometry = this._buildPatchGeometry(z, x, y);
        // Esri ORDER is {z}/{y}/{x} — row(y) before col(x). Build the URL explicitly.
        var url = this.urlTemplate.replace('{z}', z).replace('{y}', y).replace('{x}', x);
        var self = this;
        var loader = this._loader;
        return new Promise(function (resolve) {
            loader.load(url, function (texture) {
                if (self._disposed) { if (texture) texture.dispose(); geometry.dispose(); resolve(null); return; }
                self._configureTexture(texture);
                var material = new THREE.MeshBasicMaterial({
                    map: texture, transparent: true, opacity: 0.0, depthWrite: false, depthTest: true
                });
                // MeshBasicMaterial is unlit (full-bright). Tint by the current sun
                // factor so patches on the night hemisphere don't glow over the dark
                // globe (the base Earth uses a day/night shader). New tiles match.
                if (material.color) material.color.setScalar(self._lightFactor);
                var mesh = new THREE.Mesh(geometry, material);
                mesh.renderOrder = -1;                 // draw before the vector overlays
                mesh.userData.fadeTarget = 1.0;
                mesh.userData.fade = 0.0;
                self._startFade(mesh);
                resolve(mesh);
            }, undefined, function (err) {
                geometry.dispose();
                console.warn('SatelliteTiles: texture load failed ' + url, err && err.message);
                resolve(null);
            });
        });
    }

    // Build a curved grid patch spanning the tile's lon/lat bbox. Rows go N→S
    // (j), cols W→E (i). UV: u = i/N, v = 1 - j/N (see header note on flipY).
    // Bounded loops. Rule 4: <=60 lines.
    _buildPatchGeometry(z, x, y) {
        console.assert(typeof GlobeMath !== 'undefined', '_buildPatchGeometry: GlobeMath required');
        console.assert(Number.isFinite(z) && Number.isFinite(x) && Number.isFinite(y), '_buildPatchGeometry: zxy required');
        var N = this.patchSegments;
        var nw = SatelliteTiles.tileToLngLat(x, y, z);          // west lng, north lat
        var se = SatelliteTiles.tileToLngLat(x + 1, y + 1, z);  // east lng, south lat
        var west = nw.lng, north = nw.lat, east = se.lng, south = se.lat;
        var r = this.radius * this.rOffset;
        var positions = [], uvs = [], indices = [];
        for (var j = 0; j <= N; j++) {                           // Rule 2: bounded by N
            var fj = j / N;
            var lat = north + (south - north) * fj;
            for (var i = 0; i <= N; i++) {                       // Rule 2: bounded by N
                var fi = i / N;
                var lng = west + (east - west) * fi;
                var v = GlobeMath.latLngToVector3(lat, lng, r);
                positions.push(v.x, v.y, v.z);
                uvs.push(fi, 1 - fj);                            // u = i/N, v = 1 - j/N
            }
        }
        var stride = N + 1;
        for (var jj = 0; jj < N; jj++) {                         // Rule 2: bounded
            for (var ii = 0; ii < N; ii++) {                    // Rule 2: bounded
                var a = jj * stride + ii, b = a + 1, c = a + stride, d = c + 1;
                indices.push(a, c, b, b, c, d);
            }
        }
        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        return geometry;
    }

    // Apply sRGB color space + anisotropy, guarded for r128 variants. Rule 5: 2 asserts.
    _configureTexture(texture) {
        console.assert(texture && typeof texture === 'object', '_configureTexture: texture required');
        console.assert(typeof THREE !== 'undefined', '_configureTexture: THREE required');
        // r128 uses texture.encoding = THREE.sRGBEncoding; newer builds use colorSpace.
        if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
        else if ('encoding' in texture && THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
        texture.anisotropy = 4;                 // guarded: harmless integer in r128
        // No mipmaps: tiles render near 1:1, so the mip chain is wasted GPU memory
        // (~25% per texture). With up to 72 cached tiles this is a real saving on
        // integrated/mobile GPUs. LinearFilter avoids the mipmap requirement.
        texture.generateMipmaps = false;
        if (THREE.LinearFilter) texture.minFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        return true;
    }

    // ---- fade / lifecycle --------------------------------------------------

    // Cross-fade a patch's opacity in (one short rAF, bounded). Flips depthWrite on
    // once opaque so the far side / lower layers occlude correctly. Rule 5: 2 asserts.
    _startFade(mesh) {
        console.assert(mesh && mesh.material, '_startFade: mesh required');
        console.assert(mesh.userData, '_startFade: userData required');
        var self = this;
        var settle = function () {
            if (!mesh.material) return;
            mesh.material.depthWrite = true;    // opaque now: occlude far side
            mesh.material.needsUpdate = true;
        };
        if (this.reducedMotion || typeof requestAnimationFrame === 'undefined') {
            mesh.material.opacity = mesh.userData.fadeTarget; settle(); return;
        }
        var step = function () {
            if (!mesh.material) return;
            var diff = mesh.userData.fadeTarget - mesh.material.opacity;
            if (Math.abs(diff) < 0.02) { mesh.material.opacity = mesh.userData.fadeTarget; settle(); return; }
            mesh.material.opacity += diff * 0.15;
            requestAnimationFrame(step);
        };
        step();
    }

    // LRU-evict beyond lruCap, disposing geometry + material + texture. Rule 4: <=60.
    _evict() {
        console.assert(this.tiles instanceof Map, '_evict: tiles map required');
        console.assert(this.lruCap > 0, '_evict: positive cap');
        if (this.tiles.size <= this.lruCap) return;
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

    // Dispose one patch (geometry + material + texture) + unparent. Rule 5: 2 asserts.
    _disposeMesh(mesh) {
        console.assert(mesh === null || typeof mesh === 'object', '_disposeMesh: bad arg');
        console.assert(this.earthMesh, '_disposeMesh: earthMesh required');
        if (!mesh) return false;
        if (mesh.geometry && mesh.geometry.dispose) mesh.geometry.dispose();
        if (mesh.material) {
            if (mesh.material.map && mesh.material.map.dispose) mesh.material.map.dispose();
            if (mesh.material.dispose) mesh.material.dispose();
        }
        // A3: null material AFTER disposing so a pending _startFade rAF step hits its
        // `if (!mesh.material) return;` guard and stops touching a freed material.
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

    // Switch the keyless Esri basemap (satellite/dark/street/topo/light). Clears built
    // tiles so they re-fetch from the new map; only 'satellite' gets sun-dimmed (the
    // cartographic modes have no day/night). Rule 5: 2 asserts.
    setMode(mode) {
        console.assert(typeof mode === 'string', 'setMode: string required');
        console.assert(this.modes, 'setMode: modes map required');
        if (!this.modes[mode]) return this.mode;
        this.mode = mode;
        this.urlTemplate = this.modes[mode];
        this._isPhoto = (mode === 'satellite');
        var self = this;
        this.tiles.forEach(function (rec) { if (rec.mesh) self._disposeMesh(rec.mesh); });
        this.tiles.clear();
        this._building.clear();
        this.failed = 0;
        return this.mode;
    }

    // Cycle to the next basemap mode → returns the new mode. Rule 5: 2 asserts.
    nextMode() {
        console.assert(Array.isArray(this.modeOrder), 'nextMode: order required');
        console.assert(this.modeOrder.length > 0, 'nextMode: non-empty order');
        var i = this.modeOrder.indexOf(this.mode);
        return this.setMode(this.modeOrder[(i + 1) % this.modeOrder.length]);
    }

    // Per-frame mesh show/hide WITHOUT touching the user toggle. Rule 5: 2 asserts.
    _showTiles(vis) {
        console.assert(typeof vis === 'boolean', '_showTiles: boolean required');
        console.assert(this.tiles instanceof Map, '_showTiles: tiles map required');
        this.tiles.forEach(function (rec) { if (rec.mesh) rec.mesh.visible = vis; });
        return vis;
    }

    // Dim all patches by a sun-lit factor (1=day, ~0.35=night) so the unlit imagery
    // doesn't glow over the dark night hemisphere. Cheap: one grey color per patch.
    // The host computes the factor from the look-at point's sun-dot. Rule 5: 2 asserts.
    setSunLight(f) {
        console.assert(Number.isFinite(f), 'setSunLight: number required');
        console.assert(this.tiles instanceof Map, 'setSunLight: tiles map required');
        // Only photographic (satellite) imagery has a day/night look worth dimming;
        // cartographic modes (dark/street/topo/light) render at full brightness.
        this._lightFactor = this._isPhoto ? Math.max(0, Math.min(1, f)) : 1;
        var lf = this._lightFactor;
        this.tiles.forEach(function (rec) {
            // Only the visible tiles matter (hidden ones get the factor on re-show /
            // at build), so skip the rest — up to ~72 cached but ≤49 visible.
            if (rec.mesh && rec.mesh.visible && rec.mesh.material && rec.mesh.material.color) {
                rec.mesh.material.color.setScalar(lf);
            }
        });
        return lf;
    }

    // Hide all built patches WITHOUT disabling the engine (preserves this.visible
    // so a later re-entry shows them). Used on explore exit. Rule 5: 2 asserts.
    hide() {
        console.assert(this.tiles instanceof Map, 'SatelliteTiles.hide: tiles map required');
        console.assert(typeof this._showTiles === 'function', 'SatelliteTiles.hide: _showTiles required');
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
            building: this._building.size, template: this.urlTemplate };
    }

    // Free everything (all patches + geometry/material/texture). Rule 5: 2 asserts.
    dispose() {
        console.assert(this.tiles instanceof Map, 'dispose: tiles map required');
        console.assert(this.earthMesh !== undefined, 'dispose: earthMesh field expected');
        this._disposed = true;   // A2: block any in-flight build from re-adding a mesh
        var self = this;
        this.tiles.forEach(function (rec) { if (rec.mesh) self._disposeMesh(rec.mesh); });
        this.tiles.clear();
        this._building.clear();
        this._scratchKeys.length = 0;
        return true;
    }
}

// Make globally available (matches StreetTiles / GlobeMath pattern).
if (typeof window !== 'undefined') {
    window.SatelliteTiles = SatelliteTiles;
}
if (typeof module !== 'undefined' && module.exports) module.exports = SatelliteTiles;
