/**
 * sw.js — service worker for the MrCargon portfolio hub (installable PWA).
 *
 * Strategy: stale-while-revalidate for SAME-ORIGIN GET requests — respond from cache
 * instantly when present, and refresh the cache from the network in the background so a
 * `git push` propagates on the next visit. Cross-origin requests (THREE CDNs, Unsplash,
 * the embedded game iframes on mrcargon.github.io/game-*) are passed straight through and
 * never cached. Navigations fall back to the app shell when offline.
 *
 * Bump CACHE_NAME to force a clean refresh of all cached assets.
 */
// Bumped v4 -> v5 on 2026-08-22. The strategy below is stale-while-revalidate,
// which serves the cached copy FIRST on every request - so after a CSS/JS change
// a returning visitor keeps seeing the old site, and even Ctrl+Shift+R does not
// reliably beat a service worker. Bumping this name deletes every old cache in
// the activate handler below, forcing a clean fetch.
// ALWAYS bump this when shipping asset changes, or nobody sees them.
const CACHE_NAME = 'mrcargon-hub-v5';
const CORE_SHELL = ['./', './index.html', './index.css'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(CORE_SHELL))
            .then(() => self.skipWaiting())
            .catch(() => self.skipWaiting()) // never block install on a shell miss
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    // Only manage same-origin assets; let CDNs / Unsplash / game iframes pass through.
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.open(CACHE_NAME).then((cache) =>
            cache.match(req).then((cached) => {
                const network = fetch(req)
                    .then((res) => {
                        if (res && res.status === 200) cache.put(req, res.clone());
                        return res;
                    })
                    .catch(() =>
                        cached || (req.mode === 'navigate' ? cache.match('./index.html') : undefined)
                    );
                // stale-while-revalidate: serve cache now if we have it, else wait for network.
                return cached || network;
            })
        )
    );
});
