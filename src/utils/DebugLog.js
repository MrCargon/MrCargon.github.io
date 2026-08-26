// DebugLog.js — silence console.log in production, keep everything that matters.
//
// The codebase carries 273 console.log calls. They are genuinely useful while
// building, and genuinely harmful shipped: a console emitting hundreds of lines per
// page load buries the errors you actually need to see, and anyone who opens
// DevTools on the portfolio sees a wall of debug chatter rather than a clean app.
//
// Deleting 273 call sites would be a large, risky, review-hostile diff that also
// throws away the debugging. Gating them centrally is one file and zero call-site
// changes, and the logs come back on demand.
//
// DELIBERATELY NOT SILENCED:
//   console.error   — real failures, must always surface
//   console.warn    — degraded paths (texture fallbacks, failed tiles)
//   console.assert  — 1042 of them, the NASA Rule 5 invariants this codebase is
//                     built on. Silencing those would gut the safety net.
//
// Turn logging back on with either:
//   https://mrcargon.github.io/?debug
//   localStorage.setItem('mrcargon.debug', '1')     // persists across reloads
//
// Loaded FIRST in index.html. Script order matters: `defer` preserves document
// order, so this runs before any module that would log at definition time.
(function () {
    'use strict';
    if (typeof window === 'undefined' || typeof console === 'undefined') return;

    var on = false;
    try {
        on = /[?&]debug\b/.test(window.location.search) ||
             window.localStorage.getItem('mrcargon.debug') === '1';
    } catch (e) {
        on = false;                       // private mode can throw on localStorage
    }

    // Keep the real one reachable so a developer is never locked out.
    console.logRaw = console.log.bind(console);
    window.MRCARGON_DEBUG = on;

    if (!on) {
        console.log = function () {};
        console.debug = function () {};
    }

    // Single line so it is obvious the silencing is deliberate, not a broken console.
    (on ? console.logRaw : console.info).call(
        console,
        on ? '%cmrcargon: debug logging ON' : '%cmrcargon: debug logs muted — add ?debug to the URL to enable',
        'color:#ff8500'
    );

    /** Re-enable at runtime without a reload. */
    window.enableDebugLogs = function () {
        try { window.localStorage.setItem('mrcargon.debug', '1'); } catch (e) {}
        console.log = console.logRaw;
        window.MRCARGON_DEBUG = true;
        console.logRaw('mrcargon: debug logging enabled');
        return true;
    };
})();
