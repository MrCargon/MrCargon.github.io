import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Aurora ovals (P42): one soft ring per geomagnetic pole on the Thermosphere shell, sized
 * by the live Kp index (NOAA SWPC planetary K-index). Every feed is answered by a route
 * here; nothing reaches the real services.
 *
 * - Kp 2 and Kp 7 give different rings: the shader's equatorward edge (63 vs 53 deg
 *   geomagnetic latitude) AND the drawn ring, measured in pixels from the pole: the lit
 *   pixels (aurora on minus aurora off, same frame) sit clearly farther out at Kp 7.
 *   Control: off minus off gives (almost) no changed pixels, so the measure sees the
 *   aurora and not cloud drift or noise.
 * - A dead feed keeps the quiet default Kp 3 (edge 61 deg), says so, and throws nothing.
 *
 * AURORA_SHOT_DIR (optional): save p42-aurora-kp2.png / p42-aurora-kp7.png there.
 */

test.use({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
test.setTimeout(150000);

const kpReply = (kp) => [
    { time_tag: '2026-11-19T15:00:00', Kp: 1.33, a_running: 5, station_count: 8 },
    { time_tag: '2026-11-19T18:00:00', Kp: kp, a_running: 15, station_count: 8 }
];

async function routeAll(page, state) {
    await page.route('**services.swpc.noaa.gov/**', (route) => (state.kp === null
        ? route.abort('connectionrefused')
        : route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify(kpReply(state.kp)) })));
    await page.route('**earthquake.usgs.gov/**', (r) => r.abort('connectionrefused'));
    await page.route('**api.wheretheiss.at/**', (r) => r.abort('connectionrefused'));
    await page.route('**celestrak.org/**', (r) => r.abort('connectionrefused'));
    // Markers and satellites off: nothing else moves on the globe between two frames.
    await page.addInitScript(() => localStorage.setItem('mrcargon.explore.layers',
        JSON.stringify({ iss: false, quakes: false, sats: false, pois: false })));
}

async function enterExplore(page) {
    await page.goto('/#main');
    await page.waitForFunction(() => {
        const se = window.spaceEnvironment;
        const e = se && se.getEarthObject && se.getEarthObject();
        return !!(e && e.mesh);
    }, null, { timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
        const se = window.spaceEnvironment;
        if (se.selectPlanet) se.selectPlanet('Earth');
        se.enterExploreMode();
    });
    await expect(page.locator('#ep-feed-aurora')).toBeVisible({ timeout: 20000 });
}

// Camera above the geomagnetic north pole at k Earth radii (tilt 0 = straight down).
const overPole = (page, k, tilt) => page.evaluate(([k, tilt]) => {
    const se = window.spaceEnvironment, e = se.getEarthObject(), m = e.getMesh();
    const P = window.AuroraOval.POLES[0];
    const local = window.GlobeMath.latLngToVector3(P.lat - tilt, P.lng, 1).normalize();
    const c = m.getWorldPosition(new THREE.Vector3());
    const dir = local.clone().transformDirection(m.matrixWorld);
    se.camera.position.copy(c).addScaledVector(dir, e.data.radius * k);
    se.controls.target.copy(c); se.controls.update();
}, [k, tilt]);

const ovalState = (page) => page.evaluate(() => {
    const ao = window.spaceEnvironment.getEarthObject().auroraOval;
    const u = ao.material.uniforms;
    return { kp: ao.kp, edgeLat: 90 - u.uEdge.value * 180 / Math.PI, visible: ao.group.visible,
        meshes: ao.meshes.length, amt: u.uAmt.value };
});

/**
 * Two frames, aurora on and aurora off (AuroraOval.STRENGTH), same camera. Returns the
 * changed-pixel count and their median distance (px) from the pole's screen point.
 */
async function ringPixels(page, onA, onB) {
    const strength = await page.evaluate(() => window.AuroraOval.STRENGTH);
    const shot = async (on) => {
        await page.evaluate((s) => { window.AuroraOval.STRENGTH = s; }, on ? strength : 0);
        await page.waitForTimeout(700);
        return (await page.screenshot()).toString('base64');
    };
    const a = await shot(onA), b = await shot(onB);
    await page.evaluate((s) => { window.AuroraOval.STRENGTH = s; }, strength);
    return page.evaluate(async ([a, b]) => {
        const load = async (b64) => {
            // No fetch(data:) here: the page CSP's connect-src blocks it. Decode by hand.
            const bin = atob(b64), bytes = new Uint8Array(bin.length);
            for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
            const img = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
            const cv = new OffscreenCanvas(img.width, img.height), cx = cv.getContext('2d');
            cx.drawImage(img, 0, 0);
            return cx.getImageData(0, 0, img.width, img.height);
        };
        const A = await load(a), B = await load(b);
        const se = window.spaceEnvironment, e = se.getEarthObject(), m = e.getMesh();
        const P = window.AuroraOval.POLES[0];
        const p = window.GlobeMath.latLngToVector3(P.lat, P.lng, e.data.radius * 1.065);
        m.localToWorld(p).project(se.camera);
        const px = (p.x + 1) / 2 * A.width, py = (1 - p.y) / 2 * A.height;
        const d = [];
        for (let i = 0; i < A.data.length; i += 4) {
            const diff = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1])
                + Math.abs(A.data[i + 2] - B.data[i + 2]);
            if (diff < 30) continue;
            const k = i / 4, x = k % A.width, y = (k - x) / A.width;
            d.push(Math.hypot(x - px, y - py));
        }
        d.sort((u, v) => u - v);
        return { count: d.length, median: d.length ? d[d.length >> 1] : 0 };
    }, [a, b]);
}

test('Kp 2 vs Kp 7: the oval grows toward the equator (shader + pixels, with a control)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const state = { kp: 2 };
    await routeAll(page, state);
    const shotDir = process.env.AURORA_SHOT_DIR;
    if (shotDir) mkdirSync(shotDir, { recursive: true });
    const out = {};
    for (const kp of [2, 7]) {
        state.kp = kp;
        if (kp !== 2) await page.reload();
        await enterExplore(page);
        await expect(page.locator('#ep-feed-aurora'))
            .toHaveText(new RegExp('^Aurora: Kp ' + kp + '\\.0 at 18:00 UTC · oval from ' + (67 - 2 * kp) + '° mag\\. lat$'),
                { timeout: 20000 });
        await expect(page.locator('#ep-feed-aurora')).toHaveAttribute('data-state', 'live');
        await overPole(page, 3.2, 0);
        await page.waitForTimeout(2500);                 // the cascade lights the Thermosphere
        const s = await ovalState(page);
        expect(s.meshes, 'one mesh per pole').toBe(2);
        expect(s.visible, 'shown while the Thermosphere is lit').toBe(true);
        expect(s.edgeLat).toBeCloseTo(67 - 2 * kp, 3);
        out[kp] = { state: s, ring: await ringPixels(page, true, false) };
        if (kp === 2) out.control = await ringPixels(page, false, false);
        if (shotDir) {
            await overPole(page, 2.6, 22);
            await page.waitForTimeout(1200);
            await page.screenshot({ path: shotDir + '/p42-aurora-kp' + kp + '.png' });
        }
    }
    console.log('P42 ring', JSON.stringify({ kp2: out[2].ring, kp7: out[7].ring, control: out.control }));
    expect(out.control.count, 'control: off vs off changes (almost) nothing').toBeLessThan(200);
    expect(out[2].ring.count, 'Kp 2 ring is drawn').toBeGreaterThan(1500);
    expect(out[7].ring.count, 'Kp 7 ring is drawn').toBeGreaterThan(out[2].ring.count);
    expect(out[7].ring.median, 'Kp 7 ring sits farther from the pole').toBeGreaterThan(out[2].ring.median * 1.15);
    expect(errors).toEqual([]);
});

test('dead Kp feed: quiet default Kp 3, said in the Layers tab, nothing thrown; hidden up close', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await routeAll(page, { kp: null });
    await enterExplore(page);
    await expect(page.locator('#ep-feed-aurora'))
        .toHaveText(/^Aurora: Kp 3\.0 \(quiet default\) - feed offline · oval from 61° mag\. lat$/, { timeout: 20000 });
    await expect(page.locator('#ep-feed-aurora')).toHaveAttribute('data-state', 'offline');
    await overPole(page, 3.2, 0);
    await page.waitForTimeout(2500);
    const far = await ovalState(page);
    expect(far.edgeLat).toBeCloseTo(61, 3);
    expect(far.visible).toBe(true);
    // Up close the Thermosphere fades out, and the ovals with it.
    await overPole(page, 1.3, 0);
    await page.waitForTimeout(1500);
    expect((await ovalState(page)).visible, 'hidden where the shell is not shown').toBe(false);
    // Explore exit hides them too.
    await page.evaluate(() => window.spaceEnvironment.exitExploreMode());
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.spaceEnvironment.getEarthObject().auroraOval.group.visible)).toBe(false);
    expect(errors).toEqual([]);
});
