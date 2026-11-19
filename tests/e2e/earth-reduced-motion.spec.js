import { test, expect } from '@playwright/test';

/**
 * Explore under prefers-reduced-motion (roast R3 #13).
 *
 * Reduce: troposphere jets/balloons hold still, the presence halo stops pulsing, the
 * satellites switch to an occasional step; every layer stays visible. The flag is live:
 * flipping the OS setting mid-session (emulateMedia) must start and stop the motion.
 * Positive control: with no-preference the same probes DO move, so the frozen readings
 * cannot come from a dead update loop.
 */

test.use({ viewport: { width: 1280, height: 720 } });
test.setTimeout(90000);

async function enterExplore(page) {
    await page.emulateMedia({ reducedMotion: 'reduce' });   // the OS setting before load
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
        const e = window.spaceEnvironment.getEarthObject();
        return !!(e.troposphereObjects && e.troposphereObjects.built && e.troposphereObjects.jets.length);
    }, null, { timeout: 20000 });
    // Demo visitors on, so the presence halo has something to pulse.
    await page.evaluate(() => {
        const t = document.getElementById('ep-tab-presence'); if (t) t.click();
        const b = document.getElementById('explore-toggle-presence');
        if (b && b.getAttribute('aria-pressed') !== 'true') b.click();
    });
    await page.waitForFunction(() => {
        const p = window.spaceEnvironment.getEarthObject().presencePins;
        return !!(p && p.markers.size > 0);
    }, null, { timeout: 15000 });
    // Camera at 1.3R over a jet: inside the troposphere band and the presence band.
    await page.evaluate(() => {
        const se = window.spaceEnvironment; const earth = se.getEarthObject();
        const c = new THREE.Vector3(); earth.mesh.getWorldPosition(c);
        const p = new THREE.Vector3(); earth.troposphereObjects.jets[1].mesh.getWorldPosition(p);
        se.camera.position.copy(c).addScaledVector(p.sub(c).normalize(), earth.data.radius * 1.3);
        se.controls.target.copy(c); se.controls.update();
    });
    await page.waitForTimeout(2000);
}

const read = (page) => page.evaluate(() => {
    const e = window.spaceEnvironment.getEarthObject();
    const tr = e.troposphereObjects, pp = e.presencePins;
    const ring = pp.markers.values().next().value.userData.ring;
    const sats = e.satellites;
    return {
        jetF: tr.jets.map((j) => j.f),
        balloonR: tr.balloons.map((b) => b.mesh.position.length()),
        ring: [ring.material.opacity, ring.scale.x],
        tropoVisible: tr.group.visible,
        presenceVisible: pp.group.visible,
        satsRM: sats ? sats.reducedMotion : null,
        flags: [tr.reducedMotion, pp.reducedMotion]
    };
});

const moved = (a, b) => a.jetF.some((f, i) => Math.abs(f - b.jetF[i]) > 1e-6)
    || a.balloonR.some((r, i) => Math.abs(r - b.balloonR[i]) > 1e-9);
const pulsed = (a, b) => Math.abs(a.ring[0] - b.ring[0]) > 1e-4 || Math.abs(a.ring[1] - b.ring[1]) > 1e-4;

test('reduced motion freezes the live globe layers and reacts to a live OS toggle', async ({ page }) => {
    await enterExplore(page);

    // 1) Reduce from load: nothing decorative moves, everything stays visible.
    let a = await read(page); await page.waitForTimeout(1500); let b = await read(page);
    expect(b.flags).toEqual([true, true]);
    expect(b.tropoVisible).toBe(true);
    expect(b.presenceVisible).toBe(true);
    expect(moved(a, b)).toBe(false);
    expect(pulsed(a, b)).toBe(false);
    if (b.satsRM !== null) expect(b.satsRM).toBe(true);

    // 2) Positive control + live listener: the OS setting turns off -> motion resumes.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForTimeout(300);
    a = await read(page); await page.waitForTimeout(1500); b = await read(page);
    expect(b.flags).toEqual([false, false]);
    expect(moved(a, b)).toBe(true);
    expect(pulsed(a, b)).toBe(true);
    if (b.satsRM !== null) expect(b.satsRM).toBe(false);

    // 3) And back on mid-session -> frozen again, still visible.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(300);
    a = await read(page); await page.waitForTimeout(1500); b = await read(page);
    expect(b.flags).toEqual([true, true]);
    expect(moved(a, b)).toBe(false);
    expect(pulsed(a, b)).toBe(false);
    expect(b.tropoVisible && b.presenceVisible).toBe(true);
});
