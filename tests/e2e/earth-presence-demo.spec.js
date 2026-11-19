import { test, expect } from '@playwright/test';

/**
 * Presence in Demo mode stays on this device (roast R3 #12).
 *
 * With no databaseURL in PresenceConfig.js the Live layer runs on DemoAdapter: showing the
 * sample visitors AND "Share my location" must make zero requests to any Firebase host
 * (RTDB, Firestore, anonymous Auth). Every request is logged; Firebase hosts are also
 * routed to abort, so even a regression never reaches the network. Positive controls:
 * the logger sees the page's own requests, the host matcher flags Firebase URLs, and
 * sharing really happens (the "You" pin appears, rounded to 1 decimal).
 * Also checks the honest wording: "kept only while you're online", "about 10 km", and the
 * demo label on the share button.
 */

test.use({
    viewport: { width: 1280, height: 720 },
    geolocation: { latitude: 37.7749, longitude: -122.4194 },
    permissions: ['geolocation']
});
test.setTimeout(90000);

const FIREBASE = /(^|\.)(firebaseio\.com|firebasedatabase\.app|firestore\.googleapis\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|firebase\.googleapis\.com)$/i;
const isFirebase = (u) => { try { return FIREBASE.test(new URL(u).hostname); } catch (e) { return false; } };

test('demo presence: show + share make no Firebase requests, wording is honest', async ({ page }) => {
    // matcher control: it does flag the hosts it must
    expect(isFirebase('https://demo-default-rtdb.firebaseio.com/presence.json')).toBe(true);
    expect(isFirebase('https://demo-default-rtdb.europe-west1.firebasedatabase.app/presence.json')).toBe(true);
    expect(isFirebase('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=x')).toBe(true);
    expect(isFirebase('http://127.0.0.1:5173/index.html')).toBe(false);

    const all = [], fb = [];
    page.on('request', (r) => { all.push(r.url()); if (isFirebase(r.url())) fb.push(r.method() + ' ' + r.url()); });
    await page.route((url) => isFirebase(url.toString()), (route) => route.abort('blockedbyclient'));

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
    await expect(page.locator('#ep-tab-presence')).toBeVisible({ timeout: 20000 });
    // Presence.js marks the mode when it loads, which is now with the Explore bundle (R2 #7b).
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-presence'))).toBe('demo');
    await page.locator('#ep-tab-presence').click();

    // wording
    const share = page.locator('#explore-share-location');
    await expect(share).toBeVisible();
    await expect(share).toContainText('(demo: stays on this device)');
    const body = page.locator('#ep-presence-body');
    await expect(body).toContainText("kept only while you're online");
    await expect(body).toContainText('about 10 km');
    await expect(body).not.toContainText('nothing stored');
    await expect(body).not.toContainText('11 km');

    // show the sample visitors, then share
    await page.locator('#explore-toggle-presence').click();
    await page.waitForFunction(() => window.spaceEnvironment.getEarthObject().presencePins.markers.size >= 5, null, { timeout: 15000 });
    await share.click();
    await page.waitForFunction(() => window.spaceEnvironment.getEarthObject().presencePins.markers.size >= 6, null, { timeout: 15000 });
    await expect(share).toHaveAttribute('aria-pressed', 'true');
    const me = await page.evaluate(() => {
        const p = window.spaceEnvironment._presence;
        return p && p._self ? { lat: p._self.lat, lng: p._self.lng, sharing: p.isSharing() } : null;
    });
    expect(me).toEqual({ lat: 37.8, lng: -122.4, sharing: true });

    await page.waitForTimeout(8000);   // > one Firebase poll interval (6 s), had it been live
    await share.click();               // stop sharing (a Firebase adapter would DELETE here)
    await page.locator('#explore-toggle-presence').click();
    await page.waitForTimeout(1000);

    console.log(`[presence-demo] ${all.length} requests logged, ${fb.length} to Firebase hosts`);
    expect(all.length).toBeGreaterThan(5);   // logger control: it saw the page load
    expect(fb).toEqual([]);
});
