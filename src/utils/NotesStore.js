// NotesStore.js — local-first notes store for the launcher's Notes module.
// Same pattern as CalendarStore: on-device (localStorage), soft-delete tombstones,
// last-write-wins merge, change events, pluggable sync adapter (CalendarSync with
// collection:'notes'). Works fully OFFLINE; sync is additive.
//
// Note shape: { id, title, body, updated, deleted }
// classic script, window global. NASA Power-of-10: bounded loops, >=2 asserts/method,
// methods <=60 lines, pre-allocated structures, graceful fallback.

class NotesStore {
    constructor(opts) {
        console.assert(typeof window !== 'undefined', 'NotesStore: window required');
        console.assert(!opts || typeof opts === 'object', 'NotesStore: opts object');
        var o = opts || {};
        this.key = o.key || 'mrcargon.notes';
        this.sync = o.sync || null;
        this._notes = new Map();          // id -> note
        this._listeners = [];
        this._load();
        if (this.sync && typeof this.sync.attach === 'function') {
            var self = this;
            this.sync.attach({ onRemote: function (list) { self._mergeRemote(list); } });
        }
    }

    _load() {
        console.assert(typeof this.key === 'string', '_load: key required');
        console.assert(this._notes instanceof Map, '_load: notes map required');
        try {
            var raw = window.localStorage ? window.localStorage.getItem(this.key) : null;
            var arr = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(arr)) arr = [];
            var self = this;
            arr.slice(0, 5000).forEach(function (n) { if (n && n.id) self._notes.set(String(n.id), n); });
        } catch (err) {
            console.warn('[NotesStore] load failed, starting empty:', err && err.message);
        }
        return true;
    }

    _persist() {
        console.assert(this._notes instanceof Map, '_persist: notes map');
        console.assert(typeof this.key === 'string', '_persist: key');
        try {
            var arr = [];
            this._notes.forEach(function (n) { arr.push(n); });
            if (window.localStorage) window.localStorage.setItem(this.key, JSON.stringify(arr));
        } catch (err) {
            console.warn('[NotesStore] persist failed:', err && err.message);
        }
        this._emit();
        return true;
    }

    // Live notes, newest-updated first. Bounded by store size. <=60 lines.
    list() {
        console.assert(this._notes instanceof Map, 'list: notes map');
        var out = [];
        this._notes.forEach(function (n) { if (n && !n.deleted) out.push(n); });
        out.sort(function (a, b) { return (Number(b.updated) || 0) - (Number(a.updated) || 0); });
        return out;
    }

    get(id) {
        console.assert(id != null, 'get: id required');
        console.assert(this._notes instanceof Map, 'get: notes map');
        var n = this._notes.get(String(id));
        return (n && !n.deleted) ? n : null;
    }

    upsert(note) {
        console.assert(note && typeof note === 'object', 'upsert: note object');
        console.assert(this._notes instanceof Map, 'upsert: notes map');
        var id = note.id ? String(note.id) : ('nt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
        var rec = { id: id, title: note.title || '', body: note.body || '', updated: Date.now(), deleted: false };
        this._notes.set(id, rec);
        this._persist();
        if (this.sync && typeof this.sync.push === 'function') this.sync.push(rec);
        return rec;
    }

    remove(id) {
        console.assert(id != null, 'remove: id required');
        console.assert(this._notes instanceof Map, 'remove: notes map');
        var rec = this._notes.get(String(id));
        if (!rec) return false;
        rec.deleted = true; rec.updated = Date.now();     // tombstone so the delete syncs too
        this._notes.set(String(id), rec);
        this._persist();
        if (this.sync && typeof this.sync.push === 'function') this.sync.push(rec);
        return true;
    }

    _mergeRemote(list) {
        console.assert(Array.isArray(list), '_mergeRemote: array');
        console.assert(this._notes instanceof Map, '_mergeRemote: notes map');
        var self = this, changed = false;
        list.slice(0, 5000).forEach(function (r) {
            if (!r || !r.id) return;
            var cur = self._notes.get(String(r.id));
            if (!cur || (Number(r.updated) || 0) > (Number(cur.updated) || 0)) {
                self._notes.set(String(r.id), r); changed = true;
            }
        });
        if (changed) this._persist();
        return changed;
    }

    onChange(fn) {
        console.assert(typeof fn === 'function', 'onChange: fn');
        console.assert(Array.isArray(this._listeners), 'onChange: listeners');
        this._listeners.push(fn);
        return true;
    }
    _emit() {
        this._listeners.forEach(function (fn) { try { fn(); } catch (e) { /* isolate */ } });
        return true;
    }
}

if (typeof window !== 'undefined') window.NotesStore = NotesStore;
if (typeof module !== 'undefined' && module.exports) module.exports = { NotesStore: NotesStore };
