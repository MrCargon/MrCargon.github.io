// CalendarSync.js — optional cross-device sync for CalendarStore via Firebase Firestore's
// REST API (no SDK, no bundler — same approach as the Presence Firebase adapter).
//
// Local-first: if no Firebase projectId or no sync code is set, EVERY method is a safe
// no-op and the calendar stays purely on-device. When configured, events are mirrored to
// Firestore under a user-chosen "sync code" so the same code on another device pulls them
// (last-write-wins by `updated`). A sync code avoids a full auth flow for a personal tool;
// treat it like a password (see CalendarConfig.js for the security note).
//
// Adapter contract used by CalendarStore: attach({onRemote}) / push(record) / pull().
// classic script, window global. NASA Power-of-10: >=2 asserts/method, <=60 lines, bounded.

class CalendarSync {
    constructor(opts) {
        console.assert(typeof window !== 'undefined', 'CalendarSync: window required');
        console.assert(!opts || typeof opts === 'object', 'CalendarSync: opts object');
        var o = opts || {};
        var cfg = (typeof window !== 'undefined' && window.MRCARGON_FIREBASE) ? window.MRCARGON_FIREBASE : {};
        this.projectId = o.projectId || cfg.projectId || '';
        this.syncCode = o.syncCode || this._readCode();
        this.pollMs = Number.isFinite(o.pollMs) ? o.pollMs : 15000;
        this.onRemote = null;
        this._poll = null;
    }

    // Enabled only when we have both a project and a code. <=60 lines.
    enabled() {
        console.assert(typeof this.projectId === 'string', 'enabled: projectId');
        console.assert(typeof this.syncCode === 'string', 'enabled: syncCode');
        return this.projectId.length > 0 && this.syncCode.length > 0;
    }

    _readCode() {
        try { return (window.localStorage && window.localStorage.getItem('mrcargon.calendar.synccode')) || ''; }
        catch (e) { return ''; }
    }
    setSyncCode(code) {
        console.assert(typeof code === 'string', 'setSyncCode: string');
        console.assert(typeof this.projectId === 'string', 'setSyncCode: projectId');
        this.syncCode = code || '';
        try { if (window.localStorage) window.localStorage.setItem('mrcargon.calendar.synccode', this.syncCode); } catch (e) {}
        if (this.enabled()) this.pull();
        return true;
    }

    _base() {
        return 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(this.projectId)
            + '/databases/(default)/documents/calendars/' + encodeURIComponent(this.syncCode) + '/events';
    }

    attach(handlers) {
        console.assert(handlers && typeof handlers.onRemote === 'function', 'attach: onRemote required');
        console.assert(this._poll === null, 'attach: already attached');
        this.onRemote = handlers.onRemote;
        if (!this.enabled()) return false;        // local-only until configured
        var self = this;
        this.pull();
        this._poll = setInterval(function () { self.pull(); }, this.pollMs);
        return true;
    }

    // Mirror one event to Firestore (PATCH = create-or-update). <=60 lines.
    push(rec) {
        console.assert(rec && rec.id, 'push: record.id required');
        console.assert(typeof this._base === 'function', 'push: base');
        if (!this.enabled()) return false;
        var url = this._base() + '/' + encodeURIComponent(rec.id);
        var body = JSON.stringify({ fields: this._encode(rec) });
        fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: body })
            .catch(function (e) { console.warn('[CalendarSync] push failed:', e && e.message); });
        return true;
    }

    pull() {
        console.assert(typeof this._base === 'function', 'pull: base');
        console.assert(this.onRemote === null || typeof this.onRemote === 'function', 'pull: onRemote');
        if (!this.enabled() || !this.onRemote) return false;
        var self = this;
        fetch(this._base(), { method: 'GET' })
            .then(function (r) { return r && r.ok ? r.json() : null; })
            .then(function (data) {
                var docs = (data && data.documents) || [];
                var list = docs.slice(0, 5000).map(function (d) { return self._decode(d.fields); }).filter(Boolean);
                self.onRemote(list);
            })
            .catch(function (e) { console.warn('[CalendarSync] pull failed:', e && e.message); });
        return true;
    }

    detach() {
        if (this._poll) { clearInterval(this._poll); this._poll = null; }
        this.onRemote = null;
        return true;
    }

    // ---- Firestore typed-value (de)serialization ---------------------------
    _encode(rec) {
        console.assert(rec && typeof rec === 'object', '_encode: record');
        console.assert(rec.date, '_encode: date');
        return {
            id: { stringValue: String(rec.id) },
            date: { stringValue: String(rec.date) },
            time: { stringValue: String(rec.time || '') },
            title: { stringValue: String(rec.title || '') },
            notes: { stringValue: String(rec.notes || '') },
            updated: { integerValue: String(Number(rec.updated) || 0) },
            deleted: { booleanValue: !!rec.deleted }
        };
    }
    _decode(f) {
        if (!f || !f.id) return null;
        var s = function (v) { return v && typeof v.stringValue === 'string' ? v.stringValue : ''; };
        return {
            id: s(f.id), date: s(f.date), time: s(f.time), title: s(f.title), notes: s(f.notes),
            updated: Number(f.updated && f.updated.integerValue) || 0,
            deleted: !!(f.deleted && f.deleted.booleanValue)
        };
    }
}

if (typeof window !== 'undefined') window.CalendarSync = CalendarSync;
if (typeof module !== 'undefined' && module.exports) module.exports = { CalendarSync: CalendarSync };
