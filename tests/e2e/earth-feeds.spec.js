import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Explore live feeds when they fail (roast R3 #5, R1 #7).
 *
 * Every feed is answered by a route here: USGS quakes, wheretheiss.at, CelesTrak and the
 * bundled satellite snapshot. Nothing reaches the real services.
 *
 * - a dead or stalled feed shows "offline - retrying" in the Layers tab, and the switch
 *   keeps the user's choice (it used to flip Quakes off, or leave ISS/Sats "on" silently);
 * - a feed that dies after loading says "stale since" / "signal lost since", the ISS
 *   marker is hidden once its fix is 30 s old, and nothing ever reads "NaN";
 * - a quake with no magnitude is "M?" with a grey marker, not an invented M2.5.
 *
 * FEED_SHOT_DIR (optional): where to save a screenshot of the Layers tab, all feeds down.
 */

// serviceWorkers: block - the site's service worker would answer the snapshot from its
// cache, past page.route.
test.use({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
test.setTimeout(90000);

const QUAKES = {
    type: 'FeatureCollection',
    metadata: { generated: Date.now(), count: 2 },
    features: [
        { type: 'Feature', properties: { mag: 4.6, place: '10 km S of Somewhere', time: Date.now() - 3600000 },
            geometry: { type: 'Point', coordinates: [140.1, 35.2, 12.3] } },
        { type: 'Feature', properties: { mag: null, place: 'Offshore Nowhere', time: Date.now() - 7200000 },
            geometry: { type: 'Point', coordinates: [-120.5, 36.1, null] } }
    ]
};
// No altitude or velocity: the card must not say "Alt NaN km".
const ISS_FIX = { name: 'iss', id: 25544, latitude: 12.5, longitude: -40.25 };

const json = (body) => ({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body) });

/**
 * Route every live feed. mode per feed: 'ok' | 'fail' | 'stall'. Returns a setter so a
 * test can kill a feed later.
 */
async function routeFeeds(page, modes) {
    const m = Object.assign({ quakes: 'ok', iss: 'ok', sats: 'fail' }, modes);
    const handle = (feed, okBody) => (route) => {
        if (m[feed] === 'stall') return undefined;            // never answered: SafeFetch times out
        if (m[feed] === 'fail') return route.abort('connectionrefused');
        return route.fulfill(json(typeof okBody === 'function' ? okBody() : okBody));
    };
    await page.route('**earthquake.usgs.gov/**', handle('quakes', QUAKES));
    await page.route('**api.wheretheiss.at/**', handle('iss', () => ISS_FIX));
    await page.route('**celestrak.org/**', (route) => route.abort('connectionrefused'));
    await page.route('**/satellites-snapshot.json', (route) => (m.sats === 'fail'
        ? route.fulfill({ status: 404, body: 'gone' }) : route.continue()));
    // All three live layers on, whatever the device tier.
    await page.addInitScript(() => localStorage.setItem('mrcargon.explore.layers',
        JSON.stringify({ iss: true, quakes: true, sats: true, pois: true })));
    return (feed, mode) => { m[feed] = mode; };
}

async function enterExplore(page) {
    await page.goto('/#main');
    await page.waitForFunction(() => {
        const se = window.spaceEnvironment;
        const earth = se && se.getEarthObject && se.getEarthObject();
        return !!(earth && earth.mesh);
    }, null, { timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
        const se = window.spaceEnvironment;
        if (se.selectPlanet) se.selectPlanet('Earth');
        se.enterExploreMode();
    });
    await expect(page.locator('#ep-feed-quakes')).toBeVisible({ timeout: 15000 });
}

const pressed = (page, id) => page.locator('#explore-toggle-' + id).getAttribute('aria-pressed');
const panelText = (page) => page.locator('#explore-panel').innerText();

test('all feeds down: status lines say so, switches keep the choice', async ({ page }) => {
    await routeFeeds(page, { quakes: 'fail', iss: 'fail', sats: 'fail' });
    await enterExplore(page);
    await expect(page.locator('#ep-feed-quakes')).toHaveText(/^Quakes: offline - retrying$/, { timeout: 15000 });
    await expect(page.locator('#ep-feed-iss')).toHaveText(/^ISS: offline - retrying$/, { timeout: 15000 });
    await expect(page.locator('#ep-feed-sats')).toHaveText(/^Sats: unavailable/, { timeout: 15000 });
    for (const id of ['quakes', 'iss', 'sats']) {
        expect(await pressed(page, id), id + ' switch stays on').toBe('true');
        await expect(page.locator('#explore-toggle-' + id)).toHaveAttribute('data-feed', /offline/);
        await expect(page.locator('#explore-toggle-' + id)).toHaveAttribute('aria-describedby', 'ep-feed-' + id);
    }
    expect(await panelText(page)).not.toContain('NaN');
    expect(await page.evaluate(() => window.spaceEnvironment.getEarthObject().issMarkerShown())).toBe(false);

    if (process.env.FEED_SHOT_DIR) {
        mkdirSync(process.env.FEED_SHOT_DIR, { recursive: true });
        await page.locator('#explore-panel').screenshot({ path: process.env.FEED_SHOT_DIR + '/layers-feeds-offline-panel.png' });
        await page.screenshot({ path: process.env.FEED_SHOT_DIR + '/layers-feeds-offline-full.png' });
    }

    // Leaving Explore saves the user's choice, not the failed load; the refresh loop stops.
    await page.evaluate(() => window.spaceEnvironment.exitExploreMode(true));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mrcargon.explore.layers')));
    expect(saved.quakes).toBe(true);
    expect(saved.iss).toBe(true);
    expect(saved.sats).toBe(true);
    expect(await page.evaluate(() => window.spaceEnvironment.getEarthObject()._quakeLoopOn)).toBe(false);
});

test('a stalled feed shows loading, then offline after the timeout', async ({ page }) => {
    await routeFeeds(page, { quakes: 'stall', iss: 'stall' });
    await enterExplore(page);
    await expect(page.locator('#ep-feed-quakes')).toHaveText('Quakes: loading…');
    await expect(page.locator('#ep-feed-iss')).toHaveText('ISS: loading…');
    // SafeFetch aborts after 10 s.
    await expect(page.locator('#ep-feed-quakes')).toHaveText('Quakes: offline - retrying', { timeout: 20000 });
    await expect(page.locator('#ep-feed-iss')).toHaveText('ISS: offline - retrying', { timeout: 20000 });
    expect(await pressed(page, 'quakes')).toBe('true');
    expect(await pressed(page, 'iss')).toBe('true');
});

test('live feeds, then they die: stale lines, ISS hidden, M? quake, no NaN', async ({ page }) => {
    const setFeed = await routeFeeds(page, { quakes: 'ok', iss: 'ok' });
    await enterExplore(page);
    await expect(page.locator('#ep-feed-quakes')).toHaveText(/^Quakes: live · updated .+ · 2 in 24 h$/, { timeout: 15000 });
    await expect(page.locator('#ep-feed-iss')).toHaveText(/^ISS: live · updated /, { timeout: 15000 });
    const live = await page.evaluate(() => {
        const e = window.spaceEnvironment.getEarthObject();
        return { quakes: e.markers.layers.quakes.items.map((i) => i.data), iss: e.markers.itemData('iss', 0),
            shown: e.issMarkerShown(), loop: e._quakeLoopOn };
    });
    expect(live.loop, 'quakes refresh while Explore is open').toBe(true);
    expect(live.shown).toBe(true);
    expect(live.iss.info).not.toContain('NaN');
    expect(live.quakes.map((q) => q.name).sort()).toEqual(['M4.6 earthquake', 'M? earthquake']);
    const unknown = live.quakes.find((q) => q.name === 'M? earthquake');
    expect(unknown.info).toContain('magnitude not reported');
    expect(unknown.info).not.toContain('NaN');
    expect(live.quakes.find((q) => q.name === 'M4.6 earthquake').info).toContain('12 km deep');

    // Kill both feeds. Quakes: force the next refresh instead of waiting five minutes.
    setFeed('quakes', 'fail');
    setFeed('iss', 'fail');
    // (Clear SafeFetch's cache: the five-minute loop always outlives its 4.5 min TTL.)
    await page.evaluate(() => {
        window.SafeFetch._cache.clear();
        return window.spaceEnvironment.getEarthObject().refreshQuakes();
    });
    await expect(page.locator('#ep-feed-quakes')).toHaveText(/^Quakes: stale since .+ - retrying$/);
    expect(await page.evaluate(() => window.spaceEnvironment.getEarthObject().markers.layers.quakes.items.length),
        'the last good quakes stay drawn').toBe(2);
    // ISS: age the last fix past 30 s; the next 5 s poll hides the marker.
    await page.evaluate(() => { window.spaceEnvironment.getEarthObject().feeds.iss.okAt -= 31000; });
    await expect(page.locator('#ep-feed-iss')).toHaveText(/^ISS: signal lost since .+ - retrying/, { timeout: 10000 });
    await page.waitForFunction(() => window.spaceEnvironment.getEarthObject().markers.layers.iss.items[0].hidden,
        null, { timeout: 10000 });
    expect(await page.evaluate(() => window.spaceEnvironment.getEarthObject().issMarkerShown())).toBe(false);
    for (const id of ['quakes', 'iss']) expect(await pressed(page, id)).toBe('true');
    expect(await panelText(page)).not.toContain('NaN');

    // The feed comes back: the next refresh is live again.
    setFeed('quakes', 'ok');
    await page.evaluate(() => {
        if (window.SafeFetch._breaker) window.SafeFetch._breaker.clear();
        return window.spaceEnvironment.getEarthObject().refreshQuakes();
    });
    await expect(page.locator('#ep-feed-quakes')).toHaveText(/^Quakes: live · updated /);
});

test('switches still work while a feed is down', async ({ page }) => {
    await routeFeeds(page, { quakes: 'fail', iss: 'fail' });
    await enterExplore(page);
    await expect(page.locator('#ep-feed-quakes')).toHaveText('Quakes: offline - retrying', { timeout: 15000 });
    await page.locator('#explore-toggle-quakes').click();
    expect(await pressed(page, 'quakes')).toBe('false');
    await expect(page.locator('#ep-feed-quakes')).toBeHidden();
    await page.locator('#explore-toggle-quakes').click();
    expect(await pressed(page, 'quakes')).toBe('true');
    await expect(page.locator('#ep-feed-quakes')).toBeVisible();
    await page.locator('#explore-toggle-iss').click();
    expect(await pressed(page, 'iss')).toBe('false');
    expect(await page.evaluate(() => window.spaceEnvironment.getEarthObject()._issTimer)).toBeNull();
});
