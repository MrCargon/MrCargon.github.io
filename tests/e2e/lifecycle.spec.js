import { test, expect } from '@playwright/test';

/**
 * LIFECYCLE — the machinery that was declared and never implemented.
 *
 * PageManager carried a block of methods under the comment "Additional stub methods to
 * prevent errors": bodies of `{ return true; }` that existed so calls elsewhere would not
 * throw. Three of them were registered against real browser events and one was called on
 * every page cleanup, so the site was announcing behaviour it did not have —
 * preloading that never preloaded, error handling that discarded errors, resource
 * cleanup that cleaned nothing.
 *
 * These tests exist because "it does not throw" is not the same as "it works", and the
 * only way to tell the difference is to check the effect.
 */

test.use({ viewport: { width: 1280, height: 900 } });
test.describe.configure({ timeout: 120000 });

const pm = (page) => page.evaluate(() => {
    const m = window.pageManager || (window.app && window.app.pageManager);
    return m ? true : false;
});

async function boot(page, route = '#main') {
    await page.goto('/' + route);
    await page.waitForFunction(() => !!(window.pageManager || (window.app && window.app.pageManager)),
        null, { timeout: 40000 });
    await page.waitForTimeout(route === '#main' ? 5500 : 3000);
}

test('routes marked preload are actually preloaded', async ({ page }) => {
    await boot(page);
    expect(await pm(page), 'page manager is reachable').toBe(true);

    // requestIdleCallback fires when the browser is quiet; give it room.
    await page.waitForTimeout(4500);

    const state = await page.evaluate(() => {
        const m = window.pageManager || (window.app && window.app.pageManager);
        const flagged = Object.keys(m.pages).filter((n) => m.pages[n].preload);
        return {
            flagged,
            cached: [...m.pageCache.keys()],
            current: m.currentPage,
            cacheSize: m.pageCache.size
        };
    });

    expect(state.flagged.length, 'some routes are flagged for preload').toBeGreaterThan(0);
    // Every flagged route other than the one already rendered must now be in the cache.
    const want = state.flagged.filter((n) => n !== state.current);
    for (const n of want) {
        expect(state.cached, `${n} is flagged preload and should be warmed`).toContain(n);
    }
    // And the cache cap is still respected.
    expect(state.cacheSize).toBeLessThanOrEqual(10);
});

test('a preloaded route renders without a fetch', async ({ page }) => {
    await boot(page);
    await page.waitForTimeout(4500);

    // Count network requests for page fragments while navigating to a warmed route.
    const fetched = [];
    page.on('request', (r) => {
        if (r.url().includes('/src/components/pages/') && r.url().endsWith('.html')) {
            fetched.push(r.url());
        }
    });

    const warmed = await page.evaluate(() => {
        const m = window.pageManager || (window.app && window.app.pageManager);
        const n = [...m.pageCache.keys()].find((k) => k !== m.currentPage);
        return n || null;
    });
    test.skip(!warmed, 'nothing was warmed to navigate to');

    await page.evaluate((n) => { location.hash = '#' + n; }, warmed);
    await page.waitForTimeout(2500);

    const current = await page.evaluate(() => {
        const m = window.pageManager || (window.app && window.app.pageManager);
        return m.currentPage;
    });
    expect(current, 'navigated to the warmed route').toBe(warmed);
    expect(fetched, 'served from cache, not refetched').toEqual([]);
});

test('uncaught errors are recorded instead of discarded', async ({ page }) => {
    await boot(page);

    const before = await page.evaluate(() => {
        const m = window.pageManager || (window.app && window.app.pageManager);
        return m.recentErrors.length;
    });

    // A genuine uncaught error and a genuine unhandled rejection.
    await page.evaluate(() => {
        setTimeout(() => { throw new Error('audit: deliberate uncaught error'); }, 0);
        Promise.reject(new Error('audit: deliberate unhandled rejection'));
    });
    await page.waitForTimeout(600);

    const after = await page.evaluate(() => {
        const m = window.pageManager || (window.app && window.app.pageManager);
        return m.recentErrors.map((e) => ({ kind: e.kind, message: e.message, page: e.page }));
    });

    expect(after.length, 'both were recorded').toBeGreaterThan(before + 1);
    expect(after.some((e) => e.kind === 'error' && e.message.includes('deliberate uncaught')),
        'the thrown error is in the history').toBe(true);
    expect(after.some((e) => e.kind === 'unhandledrejection' && e.message.includes('deliberate unhandled')),
        'the rejection is in the history').toBe(true);
    // It must know WHICH page the failure happened on — that is the point of keeping it.
    expect(after[after.length - 1].page).toBeTruthy();
});

test('the error history is bounded', async ({ page }) => {
    await boot(page);
    const cap = await page.evaluate(() => window.PageManager.MAX_RECENT_ERRORS);
    expect(cap, 'a cap is declared').toBeGreaterThan(0);

    await page.evaluate((n) => {
        const m = window.pageManager || (window.app && window.app.pageManager);
        // Push well past the cap through the real entry point.
        for (let i = 0; i < n * 3; i++) m.recordError('error', 'flood ' + i, null, null);
    }, cap);

    const len = await page.evaluate(() => {
        const m = window.pageManager || (window.app && window.app.pageManager);
        return m.recentErrors.length;
    });
    expect(len, 'a page throwing in a loop cannot grow it without bound').toBe(cap);
});

test('page-scoped timeouts are cancelled by navigation', async ({ page }) => {
    await boot(page);

    // Schedule through the tracked helper, then navigate before it fires. The callback
    // must never run: the elements such a timeout would touch are gone.
    const result = await page.evaluate(async () => {
        const m = window.pageManager || (window.app && window.app.pageManager);
        window.__fired = false;
        m.trackedTimeout(() => { window.__fired = true; }, 3000);
        const tracked = m.activeTimeouts.size;
        await m.navigateToPage('projects', true);
        await new Promise((r) => setTimeout(r, 3500));
        return { tracked, fired: window.__fired, left: m.activeTimeouts.size };
    });

    expect(result.tracked, 'the timeout was registered').toBeGreaterThan(0);
    expect(result.fired, 'navigation cancelled it').toBe(false);
    expect(result.left, 'and the set was emptied').toBe(0);
});

test('a tracked timeout that fires deregisters itself', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = window.pageManager || (window.app && window.app.pageManager);
        const start = m.activeTimeouts.size;
        window.__ran = 0;
        m.trackedTimeout(() => { window.__ran++; }, 100);
        const during = m.activeTimeouts.size;
        await new Promise((res) => setTimeout(res, 500));
        return { start, during, after: m.activeTimeouts.size, ran: window.__ran };
    });
    expect(r.during, 'registered while pending').toBe(r.start + 1);
    expect(r.ran, 'it still runs normally').toBe(1);
    expect(r.after, 'and removes itself, so the set cannot grow without bound').toBe(r.start);
});

test('a failed start-up says so instead of leaving a blank page', async ({ page }) => {
    await boot(page);
    // handleInitializationError was a stub, so init() failing logged to the console and
    // left the visitor looking at nothing at all.
    const shown = await page.evaluate(() => {
        const m = window.pageManager || (window.app && window.app.pageManager);
        m.handleInitializationError(new Error('audit: simulated start-up failure'));
        const c = m.contentContainer || document.getElementById('page-container');
        return c ? c.textContent : '';
    });
    expect(shown, 'the visitor is told something went wrong').toContain('could not start');
    expect(shown).toContain('simulated start-up failure');
});

test('coming back from another tab does not lurch the simulation', async ({ page }) => {
    // animate() returns early while document.hidden, but the clock keeps running — so the
    // first frame after the tab regains focus used to receive the WHOLE absence as one
    // step. Measured before the fix: normal frames 0.112s, first frame back after four
    // seconds away 4.117s. A minute in another tab handed the solar system sixty seconds
    // in a single tick.
    await page.goto('/#main');
    await page.waitForFunction(() => !!(window.spaceEnvironment && window.spaceEnvironment.solarSystem),
        null, { timeout: 40000 });
    await page.waitForTimeout(5500);

    const r = await page.evaluate(async () => {
        const se = window.spaceEnvironment;
        const deltas = [];
        const orig = se.solarSystem.update.bind(se.solarSystem);
        se.solarSystem.update = (dt, j) => { deltas.push(dt); return orig(dt, j); };

        await new Promise((res) => setTimeout(res, 400));

        // Go away for four seconds.
        Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
        const before = deltas.length;
        await new Promise((res) => setTimeout(res, 4000));
        const whileHidden = deltas.length - before;

        // Come back.
        Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
        await new Promise((res) => setTimeout(res, 400));
        const firstBack = deltas[before + whileHidden];

        se.solarSystem.update = orig;
        return { whileHidden, firstBack, cap: window.SpaceEnvironment.MAX_FRAME_DELTA };
    });

    expect(r.whileHidden, 'nothing is simulated while the tab is hidden').toBe(0);
    expect(r.firstBack, 'and the frame that follows is a frame, not four seconds')
        .toBeLessThanOrEqual(r.cap);
    // Four seconds away must not arrive as four seconds of simulation.
    expect(r.firstBack).toBeLessThan(0.5);
});
