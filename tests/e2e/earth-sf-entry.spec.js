import { test, expect } from '@playwright/test';

/**
 * Explore entry faces San Francisco (P28).
 *
 * Entering Explore used to keep the camera's old direction from Earth, and the globe's spin
 * is Greenwich sidereal time, so the view on entry depended on the clock: at 04Z it was off
 * by 48 deg, at 12Z SF was on the far side (126 deg), at 20Z 66 deg - while the intro card
 * says "San Francisco · Based here". Now the entry flies in (a swing round the globe, not a
 * jump) and ends on the "Center on SF" view; under prefers-reduced-motion it is placed at once.
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
    await page.waitForTimeout(2000);
    await page.evaluate(() => { const b = document.getElementById('tab-Earth'); if (b) b.click(); });
    await page.waitForTimeout(2500);   // the fly-to Earth finishes first (an early click is ignored)
    const btn = page.locator('#explore-enter-btn');
    await expect(btn).toBeVisible({ timeout: 15000 });
    await btn.click();
    await page.waitForFunction(() => window.spaceEnvironment.exploreMode === true, null, { timeout: 10000 });
}

/** Angle camera-vs-SF from Earth's centre, SF's projected offset from the canvas centre, distance. */
const view = (page) => page.evaluate(() => {
    const se = window.spaceEnvironment; const e = se.getEarthObject(); const cam = se.camera;
    const ep = e.getMesh().getWorldPosition(cam.position.clone());
    const m = e.marker.getWorldPosition(cam.position.clone());
    const a = m.clone().sub(ep).normalize().dot(cam.position.clone().sub(ep).normalize());
    const p = m.clone().project(cam);
    const r = se.renderer.domElement.getBoundingClientRect();
    const off = Math.hypot((p.x + 1) / 2 * r.width - r.width / 2, (1 - p.y) / 2 * r.height - r.height / 2);
    return { ang: Math.acos(Math.max(-1, Math.min(1, a))) * 180 / Math.PI, off, distR: cam.position.distanceTo(ep) / e.data.radius };
});

async function flight(page) {
    const s = [];
    for (let i = 0; i < 12; i++) { s.push(await view(page)); await page.waitForTimeout(150); }
    await page.waitForTimeout(800);
    return { samples: s, end: await view(page) };
}

for (const iso of TIMES) {
    test(`desktop entry at ${iso.slice(11, 16)}Z ends facing San Francisco, by a fly-in`, async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await atClock(page, iso);
        await enter(page);
        const { samples, end } = await flight(page);
        expect(end.ang, 'camera on the SF ray').toBeLessThan(1);
        expect(end.off, 'SF projected near the canvas centre (px)').toBeLessThan(12);
        expect(Math.abs(end.distR - 3), 'close framing kept (3x radius)').toBeLessThan(0.02);
        // Smooth, not a jump: the first sample is still far from the end, and some sample is in between.
        expect(samples[0].distR, 'starts from where the camera was').toBeGreaterThan(3.2);
        const mid = samples.some((v) => v.distR > 3.02 && v.distR < samples[0].distR - 0.05);
        expect(mid, 'an in-between frame was seen').toBe(true);
    });
}

test('phone entry ends facing San Francisco', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await atClock(page, TIMES[1]);
    await enter(page);
    const { end } = await flight(page);
    expect(end.ang).toBeLessThan(1);
    expect(end.off).toBeLessThan(12);
});

test('reduced motion: the SF view is placed at once, no flight', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await atClock(page, TIMES[1]);
    await enter(page);
    const first = await view(page);
    expect(first.ang, 'already on the SF ray').toBeLessThan(1);
    expect(Math.abs(first.distR - 3)).toBeLessThan(0.02);
    await expect(page.locator('#explore-detail')).toContainText('San Francisco');   // P27 intro kept
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
