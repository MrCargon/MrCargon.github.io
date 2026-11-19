// @ts-check
/**
 * Service-worker scope (roast R3 #6), in a real browser.
 *
 * sw.js is registered at the origin root, so on the live site its scope covers the game
 * sites published on the same origin (/game-barista/, /game-snake/, /game-tictactoe/).
 * It must answer the portfolio's own files and leave every /game-* request to the
 * network. Playwright's response.fromServiceWorker() says which side answered.
 * tests/verify-sw-scope.cjs covers the same rule as a node unit test.
 */
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('SW manages portfolio files but passes /game-* straight to the network', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    // Wait until the SW controls this page (skipWaiting + clients.claim).
    await page.waitForFunction(() => !!navigator.serviceWorker && !!navigator.serviceWorker.controller,
        null, { timeout: 20000 });

    // A portfolio file: answered by the SW.
    const own = await page.goto('/index.css');
    expect(own, 'portfolio file response').not.toBeNull();
    expect(own.fromServiceWorker(), '/index.css should go through the SW').toBe(true);

    // Game paths on the same origin: never answered by the SW.
    for (const p of ['/game-snake/', '/game-barista/index.html', '/game-tictactoe/index.html?v=1']) {
        const res = await page.goto(p);
        expect(res, p + ' response').not.toBeNull();
        expect(res.fromServiceWorker(), p + ' must bypass the portfolio SW').toBe(false);
    }
    // A big game sub-resource fetched from the page: must not be cached by the SW
    // (pre-fix it went cache-first into the portfolio cache).
    await page.evaluate(() => fetch('/game-barista/index.pck').catch(() => null));
    await page.waitForTimeout(800); // cache.put in the SW is async
    const cached = await page.evaluate(async () => {
        const names = await caches.keys();
        let hits = 0;
        for (const n of names) {
            const c = await caches.open(n);
            for (const req of await c.keys()) if (new URL(req.url).pathname.startsWith('/game-')) hits++;
        }
        return hits;
    });
    expect(cached, 'no /game-* entry may land in the portfolio cache').toBe(0);
});
