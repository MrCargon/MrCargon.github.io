/**
 * boot.js - small page bootstrap that used to be two inline <script> blocks in
 * index.html. Inline scripts need 'unsafe-inline' (or a hash) in the CSP; as a file
 * they are covered by script-src 'self' (roast R3 #7).
 *  1. three.js fail-soft: dispatch threejs-ready / threejs-failed on window load.
 *  2. PWA: register the service worker (sw.js only manages the portfolio's own paths;
 *     the /game-* sites on the same origin pass straight through - see sw.js).
 *  3. Image fallback: <img data-fallback-src="..."> swaps to that URL once on error.
 *     Replaces an inline error-handler attribute (this.src = ...), which a CSP without
 *     'unsafe-inline' blocks. Capture phase, because 'error' does not bubble; one
 *     listener covers images inserted later by the page router.
 */
(function () {
// Fail-soft: if the module never ran (no import-map support, CDN blocked, offline),
// window.THREE is absent and the app shows its 3D-unavailable path instead of
// throwing. The old inline OrbitControls stub is gone - it silently produced a
// dead camera that looked like a bug rather than a load failure.
window.addEventListener('load', function () {
  var ok = (typeof window.THREE !== 'undefined') && !!window.THREE.OrbitControls;
  window.dispatchEvent(new CustomEvent(ok ? 'threejs-ready' : 'threejs-failed'));
  if (!ok) console.error('THREE.js failed to load (import map / module blocked?)');
});

// PWA: register the service worker so the whole portfolio is installable + works
// offline. No-op on browsers without service-worker support.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((e) =>
            console.warn('[MrCargon] SW registration failed:', e));
    });
}

document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    var alt = img.getAttribute('data-fallback-src');
    if (!alt || img.getAttribute('data-fallback-used')) return;
    img.setAttribute('data-fallback-used', '1');
    img.src = alt;
}, true);
})();
