// Presence.js - live "who's online" controller for the globe. Owns a PresencePins
// renderer + a pluggable backend ADAPTER and reconciles the online roster into pins.
//
// PRIVACY BY DESIGN (non-negotiable):
//   - Receiving others is always allowed; SHARING your own location is opt-in, default OFF.
//   - Coordinates you share are rounded to ~1 decimal (~11 km) — never GPS-precise.
//   - Nothing is persisted; rosters are ephemeral and pruned when peers go stale.
//
// Backends (zero-fee):
//   - DemoAdapter            : seeded sample users + (if sharing) you. No network, $0, no signup.
//   - BroadcastChannelAdapter: real presence across tabs on THIS machine. Proves multi-client
//                              sync end-to-end, $0, no backend.
//   - FirebaseAdapter        : real cross-internet presence via Firebase Realtime DB (Spark
//                              plan, free-forever, no card). Enabled only if a config is given.
//
// global window, classic script. NASA Power-of-10: bounded loops, >=2 asserts/method,
// methods <=60 lines, graceful fallback.

// ---- Adapters --------------------------------------------------------------

// Seeded sample roster — gives the globe visible life with zero backend.
class DemoAdapter {
    constructor() {
        this.onRoster = null;
        this._self = null;
        this._seed = [
            { id: 'demo-tokyo',   lat: 35.7,  lng: 139.7, name: 'Tokyo' },
            { id: 'demo-london',  lat: 51.5,  lng: -0.1,  name: 'London' },
            { id: 'demo-nyc',     lat: 40.7,  lng: -74.0, name: 'New York' },
            { id: 'demo-saopaulo',lat: -23.5, lng: -46.6, name: 'São Paulo' },
            { id: 'demo-sydney',  lat: -33.9, lng: 151.2, name: 'Sydney' }
        ];
    }
    connect(handlers) {
        console.assert(handlers && typeof handlers.onRoster === 'function', 'DemoAdapter: onRoster required');
        console.assert(Array.isArray(this._seed), 'DemoAdapter: seed required');
        this.onRoster = handlers.onRoster;
        this._emit();
        return true;
    }
    publish(record) {
        console.assert(this.onRoster, 'DemoAdapter: connect first');
        console.assert(record === null || typeof record === 'object', 'DemoAdapter: record');
        this._self = record;            // null = stopped sharing
        this._emit();
        return true;
    }
    _emit() {
        var list = this._seed.slice();
        if (this._self) list.push(Object.assign({ self: true }, this._self));
        this.onRoster(list);
    }
    disconnect() { this.onRoster = null; return true; }
}

// Real presence across tabs of the SAME browser via BroadcastChannel. Each tab announces
// its record; peers prune after staleMs. Zero backend, zero fee.
class BroadcastChannelAdapter {
    constructor(opts) {
        var o = opts || {};
        this.channelName = o.channelName || 'mrcargon.presence';
        this.staleMs = Number.isFinite(o.staleMs) ? o.staleMs : 45000;
        this.onRoster = null;
        this._peers = new Map();        // id -> { record, lastSeen }
        this._self = null;
        this._bc = null;
        this._timer = null;
    }
    connect(handlers) {
        console.assert(handlers && typeof handlers.onRoster === 'function', 'BCAdapter: onRoster required');
        console.assert(typeof BroadcastChannel !== 'undefined', 'BCAdapter: BroadcastChannel unsupported');
        this.onRoster = handlers.onRoster;
        this._bc = new BroadcastChannel(this.channelName);
        var self = this;
        this._bc.onmessage = function (e) { self._onMessage(e.data); };
        this._timer = setInterval(function () { self._prune(); }, 5000);
        this._bc.postMessage({ kind: 'hello' });
        return true;
    }
    publish(record) {
        console.assert(this.onRoster, 'BCAdapter: connect first');
        console.assert(record === null || typeof record === 'object', 'BCAdapter: record');
        this._self = record;
        if (this._bc) this._bc.postMessage(record ? { kind: 'here', record: record } : { kind: 'bye', record: this._self });
        this._emit();
        return true;
    }
    _onMessage(msg) {
        if (!msg || !msg.kind) return;
        if (msg.kind === 'hello' && this._self && this._bc) this._bc.postMessage({ kind: 'here', record: this._self });
        else if (msg.kind === 'here' && msg.record && msg.record.id != null)
            this._peers.set(String(msg.record.id), { record: msg.record, lastSeen: Date.now() });
        else if (msg.kind === 'bye' && msg.record && msg.record.id != null)
            this._peers.delete(String(msg.record.id));
        this._emit();
    }
    _prune() {
        var now = Date.now(), self = this, changed = false;
        this._peers.forEach(function (v, id) {
            if (now - v.lastSeen > self.staleMs) { self._peers.delete(id); changed = true; }
        });
        if (changed) this._emit();
    }
    _emit() {
        var list = [];
        this._peers.forEach(function (v) { list.push(v.record); });
        if (this._self) list.push(Object.assign({ self: true }, this._self));
        if (this.onRoster) this.onRoster(list);
    }
    disconnect() {
        if (this._self) this.publish(null);
        if (this._timer) clearInterval(this._timer);
        if (this._bc) { this._bc.close(); this._bc = null; }
        this.onRoster = null;
        return true;
    }
}

// ---- Controller ------------------------------------------------------------

class Presence {
    /**
     * @param {PresencePins} pins - renderer
     * @param {Object} [opts] - { adapter, heartbeatMs, coarseDecimals, onCount }
     */
    constructor(pins, opts) {
        console.assert(pins && typeof pins.setUsers === 'function', 'Presence: PresencePins required');
        console.assert(typeof window !== 'undefined', 'Presence: window required');
        var o = opts || {};
        this.pins = pins;
        this.adapter = o.adapter || Presence.defaultAdapter();
        this.heartbeatMs = Number.isFinite(o.heartbeatMs) ? o.heartbeatMs : 30000;
        this.coarseDecimals = Number.isFinite(o.coarseDecimals) ? o.coarseDecimals : 1;
        this.onCount = (typeof o.onCount === 'function') ? o.onCount : null;
        this.enabled = false;          // showing the layer at all
        this.sharing = false;          // sharing my own location
        this.selfId = 'me-' + Math.random().toString(36).slice(2, 9);
        this._hb = null;
        this._self = null;
    }

    // Pick the default free no-signup adapter. Rule 5: 2 asserts.
    static defaultAdapter() {
        console.assert(typeof window !== 'undefined', 'defaultAdapter: window');
        console.assert(typeof DemoAdapter === 'function', 'defaultAdapter: DemoAdapter required');
        // Demo by default: a seeded world roster gives the globe immediate visible life
        // (BroadcastChannel cross-tab mode shows nothing until a 2nd tab/share). Swap to
        // BroadcastChannelAdapter or a FirebaseAdapter via the `adapter` option for real sync.
        return new DemoAdapter();
    }

    // Turn the presence layer on/off (receiving + rendering). Rule 5: 2 asserts.
    setEnabled(on) {
        console.assert(typeof on === 'boolean', 'setEnabled: boolean');
        console.assert(this.pins, 'setEnabled: pins');
        if (on === this.enabled) return this.enabled;
        this.enabled = on;
        this.pins.setVisible(on);
        var self = this;
        if (on) this.adapter.connect({ onRoster: function (list) { self._onRoster(list); } });
        else { this.setSharing(false); this.adapter.disconnect(); this.pins.setUsers([]); }
        return this.enabled;
    }

    // Opt-in to sharing YOUR coarse location. Requires geolocation permission. <=60 lines.
    setSharing(on) {
        console.assert(typeof on === 'boolean', 'setSharing: boolean');
        console.assert(this.adapter, 'setSharing: adapter');
        if (!on) {
            this.sharing = false;
            if (this._hb) { clearInterval(this._hb); this._hb = null; }
            this._self = null;
            if (this.enabled) this.adapter.publish(null);
            return false;
        }
        if (!this.enabled) this.setEnabled(true);
        var self = this;
        this._locate(function (lat, lng) {
            self.sharing = true;
            self._self = { id: self.selfId, lat: lat, lng: lng, name: 'You' };
            self.adapter.publish(self._self);
            if (self._hb) clearInterval(self._hb);
            self._hb = setInterval(function () { if (self._self) self.adapter.publish(self._self); }, self.heartbeatMs);
        });
        return true;
    }

    // One-shot geolocation, rounded coarse before it ever leaves the device. <=60 lines.
    _locate(cb) {
        console.assert(typeof cb === 'function', '_locate: cb required');
        console.assert(this.coarseDecimals >= 0, '_locate: decimals');
        var self = this;
        if (!navigator.geolocation) { console.warn('[Presence] no geolocation'); return false; }
        navigator.geolocation.getCurrentPosition(function (pos) {
            var f = Math.pow(10, self.coarseDecimals);
            var lat = Math.round(pos.coords.latitude * f) / f;
            var lng = Math.round(pos.coords.longitude * f) / f;
            cb(lat, lng);
        }, function (err) { console.warn('[Presence] location denied/failed:', err && err.message); }, {
            enableHighAccuracy: false, maximumAge: 600000, timeout: 15000
        });
        return true;
    }

    _onRoster(list) {
        console.assert(Array.isArray(list), '_onRoster: array');
        console.assert(this.pins, '_onRoster: pins');
        this.pins.setUsers(list);
        if (this.onCount) this.onCount(list.length);
    }

    isEnabled() { return this.enabled; }
    isSharing() { return this.sharing; }

    dispose() {
        console.assert(this.adapter, 'dispose: adapter');
        console.assert(this.pins, 'dispose: pins');
        this.setSharing(false);
        if (this.adapter) this.adapter.disconnect();
        return true;
    }
}

if (typeof window !== 'undefined') {
    window.Presence = Presence;
    window.PresenceDemoAdapter = DemoAdapter;
    window.PresenceBroadcastAdapter = BroadcastChannelAdapter;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Presence: Presence, DemoAdapter: DemoAdapter, BroadcastChannelAdapter: BroadcastChannelAdapter };
}
