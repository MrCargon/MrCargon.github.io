import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Explore satellites: two-sample motion test.
 *
 * CelesTrak blocks an IP that fetches more than once per 2 hours, so this test NEVER talks
 * to it: every request is answered from the bundled snapshot. The request still passes the
 * page's CSP, so a missing connect-src entry would make this test fail. The CORS header
 * below is ours, so this test cannot prove the real server sends one.
 *
 * Satellites.js fetches only on the live host, or with the test flag set here. Other specs
 * that enter Explore stay on the snapshot and never reach CelesTrak.
 */

test.use({ viewport: { width: 1280, height: 900 } });
test.setTimeout(90000);

const snapshot = JSON.parse(readFileSync('src/data/satellites-snapshot.json', 'utf8'));
const NAMES = ['ISS (ZARYA)', 'GOES 19'];

// Low orbits are dropped after MAX_AGE_LEO_MS (14 d, roast R1 #7), so the bundled stations
// would age out of these tests two weeks after each snapshot rebuild. Seed the cache with
// the same stations re-dated to yesterday: the orbits keep their shape and speed.
const FRESH_STATIONS = snapshot.groups.stations.map((r) => Object.assign({}, r,
    { EPOCH: new Date(Date.now() - 86400000).toISOString().replace('Z', '') }));

async function stubCelesTrak(page) {
    const calls = [];
    await page.addInitScript((stations) => {
        localStorage.setItem('mrcargon-sats-allow-live', '1');
        localStorage.setItem('mrcargon-sats-gp-stations', JSON.stringify({ t: Date.now() - 60000, data: stations }));
    }, FRESH_STATIONS);
    await page.route('**celestrak.org/**', (route) => {
        const group = new URL(route.request().url()).searchParams.get('GROUP');
        calls.push(group);
        return route.fulfill({
            status: 200,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify(snapshot.groups[group] || [])
        });
    });
    return calls;
}

async function enterExplore(page) {
    await page.goto('/#main');
    await page.waitForFunction(() => {
        const se = window.spaceEnvironment;
        const earth = se && se.getEarthObject && se.getEarthObject();
        return !!(earth && earth.mesh);
    }, null, { timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.evaluate(() => {
        const se = window.spaceEnvironment;
        if (se.selectPlanet) se.selectPlanet('Earth');
        se.enterExploreMode();
    });
    await page.waitForFunction(() => {
        const s = window.spaceEnvironment.getEarthObject().satellites;
        return !!(s && s.points && s.count > 0);
    }, null, { timeout: 20000 });
}

// Position of a named object, in km from Earth's centre, plus the time it was read.
const sample = (page) => page.evaluate((names) => {
    const s = window.spaceEnvironment.getEarthObject().satellites;
    const a = s.points.geometry.attributes.position;
    const out = { t: Date.now() };
    names.forEach((n) => {
        const i = s._records.findIndex((r) => r.name === n);
        out[n] = [a.getX(i) / s.kmToUnits, a.getY(i) / s.kmToUnits, a.getZ(i) / s.kmToUnits];
    });
    return out;
}, NAMES);

const speed = (a, b, n) => Math.hypot(b[n][0] - a[n][0], b[n][1] - a[n][1], b[n][2] - a[n][2])
    / ((b.t - a.t) / 1000);

test('satellites load only in Explore and move at real orbital speed', async ({ page }) => {
    const calls = await stubCelesTrak(page);
    const urls = [];
    page.on('request', (r) => urls.push(r.url()));
    await page.goto('/#main');
    await page.waitForTimeout(5000);
    expect(urls.filter((u) => /satellite\.min\.js|satellites-snapshot|utils\/Satellites\.js/.test(u))).toHaveLength(0);
    expect(calls).toHaveLength(0);

    await enterExplore(page);
    await page.waitForTimeout(1000);
    expect(calls, 'one live request per window, whatever the group count').toHaveLength(1);

    const first = await sample(page);
    await page.waitForTimeout(4000);
    const second = await sample(page);
    const iss = speed(first, second, NAMES[0]);
    const geo = speed(first, second, NAMES[1]);
    console.log(`SPEED iss=${iss.toFixed(2)} km/s geo=${geo.toFixed(2)} km/s`);
    expect(iss, 'the ISS covers about 7 km of ground every second').toBeGreaterThan(6.5);
    expect(iss).toBeLessThan(8);
    expect(geo, 'a geostationary satellite hangs over one spot: the control').toBeLessThan(0.5);
});

test('a reload inside the two-hour window sends nothing', async ({ page }) => {
    const calls = await stubCelesTrak(page);
    await enterExplore(page);
    await page.waitForTimeout(1000);
    expect(calls).toHaveLength(1);
    await page.evaluate(() => { window.__sameDocument = true; });
    await page.reload();               // a fresh page, same localStorage
    expect(await page.evaluate(() => window.__sameDocument), 'really reloaded').toBeUndefined();
    await enterExplore(page);
    await page.waitForTimeout(1000);
    expect(calls).toHaveLength(1);
});

test('off the live host nothing is fetched, and the snapshot still draws', async ({ page }) => {
    const calls = await stubCelesTrak(page);
    await page.addInitScript(() => localStorage.removeItem('mrcargon-sats-allow-live'));
    await enterExplore(page);
    await page.waitForTimeout(1000);
    expect(calls).toHaveLength(0);
});

test('with no way to keep the stamp, nothing is fetched', async ({ page }) => {
    const calls = await stubCelesTrak(page);
    await page.addInitScript(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
            if (key === 'mrcargon-sats-last-fetch') throw new Error('quota');
            return original.call(this, key, value);
        };
    });
    await enterExplore(page);
    await page.waitForTimeout(1000);
    expect(calls).toHaveLength(0);
});

test('a phone starts with the layer off, and the button still works', async ({ page }) => {
    await page.addInitScript(() => {
        const original = window.matchMedia;
        window.matchMedia = (q) => (q.includes('coarse')
            ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} }
            : original.call(window, q));
    });
    const urls = [];
    page.on('request', (r) => urls.push(r.url()));
    await page.goto('/#main');
    await page.waitForFunction(() => {
        const se = window.spaceEnvironment;
        return !!(se && se.getEarthObject && se.getEarthObject() && se.getEarthObject().mesh);
    }, null, { timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.spaceEnvironment.enterExploreMode());
    await page.waitForTimeout(2500);
    expect(urls.filter((u) => /utils\/Satellites\.js/.test(u))).toHaveLength(0);
    await page.click('#explore-toggle-sats', { force: true });
    await page.waitForFunction(() => {
        const s = window.spaceEnvironment.getEarthObject().satellites;
        return !!(s && s.points);
    }, null, { timeout: 20000 });
});
