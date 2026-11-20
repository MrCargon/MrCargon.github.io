import { test, expect } from '@playwright/test';

/**
 * The Explore intro card (roast R3 #11; F2: a neutral hint, no home city).
 *
 * #explore-detail shows "Explore Earth · Drag to spin · click a place" on entering Explore.
 * It used to stay forever (still up at 1.02R street level, over the globe on a phone), had
 * no close button, and was an aria-live region re-announced on every marker click.
 *
 * - the intro hides after 6 s, or on the first drag / wheel, or with its ✕ (mouse + keyboard);
 * - the same card still opens for quakes and the ISS afterwards, and closes with the ✕;
 * - the card is not a live region: a changed card is announced once through
 *   #planet-live-region; the same marker clicked again rewrites and announces nothing.
 *
 * Every feed is answered here (nothing reaches USGS / wheretheiss.at / CelesTrak). The quake
 * and the ISS sit on the North American west side; the test turns the globe there first.
 */

test.use({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
test.setTimeout(90000);

const QUAKES = {
    type: 'FeatureCollection',
    metadata: { generated: Date.now(), count: 1 },
    features: [{ type: 'Feature', properties: { mag: 4.6, place: '10 km S of Testville', time: Date.now() - 3600000 },
        geometry: { type: 'Point', coordinates: [-112.0, 33.5, 10.0] } }]
};
const ISS_FIX = { name: 'iss', id: 25544, latitude: 46.0, longitude: -134.0, altitude: 420, velocity: 27600 };
const json = (body) => ({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body) });

async function routeFeeds(page) {
    await page.route('**earthquake.usgs.gov/**', (r) => r.fulfill(json(QUAKES)));
    await page.route('**api.wheretheiss.at/**', (r) => r.fulfill(json(ISS_FIX)));
    await page.route('**celestrak.org/**', (r) => r.abort('connectionrefused'));
    await page.route('**/satellites-snapshot.json', (r) => r.fulfill({ status: 404, body: 'gone' }));
    await page.addInitScript(() => localStorage.setItem('mrcargon.explore.layers',
        JSON.stringify({ iss: true, quakes: true, sats: false, pois: true })));
}

/** Boot, pick Earth, and enter Explore the way a user does: the Explore Earth button. */
async function enterByButton(page, how) {
    await page.goto('/#main');
    await page.waitForFunction(() => {
        const se = window.spaceEnvironment;
        const earth = se && se.getEarthObject && se.getEarthObject();
        return !!(earth && earth.mesh);
    }, null, { timeout: 60000 });
    // An early tab click is ignored while the scene is still booting (under
    // CPU load a fixed 2 s was too soon and the Sun stayed selected), so
    // click and re-click until the fly-to Earth shows the Enter button.
    const btn = page.locator('#explore-enter-btn');
    for (let i = 0; i < 20 && !(await btn.isVisible()); i++) {
        await page.evaluate(() => { const b = document.getElementById('tab-Earth'); if (b) b.click(); });
        await page.waitForTimeout(2000);
    }
    await expect(btn).toBeVisible({ timeout: 15000 });
    if (how === 'keyboard') { await btn.focus(); await page.keyboard.press('Enter'); } else await btn.click();
    await page.waitForFunction(() => window.spaceEnvironment.exploreMode === true, null, { timeout: 10000 });
}

const card = (page) => page.locator('#explore-detail');
const closeBtn = (page) => page.locator('#explore-detail .ed-close');

async function expectIntro(page) {
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toContainText('Explore Earth');
    await expect(card(page)).toContainText('Drag to spin · click a place');
    await expect(card(page)).not.toContainText('Based here');
    await expect(closeBtn(page)).toHaveAttribute('aria-label', 'Close details');
}

/** Screen point of a marker layer's first item, once it is projected and drawn. */
async function markerPoint(page, layer) {
    await page.waitForFunction((name) => {
        const L = window.spaceEnvironment.getEarthObject().markers.layers[name];
        return !!(L && L.points && L.points.visible && L.items.length
            && L.points.geometry.attributes.aAlpha.array[0] > 0 && (L.sx[0] !== 0 || L.sy[0] !== 0));
    }, layer, { timeout: 30000 });
    return page.evaluate((name) => {
        const se = window.spaceEnvironment;
        const L = se.getEarthObject().markers.layers[name];
        const r = se._getCanvasRect();
        return { x: r.left + L.sx[0], y: r.top + L.sy[0] };
    }, layer);
}

/** Count writes to the page live region from now on. */
const watchAnnouncer = (page) => page.evaluate(() => {
    const region = document.getElementById('planet-live-region');
    window.__p27 = { writes: 0, texts: [] };
    new MutationObserver(() => { window.__p27.writes++; window.__p27.texts.push(region.textContent); })
        .observe(region, { childList: true, characterData: true, subtree: true });
});
const announced = (page) => page.evaluate(() => window.__p27);

test('intro shows on entry (mouse and keyboard) and hides by itself after ~6 s', async ({ page }) => {
    await routeFeeds(page);
    await enterByButton(page, 'keyboard');
    await expectIntro(page);
    expect(await card(page).getAttribute('aria-live'), 'the card is no longer a live region').toBeNull();
    const t0 = Date.now();
    await expect(card(page)).toBeHidden({ timeout: 9000 });
    const ms = Date.now() - t0;
    expect(ms, 'hid near 6 s, not at once').toBeGreaterThan(4500);

    await page.evaluate(() => window.spaceEnvironment.exitExploreMode(true));
    await page.waitForTimeout(500);
    await page.locator('#explore-enter-btn').click();
    await expectIntro(page);
});

test('the first drag hides the intro; so does the first wheel zoom', async ({ page }) => {
    await routeFeeds(page);
    await enterByButton(page, 'mouse');
    await expectIntro(page);
    await page.mouse.move(640, 300);
    await page.mouse.down();
    await page.mouse.move(700, 320, { steps: 4 });
    await expect(card(page), 'hidden during the drag, before any click').toBeHidden({ timeout: 1500 });
    await page.mouse.up();

    await page.evaluate(() => window.spaceEnvironment.exitExploreMode(true));
    await page.waitForTimeout(500);
    await page.locator('#explore-enter-btn').click();
    await expectIntro(page);
    await page.mouse.move(640, 300);
    await page.mouse.wheel(0, -200);
    await expect(card(page)).toBeHidden({ timeout: 1500 });
});

test('the ✕ closes the intro with the mouse and with the keyboard', async ({ page }) => {
    await routeFeeds(page);
    await enterByButton(page, 'mouse');
    await expectIntro(page);
    await closeBtn(page).click();
    await expect(card(page)).toBeHidden();
    expect(await page.evaluate(() => window.spaceEnvironment.exploreMode), 'the ✕ click is not a globe click').toBe(true);

    await page.evaluate(() => window.spaceEnvironment.exitExploreMode(true));
    await page.waitForTimeout(500);
    await page.locator('#explore-enter-btn').click();
    await expectIntro(page);
    // Real Tab walk: the ✕ is in the tab order.
    let reached = false;
    for (let i = 0; i < 150 && !reached; i++) {
        await page.keyboard.press('Tab');
        reached = await page.evaluate(() => !!(document.activeElement && document.activeElement.classList.contains('ed-close')));
    }
    expect(reached, 'Tab reaches the ✕').toBe(true);
    await page.keyboard.press('Enter');
    await expect(card(page)).toBeHidden();
    expect(await page.evaluate(() => document.activeElement && document.activeElement.id),
        'focus goes back to the panel, not <body>').toBe('explore-collapse');
});

test('quake and ISS cards still open after the intro, close with ✕, and announce only on change', async ({ page }) => {
    await routeFeeds(page);
    await enterByButton(page, 'mouse');
    await expectIntro(page);
    await closeBtn(page).click();
    await expect(card(page)).toBeHidden();
    // Face the quake/ISS side (the entry view faces a neutral point), then let it settle.
    await page.evaluate(() => window.spaceEnvironment.centerOnLatLng(38, -125));
    await page.waitForTimeout(4000);
    await watchAnnouncer(page);

    const q = await markerPoint(page, 'quakes');
    await page.mouse.click(q.x, q.y);
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toContainText('Testville');
    await expect(closeBtn(page)).toBeVisible();
    let a = await announced(page);
    expect(a.writes, 'a new card is announced once').toBe(1);
    expect(a.texts[0]).toContain('Testville');

    const bodyBefore = await page.evaluate(() => document.querySelector('#explore-detail .ed-body').innerHTML);
    await page.mouse.click(q.x, q.y);                       // same marker again
    await page.waitForTimeout(300);
    a = await announced(page);
    expect(a.writes, 'the same card is not re-announced').toBe(1);
    expect(await page.evaluate(() => document.querySelector('#explore-detail .ed-body').innerHTML)).toBe(bodyBefore);

    await closeBtn(page).click();
    await expect(card(page)).toBeHidden();

    const s = await markerPoint(page, 'iss');
    await page.mouse.click(s.x, s.y);
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toContainText(/ISS|Space Station/);
    a = await announced(page);
    expect(a.writes, 'a different card is announced').toBe(2);
    // An opened marker card does not auto-hide like the intro.
    await page.waitForTimeout(6500);
    await expect(card(page)).toBeVisible();
    await closeBtn(page).focus();                            // the ✕ works from the keyboard too
    await page.keyboard.press('Enter');
    await expect(card(page)).toBeHidden();
});
