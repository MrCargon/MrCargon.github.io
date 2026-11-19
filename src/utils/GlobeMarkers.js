// GlobeMarkers.js - the live point markers on the Explore globe (places, quakes, ISS).
//
// Why this exists (audit 2026-11-19, piece F3): each marker used to be its own
// world-size sphere. Up to 250 quakes meant 250 draw calls, the spheres grew into
// 100-300 px discs as the camera came close, they were still drawn after fading to
// opacity 0, and the colours came out pastel (sRGB hex written into a pipeline that
// encodes linear -> sRGB on output).
//
// Now every layer is ONE THREE.Points draw with a small ShaderMaterial:
//   - constant screen size in pixels (gl_PointSize), a round anti-aliased disc with a
//     dark 1 px rim so it stays crisp over imagery;
//   - colours stored LINEAR and encoded by <colorspace_fragment>, so 0xff5a3c arrives
//     as 0xff5a3c, not salmon;
//   - layer.visible is still owned by the Explore toggle; the Points child is set
//     invisible (not drawn at all) once the zoom fade reaches 0;
//   - optional screen-space clustering: markers closer than `clusterPx` merge into the
//     strongest one, drawn a little larger, with a small count badge (pooled DOM);
//   - picking is done in screen space (nearest marker within a few px), because a
//     world-space raycast threshold cannot match a constant-pixel marker.
//
// Classic script (touches THREE only at runtime), exported as window.GlobeMarkers.
class GlobeMarkers {
    /**
     * @param {THREE.Object3D} parentMesh  the Earth mesh (markers are its children)
     * @param {number} radius              globe radius in world units
     */
    constructor(parentMesh, radius) {
        console.assert(parentMesh && parentMesh.isObject3D, 'GlobeMarkers: parentMesh required');
        console.assert(Number.isFinite(radius) && radius > 0, 'GlobeMarkers: radius required');
        this.parent = parentMesh;
        this.radius = radius;
        this.layers = {};          // name -> layer record
        this.order = [];           // pick priority (first added wins ties)
        this.fade = 1;
        this._v = new THREE.Vector3();
        this._c = new THREE.Vector3();
        this._cam = new THREE.Vector3();
        this._badgeRoot = null;
    }

    // Create an (empty) layer. Returns the Group the Explore toggle owns. Rule 5: 2 asserts.
    addLayer(name, opts) {
        console.assert(typeof name === 'string' && name, 'GlobeMarkers.addLayer: name required');
        console.assert(!this.layers[name], 'GlobeMarkers.addLayer: duplicate ' + name);
        const o = opts || {};
        const group = new THREE.Group();
        group.name = 'markers-' + name;
        group.visible = false;
        const L = { name: name, group: group, points: null, items: [], clusterPx: o.clusterPx || 0,
            clusterNoun: o.clusterNoun || 'markers', rep: null, count: null, sx: null, sy: null,
            badges: [], labels: o.labels ? [] : null };
        this.layers[name] = L;
        this.order.push(name);
        this.parent.add(group);
        return group;
    }

    /**
     * Replace a layer's markers.
     * items: [{lat, lng, alt (radius factor), color (sRGB hex), size (px), rank, shape, data:{name, info, ...}}]
     * shape: 0 = round disc (data: quakes, ISS), 1 = diamond with a white ring (places).
     */
    setItems(name, items) {
        const L = this.layers[name];
        console.assert(L, 'GlobeMarkers.setItems: unknown layer ' + name);
        console.assert(Array.isArray(items), 'GlobeMarkers.setItems: items array required');
        if (!L || !Array.isArray(items)) return false;
        this._disposePoints(L);
        const n = Math.min(items.length, 1000);              // Rule 2: bounded
        const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        const size = new Float32Array(n), alpha = new Float32Array(n), shape = new Float32Array(n);
        const c = new THREE.Color();
        L.items = [];
        for (let i = 0; i < n; i++) {
            const it = items[i];
            const p = GlobeMath.latLngToVector3(it.lat, it.lng, this.radius * (it.alt || 1.0009));
            pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
            // ColorManagement is off site-wide, so setHex stores the raw sRGB values;
            // convert explicitly - the shader output step encodes linear -> sRGB.
            c.setHex(it.color).convertSRGBToLinear();
            col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
            size[i] = it.size; alpha[i] = it.hidden ? 0 : 1; shape[i] = it.shape === 1 ? 1 : 0;
            L.items.push({ size: it.size, rank: it.rank || 0, hidden: !!it.hidden, data: it.data || {},
                lat: it.lat, lng: it.lng });   // R3 #9b: the Live markers list flies here
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
        g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
        g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
        g.setAttribute('aShape', new THREE.BufferAttribute(shape, 1));
        g.computeBoundingSphere();
        L.points = new THREE.Points(g, GlobeMarkers.material());
        L.points.frustumCulled = false;       // a few points; the bound changes when the ISS moves
        L.points.renderOrder = 5;             // after the imagery/street overlays
        L.points.name = 'markers-' + name + '-points';
        L.group.add(L.points);
        // Draw order by rank, weakest first, so the strongest marker sits on top.
        L.byRank = L.items.map((_, i) => i).sort((a, b) => L.items[b].rank - L.items[a].rank);
        L.rep = new Int16Array(n); L.count = new Uint16Array(n);
        L.sx = new Float32Array(n); L.sy = new Float32Array(n);
        return true;
    }

    // Move one marker (the ISS). Rule 5: 2 asserts.
    setItemPosition(name, i, lat, lng, alt) {
        const L = this.layers[name];
        console.assert(L && L.points, 'GlobeMarkers.setItemPosition: layer not built ' + name);
        console.assert(Number.isFinite(lat) && Number.isFinite(lng), 'GlobeMarkers.setItemPosition: lat/lng');
        if (!L || !L.points || !L.items[i]) return false;
        const p = GlobeMath.latLngToVector3(lat, lng, this.radius * (alt || 1.0009));
        const a = L.points.geometry.attributes.position;
        a.setXYZ(i, p.x, p.y, p.z); a.needsUpdate = true;
        L.items[i].hidden = false;
        L.items[i].lat = lat; L.items[i].lng = lng;
        return true;
    }

    /**
     * The shown markers of one layer for the Live markers list (R3 #9b): the layer's
     * toggle is on, the marker is not hidden (the ISS before its first fix or after a
     * stale one). The zoom fade does not matter: the layer is still on. Rule 5: 2 asserts.
     * @returns {Array<{i:number, lat:number, lng:number, data:Object}>}
     */
    listItems(name) {
        console.assert(typeof name === 'string', 'GlobeMarkers.listItems: name required');
        const L = this.layers[name];
        console.assert(!L || Array.isArray(L.items), 'GlobeMarkers.listItems: bad layer');
        if (!L || !L.group.visible || !L.points) return [];
        const out = [];
        for (let i = 0; i < L.items.length; i++) {
            const it = L.items[i];
            if (it.hidden || !Number.isFinite(it.lat) || !Number.isFinite(it.lng)) continue;
            out.push({ i: i, lat: it.lat, lng: it.lng, data: it.data });
        }
        return out;
    }

    itemData(name, i) {
        const L = this.layers[name];
        return (L && L.items[i]) ? L.items[i].data : null;
    }

    /**
     * Per frame from Explore: fade, hide-when-faded, horizon test, clustering, badges.
     * @param {THREE.Camera} camera
     * @param {DOMRect} rect     canvas rect (client px)
     * @param {number} fade      0..1 zoom fade (pinFade)
     * @param {number} pixelRatio renderer pixel ratio
     */
    update(camera, rect, fade, pixelRatio) {
        console.assert(camera && camera.isCamera, 'GlobeMarkers.update: camera required');
        console.assert(rect && Number.isFinite(rect.width), 'GlobeMarkers.update: rect required');
        this.fade = Math.max(0, Math.min(1, fade));
        const pr = pixelRatio || 1;
        // R2 #5: ancestors + the globe only. updateMatrixWorld() also walked the whole
        // globe subtree (every tile patch) a second time per frame; _layout reads just
        // parent.matrixWorld, and render() updates the children anyway.
        this.parent.updateWorldMatrix(true, false);
        this.parent.getWorldPosition(this._c);
        this._cam.setFromMatrixPosition(camera.matrixWorld);
        // Name labels only once the globe is big on screen (camera nearer than LABEL_MAX_R
        // globe radii); far out they crowd the small disc and the atmosphere labels.
        const e = this.parent.matrixWorld.elements;
        const worldR = this.radius * Math.hypot(e[0], e[1], e[2]);
        this._labelsOn = this._cam.distanceTo(this._c) < GlobeMarkers.LABEL_MAX_R * worldR;
        for (let k = 0; k < this.order.length; k++) {
            const L = this.layers[this.order[k]];
            if (!L.points) continue;
            const on = L.group.visible && this.fade > 0.01;
            L.points.visible = on;                       // not drawn at all once faded out
            if (!on) { this._hideBadges(L, 0); this._hideLabels(L); continue; }
            const u = L.points.material.uniforms;
            u.uOpacity.value = 0.95 * this.fade;
            u.uScale.value = pr;
            u.uViewH.value = rect.height * pr;
            this._layout(L, camera, rect);
        }
        return true;
    }

    // Project every marker, drop the ones behind the globe, cluster the rest.
    // Rule 4: <=60 lines | no per-frame allocation.
    _layout(L, camera, rect) {
        const pos = L.points.geometry.attributes.position.array;
        const aA = L.points.geometry.attributes.aAlpha, aS = L.points.geometry.attributes.aSize;
        const n = L.items.length, cp = L.clusterPx;
        const R2 = this.radius * this.radius * 0.9996;   // a hair inside: grazing markers count as seen
        const mw = this.parent.matrixWorld;
        let badge = 0;
        for (let j = 0; j < n; j++) {
            const i = L.byRank[j];
            const it = L.items[i];
            L.rep[i] = -1; L.count[i] = 0;
            if (it.hidden) { aA.array[i] = 0; continue; }
            this._v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(mw);
            // Horizon: hidden when the camera->marker segment passes inside the globe
            // (closest approach to the centre < R before reaching the marker). Works for
            // surface markers and the raised ISS alike. Depth test does the pixels; this
            // keeps far-side markers out of clusters, badges and picks.
            const cx = this._cam.x - this._c.x, cy = this._cam.y - this._c.y, cz = this._cam.z - this._c.z;
            const dx = this._v.x - this._cam.x, dy = this._v.y - this._cam.y, dz = this._v.z - this._cam.z;
            const dd = dx * dx + dy * dy + dz * dz;
            const t = dd > 0 ? -(cx * dx + cy * dy + cz * dz) / dd : 1;
            let visible = true;
            if (t > 0 && t < 1) {
                const qx = cx + t * dx, qy = cy + t * dy, qz = cz + t * dz;
                visible = (qx * qx + qy * qy + qz * qz) >= R2;
            }
            this._v.project(camera);
            if (!visible || this._v.z > 1 || Math.abs(this._v.x) > 1.05 || Math.abs(this._v.y) > 1.05) {
                aA.array[i] = 0; continue;
            }
            const sx = (this._v.x * 0.5 + 0.5) * rect.width, sy = (-this._v.y * 0.5 + 0.5) * rect.height;
            L.sx[i] = sx; L.sy[i] = sy;
            let host = -1;
            if (cp > 0) {
                for (let q = 0; q < j; q++) {          // only stronger, already placed reps
                    const h = L.byRank[q];
                    if (L.rep[h] !== h) continue;
                    const dx = L.sx[h] - sx, dy = L.sy[h] - sy;
                    if (dx * dx + dy * dy < cp * cp) { host = h; break; }
                }
            }
            if (host >= 0) { L.rep[i] = host; L.count[host]++; aA.array[i] = 0; continue; }
            L.rep[i] = i; L.count[i] = 1; aA.array[i] = 1;
        }
        for (let i = 0; i < n; i++) {
            const c = L.count[i];
            // A cluster grows a little with its count, capped so nothing passes 13 px.
            aS.array[i] = c > 1 ? Math.min(GlobeMarkers.MAX_PX, L.items[i].size + 1 + Math.log2(c)) : L.items[i].size;
            if (c > 1 && badge < GlobeMarkers.MAX_BADGES) {
                this._badge(L, badge++, rect.left + L.sx[i], rect.top + L.sy[i], aS.array[i], c);
            }
            if (L.labels) this._label(L, i, (c > 0 && this._labelsOn) ? rect.left + L.sx[i] : NaN, rect.top + L.sy[i], aS.array[i]);
        }
        this._hideBadges(L, badge);
        aA.needsUpdate = true; aS.needsUpdate = true;
        return badge;
    }

    _badge(L, k, x, y, sizePx, count) {
        if (typeof document === 'undefined') return;
        let el = L.badges[k];
        if (!el) {
            el = document.createElement('div');
            el.className = 'globe-marker-badge';
            el.setAttribute('aria-hidden', 'true');
            el.style.cssText = 'position:fixed; z-index:34; pointer-events:none; ' +
                'font:700 10px/13px system-ui,-apple-system,sans-serif; color:#fff; min-width:13px; ' +
                'text-align:center; padding:0 3px; border-radius:7px; background:rgba(14,10,12,0.82); ' +
                'border:1px solid rgba(255,255,255,0.35); transform:translate(-50%,-50%); display:none;';
            document.body.appendChild(el);
            L.badges[k] = el;
        }
        const t = String(count);
        if (el.textContent !== t) el.textContent = t;
        const off = sizePx * 0.5 + 4;
        el.style.left = (x + off) + 'px';
        el.style.top = (y - off) + 'px';
        el.style.opacity = String(Math.min(1, this.fade * 1.2));
        el.style.display = 'block';
    }

    _hideBadges(L, from) {
        for (let k = from; k < L.badges.length; k++) {
            if (L.badges[k].style.display !== 'none') L.badges[k].style.display = 'none';
        }
    }

    // Hide a labelled layer's name labels (layer off or faded out).
    _hideLabels(L) {
        if (!L.labels) return;
        for (let k = 0; k < L.labels.length; k++) {
            if (L.labels[k] && L.labels[k].style.display !== 'none') L.labels[k].style.display = 'none';
        }
    }

    // Always-on name label beside a labelled layer's marker (the 4 places). x NaN = hide.
    // Rule 5: 2 asserts.
    _label(L, i, x, y, sizePx) {
        console.assert(Array.isArray(L.labels), 'GlobeMarkers._label: labelled layer required');
        console.assert(Number.isInteger(i), 'GlobeMarkers._label: index required');
        if (typeof document === 'undefined') return;
        let el = L.labels[i];
        if (!Number.isFinite(x)) { if (el && el.style.display !== 'none') el.style.display = 'none'; return; }
        if (!el) {
            el = document.createElement('div');
            el.className = 'globe-marker-label';
            el.setAttribute('aria-hidden', 'true');
            el.style.cssText = 'position:fixed; z-index:34; pointer-events:none; white-space:nowrap; ' +
                'font:600 11px/14px system-ui,-apple-system,sans-serif; color:#fff; padding:0 4px; ' +
                'border-radius:3px; background:rgba(14,10,12,0.62); transform:translate(0,-50%); display:none;';
            el.textContent = (L.items[i].data && L.items[i].data.name) || '';
            document.body.appendChild(el);
            L.labels[i] = el;
        }
        el.style.left = (x + sizePx * 0.5 + 4) + 'px';
        el.style.top = y + 'px';
        el.style.opacity = String(Math.min(1, this.fade * 1.2));
        if (el.style.display !== 'block') el.style.display = 'block';
    }

    // Hide the count badges of layers whose toggle is off (Explore exit / toggle).
    syncVisibility() {
        for (let k = 0; k < this.order.length; k++) {
            const L = this.layers[this.order[k]];
            if (!L.group.visible) { this._hideBadges(L, 0); this._hideLabels(L); if (L.points) L.points.visible = false; }
        }
        return true;
    }

    /**
     * Screen-space pick: nearest drawn marker within its radius + a small slop.
     * @returns {{name:string, info:string}|null}
     */
    pick(clientX, clientY, rect) {
        console.assert(Number.isFinite(clientX) && Number.isFinite(clientY), 'GlobeMarkers.pick: point required');
        console.assert(rect && Number.isFinite(rect.width), 'GlobeMarkers.pick: rect required');
        const x = clientX - rect.left, y = clientY - rect.top;
        let best = null, bestD = Infinity;
        for (let k = 0; k < this.order.length; k++) {
            const L = this.layers[this.order[k]];
            if (!L.points || !L.points.visible) continue;
            const aA = L.points.geometry.attributes.aAlpha.array, aS = L.points.geometry.attributes.aSize.array;
            for (let i = 0; i < L.items.length; i++) {
                if (aA[i] <= 0) continue;
                const dx = L.sx[i] - x, dy = L.sy[i] - y, d = Math.sqrt(dx * dx + dy * dy);
                const reach = Math.max(8, aS[i] * 0.5 + 4);
                if (d <= reach && d < bestD - 0.5) { bestD = d; best = { L: L, i: i }; }
            }
        }
        return best ? this._describe(best.L, best.i) : null;
    }

    // Card text for a marker, or for a cluster (count + its strongest member).
    _describe(L, i) {
        const d = L.items[i].data || {};
        const c = L.count[i];
        if (c > 1) {
            return { name: c + ' ' + L.clusterNoun + ' here',
                info: 'Strongest: ' + (d.name || '') + (d.info ? ' · ' + d.info : '') + ' (zoom in to split)',
                cluster: c, data: d };
        }
        return { name: d.name || 'Marker', info: d.info || '', cluster: 1, data: d };
    }

    _disposePoints(L) {
        if (!L.points) return;
        L.group.remove(L.points);
        L.points.geometry.dispose();
        L.points.material.dispose();
        L.points = null;
    }

    dispose() {
        for (let k = 0; k < this.order.length; k++) {
            const L = this.layers[this.order[k]];
            this._disposePoints(L);
            for (let b = 0; b < L.badges.length; b++) { if (L.badges[b].parentNode) L.badges[b].parentNode.removeChild(L.badges[b]); }
            L.badges = [];
            const lb = L.labels || [];
            for (let b = 0; b < lb.length; b++) { if (lb[b] && lb[b].parentNode) lb[b].parentNode.removeChild(lb[b]); }
            L.labels = L.labels ? [] : null;
            if (L.group.parent) L.group.parent.remove(L.group);
        }
        this.layers = {}; this.order = [];
        return true;
    }

    // ---- test/measurement hooks (cheap, read-only) ----

    // On-screen diameters (px) of the drawn markers per layer, plus cluster count.
    debugSizes() {
        const out = { clusters: 0 };
        for (let k = 0; k < this.order.length; k++) {
            const L = this.layers[this.order[k]];
            const arr = out[L.name] = [];
            if (!L.points || !L.points.visible) continue;
            const aA = L.points.geometry.attributes.aAlpha.array, aS = L.points.geometry.attributes.aSize.array;
            for (let i = 0; i < L.items.length; i++) {
                if (aA[i] > 0) { arr.push(String(aS[i])); if (L.count[i] > 1) out.clusters++; }
            }
        }
        return out;
    }

    // Client-px centres of the drawn markers, strongest first (for click tests).
    debugScreenPoints(camera, rect) {
        const pts = [];
        for (let k = 0; k < this.order.length; k++) {
            const L = this.layers[this.order[k]];
            if (!L.points || !L.points.visible) continue;
            const aA = L.points.geometry.attributes.aAlpha.array;
            for (let j = 0; j < L.byRank.length; j++) {
                const i = L.byRank[j];
                if (aA[i] > 0) pts.push({ layer: L.name, x: rect.left + L.sx[i], y: rect.top + L.sy[i], count: L.count[i] });
            }
        }
        return pts;
    }

    // One shared-shape material per layer (uniforms differ per layer).
    static material() {
        return new THREE.ShaderMaterial({
            uniforms: { uOpacity: { value: 0.95 }, uScale: { value: 1 }, uViewH: { value: 720 } },
            vertexShader: [
                'attribute vec3 aColor;',
                'attribute float aSize;',
                'attribute float aAlpha;',
                'attribute float aShape;',
                'uniform float uScale;',
                'uniform float uViewH;',
                'varying vec3 vColor;',
                'varying float vAlpha;',
                'varying float vPx;',
                'varying float vShape;',
                'void main() {',
                '  vColor = aColor; vAlpha = aAlpha; vShape = aShape;',
                '  vPx = aSize * uScale;',
                '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
                // Pull the sprite toward the camera by ~1.5 of its own width (world units),
                // so near the limb the curved surface does not cut the disc in half.
                // Far-side markers are already alpha 0 (CPU horizon test), so this never
                // lets one show through the globe. Screen position is unchanged.
                '  float wpp = 2.0 * max(-mv.z, 1e-4) / (projectionMatrix[1][1] * max(uViewH, 1.0));',
                '  mv.xyz -= normalize(mv.xyz) * min(1.5 * vPx * wpp, 0.5 * length(mv.xyz));',
                '  gl_Position = projectionMatrix * mv;',
                '  gl_PointSize = aAlpha > 0.0 ? vPx : 0.0;',
                '}'
            ].join('\n'),
            fragmentShader: [
                'uniform float uOpacity;',
                'varying vec3 vColor;',
                'varying float vAlpha;',
                'varying float vPx;',
                'varying float vShape;',
                'void main() {',
                '  vec2 p = gl_PointCoord * 2.0 - 1.0;',
                // Shape 1 (places) = a diamond (L1 distance), so a place never reads as a quake.
                '  float r = vShape > 0.5 ? abs(p.x) + abs(p.y) : length(p);',
                '  float px = 2.0 / max(vPx, 1.0);',              // one pixel in disc units
                '  float disc = 1.0 - smoothstep(1.0 - px, 1.0, r);',
                '  if (disc <= 0.0 || vAlpha <= 0.0) discard;',
                '  float core = 1.0 - smoothstep(1.0 - 2.4 * px, 1.0 - 1.4 * px, r);',  // ~1 px dark rim
                '  vec3 col = mix(vColor * 0.18, vColor, core);',
                // Places: a ~1.5 px white ring inside the dark rim, colour core inside it.
                '  if (vShape > 0.5) {',
                '    float inner = 1.0 - smoothstep(1.0 - 5.6 * px, 1.0 - 4.4 * px, r);',
                '    col = mix(vColor * 0.18, mix(vec3(1.0), vColor, inner), core);',
                '  }',
                '  gl_FragColor = vec4(col, disc * vAlpha * uOpacity);',
                '  #include <colorspace_fragment>',
                '}'
            ].join('\n'),
            transparent: true,
            depthWrite: false,
            depthTest: true
        });
    }
}
GlobeMarkers.MAX_BADGES = 40;

// ONE globe palette (roast R1 #3/#4): each meaning owns one hue, and the pairs that can
// sit side by side also differ in shape, dash or lightness, so they stay apart under
// deuteranopia/protanopia (checked with a Machado 2009 simulation). sRGB hex.
//   yellow  = places (diamond + white ring + name)   orange->purple = quakes (discs)
//   cyan    = country borders (solid, brightest)     steel blue = states (dashed, dimmer)
//   amber   = SF districts (solid)                   grey = lat/lng grid (faint, fades at poles)
//   warm white = cities (small dots)                 mint/sky/pink = GPS/weather/station sats
GlobeMarkers.PALETTE = Object.freeze({
    place: 0xffe14a,
    city: 0xfff0dc,
    border: 0x8fe3ff,
    state: 0x5f8fc8,
    district: 0xffb85c,
    grid: 0xb4bcc6,
    satGps: 0x7dffb0,
    satWeather: 0x5cb4ff,
    satStation: 0xff6ad3
});

// A palette hex as a THREE.Color that SHOWS as that hex. ColorManagement is off site-wide,
// so a raw setHex is treated as linear and the sRGB output step brightens it (amber
// 0xffb85c came out cream). Converting first keeps the globe equal to the legend.
GlobeMarkers.color = function (hex) {
    console.assert(Number.isFinite(hex), 'GlobeMarkers.color: hex required');
    return new THREE.Color().setHex(hex).convertSRGBToLinear();
};
GlobeMarkers.LABEL_MAX_R = 3.5;     // place-name labels show nearer than this (globe radii)
GlobeMarkers.MAX_PX = 13;            // largest marker diameter on screen (CSS px)

// Magnitude colour ramp for quakes (sRGB hex; GlobeMarkers converts to linear).
// M2.5 light orange -> M4 orange -> M5 red -> M6 magenta -> M7+ purple. It starts at
// orange, not yellow: yellow belongs to the places (diamonds). Lightness falls with
// magnitude, so the order holds for colour-blind readers too. Rule 5: 2 asserts.
GlobeMarkers.quakeColor = function (mag) {
    console.assert(Number.isFinite(mag), 'GlobeMarkers.quakeColor: mag required');
    const stops = [[2.5, 0xffa64d], [4.0, 0xff7a1a], [5.0, 0xf03a23], [6.0, 0xc4126e], [7.0, 0x8a1ab8]];
    if (mag <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
        if (mag <= stops[i][0]) {
            const a = stops[i - 1], b = stops[i], t = (mag - a[0]) / (b[0] - a[0]);
            const ch = (s) => Math.round(((a[1] >> s) & 255) * (1 - t) + ((b[1] >> s) & 255) * t);
            const out = (ch(16) << 16) | (ch(8) << 8) | ch(0);
            console.assert(out >= 0 && out <= 0xffffff, 'GlobeMarkers.quakeColor: out of range');
            return out;
        }
    }
    return stops[stops.length - 1][1];
};

// Quake marker diameter in px: M2.5 -> 5 px, M4 -> 7 px, M6 -> 10 px, M7+ 11 px.
GlobeMarkers.quakeSize = function (mag) {
    return Math.max(5, Math.min(11, 5 + (mag - 2.5) * 1.5));
};

if (typeof window !== 'undefined') window.GlobeMarkers = GlobeMarkers;
