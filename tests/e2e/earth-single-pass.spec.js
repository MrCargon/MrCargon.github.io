import { test, expect } from '@playwright/test';

/**
 * Transparent DoubleSide materials draw in ONE pass (roast R2 #3).
 *
 * three r184 draws a transparent DoubleSide object twice (BackSide, then FrontSide) and sets
 * material.needsUpdate between the passes, so material.version rises ~2x per frame and every
 * draw re-runs getParameters / getProgramCacheKey: measured ~5 MB/s of garbage at 3R with the
 * pin and presence rings on. Every such material in Explore is flat or additive, so
 * forceSinglePass changes no pixel.
 *
 * Checks, with a pin and the demo visitors on (every listed material in the scene):
 * - no visible transparent DoubleSide material lacks forceSinglePass;
 * - their material.version stays still over 1 s.
 * Positive control: a probe mesh WITHOUT the flag, added for that second, does bump its
 * version, so the measure would see a regression.
 */

test.use({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
test.setTimeout(120000);

test('Explore: transparent DoubleSide materials are single-pass, versions stay still', async ({ page }) => {
    for (const h of ['earthquake.usgs.gov', 'api.wheretheiss.at', 'celestrak.org', 'services.swpc.noaa.gov']) {
        await page.route('**' + h + '/**', (r) => r.abort('connectionrefused'));
    }
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
    await expect(page.locator('#ep-add-pin')).toBeAttached({ timeout: 20000 });
    await page.evaluate(() => {
        document.getElementById('ep-add-pin').click();
        document.getElementById('explore-toggle-presence').click();
    });
    await page.waitForFunction(() => window.spaceEnvironment.getEarthObject().presencePins.markers.size >= 5, null, { timeout: 15000 });
    // Camera at 3R, where the presence and pin rings are on screen.
    await page.evaluate(() => {
        const se = window.spaceEnvironment, e = se.getEarthObject(), m = e.getMesh();
        const R = (e.data && e.data.radius) || 2, ep = m.getWorldPosition(new THREE.Vector3());
        const dir = m.localToWorld(GlobeMath.latLngToVector3(40, -100, R)).sub(ep).normalize();
        se.camera.position.copy(ep).addScaledVector(dir, R * 3); se.controls.target.copy(ep); se.controls.update();
    });
    await page.waitForTimeout(1500);

    const r = await page.evaluate(async () => {
        const se = window.spaceEnvironment, list = [], bad = [];
        const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
        se.scene.traverse((o) => {
            const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
            ms.forEach((m) => {
                if (!m || !m.transparent || m.side !== THREE.DoubleSide || !visible(o)) return;
                list.push({ m, v: m.version });
                if (!m.forceSinglePass) bad.push((o.name || (o.parent && o.parent.name) || '?') + ':' + m.type);
            });
        });
        // positive control: an unflagged transparent DoubleSide plane in front of the camera
        const probe = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.01, side: THREE.DoubleSide, depthWrite: false }));
        probe.position.copy(se.camera.position).add(se.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1));
        probe.frustumCulled = false;
        se.scene.add(probe);
        const pv = probe.material.version;
        await new Promise((res) => setTimeout(res, 1000));
        const probeBumps = probe.material.version - pv;
        se.scene.remove(probe); probe.geometry.dispose(); probe.material.dispose();
        const maxBump = list.reduce((a, x) => Math.max(a, x.m.version - x.v), 0);
        return { count: list.length, bad, maxBump, probeBumps };
    });
    console.log('single-pass:', JSON.stringify(r));
    expect(r.count).toBeGreaterThanOrEqual(6);      // 5 demo rings + the pin ring at least
    expect(r.probeBumps).toBeGreaterThan(5);        // control: an unflagged one does churn
    expect(r.bad).toEqual([]);
    expect(r.maxBump).toBeLessThan(5);
});
