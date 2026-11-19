import { test, expect } from '@playwright/test';

/**
 * R3 #9a (P30): the Explore globe works from the keyboard. The canvas is a Tab stop
 * (role=application, a label that names the keys) with a visible focus ring. While it has
 * focus: arrows orbit by a set step (5 deg from 3R out, smaller lower down), + / = and
 * - / _ zoom by 1.5x in altitude, in-zoom stops at the slider's near end, out-zoom runs on
 * past 6R so the 9R rule still leaves Explore, and Esc exits. Reduced motion places the
 * camera at once (P23); otherwise a short glide. Keys do nothing when the canvas is not
 * focused (positive control: the pin name field).
 */

test.use({ viewport: { width: 1280, height: 720 } });

async function enterExplore(page) {
    await page.goto('/#main');
    await page.waitForFunction(() => {
        const se = window.spaceEnvironment;
        const e = se && se.getEarthObject && se.getEarthObject();
        return !!(e && e.mesh);   // the layers are built on the first Explore entry (R2 #7b)
    }, null, { timeout: 40000 });
    await page.waitForTimeout(4000);
    await page.evaluate(() => window.spaceEnvironment.enterExploreMode());
    await page.waitForTimeout(3000);
}

// Put the camera at k radii, looking down from a mid latitude (polar 60 deg).
const place = (page, k) => page.evaluate((k) => {
    const se = window.spaceEnvironment, e = se.getEarthObject();
    const p = e.getMesh().getWorldPosition(new THREE.Vector3());
    const s = new THREE.Spherical(e.data.radius * k, Math.PI / 3, 0.4);
    se.camera.position.copy(p).add(new THREE.Vector3().setFromSpherical(s));
    se.controls.target.copy(p); se.controls.update();
}, k);

// Camera around the target: azimuth + polar angle in degrees, distance in radii.
const cam = (page) => page.evaluate(() => {
    const se = window.spaceEnvironment, e = se.getEarthObject();
    const o = se.camera.position.clone().sub(se.controls.target);
    const s = new THREE.Spherical().setFromVector3(o);
    return { az: s.theta * 180 / Math.PI, pol: s.phi * 180 / Math.PI, rr: s.radius / e.data.radius,
        explore: !!se.exploreMode };
});

const focusCanvas = (page) => page.evaluate(() => window.spaceEnvironment.renderer.domElement.focus());
const wrap = (d) => ((d + 540) % 360) - 180;

test('the canvas is a labelled Tab stop with a visible ring (NVIDIA renderer)', async ({ page }) => {
    await enterExplore(page);
    const r = await page.evaluate(() => {
        const cv = window.spaceEnvironment.renderer.domElement;
        const gl = window.spaceEnvironment.renderer.getContext();
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return { tab: cv.tabIndex, role: cv.getAttribute('role'), label: cv.getAttribute('aria-label') || '',
            gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
    });
    console.log('renderer:', r.gpu);
    expect(r.tab).toBe(0);
    expect(r.role).toBe('application');
    expect(r.label).toMatch(/Arrow keys rotate/);
    expect(r.label).toMatch(/plus and minus zoom/);
    expect(r.label).toMatch(/Escape/);
    // Reach it with the keyboard (Shift+Tab from the end of the page lands on it first).
    await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
    await page.keyboard.press('Shift+Tab');
    const ring = await page.evaluate(() => {
        const cv = window.spaceEnvironment.renderer.domElement, s = getComputedStyle(cv);
        return { focused: document.activeElement === cv, fv: cv.matches(':focus-visible'),
            style: s.outlineStyle, width: parseFloat(s.outlineWidth), offset: parseFloat(s.outlineOffset) };
    });
    expect(ring.focused, 'Shift+Tab from the end reaches the globe').toBe(true);
    expect(ring.fv).toBe(true);
    expect(ring.style).toBe('solid');
    expect(ring.width).toBeGreaterThanOrEqual(2);
    expect(ring.offset, 'ring drawn inside the edges').toBeLessThan(0);
    // Leaving Explore takes the Tab stop away again.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => {
        const se = window.spaceEnvironment, cv = se.renderer.domElement;
        return { explore: se.exploreMode, tab: cv.getAttribute('tabindex'), role: cv.getAttribute('role'),
            first: document.body.firstElementChild === se.container
                || document.body.firstElementChild.nextElementSibling === se.container };
    });
    expect(after.explore, 'Esc on the focused globe exits').toBe(false);
    expect(after.tab).toBeNull();
    expect(after.role).toBeNull();
    expect(after.first, 'container back at the start of <body>').toBe(true);
});

test('arrows orbit by a set step, +/- zoom within the limits', async ({ page }) => {
    await enterExplore(page);
    await place(page, 3);
    await page.waitForTimeout(800);
    await focusCanvas(page);
    const steps = {};
    for (const [key, field, sign] of [['ArrowRight', 'az', 1], ['ArrowLeft', 'az', -1],
        ['ArrowDown', 'pol', 1], ['ArrowUp', 'pol', -1]]) {
        const a = await cam(page);
        await page.keyboard.press(key);
        await page.waitForTimeout(400);
        const b = await cam(page);
        const d = field === 'az' ? wrap(b.az - a.az) : b.pol - a.pol;
        steps[key] = +d.toFixed(3);
        expect(d * sign, `${key} turns 5 deg at 3R (got ${d})`).toBeCloseTo(5, 1);
        expect(Math.abs(b.rr - a.rr), `${key} keeps the distance`).toBeLessThan(0.01);
    }
    // Closer in, one press turns less (alt 0.5R -> 1.25 deg).
    await place(page, 1.5);
    await page.waitForTimeout(800);
    const c0 = await cam(page);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    const c1 = await cam(page);
    expect(wrap(c1.az - c0.az), 'smaller step at 1.5R').toBeCloseTo(1.25, 1);
    // Zoom: + and = in, - and _ out, 1.5x in altitude a press.
    await place(page, 3);
    await page.waitForTimeout(800);
    const zoom = [];
    for (const key of ['+', '=', '-', '_']) {
        const a = await cam(page);
        await page.keyboard.press(key);
        await page.waitForTimeout(400);
        const b = await cam(page);
        const ratio = (b.rr - 1) / (a.rr - 1);
        zoom.push(`${key}:${a.rr.toFixed(3)}->${b.rr.toFixed(3)}`);
        expect(ratio, `${key} altitude ratio`).toBeCloseTo(key === '+' || key === '=' ? 1 / 1.5 : 1.5, 2);
    }
    // In-zoom stops at the slider's near end (1.0013R) and never passes it.
    for (let i = 0; i < 30; i++) await page.keyboard.press('+');
    await page.waitForTimeout(500);
    const near = await cam(page);
    const minR = await page.evaluate(() => window.spaceEnvironment._zoomRange().minR);
    expect(near.rr, 'stops at the slider minimum').toBeGreaterThanOrEqual(minR - 1e-4);
    expect(near.rr).toBeLessThan(minR + 1e-3);
    // Out-zoom passes the slider's far end (6R), and past 9R the existing rule exits.
    const out = [];
    for (let i = 0; i < 30; i++) {
        await page.keyboard.press('-');
        await page.waitForTimeout(250);
        const s = await cam(page);
        out.push(+s.rr.toFixed(3));
        if (!s.explore) break;
    }
    console.log(JSON.stringify({ steps, zoom, nearR: near.rr, minR, out }));
    expect(Math.max(...out), 'zoomed past the slider end').toBeGreaterThan(6);
    expect((await cam(page)).explore, 'zooming out past 9R left Explore').toBe(false);
});

test('reduced motion places the camera at once; otherwise it glides', async ({ page }) => {
    // One synchronous read right after the keydown: placed in full, or only just begun.
    const pressNow = (page) => page.evaluate(() => {
        const se = window.spaceEnvironment, cv = se.renderer.domElement;
        const az = () => new THREE.Spherical().setFromVector3(se.camera.position.clone().sub(se.controls.target)).theta;
        const a = az();
        cv.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        let d = (az() - a) * 180 / Math.PI;
        d = ((d + 540) % 360) - 180;
        return d;
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await enterExplore(page);
    await place(page, 3);
    await page.waitForTimeout(800);
    const rm = await pressNow(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForTimeout(500);
    const glideStart = await pressNow(page);
    await page.waitForTimeout(400);
    console.log(JSON.stringify({ reducedSync: rm, glideSync: glideStart }));
    expect(rm, 'reduce: the whole step at once').toBeCloseTo(5, 1);
    expect(glideStart, 'no-preference: the glide has only begun').toBeLessThan(1);
});

test('positive control: keys do nothing when the globe is not focused', async ({ page }) => {
    await enterExplore(page);
    await place(page, 3);
    await page.waitForTimeout(800);
    // Nothing focused.
    await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
    let a = await cam(page);
    for (const k of ['ArrowLeft', 'ArrowUp', '+', '-']) await page.keyboard.press(k);
    await page.waitForTimeout(400);
    let b = await cam(page);
    expect(Math.abs(wrap(b.az - a.az)) + Math.abs(b.pol - a.pol) + Math.abs(b.rr - a.rr)).toBeLessThan(0.05);
    // Typing in the pin name field: the text goes in, the camera stays.
    await page.click('#ep-tab-pins').catch(() => {});
    await page.evaluate(() => { const b = document.getElementById('ep-add-pin'); if (b) b.click(); });
    await page.waitForTimeout(2200);   // the new pin is centred with a 1.5 s fly; let it land
    const name = page.locator('#ep-ed-name');
    await expect(name).toBeVisible();
    await name.focus();
    a = await cam(page);
    await name.fill('');
    await page.keyboard.type('a-b+c=d');
    for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) await page.keyboard.press(k);
    await page.waitForTimeout(400);
    b = await cam(page);
    expect(await name.inputValue()).toBe('a-b+c=d');
    expect(Math.abs(wrap(b.az - a.az)) + Math.abs(b.pol - a.pol) + Math.abs(b.rr - a.rr),
        'camera unmoved while typing').toBeLessThan(0.05);
    // And back on the globe the same key works (the control is live).
    await focusCanvas(page);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    const c = await cam(page);
    expect(wrap(c.az - b.az)).toBeCloseTo(5, 1);
});
