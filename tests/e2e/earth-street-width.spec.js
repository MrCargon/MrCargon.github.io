import { test, expect } from '@playwright/test';

/**
 * Roast R1 #10 guard (D:\work\_plan\PORTFOLIO-ROAST-R1-2026-11-19.md): streets show their
 * class by WIDTH, not only by brightness, and motorways/trunks get a dark casing.
 *
 * The pixel test draws two real segments with the street layer's own patched line shader
 * into a render target and measures their thickness. Positive control: the same two
 * segments through an UNPATCHED LineMaterial must come out the same thickness, so the
 * measurement can see a width difference only when the patch makes one (a pass cannot come
 * from a measurement that always reports "wider"). A second control renders one segment at
 * two uniform widths and must see the difference, so the thickness reader is not blind.
 */

test.use({ viewport: { width: 1280, height: 720 } });
test.setTimeout(90000);

async function loadStreets(page) {
    await page.goto('/#main');
    await page.waitForFunction(() => {
        const se = window.spaceEnvironment;
        const earth = se && se.getEarthObject && se.getEarthObject();
        return !!(earth && earth.mesh);
    }, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
        const se = window.spaceEnvironment;
        if (se.selectPlanet) se.selectPlanet('Earth');
        se.enterExploreMode();
    });
    await page.waitForFunction(() => !!(window.StreetTiles && window.THREE && window.THREE.LineMaterial), null, { timeout: 30000 });
}

test('R1 #10: width table - majors wider than minors, only motorway/trunk cased', async ({ page }) => {
    await loadStreets(page);
    const w = await page.evaluate(() => {
        const S = window.StreetTiles, f = (c) => S.roadWidth('transportation', c);
        return { motorway: f('motorway'), trunk: f('trunk'), primary: f('primary'), minor: f('minor'),
            service: f('service'), unknown: f('nonesuch'), motorwayCons: f('motorway_construction'),
            river: S.roadWidth('waterway', 'river') };
    });
    expect(w.unknown.mul).toBe(1);                       // control: unlisted classes draw at 1x
    expect(w.motorway.mul).toBeGreaterThan(w.primary.mul);
    expect(w.primary.mul).toBeGreaterThan(w.minor.mul);
    expect(w.minor.mul).toBeGreaterThanOrEqual(w.service.mul);
    expect(w.motorwayCons.mul).toBe(w.motorway.mul);
    expect(w.motorway.cased).toBe(true);
    expect(w.trunk.cased).toBe(true);
    expect(w.primary.cased).toBe(false);
    expect(w.minor.cased).toBe(false);
    expect(w.river.cased).toBe(false);
});

test('R1 #10: a tile puts casings first, wider and dark, and only from z12', async ({ page }) => {
    await loadStreets(page);
    const r = await page.evaluate(() => {
        const S = window.StreetTiles, se = window.spaceEnvironment, earth = se.getEarthObject();
        const st = new S(earth.mesh, earth.data.radius);
        const line = (cls, y) => ({ type: window.MVT.GEOM_LINESTRING, properties: { class: cls },
            geometry: [[{ x: 100, y: y }, { x: 300, y: y }]] });
        const layer = { extent: 4096, features: [line('minor', 100), line('motorway', 200), line('primary', 300)] };
        const run = (z) => {
            const out = { verts: [], cols: [], widths: [], caseVerts: [], caseCols: [], caseWidths: [], casing: true };
            st._appendLayer(layer, 'transportation', z, 0, 0, out);
            return { fills: out.verts.length / 6, casings: out.caseVerts.length / 6, widths: out.widths,
                caseWidths: out.caseWidths, caseCol: out.caseCols[0], fillCol: out.cols[0] };
        };
        const out = { z14: run(14), z11: run(11), widthOK: st._widthOK(), casingPx: S.CASING_PX };
        st.dispose();
        return out;
    });
    expect(r.widthOK).toBe(true);
    expect(r.z14.fills).toBe(3);                         // control: all three classes drawn at z14
    expect(r.z14.casings).toBe(1);                       // the motorway only
    expect(r.z14.caseWidths).toEqual([expect.any(Number), r.casingPx]);
    expect(r.z14.caseWidths[0]).toBe(r.z14.widths[2]);   // casing = the motorway's width + CASING_PX
    expect(r.z14.caseCol).toBeLessThan(0.3);             // dark
    expect(r.z11.casings).toBe(0);                       // no casing below CASING_MIN_Z
});

test('R1 #10: major roads render wider than minor ones (pixel check, with controls)', async ({ page }) => {
    await loadStreets(page);
    const r = await page.evaluate(() => {
        const T = window.THREE, S = window.StreetTiles, se = window.spaceEnvironment, earth = se.getEarthObject();
        const renderer = se.renderer, N = 256;
        const rt = new T.WebGLRenderTarget(N, N);
        const cam = new T.OrthographicCamera(-1, 1, 1, -1, -1, 1);
        // Thickness (rows lit) of each line at column N/2, top line first.
        const thickness = (mat, widths, lw) => {
            const geo = new T.LineSegmentsGeometry();
            geo.setPositions([-0.8, 0.5, 0, 0.8, 0.5, 0, -0.8, -0.5, 0, 0.8, -0.5, 0]);
            geo.setColors([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
            geo.setAttribute('instanceWidth', new T.InstancedBufferAttribute(new Float32Array(widths), 2));
            mat.linewidth = lw;
            const mesh = new T.LineSegments2(geo, mat);
            const scene = new T.Scene(); scene.add(mesh);
            const prevRT = renderer.getRenderTarget(), prevClear = renderer.getClearAlpha();
            renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, cam);
            const px = new Uint8Array(N * N * 4);
            renderer.readRenderTargetPixels(rt, 0, 0, N, N, px);
            renderer.setRenderTarget(prevRT); renderer.setClearAlpha(prevClear);
            geo.dispose();
            let top = 0, bottom = 0;
            for (let y = 0; y < N; y++) {
                if (px[(y * N + N / 2) * 4] < 128) continue;
                if (y >= N / 2) top++; else bottom++;          // readPixels rows go bottom-up
            }
            return { top, bottom };
        };
        const mk = () => new T.LineMaterial({ color: 0xffffff, linewidth: 1, vertexColors: true, depthTest: false });
        const st = new S(earth.mesh, earth.data.radius);
        const W = S.ROAD_WIDTHS.transportation;
        const widths = [W.motorway, 0, W.minor, 0];          // top = motorway, bottom = minor
        const patched = mk(); st._patchWidthShader(patched);
        const out = {
            patched: thickness(patched, widths, 48),
            unpatched: thickness(mk(), widths, 48),           // control 1: no patch, same data
            thin: thickness(mk(), widths, 16), thick: thickness(mk(), widths, 48),  // control 2: reader sees width
            flag: patched.userData.widthPatched, mul: [W.motorway, W.minor]
        };
        st.dispose(); rt.dispose();
        return out;
    });
    // control 2: the reader sees a uniform width change at all
    expect(r.thick.top).toBeGreaterThan(r.thin.top + 2);
    // control 1: without the patch both classes are the same width
    expect(r.unpatched.top).toBeGreaterThan(0);
    expect(Math.abs(r.unpatched.top - r.unpatched.bottom)).toBeLessThanOrEqual(1);
    // the real thing: with the street shader the motorway is clearly wider than the minor road
    expect(r.flag).toBe(true);
    expect(r.patched.bottom).toBeGreaterThan(0);
    expect(r.patched.top).toBeGreaterThan(r.patched.bottom * 1.5);
    const ratio = r.patched.top / r.patched.bottom, want = r.mul[0] / r.mul[1];
    expect(Math.abs(ratio - want)).toBeLessThan(0.25);
});
