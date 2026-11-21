import { test, expect } from '@playwright/test';

/**
 * Explore-only surface detail: the 4k day map and cloud shadows must cost nothing before
 * Explore, go away after it, and fail soft.
 */

// No service worker: it could answer the texture fetches before page.route sees them.
test.use({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
test.setTimeout(90000);

async function bootMain(page) {
    await page.goto('/#main');
    await page.waitForFunction(() => {
        const se = window.spaceEnvironment;
        const earth = se && se.getEarthObject && se.getEarthObject();
        return !!(earth && earth.mesh);
    }, null, { timeout: 60000 });
    await page.waitForTimeout(3000);
}

const surface = (page) => page.evaluate(() => {
    const u = window.spaceEnvironment.getEarthObject().mesh.material.uniforms;
    return { width: u.dayTexture.value.image.width, shadow: u.uCloudShadow.value };
});

const enter = (page) => page.evaluate(() => {
    const se = window.spaceEnvironment;
    if (se.selectPlanet) se.selectPlanet('Earth');
    return se.enterExploreMode();
});

test('4k map and shadows arrive with Explore and leave with it', async ({ page }) => {
    const hits = [];
    page.on('request', (r) => { if (r.url().includes('earth_day_4k')) hits.push(r.url()); });
    await bootMain(page);
    expect(hits, 'nothing before Explore').toHaveLength(0);
    expect(await surface(page)).toEqual({ width: 1000, shadow: 0 });

    await enter(page);
    await page.waitForFunction(() => window.spaceEnvironment.getEarthObject()
        .mesh.material.uniforms.dayTexture.value.image.width === 4096, null, { timeout: 30000 });
    await page.waitForFunction(() => window.spaceEnvironment.getEarthObject()
        .mesh.material.uniforms.uCloudShadow.value > 0.5, null, { timeout: 10000 });

    await page.evaluate(() => window.spaceEnvironment.exitExploreMode(true));
    await page.waitForTimeout(500);
    expect(await surface(page)).toEqual({ width: 1000, shadow: 0 });
    expect(hits).toHaveLength(1);
});

test('a missing 4k map leaves the 1k globe working', async ({ page }) => {
    let blocked = 0;
    await page.route('**/earth_day_4k.jpg', (route) => {
        blocked++;
        return route.fulfill({ status: 404, body: 'x' });
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await bootMain(page);
    await enter(page);
    await page.waitForTimeout(3000);
    expect(blocked, 'the fetch really happened and really failed').toBe(1);
    expect((await surface(page)).width).toBe(1000);
    expect(await page.evaluate(() => window.spaceEnvironment.exploreMode)).toBe(true);
    expect(errors).toHaveLength(0);
});

test('a phone gets neither the 4k map nor shadows', async ({ page }) => {
    await page.addInitScript(() => {
        const original = window.matchMedia;
        window.matchMedia = (q) => (q.includes('coarse')
            ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} }
            : original.call(window, q));
    });
    const hits = [];
    page.on('request', (r) => { if (r.url().includes('earth_day_4k')) hits.push(r.url()); });
    await bootMain(page);
    await enter(page);
    await page.waitForTimeout(3000);
    expect(hits).toHaveLength(0);
    expect(await surface(page)).toEqual({ width: 1000, shadow: 0 });
});

// Roast R1 #12: the cloud shell is one still picture drifting 2%/day against the ground,
// shown beside live feeds, so the Detail tab says so. The note must sit beside a cloud
// layer that is really drawn (control: the shell exists and is visible in Explore).
test('the Detail tab marks the clouds as illustrative and dates the base map', async ({ page }) => {
    await bootMain(page);
    await enter(page);
    await page.waitForTimeout(1500);
    const shell = await page.evaluate(() => {
        const c = window.spaceEnvironment.getEarthObject().cloudsMesh;
        return !!(c && c.visible && c.material && c.material.map);
    });
    expect(shell, 'a cloud shell is drawn in Explore').toBe(true);
    await page.click('#ep-tab-detail');
    const note = page.locator('#ep-clouds-note');
    await expect(note).toBeVisible();
    await expect(note).toContainText('illustrative');
    await expect(note).toContainText("not today's weather");
    // The base map is one month (June 2004), so it says which: no snow in a northern winter.
    await expect(page.locator('#ep-texture-note')).toContainText('June 2004');
});
