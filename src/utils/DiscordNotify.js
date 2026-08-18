// DiscordNotify.js — client for the portfolio-discord-proxy Vercel deployment
// (see DiscordProxyConfig.js). Sends contact-form submissions and calendar
// event changes to Discord via a serverless proxy, so the webhook URLs
// themselves never appear in this public repo's JS bundle.
//
// Local-first, same pattern as CalendarSync/Presence: everything here is a
// safe no-op until DiscordProxyConfig.js's proxyUrl is filled in - nothing
// breaks, the contact form and calendar just don't notify anywhere yet.
//
// classic script, window global. NASA Power-of-10: >=2 asserts/method,
// <=60 lines, bounded, fail-soft (never throws into the caller).
class DiscordNotify {
    constructor(opts) {
        console.assert(typeof window !== 'undefined', 'DiscordNotify: window required');
        console.assert(!opts || typeof opts === 'object', 'DiscordNotify: opts object');
        var o = opts || {};
        var cfg = (typeof window !== 'undefined' && window.MRCARGON_DISCORD_PROXY) ? window.MRCARGON_DISCORD_PROXY : {};
        // Strip a trailing slash so `proxyUrl + '/api/...'` never double-slashes.
        this.proxyUrl = (o.proxyUrl || cfg.proxyUrl || '').replace(/\/$/, '');
    }

    enabled() {
        console.assert(typeof this.proxyUrl === 'string', 'enabled: proxyUrl');
        return this.proxyUrl.length > 0;
    }

    // Shared POST helper. Resolves { ok, error } - never rejects, so callers
    // never need a .catch(). <=60 lines.
    _post(body) {
        console.assert(body && typeof body === 'object', '_post: body object required');
        if (!this.enabled()) return Promise.resolve({ ok: false, error: 'not configured' });
        return fetch(this.proxyUrl + '/api/discord-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (r) {
            if (r && r.ok) return { ok: true };
            return r.json().then(function (j) { return { ok: false, error: (j && j.error) || ('HTTP ' + r.status) }; })
                .catch(function () { return { ok: false, error: 'HTTP ' + (r && r.status) }; });
        }).catch(function (e) {
            console.warn('[DiscordNotify] request failed:', e && e.message);
            return { ok: false, error: 'network error' };
        });
    }

    // `hp` is the honeypot field value from the form - pass it through
    // untouched, the proxy silently drops anything with it filled in.
    // <=60 lines.
    contact(name, email, message, hp) {
        console.assert(typeof name === 'string', 'contact: name string');
        console.assert(typeof email === 'string', 'contact: email string');
        return this._post({ type: 'contact', name: name, email: email, message: message || '', hp: hp || '' });
    }

    // action: 'created' | 'updated' | 'deleted'. ev: CalendarStore record
    // shape ({ title, date, time, notes, ... }). <=60 lines.
    calendarEvent(action, ev) {
        console.assert(typeof action === 'string', 'calendarEvent: action string');
        console.assert(ev && typeof ev === 'object', 'calendarEvent: event object required');
        return this._post({
            type: 'calendar', action: action,
            title: ev.title || '', date: ev.date || '', time: ev.time || '', notes: ev.notes || ''
        });
    }
}

if (typeof window !== 'undefined') window.DiscordNotify = DiscordNotify;
if (typeof module !== 'undefined' && module.exports) module.exports = { DiscordNotify: DiscordNotify };
