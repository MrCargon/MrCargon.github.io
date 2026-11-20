import { test, expect } from '@playwright/test';

/**
 * Explore entry: the whole Earth, facing a neutral point (P28, F2).
 *
 * Entering Explore used to keep the camera's old direction from Earth, and the globe's spin
 * is Greenwich sidereal time, so the view on entry depended on the clock (P28). P28 then aimed
 * the entry at San Francisco; F2 (privacy: the owner asked the globe not to point at his home
 * city) aims it at the fixed neutral EXPLORE_HOME point (lat 20, lng 0) and frames the WHOLE
 * globe. The entry flies in (a swing round the globe, not a jump); under prefers-reduced-motion
 * it is placed at once. "Reset view" returns to the same framing.
 *
 * The clock is moved with a Date shim (an offset, so timers and rAF still run normally).
 */

test.setTimeout(90000);

const TIMES = ['2026-11-19T04:00:00Z', '2026-11-19T12:00:00Z', '2026-11-19T20:00:00Z'];

async function atClock(page, iso) {
    await page.route('**celestrak.org/**', (r) => r.abort('connectionrefused'));
    await page.route('**/satellites-snapshot.json', (r) => r.fulfill({ status: 404, body: 'gone' }));
    await page.addInitScript((target) => {
        const RD = Date; const OFF = target - RD.now();
        class FD extends RD {
            constructor(...a) { if (a.length === 0) super(RD.now() + OFF); else super(...a); }
            static now() { return RD.now() + OFF; }
        }
        window.Date = FD;
    }, Date.parse(iso));
}

async function enter(page) {
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
}

/**
 * Angle camera-vs-home point from Earth's centre, the point's projected offset from the canvas
 * centre, distance in radii, the whole-Earth distance the page wants, the globe's angular
 * radius vs the narrower half field of view, and the angle to San Francisco.
 */
const view = (page) => page.evaluate(() => {
    const se = window.spaceEnvironment; const e = se.getEarthObject(); const cam = se.camera;
    const mesh = e.getMesh();
    mesh.updateWorldMatrix(true, false);
    const ep = mesh.getWorldPosition(cam.position.clone());
    const at = (lat, lng) => mesh.localToWorld(GlobeMath.latLngToVector3(lat, lng, e.data.radius));
    const camDir = cam.position.clone().sub(ep).normalize();
    const angTo = (w) => Math.acos(Math.max(-1, Math.min(1, w.clone().sub(ep).normalize().dot(camDir)))) * 180 / Math.PI;
    const H = window.SpaceEnvironment ? window.SpaceEnvironment.EXPLORE_HOME : se.constructor.EXPLORE_HOME;
    const m = at(H.lat, H.lng);
    const p = m.clone().project(cam);
    const r = se.renderer.domElement.getBoundingClientRect();
    const off = Math.hypot((p.x + 1) / 2 * r.width - r.width / 2, (1 - p.y) / 2 * r.height - r.height / 2);
    const d = cam.position.distanceTo(ep);
    const halfV = cam.fov * Math.PI / 360;
    return {
        ang: angTo(m), off, distR: d / e.data.radius,
        wantR: se._exploreWholeEarthDist(e.data.radius) / e.data.radius,
        globeHalf: Math.asin(Math.min(1, e.data.radius / d)) * 180 / Math.PI,
        viewHalf: Math.min(halfV, Math.atan(Math.tan(halfV) * cam.aspect)) * 180 / Math.PI,
        sfAng: angTo(at(37.77, -122.42))
    };
});
const wholeGlobe = (v) => expect(v.globeHalf, 'the whole globe is in frame').toBeLessThan(v.viewHalf);

async function flight(page) {
    const s = [];
    for (let i = 0; i < 12; i++) { s.push(await view(page)); await page.waitForTimeout(150); }
    await page.waitForTimeout(800);
    return { samples: s, end: await view(page) };
}

for (const iso of TIMES) {
    test(`desktop entry at ${iso.slice(11, 16)}Z ends on the whole Earth (neutral point), by a fly-in`, async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await atClock(page, iso);
        await enter(page);
        const { samples, end } = await flight(page);
        expect(end.ang, 'camera on the neutral-point ray').toBeLessThan(1);
        expect(end.off, 'the neutral point projected near the canvas centre (px)').toBeLessThan(12);
        expect(Math.abs(end.distR - end.wantR), 'whole-Earth distance reached').toBeLessThan(0.02);
        wholeGlobe(end);
        expect(end.sfAng, 'not aimed at San Francisco').toBeGreaterThan(30);
        // Smooth, not a jump: the first sample is still far from the end, and some sample is in between.
        expect(samples[0].distR, 'starts from where the camera was').toBeGreaterThan(3.2);
        const mid = samples.some((v) => v.distR > 3.02 && v.distR < samples[0].distR - 0.05);
        expect(mid, 'an in-between frame was seen').toBe(true);
    });
}

test('phone entry ends on the whole Earth (pulled back for the narrow screen)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await atClock(page, TIMES[1]);
    await enter(page);
    const { end } = await flight(page);
    expect(end.ang).toBeLessThan(1);
    expect(end.off).toBeLessThan(12);
    expect(Math.abs(end.distR - end.wantR)).toBeLessThan(0.02);
    expect(end.distR, 'further out than the desktop 3R').toBeGreaterThan(3.5);
    wholeGlobe(end);
});

test('reduced motion: the whole-Earth view is placed at once, no flight', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await atClock(page, TIMES[1]);
    await enter(page);
    const first = await view(page);
    expect(first.ang, 'already on the neutral-point ray').toBeLessThan(1);
    expect(Math.abs(first.distR - first.wantR)).toBeLessThan(0.02);
    wholeGlobe(first);
    await expect(page.locator('#explore-detail')).toContainText('Drag to spin');   // P27 intro kept, F2 neutral hint
});

test('a drag during the fly-in takes over (the flight stops)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await atClock(page, TIMES[1]);
    await enter(page);
    await page.mouse.move(640, 450);
    await page.mouse.down();
    await page.mouse.move(700, 470, { steps: 3 });
    await page.mouse.up();
    const a = await view(page);
    await page.waitForTimeout(2200);
    const b = await view(page);
    expect(Math.abs(b.distR - a.distR), 'distance not pulled on by the cancelled flight').toBeLessThan(0.05);
});

test('"Reset view" returns to the whole-Earth framing after a zoom and a turn', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await atClock(page, TIMES[1]);
    await enter(page);
    await flight(page);
    // Somewhere else, close in: SF at 1.5R (centerOnLatLng keeps the distance, so set it first).
    await page.evaluate(() => {
        const se = window.spaceEnvironment; const e = se.getEarthObject();
        const ep = e.getMesh().getWorldPosition(se.camera.position.clone());
        se.camera.position.sub(ep).setLength(e.data.radius * 1.5).add(ep);
        se.controls.update();
        se.centerOnLatLng(37.77, -122.42);
    });
    await page.waitForTimeout(2500);
    const moved = await view(page);
    expect(moved.distR).toBeLessThan(2);
    const btn = page.locator('#explore-reset-view');
    await expect(btn).toHaveText(/Reset view/);
    await expect(btn).toHaveAttribute('aria-label', 'Reset the view to the whole Earth');
    await btn.click();
    const { end } = await flight(page);
    expect(end.ang).toBeLessThan(1);
    expect(Math.abs(end.distR - end.wantR)).toBeLessThan(0.02);
    wholeGlobe(end);
});
