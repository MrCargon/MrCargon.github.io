// CalendarStore.js — local-first event store for the Calendar module.
//
// DESIGN: on-device first (localStorage), works fully OFFLINE and instantly. An optional
// pluggable SYNC ADAPTER mirrors events to a backend when online + configured — same
// "works without config, syncs when configured" pattern as Presence.js. Nothing here
// depends on the network; sync is additive.
//
// Event shape: { id, date:'YYYY-MM-DD', time:'HH:MM'|'' , title, notes, updated, deleted }
//   - soft-delete (deleted:true + tombstone) so removals also sync/merge cleanly.
//
// classic script, window global. NASA Power-of-10: bounded loops, >=2 asserts/method,
// methods <=60 lines, pre-allocated structures, graceful fallback.

class CalendarStore {
    constructor(opts) {
        console.assert(typeof window !== 'undefined', 'CalendarStore: window required');
        console.assert(!opts || typeof opts === 'object', 'CalendarStore: opts object');
        var o = opts || {};
        this.key = o.key || 'mrcargon.calendar.events';
        this.sync = o.sync || null;          // optional CalendarSync-like adapter
        this._events = new Map();            // id -> event (pre-allocated structure)
        this._listeners = [];
        this._load();
        if (this.sync && typeof this.sync.attach === 'function') {
            var self = this;
            this.sync.attach({ onRemote: function (list) { self._mergeRemote(list); } });
        }
    }

    // ---- persistence -------------------------------------------------------
    _load() {
        console.assert(typeof this.key === 'string', '_load: key required');
        console.assert(this._events instanceof Map, '_load: events map required');
        try {
            var raw = window.localStorage ? window.localStorage.getItem(this.key) : null;
            var arr = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(arr)) arr = [];
            var self = this;
            arr.slice(0, 5000).forEach(function (e) { if (e && e.id) self._events.set(String(e.id), e); });
        } catch (err) {
            console.warn('[CalendarStore] load failed, starting empty:', err && err.message);
        }
        return true;
    }

    _persist() {
        console.assert(this._events instanceof Map, '_persist: events map');
        console.assert(typeof this.key === 'string', '_persist: key');
        try {
            var arr = [];
            this._events.forEach(function (e) { arr.push(e); });
            if (window.localStorage) window.localStorage.setItem(this.key, JSON.stringify(arr));
        } catch (err) {
            console.warn('[CalendarStore] persist failed:', err && err.message);
        }
        this._emit();
        return true;
    }

    // ---- queries -----------------------------------------------------------
    // All live (non-deleted) events for a 'YYYY-MM-DD' date, sorted by time. <=60 lines.
    forDate(date) {
        console.assert(typeof date === 'string', 'forDate: date string');
        console.assert(this._events instanceof Map, 'forDate: events map');
        var out = [];
        this._events.forEach(function (e) {
            if (e && !e.deleted && e.date === date) out.push(e);
        });
        out.sort(function (a, b) { return String(a.time || '').localeCompare(String(b.time || '')); });
        return out;
    }

    // Map of 'YYYY-MM-DD' -> live event count, for month-grid dots. Bounded by store size.
    countsByDate() {
        console.assert(this._events instanceof Map, 'countsByDate: events map');
        var counts = Object.create(null);
        this._events.forEach(function (e) {
            if (e && !e.deleted && e.date) counts[e.date] = (counts[e.date] || 0) + 1;
        });
        return counts;
    }

    // ---- mutations ---------------------------------------------------------
    upsert(ev) {
        console.assert(ev && typeof ev === 'object', 'upsert: event object');
        console.assert(ev.date && typeof ev.date === 'string', 'upsert: event.date required');
        var id = ev.id ? String(ev.id) : ('ev-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
        var rec = {
            id: id, date: ev.date, time: ev.time || '', title: ev.title || '(untitled)',
            notes: ev.notes || '', updated: Date.now(), deleted: false
        };
        this._events.set(id, rec);
        this._persist();
        if (this.sync && typeof this.sync.push === 'function') this.sync.push(rec);
        return rec;
    }

    remove(id) {
        console.assert(id != null, 'remove: id required');
        console.assert(this._events instanceof Map, 'remove: events map');
        var rec = this._events.get(String(id));
        if (!rec) return false;
        rec.deleted = true; rec.updated = Date.now();     // tombstone, so the delete syncs too
        this._events.set(String(id), rec);
        this._persist();
        if (this.sync && typeof this.sync.push === 'function') this.sync.push(rec);
        return true;
    }

    // ---- remote merge (last-write-wins by `updated`) -----------------------
    _mergeRemote(list) {
        console.assert(Array.isArray(list), '_mergeRemote: array');
        console.assert(this._events instanceof Map, '_mergeRemote: events map');
        var self = this, changed = false;
        list.slice(0, 5000).forEach(function (r) {
            if (!r || !r.id) return;
            var cur = self._events.get(String(r.id));
            if (!cur || (Number(r.updated) || 0) > (Number(cur.updated) || 0)) {
                self._events.set(String(r.id), r); changed = true;
            }
        });
        if (changed) this._persist();
        return changed;
    }

    // ---- change notification ----------------------------------------------
    onChange(fn) {
        console.assert(typeof fn === 'function', 'onChange: fn');
        console.assert(Array.isArray(this._listeners), 'onChange: listeners');
        this._listeners.push(fn);
        return true;
    }
    _emit() {
        var self = this;
        this._listeners.forEach(function (fn) { try { fn(); } catch (e) { /* isolate */ } });
        return true;
    }
}

if (typeof window !== 'undefined') window.CalendarStore = CalendarStore;
if (typeof module !== 'undefined' && module.exports) module.exports = { CalendarStore: CalendarStore };
