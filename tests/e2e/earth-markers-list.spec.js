import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Live markers list (roast R3 #9b, P31).
 *
 * The quake and ISS detail cards used to open only by a mouse click on the globe (screen
 * pick). The Layers tab now has a "Live markers" list, collapsed by default: the ISS plus
 * the 10 quakes nearest the view centre, as buttons. A button flies the camera there and
 * opens the card through the same _showDetail a click uses (one announcement, the ✕).
 *
 * Every feed is answered here. 10 quakes sit on the San Francisco side (Target Island far
 * enough from the rest that a click on it is never a cluster), 2 on the far side.
 *
 * MARKERS_SHOT_DIR (optional): where to save the collapsed / open screenshots.
 */

test.use({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
test.setTimeout(120000);

const NOW = Date.now();
const q = (mag, place, lng, lat) => ({ type: 'Feature', properties: { mag: mag, place: place, time: NOW - 3600000 },
    geometry: { type: 'Point', coordinates: [lng, lat, 10.0] } });
const NEAR = [
    q(3.1, 'Near A, CA', -118.0, 34.0), q(3.4, 'Near B, CA', -121.0, 37.5), q(2.9, 'Near C, NV', -116.0, 39.0),
    q(4.0, 'Near D, OR', -122.5, 43.5), q(3.7, 'Near E, WA', -121.5, 47.5), q(2.6, 'Near F, AZ', -111.5, 33.5),
    q(3.2, 'Near G, UT', -112.0, 40.5), q(4.3, 'Near H, BC', -126.0, 50.0), q(3.0, 'Near I, Baja', -115.5, 30.0),
    q(4.6, 'Target Island', -155.0, 20.0)
];
const FAR = [q(5.1, 'Far India', 80.0, -20.0), q(4.8, 'Far Africa', 25.0, -30.0)];
const QUAKES = { type: 'FeatureCollection', metadata: { generated: NOW, count: 12 }, features: NEAR.concat(FAR) };
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

/** Boot, pick Earth, enter Explore by its button, close the intro card, face SF. */
async function enter(page) {
    await page.goto('/#main');
    await page.waitForFunction(() => {
        const se = window.spaceEnvironment;
        const earth = se && se.getEarthObject && se.getEarthObject();
        return !!(earth && earth.mesh);
    }, null, { timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => { const b = document.getElementById('tab-Earth'); if (b) b.click(); });
    await page.waitForTimeout(2500);
    await page.locator('#explore-enter-btn').click();
    await page.waitForFunction(() => window.spaceEnvironment.exploreMode === true, null, { timeout: 10000 });
    await expect(card(page)).toContainText('San Francisco');
    await page.locator('#explore-detail .ed-close').click();
    await page.locator('#explore-center-sf').click();
    // Both live layers loaded and the ISS placed.
    await page.waitForFunction(() => {
        const mk = window.spaceEnvironment.getEarthObject().markers;
        return !!(mk && mk.listItems('quakes').length === 12 && mk.listItems('iss').length === 1);
    }, null, { timeout: 30000 });
    await page.waitForTimeout(2500);
}

const card = (page) => page.locator('#explore-detail');
const cardText = (page) => page.locator('#explore-detail .ed-body').innerText();
const list = (page) => page.locator('#ep-marker-list');
const quakeBtns = (page) => page.locator('#ep-marker-list button[data-layer="quakes"]');
const issBtn = (page) => page.locator('#ep-marker-list button[data-layer="iss"]');

const watchAnnouncer = (page) => page.evaluate(() => {
    const region = document.getElementById('planet-live-region');
    window.__p31 = { writes: 0, texts: [] };
    new MutationObserver(() => { window.__p31.writes++; window.__p31.texts.push(region.textContent); })
        .observe(region, { childList: true, characterData: true, subtree: true });
});
const announced = (page) => page.evaluate(() => window.__p31);

/** Angle (deg) between the view centre and a lat/lng, in the globe's own frame. */
const viewAngleTo = (page, lat, lng) => page.evaluate(([la, ln]) => {
    const se = window.spaceEnvironment;
    const mesh = se.getEarthObject().getMesh();
    const v = mesh.worldToLocal(se.camera.position.clone()).normalize();
    const p = GlobeMath.latLngToVector3(la, ln, 1).normalize();
    return Math.acos(Math.max(-1, Math.min(1, v.dot(p)))) * 180 / Math.PI;
}, [lat, lng]);

/** Screen point of the drawn marker whose card text contains `needle`. */
async function markerPointFor(page, layer, needle) {
    await page.waitForFunction(([name, n]) => {
        const L = window.spaceEnvironment.getEarthObject().markers.layers[name];
        if (!L || !L.points || !L.points.visible) return false;
        const i = L.items.findIndex((it) => ((it.data.name || '') + ' ' + (it.data.info || '')).includes(n));
        return i >= 0 && L.points.geometry.attributes.aAlpha.array[i] > 0 && (L.sx[i] !== 0 || L.sy[i] !== 0);
    }, [layer, needle], { timeout: 30000 });
    return page.evaluate(([name, n]) => {
        const se = window.spaceEnvironment;
        const L = se.getEarthObject().markers.layers[name];
        const i = L.items.findIndex((it) => ((it.data.name || '') + ' ' + (it.data.info || '')).includes(n));
        const r = se._getCanvasRect();
        return { x: r.left + L.sx[i], y: r.top + L.sy[i], count: L.count[i] };
    }, [layer, needle]);
}

test('keyboard: Tab into the list, Enter flies to a quake and opens the same card a click opens', async ({ page }) => {
    await routeFeeds(page);
    await enter(page);
    const renderer = await page.evaluate(() => {
        const gl = window.spaceEnvironment.renderer.getContext();
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });
    console.log('renderer: ' + renderer);

    // Collapsed by default: the panel stays clean.
    const box = page.locator('#ep-markers');
    expect(await box.evaluate((d) => d.open)).toBe(false);
    await expect(list(page)).toBeHidden();
    await expect(page.locator('#ep-markers-count')).toHaveText('11');
    const shots = process.env.MARKERS_SHOT_DIR;
    if (shots) {
        mkdirSync(shots, { recursive: true });
        await page.locator('#explore-panel').screenshot({ path: shots + '/markers-collapsed-panel.png' });
    }

    // Tab reaches the summary right after the last layer switch; Enter opens it.
    await page.locator('#explore-toggle-sats').focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.tagName + '|' + document.activeElement.parentElement.id))
        .toBe('SUMMARY|ep-markers');
    await page.keyboard.press('Enter');
    await expect(list(page)).toBeVisible();
    await expect(issBtn(page)).toHaveCount(1);
    await expect(quakeBtns(page)).toHaveCount(10);
    const labels = await quakeBtns(page).allInnerTexts();
    expect(labels.join('\n')).not.toContain('Far India');      // nearest 10 only
    expect(labels.join('\n')).not.toContain('Far Africa');
    expect(labels).toContain('M4.6 · Target Island');            // the card's magnitude + place
    if (shots) {
        await page.locator('#explore-panel').screenshot({ path: shots + '/markers-open-panel.png' });
        await page.screenshot({ path: shots + '/markers-open-full.png' });
    }

    // Tab down to Target Island (ISS first, then quakes nearest first) and press Enter.
    const idx = labels.indexOf('M4.6 · Target Island');
    for (let i = 0; i <= idx + 1; i++) await page.keyboard.press('Tab');   // summary -> ISS -> quakes[0..idx]
    expect(await page.evaluate(() => document.activeElement.textContent)).toBe('M4.6 · Target Island');
    await watchAnnouncer(page);
    expect(await viewAngleTo(page, 20, -155)).toBeGreaterThan(10);
    await page.keyboard.press('Enter');
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toContainText('M4.6 earthquake');
    await expect(card(page)).toContainText('Target Island');
    await expect(page.locator('#explore-detail .ed-close')).toBeVisible();
    expect(await page.evaluate(() => document.activeElement.textContent), 'focus stays on the button')
        .toBe('M4.6 · Target Island');
    const fromList = await cardText(page);
    await page.waitForTimeout(2500);                            // the 1.5 s fly lands
    const ang = await viewAngleTo(page, 20, -155);
    console.log('view centre to Target Island after Enter: ' + ang.toFixed(2) + ' deg');
    expect(ang, 'the camera flew to the quake').toBeLessThan(2);
    let a = await announced(page);
    expect(a.writes, 'announced once').toBe(1);
    expect(a.texts[0]).toContain('Target Island');
    await card(page).waitFor({ state: 'visible' });
    if (shots) await page.screenshot({ path: shots + '/markers-quake-card.png' });

    // Positive control: the mouse path. Close the card, click the same marker on the globe.
    await page.locator('#explore-detail .ed-close').click();
    await expect(card(page)).toBeHidden();
    const pt = await markerPointFor(page, 'quakes', 'Target Island');
    expect(pt.count, 'not a cluster at this zoom').toBe(1);
    await page.mouse.click(pt.x, pt.y);
    await expect(card(page)).toBeVisible();
    expect(await cardText(page), 'same card text as a mouse click').toBe(fromList);
    a = await announced(page);
    expect(a.writes).toBe(2);
});

test('the ISS button opens the ISS card; hidden layers leave the list', async ({ page }) => {
    await routeFeeds(page);
    await enter(page);
    await page.locator('#ep-markers > summary').click();
    await expect(issBtn(page)).toHaveText('ISS (Zarya)');
    await issBtn(page).focus();
    await page.keyboard.press('Enter');
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toContainText('ISS (Zarya)');
    await expect(card(page)).toContainText('Alt 420 km');
    const fromList = await cardText(page);
    await page.waitForTimeout(2500);
    expect(await viewAngleTo(page, 46, -134), 'the camera flew to the ISS').toBeLessThan(2);
    // Mouse control on the ISS marker gives the same card.
    await page.locator('#explore-detail .ed-close').click();
    const pt = await markerPointFor(page, 'iss', 'ISS');
    await page.mouse.click(pt.x, pt.y);
    await expect(card(page)).toBeVisible();
    expect(await cardText(page)).toBe(fromList);

    // Quakes off: the quake part empties at once, the ISS stays.
    await page.locator('#explore-toggle-quakes').click();
    await expect(page.locator('#explore-toggle-quakes')).toHaveAttribute('aria-pressed', 'false');
    await expect(quakeBtns(page)).toHaveCount(0);
    await expect(issBtn(page)).toHaveCount(1);
    await expect(page.locator('#ep-markers-count')).toHaveText('1');
    // ISS off too: nothing listed, the hint says why.
    await page.locator('#explore-toggle-iss').click();
    await expect(issBtn(page)).toHaveCount(0);
    await expect(page.locator('#ep-markers-empty')).toBeVisible();
    // Quakes back on: they come back.
    await page.locator('#explore-toggle-quakes').click();
    await expect(quakeBtns(page)).toHaveCount(10, { timeout: 5000 });
});

test('updates follow the view and the feed without stealing focus', async ({ page }) => {
    await routeFeeds(page);
    await enter(page);
    await page.locator('#ep-markers > summary').click();
    await expect(quakeBtns(page)).toHaveCount(10);
    await quakeBtns(page).nth(3).focus();
    await page.evaluate(() => { window.__p31f = document.activeElement; });
    const sig0 = await list(page).getAttribute('data-sig');

    // Turn to the far side while focus is in the list: nothing under the user moves.
    await page.evaluate(() => window.spaceEnvironment.centerOnLatLng(-20, 80));
    await page.waitForTimeout(3000);
    expect(await page.evaluate(() => document.activeElement === window.__p31f && document.contains(window.__p31f)),
        'focus not stolen').toBe(true);
    expect(await list(page).getAttribute('data-sig')).toBe(sig0);

    // Focus leaves the list: within a tick the list follows the new view centre.
    await page.locator('#ep-markers > summary').focus();
    await expect(quakeBtns(page).first()).toHaveText('M5.1 · Far India', { timeout: 3000 });

    // A feed update (the quake layer redrawn with a new quake) shows up on the next tick.
    await page.evaluate(() => {
        const earth = window.spaceEnvironment.getEarthObject();
        const f = [{ type: 'Feature', properties: { mag: 6.2, place: 'New Quake Sea', time: Date.now() },
            geometry: { type: 'Point', coordinates: [79.0, -21.0, 5] } }];
        earth.markers.setItems('quakes', Earth.quakeItems(f));
    });
    await expect(quakeBtns(page)).toHaveCount(1, { timeout: 3000 });
    await expect(quakeBtns(page).first()).toHaveText('M6.2 · New Quake Sea');
    expect(await page.evaluate(() => document.activeElement.tagName)).toBe('SUMMARY');
});
