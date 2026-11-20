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

test('F1: troposphere objects fade out up close and stay small on screen', async ({ page }) => {
    await enterExplore(page);
    // Control: inside the band (1.3R) the objects are drawn.
    await placeCamera(page, 1.3, 37.7749, -122.4194);
    await page.waitForTimeout(2500);
    const mid = await tropoRead(page);
    expect(mid.n).toBeGreaterThan(10);
    expect(mid.visible).toBe(true);
    expect(mid.maxPx).toBeLessThanOrEqual(36);  // largest cap is the jet's 34 px
    // Up close (1.02R, below showNear 1.04R) the layer must be gone, not left at ~0.78.
    await placeCamera(page, 1.02, 37.7749, -122.4194);
    await page.waitForTimeout(2500);
    const near = await tropoRead(page);
    expect(near.visible).toBe(false);
    expect(near.maxOp).toBe(0);
});

test('F3: live markers are one Points draw per layer, at most 15 px, not drawn when faded', async ({ page }) => {
    await enterExplore(page);
    await placeCamera(page, 1.8, 37.7749, -122.4194);
    await page.waitForTimeout(2000);
    const r = await page.evaluate(() => {
        const e = window.spaceEnvironment.getEarthObject(); const mk = e.markers;
        const out = { layers: {}, sphereMarkers: 0 };
        for (const name of Object.keys(mk.layers)) {
            const L = mk.layers[name]; const a = L.points && L.points.geometry.getAttribute('aSize');
            let mx = 0; if (a) for (let i = 0; i < a.count; i++) mx = Math.max(mx, a.array[i]);
            out.layers[name] = { isPoints: !!(L.points && L.points.isPoints), n: a ? a.count : 0, maxPx: mx };
        }
        // No world-size marker spheres left anywhere under the markers' groups.
        for (const name of Object.keys(mk.layers)) mk.layers[name].group.traverse((o) => { if (o.isMesh) out.sphereMarkers++; });
        out.max = window.GlobeMarkers.MAX_PX;
        return out;
    });
    // Control: the places layer always has items (static list), so the size check is real.
    expect(r.layers.pois && r.layers.pois.n).toBeGreaterThan(0);
    for (const name of Object.keys(r.layers)) {
        expect(r.layers[name].isPoints).toBe(true);
        expect(r.layers[name].maxPx).toBeLessThanOrEqual(15);   // quakes <= 11, clusters <= 13, place diamonds 15
    }
    expect(r.sphereMarkers).toBe(0);
    // Up close the marker fade reaches 0: the Points are not drawn at all.
    await placeCamera(page, 1.05, 37.7749, -122.4194);
    await page.waitForTimeout(2500);
    const drawn = await page.evaluate(() => {
        const mk = window.spaceEnvironment.getEarthObject().markers;
        return Object.keys(mk.layers).filter((n) => mk.layers[n].points && mk.layers[n].points.visible);
    });
    expect(drawn).toEqual([]);
});

test('F4: streets thin out by zoom - majors first, minor roads only up close', async ({ page }) => {
    await enterExplore(page);
    await page.waitForFunction(() => !!window.StreetTiles, null, { timeout: 15000 });
    const w = await page.evaluate(() => {
        const S = window.StreetTiles, f = (c, z) => S.roadWeight('transportation', c, z);
        return { motorway9: f('motorway', 9), primary9: f('primary', 9), minor9: f('minor', 9),
            minor12: f('minor', 12), minor13: f('minor', 13), service13: f('service', 13), service14: f('service', 14),
            path14: f('path', 14), track14: f('track', 14), motorwayCons9: f('motorway_construction', 9) };
    });
    expect(w.motorway9).toBeGreaterThan(0);          // control: majors are drawn at z9
    expect(w.motorwayCons9).toBe(w.motorway9);
    expect(w.primary9).toBe(0);
    expect(w.minor9).toBe(0);
    expect(w.minor12).toBe(0);
    expect(w.minor13).toBeGreaterThan(0);
    expect(w.minor13).toBeLessThan(w.motorway9);     // hierarchy: minor roads dimmer
    expect(w.service13).toBe(0);
    expect(w.service14).toBeGreaterThan(0);
    expect(w.path14).toBe(0);                        // footpaths/tracks never drawn
    expect(w.track14).toBe(0);
});
