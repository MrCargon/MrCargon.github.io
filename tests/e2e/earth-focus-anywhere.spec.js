import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * F1 "focus anywhere": the Explore panel search finds any continent, country, region, city or
 * typed "lat, lng"; picking one flies there and opens ONE place card (kind, approximate local
 * solar time, Sun up/down, quakes and ISS from data Explore already holds). Clicking a country
 * on the globe opens the same card; a double-click still drops a pin.
 *
 * - "Latvia" -> Country card with "Population ≈ 1.91 M (2019 est.)" (Natural Earth POP_EST + year),
 *   the camera ends facing Latvia; a globe click on France also gets its population line;
 * - "Jūrmala" and "jurmala" both find the region (diacritic-insensitive), "Region of Latvia";
 * - "37.77, -122.42" flies there and the card shows the typed coordinates;
 * - "Africa" -> Continent;
 * - keyboard only: arrows move aria-activedescendant / aria-selected, Enter picks, Esc closes
 *   the list without leaving Explore;
 * - the index is lazy: no geo search file is fetched before the field is focused;
 * - a fake USGS feed with one quake in Latvia shows up on the Latvia card.
 *
 * F1_SHOTS (optional): folder for f1-search.png (results open) and f1-card.png (country card).
 */

test.use({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
test.setTimeout(120000);

const QUAKE_FEED = { type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { mag: 3.4, place: 'Test quake, Latvia', time: Date.now() - 3600000 },
        geometry: { type: 'Point', coordinates: [25.5, 56.7, 10] } }] };

async function routeFeeds(page, quakes) {
    await page.route('**earthquake.usgs.gov/**', (r) => (quakes
        ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(quakes) })
        : r.abort('connectionrefused')));
    await page.route('**api.wheretheiss.at/**', (r) => r.abort('connectionrefused'));
    await page.route('**celestrak.org/**', (r) => r.abort('connectionrefused'));
    await page.route('**/satellites-snapshot.json', (r) => r.fulfill({ status: 404, body: 'gone' }));
}

async function enterExplore(page) {
    await page.goto('/#main');
    await page.waitForFunction(() => {
        const se = window.spaceEnvironment; const e = se && se.getEarthObject && se.getEarthObject();
        return !!(e && e.mesh);
    }, null, { timeout: 60000 });
    // An early tab click is ignored while the scene boots (a fixed 2 s was too
    // soon under CPU load), so re-click until the fly-to shows the Enter button.
    const btn = page.locator('#explore-enter-btn');
    for (let i = 0; i < 20 && !(await btn.isVisible()); i++) {
        await page.evaluate(() => { const b = document.getElementById('tab-Earth'); if (b) b.click(); });
        await page.waitForTimeout(2000);
    }
    await expect(btn).toBeVisible({ timeout: 15000 });
    await btn.click();
    await page.waitForFunction(() => window.spaceEnvironment.exploreMode === true, null, { timeout: 10000 });
    await page.waitForTimeout(3000);   // entry fly-in done
}

/** Angle (deg) between the camera ray and the ray to (lat,lng) from Earth's centre. */
const facing = (page, lat, lng) => page.evaluate(([la, lo]) => {
    const se = window.spaceEnvironment; const e = se.getEarthObject(); const cam = se.camera;
    const mesh = e.getMesh(); mesh.updateWorldMatrix(true, false);
    const ep = mesh.getWorldPosition(cam.position.clone());
    const p = mesh.localToWorld(GlobeMath.latLngToVector3(la, lo, e.data.radius));
    const a = p.sub(ep).normalize().dot(cam.position.clone().sub(ep).normalize());
    return Math.acos(Math.max(-1, Math.min(1, a))) * 180 / Math.PI;
}, [lat, lng]);

const options = (page) => page.locator('#ep-search-list [role="option"]');
const card = (page) => page.locator('#explore-detail');

async function search(page, text) {
    const input = page.locator('#ep-search-input');
    await input.fill('');
    await input.click();
    await input.fill(text);
    await expect(options(page).first()).toBeVisible({ timeout: 20000 });
}

test('search: country, region (with and without diacritics), point, continent', async ({ page }) => {
    const geo = [];
    page.on('request', (r) => { if (/states-named|towns-named|capitals-named/.test(r.url())) geo.push(r.url()); });
    await routeFeeds(page, null);
    await enterExplore(page);
    const lazy = geo.filter((u) => /towns-named|capitals-named/.test(u));
    expect.soft(lazy, 'no city search file before the field is focused').toEqual([]);
    expect.soft(await page.evaluate(() => window.spaceEnvironment._placeSearch), 'no index before focus').toBeNull();

    // Country
    await search(page, 'Latvia');
    await expect(options(page).first()).toContainText('Latvia');
    await expect(options(page).first()).toContainText('Country');
    await expect(page.locator('#ep-search-input')).toHaveAttribute('aria-expanded', 'true');
    if (process.env.F1_SHOTS) {
        mkdirSync(process.env.F1_SHOTS, { recursive: true });
        await page.screenshot({ path: process.env.F1_SHOTS + '/f1-search.png' });
    }
    await page.keyboard.press('Enter');
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toContainText('Latvia');
    await expect(card(page)).toContainText('Country');
    await expect(card(page)).toContainText(/Local time ≈ \d\d:\d\d \(approx\./);
    await expect(card(page)).toContainText(/Sun: (up|down)/);
    await expect(card(page)).toContainText('Quakes (24 h): no data loaded');
    await expect(card(page), 'country population with its year').toContainText(/Population ≈ \d+\.\d\d M \((19|20)\d\d est\.\)/);
    await expect(page.locator('#ep-search-input')).toHaveAttribute('aria-expanded', 'false');
    await page.waitForTimeout(3000);
    expect(await facing(page, 56.8, 24.8), 'the camera faces Latvia').toBeLessThan(6);
    if (process.env.F1_SHOTS) await page.screenshot({ path: process.env.F1_SHOTS + '/f1-card.png' });

    // Region, both spellings
    for (const q of ['Jūrmala', 'jurmala']) {
        await search(page, q);
        await expect(options(page).first(), q).toContainText('Jūrmala');
        await expect(options(page).first(), q).toContainText('Region of Latvia');
    }

    // Typed point: the card shows the typed coordinates
    await search(page, '37.77, -122.42');
    await expect(options(page).first()).toContainText('37.77, -122.42');
    await page.keyboard.press('Enter');
    await expect(card(page)).toContainText('37.77, -122.42');
    await expect(card(page)).toContainText('Point');
    await page.waitForTimeout(3000);
    expect(await facing(page, 37.77, -122.42), 'the camera faces the typed point').toBeLessThan(3);

    // Continent
    await search(page, 'Africa');
    await options(page).first().click();
    await expect(card(page)).toContainText('Africa');
    await expect(card(page)).toContainText('Continent');
    await page.waitForTimeout(3000);
    expect(await facing(page, 2, 20)).toBeLessThan(6);
    expect(await page.evaluate(() => window.spaceEnvironment.exploreMode)).toBe(true);
});

test('keyboard only: arrows, Enter, Esc', async ({ page }) => {
    await routeFeeds(page, null);
    await enterExplore(page);
    const input = page.locator('#ep-search-input');
    await input.focus();
    await page.keyboard.type('riga');
    await expect(options(page).first()).toBeVisible({ timeout: 20000 });
    const n = await options(page).count();
    expect(n).toBeGreaterThan(1);
    expect(n).toBeLessThanOrEqual(8);
    await expect(input).toHaveAttribute('aria-activedescendant', 'ep-search-opt-0');
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', 'ep-search-opt-1');
    await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(options(page).nth(0)).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('ArrowUp');
    await expect(input).toHaveAttribute('aria-activedescendant', 'ep-search-opt-0');
    // Esc closes the list and keeps Explore
    await page.keyboard.press('Escape');
    await expect(page.locator('#ep-search-list')).toBeHidden();
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => window.spaceEnvironment.exploreMode)).toBe(true);
    // ArrowDown reopens; Enter picks the first (Riga, the capital)
    await page.keyboard.press('ArrowDown');
    await expect(options(page).first()).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(card(page)).toContainText('Riga');
    await expect(card(page)).toContainText('City, Latvia');
    await expect(card(page)).toContainText('Population:');
    await expect(input).toBeFocused();
});

test('click a country opens its card, double-click still drops a pin, quakes counted', async ({ page }) => {
    await routeFeeds(page, QUAKE_FEED);
    await enterExplore(page);
    // Quakes on (fake feed: one M3.4 in Latvia)
    await page.locator('#explore-toggle-quakes').click();
    await page.waitForFunction(() => {
        const e = window.spaceEnvironment.getEarthObject();
        return !!(e.feeds && e.feeds.quakes && e.feeds.quakes.okAt);
    }, null, { timeout: 15000 });
    // Country shapes for the click lookup are loaded by Explore.
    await page.waitForFunction(() => window.spaceEnvironment.getEarthObject().regionAt('country', 46.6, 2.4) === 'France',
        null, { timeout: 30000 });
    await page.evaluate(() => window.spaceEnvironment.centerOnLatLng(46.6, 2.4));
    await page.waitForTimeout(2500);
    const box = await page.locator('canvas').first().boundingBox();
    const cx = box.x + box.width / 2; const cy = box.y + box.height / 2;
    // The globe centre faces France: a single click opens France's card.
    await page.mouse.click(cx, cy);
    await expect(card(page)).toContainText('France');
    await expect(card(page)).toContainText('Country');
    await expect(card(page), 'globe click: country population loads lazily').toContainText(/Population ≈ \d+\.\d\d M \((19|20)\d\d est\.\)/);
    // A double-click on the same spot still drops a pin.
    const pinsBefore = await page.evaluate(() => window.spaceEnvironment.getEarthObject().explorePins.pins.length);
    await page.mouse.dblclick(cx, cy);
    await page.waitForFunction((n) => window.spaceEnvironment.getEarthObject().explorePins.pins.length === n + 1,
        pinsBefore, { timeout: 5000 });

    // Latvia's card counts the fake quake inside its polygon (the pin editor took the Pins tab).
    await page.locator('#ep-tab-layers').click();
    await search(page, 'Latvia');
    await page.keyboard.press('Enter');
    await expect(card(page)).toContainText('Quakes (24 h): 1 in this area, strongest M3.4');
});
