import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Privacy: the globe does not point at a home city (F2).
 *
 * The owner asked that Explore stop opening on San Francisco and that the page stop saying
 * "Based here" on the globe: together they gave away a narrow location. The identity line
 * names the birthplace at city level only.
 *
 * - no element, text, label or title on the page says "Based here" (before and after entry);
 * - the identity card and the Explore panel read the agreed identity line;
 * - after the Explore entry settles, the camera does NOT face 37.77, -122.42 (more than 30 deg off);
 * - the whole globe is in frame (its angular radius fits inside the narrower half field of view).
 *
 * F3: no single-city map layers either. San Francisco had its own districts + ZIP layers and a
 * "DataSF" credit, which narrowed the place down just as well. Every place gets the same detail:
 * - no "DataSF" / "SF districts" text, no Districts toggle or style button;
 * - no request for any *-sf*.json, even after zooming close in Explore;
 * - neither the hover cascade nor the zoom detail has a district or ZIP tier.
 *
 * F2_SHOT (optional): file path for a screenshot of the settled entry view.
 */

test.use({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
test.setTimeout(90000);

const IDENTITY = 'Born in Jūrmala, Latvia · based in San Francisco · Open to work';

async function routeFeeds(page) {
    await page.route('**earthquake.usgs.gov/**', (r) => r.abort('connectionrefused'));
    await page.route('**api.wheretheiss.at/**', (r) => r.abort('connectionrefused'));
    await page.route('**celestrak.org/**', (r) => r.abort('connectionrefused'));
    await page.route('**/satellites-snapshot.json', (r) => r.fulfill({ status: 404, body: 'gone' }));
}

/** Every text node, aria-label, title and alt on the page, joined. */
const pageWords = (page) => page.evaluate(() => {
    const out = [document.body.innerText || ''];
    document.querySelectorAll('*').forEach((el) => {
        ['aria-label', 'title', 'alt', 'placeholder'].forEach((a) => { const v = el.getAttribute(a); if (v) out.push(v); });
        if (el.childNodes) el.childNodes.forEach((n) => { if (n.nodeType === 3) out.push(n.textContent); });
    });
    return out.join('\n');
});

/** Angle (deg) between the camera ray and the SF ray from Earth's centre, and the framing. */
const sfView = (page) => page.evaluate(() => {
    const se = window.spaceEnvironment; const e = se.getEarthObject(); const cam = se.camera;
    const mesh = e.getMesh();
    mesh.updateWorldMatrix(true, false);
    const ep = mesh.getWorldPosition(cam.position.clone());
    const sf = mesh.localToWorld(GlobeMath.latLngToVector3(37.77, -122.42, e.data.radius));
    const a = sf.sub(ep).normalize().dot(cam.position.clone().sub(ep).normalize());
    const d = cam.position.distanceTo(ep);
    const halfV = cam.fov * Math.PI / 360;
    const halfH = Math.atan(Math.tan(halfV) * cam.aspect);
    return {
        ang: Math.acos(Math.max(-1, Math.min(1, a))) * 180 / Math.PI,
        globeHalf: Math.asin(Math.min(1, e.data.radius / d)) * 180 / Math.PI,
        viewHalf: Math.min(halfV, halfH) * 180 / Math.PI
    };
});

test('no "Based here", the identity line names the birthplace, and Explore does not face SF', async ({ page }) => {
    await routeFeeds(page);
    await page.goto('/#main');
    await page.waitForFunction(() => {
        const se = window.spaceEnvironment; const e = se && se.getEarthObject && se.getEarthObject();
        return !!(e && e.mesh);
    }, null, { timeout: 60000 });
    expect.soft(await pageWords(page), 'nothing says "Based here" before Explore').not.toMatch(/based here/i);
    await expect.soft(page.locator('.idc-status')).toHaveText(IDENTITY);
    if (process.env.F2_SHOT) {
        mkdirSync(process.env.F2_SHOT.replace(/[\\/][^\\/]*$/, ''), { recursive: true });
        await expect(page.locator('.idc-status')).toBeVisible({ timeout: 20000 });   // loader gone
        await page.waitForTimeout(800);
        await page.screenshot({ path: process.env.F2_SHOT.replace(/\.png$/, '-identity.png') });
    }

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
    await page.waitForTimeout(600);
    expect.soft(await pageWords(page), 'nothing says "Based here" in Explore (intro card, panel)').not.toMatch(/based here/i);
    await expect.soft(page.locator('#explore-panel .ep-info')).toContainText(IDENTITY);
    expect.soft(await page.evaluate(() => !!window.spaceEnvironment.getEarthObject().marker), 'no home marker on the globe').toBe(false);

    await page.waitForTimeout(2500);   // the entry move has finished
    const v = await sfView(page);
    if (process.env.F2_SHOT) await page.screenshot({ path: process.env.F2_SHOT });
    expect.soft(v.ang, 'the entry camera is not aimed at San Francisco').toBeGreaterThan(30);
    expect(v.globeHalf, 'the whole globe is in frame').toBeLessThan(v.viewHalf);
});

test('F3: no San Francisco-only layers, legend, toggle, credit or data request', async ({ page }) => {
    const sfRequests = [];
    page.on('request', (r) => { if (/-sf[^/]*\.json/i.test(r.url())) sfRequests.push(r.url()); });
    await routeFeeds(page);
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
    await page.waitForTimeout(3000);
    // Close in (1.25R) over a neutral spot so every zoom tier and hover tier would load.
    await page.evaluate(() => {
        const se = window.spaceEnvironment; const e = se.getEarthObject();
        const ep = e.getMesh().getWorldPosition(se.camera.position.clone());
        se.camera.position.sub(ep).setLength(e.data.radius * 1.25).add(ep);
        se.controls.update();
        se.centerOnLatLng(48.85, 2.35);
    });
    await page.waitForTimeout(6000);

    const words = await pageWords(page);
    expect.soft(words, 'no DataSF credit').not.toMatch(/DataSF/);
    expect.soft(words, 'no "SF districts" legend item').not.toMatch(/SF districts/i);
    expect.soft(await page.locator('#ep-toggle-districts, #ep-style-layers [data-layer="districts"]').count(),
        'no Districts toggle or style button').toBe(0);
    const tiers = await page.evaluate(() => {
        const e = window.spaceEnvironment.getEarthObject();
        return {
            hover: (Earth.REGION_TIER_DEFS || []).map((d) => d.key + ' ' + d.url),
            lod: e.geoLOD ? Array.from(e.geoLOD.tiers.keys()) : null
        };
    });
    expect.soft(tiers.hover.join('\n'), 'hover cascade has no district/ZIP tier').not.toMatch(/district|zip|-sf/i);
    expect.soft(tiers.lod, 'zoom detail tiers').toEqual(['states', 'cities']);
    expect(sfRequests, 'no request for a San Francisco-only data file').toEqual([]);
});
