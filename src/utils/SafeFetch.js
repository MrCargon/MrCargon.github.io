// SafeFetch.js - resilient JSON fetch for live data layers.
// Production-polish wrapper (learned from WorldMonitor's circuit-breaker pattern):
//   - TTL cache so repeated reads don't hammer the API
//   - circuit breaker: after N consecutive failures, stop trying for a cooldown
//   - never throws; returns null on failure so one dead feed can't blank the globe
// global SafeFetch, no modules. three.js r184 codebase convention.
class SafeFetch {
    // NASA Rule 5: validate inputs; Rule 2: all bounds fixed.
    static async json(url, options = {}) {
        console.assert(typeof url === 'string' && url.length > 0, 'SafeFetch.json: url required');
        const ttl = Number.isFinite(options.ttl) ? options.ttl : 30000;     // cache window (ms)
        const timeout = Number.isFinite(options.timeout) ? options.timeout : 10000;
        const now = Date.now();

        SafeFetch._init();
        const cached = SafeFetch._cache.get(url);
        if (cached && (now - cached.t) < ttl) return cached.v;

        // Circuit breaker: skip while tripped.
        const breaker = SafeFetch._breaker.get(url) || { fails: 0, until: 0 };
        if (now < breaker.until) {
            return cached ? cached.v : null;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const res = await fetch(url, { signal: controller.signal });
            if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status));
            const data = await res.json();
            SafeFetch._cache.set(url, { v: data, t: Date.now() });
            SafeFetch._breaker.set(url, { fails: 0, until: 0 });
            return data;
        } catch (err) {
            const fails = breaker.fails + 1;
            // Trip after 3 consecutive failures for a 60s cooldown (bounded).
            const until = fails >= 3 ? Date.now() + 60000 : 0;
            SafeFetch._breaker.set(url, { fails, until });
            console.warn('SafeFetch: ' + url + ' failed (' + fails + '):', err.message);
            return cached ? cached.v : null;   // serve stale if we have it
        } finally {
            clearTimeout(timer);
        }
    }

    // When the network last answered this URL (ms, 0 = never). json() serves its cache on a
    // failure, so callers compare this to tell fresh data from stale (roast R3 #5).
    static fetchedAt(url) {
        console.assert(typeof url === 'string', 'SafeFetch.fetchedAt: url required');
        SafeFetch._init();
        const c = SafeFetch._cache.get(url);
        return c ? c.t : 0;
    }

    // True while the last request to this URL failed (the breaker may also be open).
    static failing(url) {
        console.assert(typeof url === 'string', 'SafeFetch.failing: url required');
        SafeFetch._init();
        const b = SafeFetch._breaker.get(url);
        return !!(b && b.fails > 0);
    }

    static _init() {
        if (!SafeFetch._cache) {
            SafeFetch._cache = new Map();
            SafeFetch._breaker = new Map();
        }
    }
}

if (typeof window !== 'undefined') {
    window.SafeFetch = SafeFetch;
}
