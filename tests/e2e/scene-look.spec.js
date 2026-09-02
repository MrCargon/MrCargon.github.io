import { test, expect } from '@playwright/test';
import fs from 'fs';

/**
 * Look at the particle scene, rather than only counting assertions.
 *
 * Writes screenshots and a pixel report to scratch/. This is the check that catches the
 * class of bug the unit tests cannot: the sim was correct and the particles rendered
 * sub-pixel, so the page was a black rectangle with all nine physics tests green.
 *
 * Rendering here is SwiftShader (no GPU in the test browser), so TIMING numbers from this
 * file would be meaningless. Colour and coverage are not — those are the same arithmetic
 * on any rasteriser.
 */

test.use({ viewport: { width: 1280, height: 900 } });

const OUT = 'scratch';

test('the particle field is visible, coloured and moving', async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });

    await page.goto('/#main');
    await page.waitForFunction(() => !!(window.spaceEnvironment && window.spaceEnvironment.camera),
        null, { timeout: 40000 });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${OUT}/scene-1-solar.png` });

    const tab = page.locator('#camera-controls-popup .popup-tab');
    if (await tab.count()) await tab.first().click({ force: true });
    await page.waitForTimeout(400);
    await page.locator('#scene-particles').click({ force: true });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/scene-2-particles.png` });

    // Sample the pixels: how much of the frame is lit, and in how many distinct hues.
    // A blank scene, an all-white scene and a correctly-coloured scene are all "a canvas
    // that rendered" — only the pixels tell them apart.
    //
    // The obvious way to do this — drawImage the WebGL canvas into a 2D one and read it
    // back — silently returns an EMPTY image, because the renderer is built without
    // preserveDrawingBuffer and the drawing buffer is cleared as soon as it is
    // composited. It reported 0% lit against a screenshot that plainly showed particles.
    // So: take Playwright's screenshot (which reads the composited frame), hand the PNG
    // back into the page, and decode it through an Image, which cannot be empty.
    const shot = await page.screenshot({ clip: { x: 40, y: 120, width: 820, height: 700 } });
    const stats = await page.evaluate(async (b64) => {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
        const c = document.createElement('canvas');
        c.width = 320; c.height = 273;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let lit = 0; const hues = new Set();
        let coloured = 0, washed = 0;
        for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            if (r + g + b > 90) {
                lit++;
                // Quantise so anti-aliasing does not invent thousands of "hues".
                hues.add(`${r >> 5},${g >> 5},${b >> 5}`);
                // Saturation: max-min over max. Additive blending drove this near zero
                // (everything cream). It is the number that catches that regression.
                const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
                if ((mx - mn) / mx > 0.25) coloured++; else washed++;
            }
        }
        return { total: d.length / 4, lit, hues: hues.size, coloured, washed };
    }, shot.toString('base64'));
    expect(stats, 'pixels sampled').not.toBeNull();
    const pct = (100 * stats.lit / stats.total).toFixed(1);
    const sat = stats.lit ? (100 * stats.coloured / stats.lit).toFixed(0) : '0';

    // Motion: same sample twice, a second apart. Identical means frozen.
    const frame = () => page.evaluate(() => {
        const f = window.spaceEnvironment.particleField;
        return { gen: f.generation, x: f._px[0], y: f._py[0], z: f._pz[0],
                 cam: [f.camera.position.x, f.camera.position.y, f.camera.position.z] };
    });
    const f1 = await frame();
    await page.waitForTimeout(1500);
    const f2 = await frame();
    await page.screenshot({ path: `${OUT}/scene-3-particles-later.png` });

    const moved = Math.hypot(f2.x - f1.x, f2.y - f1.y, f2.z - f1.z);
    const camMoved = Math.hypot(f2.cam[0] - f1.cam[0], f2.cam[1] - f1.cam[1], f2.cam[2] - f1.cam[2]);

    const report = [
        `lit pixels      ${pct}% of the frame (${stats.lit} of ${stats.total} sampled)`,
        `distinct hues   ${stats.hues}`,
        `saturated       ${sat}% of lit pixels carry a species colour (${stats.coloured} vs ${stats.washed} washed)`,
        `generations     ${f1.gen} -> ${f2.gen} in 1.5s`,
        `particle 0      moved ${moved.toFixed(5)} world units`,
        `camera          moved ${camMoved.toFixed(5)} world units`
    ].join('\n');
    fs.writeFileSync(`${OUT}/scene-report.txt`, report);
    console.log('\n' + report + '\n');

    // A field of ~2200 points at this size covers a small but non-trivial slice. Under
    // 0.2% would mean sub-pixel points (the bug that shipped once already); over 40%
    // would mean something is filling the screen instead of drawing points.
    expect(Number(pct), 'particles actually cover pixels').toBeGreaterThan(0.2);
    expect(Number(pct), 'and are points, not a wash').toBeLessThan(40);
    // More than a couple of hues means the species colours survived to the screen.
    expect(stats.hues, 'species colours are distinguishable').toBeGreaterThan(3);
    // And they must be genuinely COLOURED, not five shades of cream. This is the
    // additive-blending regression, stated as a number.
    expect(Number(sat), 'most lit pixels carry a real hue').toBeGreaterThan(50);
    expect(f2.gen, 'simulation advanced').toBeGreaterThan(f1.gen);
    expect(moved, 'particles moved').toBeGreaterThan(0);
    expect(camMoved, 'camera drifted').toBeGreaterThan(0);
});
