import { test, expect } from '@playwright/test';

/**
 * Earth-view clutter guards (D:\work\_plan\PORTFOLIO-EARTH-AUDIT-2026-11-19.md, section 4).
 * Each test pins one audit piece so a later change cannot quietly bring the clutter back.
 * Positive controls sit inside each test: the thing being limited is first shown to exist
 * (objects built, layer has items, table has classes), so a pass cannot come from an
 * empty scene.
 */

test.use({ viewport: { width: 1280, height: 720 } });
test.setTimeout(90000);

async function enterExplore(page) {
    await page.goto('/#main');
    await page.waitForFunction(() => {
        const se = window.spaceEnvironment;
        const earth = se && se.getEarthObject && se.getEarthObject();
        return !!(earth && earth.mesh);
    }, null, { timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
        const se = window.spaceEnvironment;
        if (se.selectPlanet) se.selectPlanet('Earth');
        se.enterExploreMode();
    });
    await page.waitForFunction(() => {
        const e = window.spaceEnvironment.getEarthObject();
        return !!(e.troposphereObjects && e.troposphereObjects.built && e.markers);
    }, null, { timeout: 30000 });
}

// Put the camera rr Earth radii from the centre, above lat/lng.
async function placeCamera(page, rr, lat, lng) {
    await page.evaluate(([rr, lat, lng]) => {
        const se = window.spaceEnvironment; const earth = se.getEarthObject();
        const c = new THREE.Vector3(); earth.mesh.getWorldPosition(c);
        const s = earth.mesh.localToWorld(GlobeMath.latLngToVector3(lat, lng, earth.data.radius).clone());
        se.camera.position.copy(c).addScaledVector(s.sub(c).normalize(), earth.data.radius * rr);
        se.controls.target.copy(c); se.controls.update();
    }, [rr, lat, lng]);
}

// Largest on-screen size (CSS px) and opacity over the troposphere objects that are drawn.
const tropoRead = (page) => page.evaluate(() => {
    const se = window.spaceEnvironment; const t = se.getEarthObject().troposphereObjects;
    const cam = se.camera, h = se.renderer.domElement.clientHeight;
    const k = (h / 2) / Math.tan((cam.fov * Math.PI / 180) / 2);
    const wp = new THREE.Vector3(), ws = new THREE.Vector3();
    let maxPx = 0, maxOp = 0, n = 0;
    for (const set of [t.balloons, t.jets, t.weather]) for (const o of set) {
        n++;
        o.mesh.getWorldPosition(wp); o.mesh.getWorldScale(ws);
        const px = (o.extent * ws.x) * k / wp.distanceTo(cam.position);
        const op = Math.max(...o.mats.map((m) => m.opacity));
        if (t.group.visible && op > 0.01) { maxPx = Math.max(maxPx, px); maxOp = Math.max(maxOp, op); }
    }
    return { n, visible: t.group.visible, maxPx, maxOp };
});

test('F2: the pin editor stays hidden while no pin is selected', async ({ page }) => {
    await enterExplore(page);
    await page.click('#ep-tab-pins');
    const ed = await page.evaluate(() => {
        const e = document.getElementById('ep-editor');
        return { hidden: e.hidden, display: getComputedStyle(e).display, h: e.getBoundingClientRect().height,
            pins: document.querySelectorAll('#ep-pin-list li').length,
            tabShown: !document.getElementById('ep-pins-body').hidden };
    });
    expect(ed.tabShown).toBe(true);            // control: the Pins tab really is open
    expect(ed.pins).toBe(0);
    expect(ed.hidden).toBe(true);
    expect(ed.display).toBe('none');
    expect(ed.h).toBe(0);
});
