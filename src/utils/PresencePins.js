// PresencePins.js - EPHEMERAL live-presence markers on the globe. Unlike ExplorePins
// (user-saved places, persisted to localStorage), these represent *currently-online*
// visitors fed from a realtime backend: they appear, pulse, and disappear with the
// roster and are NEVER persisted. One marker per online user, parented to the Earth
// mesh so they track rotation.
//
// DATA + MESHES only. The backend (heartbeat/roster) lives in Presence.js; this module
// just renders whatever roster it is handed via setUsers().
//
// global THREE r128 + GlobeMath, classic script. NASA Power-of-10: bounded loops,
// >=2 asserts/method, methods <=60 lines, pre-allocated structures, graceful fallback.
class PresencePins {
    /**
     * @param {THREE.Mesh} earthMesh - globe mesh; markers are parented to it
     * @param {number} radius - globe radius (scene units)
     * @param {Object} [opts] - { maxUsers, selfColor, peerColor }
     */
    constructor(earthMesh, radius, opts) {
        console.assert(earthMesh && earthMesh.isObject3D, 'PresencePins: earthMesh required');
        console.assert(Number.isFinite(radius) && radius > 0, 'PresencePins: radius required');
        var o = opts || {};
        this.earthMesh = earthMesh;
        this.radius = radius;
        this.maxUsers = Number.isFinite(o.maxUsers) ? o.maxUsers : 60;
        this.selfColor = o.selfColor || '#ffa500';
        this.peerColor = o.peerColor || '#5bd1ff';
        this._disposed = false;
        this.markers = new Map();                        // id -> THREE.Object3D
        this.group = (typeof THREE !== 'undefined') ? new THREE.Group() : null;
        if (this.group) { this.group.name = 'presencePins'; this.group.visible = false; this.earthMesh.add(this.group); }
    }

    // Reconcile the rendered markers with a fresh roster: add new, move existing,
    // remove vanished. Each user = { id, lat, lng, name, self }. Rule 4: <=60 lines.
    setUsers(users) {
        console.assert(Array.isArray(users), 'setUsers: array required');
        console.assert(!this._disposed, 'setUsers: not disposed');
        if (!this.group) return false;
        var seen = Object.create(null);
        var max = Math.min(users.length, this.maxUsers);            // Rule 2: bounded
        for (var i = 0; i < max; i++) {
            var u = users[i];
            if (!u || !Number.isFinite(u.lat) || !Number.isFinite(u.lng) || u.id == null) continue;
            var id = String(u.id);
            seen[id] = true;
            var holder = this.markers.get(id);
            if (holder) this._placeMarker(holder, u.lat, u.lng);
            else this._buildMarker(id, u);
        }
        var self = this;
        this.markers.forEach(function (h, id) { if (!seen[id]) self._disposeMarker(id); });
        return true;
    }

    // Build one pulsing presence dot (sphere head + halo ring) for a user. Rule 4: <=60.
    _buildMarker(id, u) {
        console.assert(typeof id === 'string', '_buildMarker: id required');
        console.assert(u && Number.isFinite(u.lat), '_buildMarker: coords required');
        if (typeof THREE === 'undefined' || !this.group) return null;
        if (this.markers.size >= this.maxUsers) return null;        // Rule 2: bounded
        var col = new THREE.Color(u.self ? this.selfColor : this.peerColor);
        var r = this.radius * 0.012;
        var holder = new THREE.Group();
        var head = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12),
            new THREE.MeshBasicMaterial({ color: col }));
        head.position.y = r * 2.0;
        var ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.6, r * 2.4, 24),
            new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6,
                side: THREE.DoubleSide, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2;
        holder.add(head); holder.add(ring);
        holder.userData = { presenceId: id, self: !!u.self, ring: ring, head: head, phase: Math.random() * 6.28 };
        this._placeMarker(holder, u.lat, u.lng);
        this.group.add(holder);
        this.markers.set(id, holder);
        return holder;
    }

    // Position + orient a marker so local +Y is the surface normal. Rule 5: 2 asserts.
    _placeMarker(holder, lat, lng) {
        console.assert(holder && holder.isObject3D, '_placeMarker: holder required');
        console.assert(typeof GlobeMath !== 'undefined', '_placeMarker: GlobeMath required');
        var p = GlobeMath.latLngToVector3(lat, lng, this.radius * 1.001);
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

    setVisible(vis) {
        console.assert(typeof vis === 'boolean', 'setVisible: boolean required');
        console.assert(this.group, 'setVisible: group required');
        this.group.visible = !!vis;
        return vis;
    }

    count() { console.assert(this.markers instanceof Map, 'count: markers required');
        console.assert(!this._disposed, 'count: live'); return this.markers.size; }

    // Per-frame: scale dots to a near-constant screen size + pulse the halo ring.
    // distInRadii from camera; elapsed seconds drives the pulse. Rule 4: <=60 | no alloc.
    update(distInRadii, elapsed) {
        console.assert(Number.isFinite(distInRadii), 'update: distance required');
        console.assert(this.markers instanceof Map, 'update: markers required');
        if (this._disposed || !this.group || !this.group.visible) return false;
        var s = Math.max(0.35, Math.min(4, distInRadii * 0.5));
        var t = Number.isFinite(elapsed) ? elapsed : 0;
        this.markers.forEach(function (holder) {
            holder.scale.setScalar(s);
            var ud = holder.userData;
            if (ud && ud.ring && ud.ring.material) {
                var pulse = 0.35 + 0.35 * (1 + Math.sin(t * 3 + ud.phase)) * 0.5;
                ud.ring.material.opacity = pulse;
                ud.ring.scale.setScalar(1 + 0.25 * (1 + Math.sin(t * 3 + ud.phase)) * 0.5);
            }
        });
        return true;
    }

    // Free everything (markers + group). Rule 5: 2 asserts.
    dispose() {
        console.assert(this.markers instanceof Map, 'dispose: markers required');
        console.assert(this.group !== undefined, 'dispose: group field expected');
        this._disposed = true;
        var self = this;
        this.markers.forEach(function (holder, id) { self._disposeMarker(id); });
        this.markers.clear();
        if (this.group && this.group.parent) this.group.parent.remove(this.group);
        return true;
    }
}

if (typeof window !== 'undefined') window.PresencePins = PresencePins;
if (typeof module !== 'undefined' && module.exports) module.exports = PresencePins;
