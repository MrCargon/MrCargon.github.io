import { test, expect } from '@playwright/test';

/**
 * Earth astronomy: is the scene TRUE at the shown time? (R1 #1, #2, #8, #9)
 *
 * The page is read, not the formulas: the Sun direction the day/night shader uses, the
 * globe's spin, the Moon's world position and the planets' positions. References are
 * independent of the site's code:
 *   - subsolar point 2026-11-19 06:33 UTC: lat -19.5, lng +78.1 (almanac)
 *   - GMST = 280.46061837 + 360.98564736629 * d (IAU 1982, d = days from J2000.0 UT)
 *   - heliocentric ecliptic longitudes 2026-11-19 00:00 UT, JPL Horizons (DE441,
 *     ecliptic J2000): Venus 71.84, Earth 56.29, Mars 108.90, Jupiter 135.03
 *   - Moon: ~13.2 deg/day eastward, and not inside the GPS/geostationary shells
 * Scene frame: ecliptic longitude 0 = world +x, 90 = world -z, north = +y.
 * All of these failed on 7101db4.
 */

test.use({ viewport: { width: 1280, height: 720 } });

async function boot(page) {
    await page.goto('/#main');
    await page.waitForFunction(() => {
        const se = window.spaceEnvironment;
        const e = se && se.getEarthObject && se.getEarthObject();
        return !!(e && e.mesh && e.moons && e.moons.length && se.timeManager);
    }, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
}

/** Pin the sim clock at an instant (paused) and let a few frames apply it. */
async function at(page, iso) {
    await page.evaluate((iso) => {
        const tm = window.spaceEnvironment.timeManager;
        tm.reset(new Date(iso));
        tm.pause();
    }, iso);
    await page.waitForTimeout(400);
}

const read = (page) => page.evaluate(() => {
    const se = window.spaceEnvironment, e = se.getEarthObject(), T = window.THREE;
    e.mesh.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(e.mesh.matrixWorld).invert();
    const s = e._sunDir.clone().transformDirection(inv);           // Sun in globe-local
    const ll = window.GlobeMath.vector3ToLatLng(s.clone().multiplyScalar(e.data.radius), e.data.radius);
    const ep = e.mesh.getWorldPosition(new T.Vector3());
    const mp = e.moons[0].mesh.getWorldPosition(new T.Vector3()).sub(ep);
    const lon = (v) => ((Math.atan2(-v.z, v.x) * 180 / Math.PI) + 360) % 360;
    const planets = {};
    ['Venus', 'Earth', 'Mars', 'Jupiter'].forEach((n) => {
        const p = se.solarSystem.getPlanetByName(n);
        if (p && p.mesh) planets[n] = lon(p.mesh.position);
    });
    return {
        j2000Days: se.timeManager.getJ2000Days(),
        subLat: ll.lat, subLng: ll.lng,
        spinDeg: ((e.mesh.rotation.y * 180 / Math.PI) % 360 + 360) % 360,
        moonLon: lon(mp), moonDistR: mp.length() / e.data.radius,
        moonOnGlobe: e.moonGroup.parent === e.mesh,
        planets
    };
});

const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

test('Sun, spin, Moon and planets match the real sky at a fixed date', async ({ page }) => {
    await boot(page);

    await at(page, '2026-11-19T06:33:00Z');
    const t0 = await read(page);
    expect(Math.abs(t0.subLat - (-19.5)), 'subsolar latitude (deg)').toBeLessThan(1);
    expect(angleDiff(t0.subLng, 78.1), 'subsolar longitude (deg)').toBeLessThan(1);

    // Spin = Greenwich sidereal time, from the page's own clock value.
    const gmst = ((280.46061837 + 360.98564736629 * t0.j2000Days) % 360 + 360) % 360;
    expect(angleDiff(t0.spinDeg, gmst), 'globe spin vs GMST (deg)').toBeLessThan(0.05);

    // Moon: its own orbit, not the globe's spin. 6 h of sim time is ~3.3 deg, not ~90.
    expect(t0.moonOnGlobe, 'Moon must not be a child of the spinning globe').toBe(false);
    expect(t0.moonDistR, 'Moon outside the geostationary shell (6.6 R)').toBeGreaterThan(6.6);
    await at(page, '2026-11-19T12:33:00Z');
    const t6 = await read(page);
    expect(angleDiff(t6.moonLon, t0.moonLon), 'Moon motion in 6 h (deg)').toBeLessThan(5);
    await at(page, '2026-11-20T06:33:00Z');
    const t1 = await read(page);
    const rate = ((t1.moonLon - t0.moonLon) + 360) % 360;              // eastward
    expect(rate, 'Moon deg/day').toBeGreaterThan(11.5);
    expect(rate, 'Moon deg/day').toBeLessThan(15.5);

    // Planets vs JPL Horizons, heliocentric ecliptic longitude.
    await at(page, '2026-11-19T00:00:00Z');
    const h = await read(page);
    const ref = { Venus: 71.84, Earth: 56.29, Mars: 108.90, Jupiter: 135.03 };
    for (const n of Object.keys(ref)) {
        expect(angleDiff(h.planets[n], ref[n]), n + ' heliocentric longitude (deg)').toBeLessThan(2);
    }
});

test('Explore: one clock - Sun follows the wall clock, panel says so', async ({ page }) => {
    await boot(page);
    // Leave the sim far from now at high speed; entering Explore must pin it to now.
    await page.evaluate(() => {
        const tm = window.spaceEnvironment.timeManager;
        tm.reset(new Date('2030-03-01T00:00:00Z'));
        tm.setTimeScale(1000);
    });
    const entered = await page.evaluate(() => {
        const se = window.spaceEnvironment;
        if (typeof se.selectPlanet === 'function') se.selectPlanet('Earth');
        return se.enterExploreMode();
    });
    expect(entered).toBeTruthy();
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => {
        const se = window.spaceEnvironment, tm = se.timeManager, e = se.getEarthObject(), T = window.THREE;
        e.mesh.updateMatrixWorld(true);
        const inv = new T.Matrix4().copy(e.mesh.matrixWorld).invert();
        const s = e._sunDir.clone().transformDirection(inv).multiplyScalar(e.data.radius);
        const el = document.getElementById('explore-clock');
        return {
            drift: Math.abs(tm.getCurrentDate().getTime() - Date.now()),
            scale: tm.getTimeScale(),
            sun: window.GlobeMath.vector3ToLatLng(s, e.data.radius),
            want: window.OrbitalCalculator.subsolarPoint(tm.getJ2000Days()),
            label: el ? el.textContent : ''
        };
    });
    expect(r.drift, 'sim clock vs wall clock in Explore (ms)').toBeLessThan(3000);
    expect(r.scale).toBe(1);
    expect(Math.abs(r.sun.lat - r.want.lat)).toBeLessThan(0.5);
    expect(angleDiff(r.sun.lng, r.want.lng)).toBeLessThan(0.5);
    expect(r.label).toMatch(/live/i);

    // Exit gives the user's speed back.
    await page.evaluate(() => window.spaceEnvironment.exitExploreMode(true));
    const scale = await page.evaluate(() => window.spaceEnvironment.timeManager.getTimeScale());
    expect(scale).toBe(1000);
});
