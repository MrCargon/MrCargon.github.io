// ExplorePins.js - user-managed map pins for Explore mode. Each pin is a saved place
// with a name, note, colour and a TYPE: a single 'dot' (point marker) or a flexible
// 'area' (a translucent disc of adjustable radius draped on the surface). Pins persist
// to localStorage so they survive reloads, render as meshes parented to the Earth mesh
// (so they track rotation), and expose their marker meshes for raycast picking/drag.
//
// This module owns DATA + MESHES only. The panel UI, raycast picking and drag-to-move
// interaction live in SpaceEnvironment (which owns the camera/controls/DOM).
//
// global THREE r128, classic script. NASA Power-of-10: bounded loops, >=2 asserts/
// method, methods <=60 lines, graceful fallback, dispose.
class ExplorePins {
    /**
     * @param {THREE.Mesh} earthMesh - globe mesh; pin meshes are parented to it
     * @param {number} radius - globe radius (scene units)
     * @param {Object} [opts]
     */
    constructor(earthMesh, radius, opts) {
        console.assert(earthMesh && earthMesh.isObject3D, 'ExplorePins: earthMesh required');
        console.assert(Number.isFinite(radius) && radius > 0, 'ExplorePins: radius required');
        var o = opts || {};
        this.earthMesh = earthMesh;
        this.radius = radius;
        this.storageKey = o.storageKey || 'mrcargon.explore.pins';
        this.kmPerUnit = 6371 / radius;                 // Earth radius / scene radius
        this.maxPins = Number.isFinite(o.maxPins) ? o.maxPins : 200;
        this._disposed = false;
        this._seq = 1;
        this.pins = [];                                  // data records (see _normalize)
        this.markers = new Map();                        // id -> THREE.Object3D
        this.group = (typeof THREE !== 'undefined') ? new THREE.Group() : null;
        if (this.group) { this.group.name = 'explorePins'; this.earthMesh.add(this.group); }
        this.load();
    }

    // ---- persistence -------------------------------------------------------

    // Load saved pins (or seed a default) + build their markers. Rule 4: <=60 lines.
    load() {
        console.assert(Array.isArray(this.pins), 'load: pins array required');
        console.assert(this.group, 'load: group required');
        var raw = null;
        try { raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(this.storageKey) : null; }
        catch (e) { raw = null; }
        var arr = null;
        if (raw) { try { arr = JSON.parse(raw); } catch (e) { arr = null; } }
        // No default pin: the globe already shows the "Based in San Francisco" marker,
        // so a seeded SF pin would just duplicate it. Start empty; the user adds pins.
        if (!Array.isArray(arr)) arr = [];
        var max = Math.min(arr.length, this.maxPins);             // Rule 2: bounded
        for (var i = 0; i < max; i++) this._addRecord(arr[i], false);
        return true;
    }

    // Persist current pins (data only) to localStorage. Rule 5: 2 asserts.
    save() {
        console.assert(Array.isArray(this.pins), 'save: pins array required');
        console.assert(typeof this.storageKey === 'string', 'save: key required');
        try {
            if (typeof localStorage !== 'undefined') localStorage.setItem(this.storageKey, JSON.stringify(this.pins));
        } catch (e) { /* quota / disabled — non-fatal */ }
        return true;
    }

    // Coerce a raw record into the canonical pin shape. Rule 5: 2 asserts.
    _normalize(r) {
        console.assert(r && typeof r === 'object', '_normalize: record required');
        console.assert(Number.isFinite(r.lat) && Number.isFinite(r.lng), '_normalize: coords required');
        var type = (r.type === 'area') ? 'area' : 'dot';
        return {
            id: r.id || ('pin-' + (this._seq++)),
            name: (typeof r.name === 'string' && r.name) ? r.name.slice(0, 60) : 'Pin',
            note: (typeof r.note === 'string') ? r.note.slice(0, 240) : '',
            lat: Math.max(-90, Math.min(90, r.lat)),
            lng: ((r.lng + 540) % 360) - 180,
            color: (typeof r.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(r.color)) ? r.color : '#66e8ff',
            type: type,
            radiusKm: Number.isFinite(r.radiusKm) ? Math.max(1, Math.min(2000, r.radiusKm)) : 50
        };
    }

    // ---- CRUD --------------------------------------------------------------

    // Add a pin record (+ its marker). save=false during bulk load. Rule 5: 2 asserts.
    _addRecord(r, save) {
        console.assert(this.pins.length < this.maxPins + 1, '_addRecord: under cap');
        console.assert(this.group, '_addRecord: group required');
        if (this.pins.length >= this.maxPins) return null;
        var pin = this._normalize(r);
        this.pins.push(pin);
        this._buildMarker(pin);
        if (save) this.save();
        return pin;
    }

    // Public create at a lat/lng with optional fields. Rule 5: 2 asserts.
    addPin(lat, lng, fields) {
        console.assert(Number.isFinite(lat) && Number.isFinite(lng), 'addPin: coords required');
        console.assert(!this._disposed, 'addPin: not disposed');
        var f = fields || {};
        return this._addRecord({ lat: lat, lng: lng, name: f.name, note: f.note,
            color: f.color, type: f.type, radiusKm: f.radiusKm }, true);
    }

    // Update a pin's fields; rebuilds the marker if shape-affecting. Rule 4: <=60 lines.
    updatePin(id, fields) {
        console.assert(typeof id === 'string', 'updatePin: id required');
        console.assert(fields && typeof fields === 'object', 'updatePin: fields required');
        var pin = this.getPin(id);
        if (!pin) return null;
        var shapeChanged = (fields.type !== undefined && fields.type !== pin.type) ||
            (fields.radiusKm !== undefined && fields.radiusKm !== pin.radiusKm);
        var moved = (fields.lat !== undefined && fields.lat !== pin.lat) ||
            (fields.lng !== undefined && fields.lng !== pin.lng);
        var merged = this._normalize(Object.assign({}, pin, fields, { id: pin.id }));
        var idx = this.pins.indexOf(pin);
        this.pins[idx] = merged;
        if (shapeChanged) { this._disposeMarker(id); this._buildMarker(merged); }
        else { this._restyleMarker(merged); if (moved) this._placeMarker(this.markers.get(id), merged.lat, merged.lng); }
        this.save();
        return merged;
    }

    // Remove a pin + its marker. Rule 5: 2 asserts.
    removePin(id) {
        console.assert(typeof id === 'string', 'removePin: id required');
        console.assert(Array.isArray(this.pins), 'removePin: pins required');
        var pin = this.getPin(id);
        if (!pin) return false;
        this.pins.splice(this.pins.indexOf(pin), 1);
        this._disposeMarker(id);
        this.save();
        return true;
    }

    getPin(id) {
        console.assert(typeof id === 'string', 'getPin: id required');
        console.assert(Array.isArray(this.pins), 'getPin: pins required');
        for (var i = 0; i < this.pins.length; i++) if (this.pins[i].id === id) return this.pins[i];
        return null;
    }

    list() { console.assert(Array.isArray(this.pins), 'list: pins required');
        console.assert(!this._disposed, 'list: not disposed'); return this.pins; }

    // ---- meshes ------------------------------------------------------------

    // Build the marker (dot or area) for a pin, parent it, register for picking. <=60.
    _buildMarker(pin) {
        console.assert(pin && pin.id, '_buildMarker: pin required');
        console.assert(this.group, '_buildMarker: group required');
        if (typeof THREE === 'undefined') return null;
        var holder = new THREE.Group();
        if (pin.type === 'area') this._buildArea(holder, pin); else this._buildDot(holder, pin);
        holder.userData.pinId = pin.id;
        holder.userData.kind = 'pin';
        this._placeMarker(holder, pin.lat, pin.lng);
        this.group.add(holder);
        this.markers.set(pin.id, holder);
        return holder;
    }

    // Dot = a small bright sphere on a thin stem + a flat ring halo. Rule 4: <=60.
    _buildDot(holder, pin) {
        console.assert(holder && holder.isObject3D, '_buildDot: holder required');
        console.assert(pin, '_buildDot: pin required');
        var col = new THREE.Color(pin.color);
        var r = this.radius * 0.012;
        var headMat = new THREE.MeshBasicMaterial({ color: col });
        var head = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), headMat);
        head.position.y = r * 2.4;
        var stemMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6 });
        var stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.18, r * 2.4, 6), stemMat);
        stem.position.y = r * 1.2;
        var ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5,
            side: THREE.DoubleSide, depthWrite: false });
        var ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.4, r * 2.0, 24), ringMat);
        ring.rotation.x = -Math.PI / 2;
        holder.add(stem); holder.add(head); holder.add(ring);
        holder.userData.pickMesh = head;        // the raycast target
        return holder;
    }

    // Area = translucent disc of radiusKm + an outline ring, draped tangent. Rule 4: <=60.
    _buildArea(holder, pin) {
        console.assert(holder && holder.isObject3D, '_buildArea: holder required');
        console.assert(pin && pin.radiusKm > 0, '_buildArea: radius required');
        var col = new THREE.Color(pin.color);
        var rU = Math.max(this.radius * 0.004, pin.radiusKm / this.kmPerUnit);
        var fillMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22,
            side: THREE.DoubleSide, depthWrite: false });
        var fill = new THREE.Mesh(new THREE.CircleGeometry(rU, 48), fillMat);
        var ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8,
            side: THREE.DoubleSide, depthWrite: false });
        var ring = new THREE.Mesh(new THREE.RingGeometry(rU * 0.97, rU, 48), ringMat);
        // disc lies in the XZ plane facing +Y; _placeMarker orients +Y to the normal.
        fill.rotation.x = -Math.PI / 2; ring.rotation.x = -Math.PI / 2;
        fill.position.y = this.radius * 0.0012; ring.position.y = this.radius * 0.0013;
        holder.add(fill); holder.add(ring);
        holder.userData.pickMesh = fill;
        return holder;
    }

    // Re-colour an existing marker in place (no rebuild). Rule 5: 2 asserts.
    _restyleMarker(pin) {
        console.assert(pin && pin.id, '_restyleMarker: pin required');
        console.assert(this.markers, '_restyleMarker: markers required');
        var holder = this.markers.get(pin.id);
        if (!holder) return false;
        var col = new THREE.Color(pin.color);
        holder.traverse(function (o) { if (o.material && o.material.color) o.material.color.copy(col); });
        return true;
    }

    // Position + orient a marker so its local +Y is the surface normal. Rule 5: 2 asserts.
    _placeMarker(holder, lat, lng) {
        console.assert(holder && holder.isObject3D, '_placeMarker: holder required');
        console.assert(typeof GlobeMath !== 'undefined', '_placeMarker: GlobeMath required');
        var p = GlobeMath.latLngToVector3(lat, lng, this.radius * 1.0009);
        holder.position.set(p.x, p.y, p.z);
        holder.up.set(p.x, p.y, p.z).normalize();
        holder.lookAt(p.x * 2, p.y * 2, p.z * 2);
        return true;
    }

    // Dispose one marker (geometry + material) + unregister. Rule 5: 2 asserts.
    _disposeMarker(id) {
        console.assert(typeof id === 'string', '_disposeMarker: id required');
        console.assert(this.markers, '_disposeMarker: markers required');
        var holder = this.markers.get(id);
        if (!holder) return false;
        holder.traverse(function (o) {
            if (o.geometry && o.geometry.dispose) o.geometry.dispose();
            if (o.material && o.material.dispose) o.material.dispose();
        });
        if (holder.parent) holder.parent.remove(holder);
        this.markers.delete(id);
        return true;
    }

    // Marker meshes for raycast picking (the pickMesh of each). Rule 5: 2 asserts.
    getPickMeshes() {
        console.assert(this.markers instanceof Map, 'getPickMeshes: markers required');
        console.assert(!this._disposed, 'getPickMeshes: not disposed');
        var out = [];
        this.markers.forEach(function (holder) {
            if (holder.userData.pickMesh) out.push(holder.userData.pickMesh);
        });
        return out;
    }

    setVisible(vis) {
        console.assert(typeof vis === 'boolean', 'setVisible: boolean required');
        console.assert(this.group, 'setVisible: group required');
        this.group.visible = !!vis;
        return vis;
    }

    // Per-frame: scale DOT markers by camera distance so they hold a near-constant
    // screen size (instead of vanishing when far + ballooning/clipping when close).
    // scale = rr/2 makes the subtended angle constant; clamped. AREA pins keep their
    // real km radius (not screen-scaled). Rule 4: <=60 lines | no per-frame alloc.
    update(distInRadii) {
        console.assert(Number.isFinite(distInRadii), 'update: distance required');
        console.assert(this.markers instanceof Map, 'update: markers required');
        if (this._disposed || !this.group || !this.group.visible) return false;
        var s = Math.max(0.35, Math.min(4, distInRadii * 0.5));
        var max = Math.min(this.pins.length, this.maxPins);     // Rule 2: bounded
        for (var i = 0; i < max; i++) {
            var p = this.pins[i];
            if (p.type === 'area') continue;
            var holder = this.markers.get(p.id);
            if (holder) holder.scale.setScalar(s);
        }
        return true;
    }

    // Free everything. Rule 5: 2 asserts.
    dispose() {
        console.assert(this.markers instanceof Map, 'dispose: markers required');
        console.assert(this.group !== undefined, 'dispose: group field expected');
        this._disposed = true;
        var self = this;
        this.markers.forEach(function (holder, id) { self._disposeMarker(id); });
        this.markers.clear();
        if (this.group && this.group.parent) this.group.parent.remove(this.group);
        this.pins = [];
        return true;
    }
}

if (typeof window !== 'undefined') window.ExplorePins = ExplorePins;
if (typeof module !== 'undefined' && module.exports) module.exports = ExplorePins;
