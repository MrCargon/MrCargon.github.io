import { test, expect } from '@playwright/test';

/**
 * Explore map tiles and credits (roast R3 #4 + #5, P44).
 *
 * - Tiles down: when the imagery host (Esri) and the street host (OpenFreeMap) fail, a
 *   zoom-in used to end on a dark sphere with no hint. Now a quiet line "Map tiles
 *   unavailable - showing the base globe" shows under the nav, and showing it moves
 *   nothing else on screen (panel, footer, nav keep their boxes).
 *   Control: the same zoom with both hosts answering (a 1x1 PNG, an empty vector tile)
 *   never shows the line; and once the hosts come back, the line goes away.
 * - Credits at phone width: every required credit (Esri, Maxar, Earthstar Geographics,
 *   OpenStreetMap, OpenFreeMap, Natural Earth) is on screen, not clipped and not under the
 *   Explore panel. Control: the old one-line ellipsis CSS put back in the page makes the
 *   same check fail, so the check can see a clipped strip.
 *
 * Every live feed and both tile hosts are answered by routes here.
 * SHOT_DIR (optional): where to save p44-*.png screenshots.
 */

test.use({ serviceWorkers: 'block' });
test.setTimeout(120000);

const SHOT_DIR = process.env.SHOT_DIR || '';
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const CORS = { 'Access-Control-Allow-Origin': '*' };

async function routeFeeds(page) {
    await page.route('**earthquake.usgs.gov/**', (r) => r.abort('connectionrefused'));
    await page.route('**api.wheretheiss.at/**', (r) => r.abort('connectionrefused'));
    await page.route('**celestrak.org/**', (r) => r.abort('connectionrefused'));
    await page.route('**services.swpc.noaa.gov/**', (r) => r.abort('connectionrefused'));
    await page.route('**/satellites-snapshot.json', (r) => r.fulfill({ status: 404, body: 'gone' }));
}

/** Route both tile hosts. Returns a setter: up(true) answers them, up(false) refuses. */
async function routeTiles(page, startUp) {
    let up = startUp;
    await page.route('**server.arcgisonline.com/**', (r) => (up
        ? r.fulfill({ status: 200, headers: Object.assign({ 'Content-Type': 'image/png' }, CORS), body: PNG_1PX })
        : r.abort('connectionrefused')));
    await page.route('**tiles.openfreemap.org/**', (r) => {
        if (!up) return r.abort('connectionrefused');
        if (/\.pbf(\?|$)/.test(r.request().url())) {
            return r.fulfill({ status: 200, headers: Object.assign({ 'Content-Type': 'application/x-protobuf' }, CORS), body: '' });
        }
        return r.fulfill({ status: 200, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS),
            body: JSON.stringify({ tiles: ['https://tiles.openfreemap.org/planet/test/{z}/{x}/{y}.pbf'] }) });
    });
    return (v) => { up = v; };
}

async function enterExplore(page) {
    await page.goto('/#main');
    await page.waitForFunction(() => {
        const se = window.spaceEnvironment;
        const earth = se && se.getEarthObject && se.getEarthObject();
        return !!(earth && earth.mesh);
    }, null, { timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => { const b = document.getElementById('tab-Earth'); if (b) b.click(); });
    await page.waitForTimeout(2500);
    const btn = page.locator('#explore-enter-btn');
    await expect(btn).toBeVisible({ timeout: 15000 });
    await btn.click();
    await page.waitForFunction(() => window.spaceEnvironment.exploreMode === true, null, { timeout: 10000 });
    await page.waitForTimeout(1500);
}

const rr = (page) => page.evaluate(() => {
    const se = window.spaceEnvironment, e = se.getEarthObject();
    const R = (e.data && e.data.radius) || 2;
    return se.camera.position.distanceTo(e.getMesh().getWorldPosition(new window.THREE.Vector3())) / R;
});

/** Zoom in with real wheel events until the camera is inside the street-tile range. */
async function zoomClose(page) {
    const vp = page.viewportSize();
    await page.mouse.move(vp.width / 2, vp.height / 2);
    for (let i = 0; i < 40 && (await rr(page)) > 1.2; i++) {
        await page.mouse.wheel(0, -240);
        await page.waitForTimeout(120);
    }
    expect(await rr(page), 'camera should reach the tile range').toBeLessThan(1.25);
}

const boxes = (page) => page.evaluate(() => {
    const b = (sel) => { const el = document.querySelector(sel); if (!el) return null;
        const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((v) => Math.round(v)); };
    return { panel: b('#explore-panel'), footer: b('.main-footer'), header: b('.main-header') };
});

const notice = (page) => page.locator('#explore-tile-notice');

/**
 * "Visible" to Playwright is not "seen": in Explore the globe canvas is raised to z 30, and
 * a first build of this notice sat inside #content under it, visible by every DOM measure
 * but never painted. Hit-test it (pointer events on for the probe only) to prove it is the
 * top-most thing at its own centre.
 */
const paintedOnTop = (page) => page.evaluate(() => {
    const n = document.getElementById('explore-tile-notice');
    const r = n.getBoundingClientRect();
    n.style.pointerEvents = 'auto';
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    n.style.pointerEvents = '';
    return top === n;
});

test.describe('map tiles down', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('both tile hosts down: the quiet notice shows, nothing moves; back up: it goes', async ({ page }) => {
        await routeFeeds(page);
        const setUp = await routeTiles(page, false);
        await enterExplore(page);
        await expect(notice(page)).toBeHidden();          // far out: no tile is needed yet
        await zoomClose(page);
        const before = await boxes(page);
        await expect(notice(page)).toBeVisible({ timeout: 20000 });
        await expect(notice(page)).toHaveText('Map tiles unavailable - showing the base globe');
        await expect(notice(page)).toHaveAttribute('role', 'status');
        const st = await page.evaluate(() => {
            const e = window.spaceEnvironment.getEarthObject();
            return { sat: e.satelliteTiles.getStatus(), street: e.streetTiles.getStatus() };
        });
        expect(st.sat.failStreak + (st.street.templateDown ? 99 : st.street.failStreak)).toBeGreaterThanOrEqual(3);
        // No layout jump: the panel, footer and nav keep their boxes, and the notice is
        // click-through and clear of the nav pill.
        expect(await boxes(page)).toEqual(before);
        const geo = await page.evaluate(() => {
            const n = document.getElementById('explore-tile-notice');
            const r = n.getBoundingClientRect(), h = document.querySelector('.main-header').getBoundingClientRect();
            return { pe: getComputedStyle(n).pointerEvents, pos: getComputedStyle(n).position,
                belowHeader: r.top >= h.bottom - 1, inView: r.left >= 0 && r.right <= innerWidth };
        });
        expect(geo).toEqual({ pe: 'none', pos: 'fixed', belowHeader: true, inView: true });
        expect(await paintedOnTop(page), 'the notice must paint above the raised globe canvas').toBe(true);
        if (SHOT_DIR) await page.screenshot({ path: SHOT_DIR + '/p44-desktop-tiles-down.png' });

        // Hosts come back: the next tile that loads hides the notice.
        setUp(true);
        await expect(notice(page)).toBeHidden({ timeout: 45000 });

        // Leaving Explore never leaves the line behind.
        await page.evaluate(() => window.spaceEnvironment.exitExploreMode && window.spaceEnvironment.exitExploreMode());
        await expect(notice(page)).toBeHidden();
    });

    test('control: hosts answering, the same zoom shows no notice', async ({ page }) => {
        await routeFeeds(page);
        await routeTiles(page, true);
        await enterExplore(page);
        await zoomClose(page);
        await page.waitForTimeout(4000);
        const st = await page.evaluate(() => window.spaceEnvironment.getEarthObject().satelliteTiles.getStatus());
        expect(st.built, 'the control must really load imagery tiles').toBeGreaterThan(0);
        await expect(notice(page)).toBeHidden();
    });
});

test.describe('phone width', () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

    const CREDITS = ['Esri', 'Maxar', 'Earthstar Geographics', 'OpenStreetMap', 'OpenFreeMap', 'Natural Earth'];

    /** Every credit present, the strip unclipped, on screen and not under the panel. */
    const creditCheck = (page) => page.evaluate((names) => {
        const a = document.querySelector('.main-footer .footer-attribution');
        const r = a.getBoundingClientRect(), cs = getComputedStyle(a);
        const p = document.getElementById('explore-panel').getBoundingClientRect();
        const text = a.textContent.replace(/\s+/g, ' ');
        return {
            missing: names.filter((n) => !text.includes(n)),
            clipped: a.scrollWidth > a.clientWidth + 1 || a.scrollHeight > a.clientHeight + 1 || cs.textOverflow === 'ellipsis',
            onScreen: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
            underPanel: !(p.bottom <= r.top || p.top >= r.bottom || p.right <= r.left || p.left >= r.right)
        };
    }, CREDITS);

    test('every required credit is on screen, unclipped, in Explore', async ({ page }) => {
        await routeFeeds(page);
        await routeTiles(page, true);
        await enterExplore(page);
        expect(await creditCheck(page)).toEqual({ missing: [], clipped: false, onScreen: true, underPanel: false });
        if (SHOT_DIR) await page.screenshot({ path: SHOT_DIR + '/p44-phone-explore-credits.png' });

        // Control: the pre-R3 one-line ellipsis strip is caught by the same check.
        await page.addStyleTag({ content: 'body.explore-active .main-footer .footer-attribution{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:200px!important}' });
        const bad = await creditCheck(page);
        expect(bad.clipped, 'the check must see a clipped strip').toBe(true);
    });

    test('tiles down at phone width: the notice fits under the nav', async ({ page }) => {
        await routeFeeds(page);
        await routeTiles(page, false);
        await enterExplore(page);
        await zoomClose(page);
        await expect(notice(page)).toBeVisible({ timeout: 20000 });
        const geo = await page.evaluate(() => {
            const n = document.getElementById('explore-tile-notice').getBoundingClientRect();
            const h = document.querySelector('.main-header').getBoundingClientRect();
            return { belowHeader: n.top >= h.bottom - 1, inView: n.left >= 0 && n.right <= innerWidth, oneLine: n.height < 26 };
        });
        expect(geo).toEqual({ belowHeader: true, inView: true, oneLine: true });
        expect(await paintedOnTop(page), 'the notice must paint above the raised globe canvas').toBe(true);
        if (SHOT_DIR) await page.screenshot({ path: SHOT_DIR + '/p44-phone-tiles-down.png' });
    });
});
