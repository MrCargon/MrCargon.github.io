// Cosmology features: each one turns on and off without a page error (P33).
// Since P32 these classes arrive with the lazy 'cosmology' bundle, so this also covers
// the bundle load. Two of them were broken on main: DarkMatterHalo threw in its
// constructor (a duplicate getParticleCount method) and CosmicScale's data JSON held
// 0x hex literals, which JSON does not allow.
import { test, expect } from '@playwright/test';

const FEATURES = [
    { method: 'enableGravitationalWaves', key: 'gravitationalWaves' },
    { method: 'enableDarkMatterHalo', key: 'darkMatterHalo' },
    { method: 'enableExoplanetSystems', key: 'exoplanetSystems' },
    { method: 'enableCosmicScale', key: 'cosmicScale' },
    // Shows a mandatory disclaimer and waits for its button.
    { method: 'enableStringTheory', key: 'stringTheory', disclaimer: true }
];

// Mean per-pixel difference (max channel) between two PNG screenshots, decoded in the page.
// pct = share of pixels that changed by more than 24. Optional clip box in CSS pixels.
async function pixelDiff(page, a, b, box = null) {
    return page.evaluate(async ([a64, b64, clip]) => {
        const load = (s) => {
            const bin = atob(s); const u = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
            return createImageBitmap(new Blob([u], { type: 'image/png' }));
        };
        const A = await load(a64); const B = await load(b64);
        const c = new OffscreenCanvas(A.width, A.height); const x = c.getContext('2d');
        const r = clip || { x: 0, y: 0, w: A.width, h: A.height };
        x.drawImage(A, 0, 0); const da = x.getImageData(r.x, r.y, r.w, r.h).data;
        x.clearRect(0, 0, A.width, A.height);
        x.drawImage(B, 0, 0); const db = x.getImageData(r.x, r.y, r.w, r.h).data;
        let sum = 0; let big = 0; const n = da.length / 4;
        for (let i = 0; i < da.length; i += 4) {
            const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
            sum += d; if (d > 24) big++;
        }
        return { mean: sum / n, pct: 100 * big / n };
    }, [a.toString('base64'), b.toString('base64'), box]);
}

test.describe('Cosmology features', () => {
    for (const feature of FEATURES) {
        test(`${feature.method} turns on and off with no page errors`, async ({ page }) => {
            const errors = [];
            page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
            page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

            await page.goto('/#main');
            await page.waitForFunction(() => window.spaceEnvironment && window.spaceEnvironment.scene,
                null, { timeout: 30000 });

            const enabling = page.evaluate((name) => window.spaceEnvironment[name](), feature.method);
            if (feature.disclaimer) {
                const accept = page.getByRole('button', { name: /I Understand/i });
                await accept.click({ timeout: 10000 });
            }
            expect(await enabling).toBe(true);

            const state = await page.evaluate((key) => ({
                active: window.spaceEnvironment.activeCosmologyFeature,
                built: window.spaceEnvironment.cosmologyFeatures[key] !== null
            }), feature.key);
            expect(state).toEqual({ active: feature.key, built: true });

            // Let a few frames run its update() before turning it off.
            await page.waitForTimeout(500);
            await page.evaluate(() => window.spaceEnvironment.disableAllCosmologyFeatures());
            const left = await page.evaluate(() => Object.values(window.spaceEnvironment.cosmologyFeatures)
                .filter((v) => v).length);
            expect(left).toBe(0);

            expect(errors).toEqual([]);
        });
    }

    // P34: StringTheory used to work but sit inside the Sun (strings at the world origin,
    // 0.2 units thick): on-vs-off differed by 0.24 mean, the same as animation noise
    // (0.27-0.91 between two "off" shots). It must now be SEEN from the camera that is
    // active when it is enabled. Control: with main's placement every check below fails
    // (box 183x58 behind the Sun, whole 0.19, in-box 2.4 %; P34 notes).
    test('enableStringTheory is visible from the current camera', async ({ page }) => {
        await page.goto('/#main');
        await page.waitForFunction(() => window.spaceEnvironment && window.spaceEnvironment.scene,
            null, { timeout: 30000 });
        await page.waitForTimeout(3000);
        const off = await page.screenshot();

        const enabling = page.evaluate(() => window.spaceEnvironment.enableStringTheory());
        await page.getByRole('button', { name: /I Understand/i }).click({ timeout: 10000 });
        expect(await enabling).toBe(true);
        await page.waitForTimeout(1500);
        const on = await page.screenshot();

        // Screen box of the strings, and whether they are in front of the Sun.
        const view = await page.evaluate(() => {
            const se = window.spaceEnvironment; const cam = se.camera;
            const st = se.cosmologyFeatures.stringTheory;
            const b = new THREE.Box3(); st.strings.forEach((s) => b.expandByObject(s.mesh));
            const rect = se.renderer.domElement.getBoundingClientRect();
            let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
            for (let i = 0; i < 8; i++) {
                const p = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y,
                    i & 4 ? b.max.z : b.min.z).project(cam);
                x0 = Math.min(x0, (p.x + 1) / 2 * rect.width); x1 = Math.max(x1, (p.x + 1) / 2 * rect.width);
                y0 = Math.min(y0, (1 - p.y) / 2 * rect.height); y1 = Math.max(y1, (1 - p.y) / 2 * rect.height);
            }
            const centre = b.getCenter(new THREE.Vector3());
            const sun = new THREE.Vector3(); // the Sun sits at the world origin
            return {
                box: { x: Math.max(0, Math.round(x0)), y: Math.max(0, Math.round(y0)),
                    w: Math.round(x1 - x0), h: Math.round(y1 - y0) },
                nearerThanSun: cam.position.distanceTo(centre) < cam.position.distanceTo(sun) - 20
            };
        });
        const whole = await pixelDiff(page, off, on);
        const inBox = await pixelDiff(page, off, on, view.box);
        console.log('StringTheory visibility', JSON.stringify({ view, whole, inBox }));

        expect(view.nearerThanSun).toBe(true);
        expect(view.box.w).toBeGreaterThan(250);
        expect(view.box.h).toBeGreaterThan(80);
        // Well above animation noise (max 0.91); the old placement measured 0.24.
        expect(whole.mean).toBeGreaterThan(1.2);
        expect(inBox.pct).toBeGreaterThan(5); // fixed ~9, old placement 2.4

        await page.evaluate(() => window.spaceEnvironment.disableAllCosmologyFeatures());
        expect(await page.evaluate(() => window.spaceEnvironment.scene.getObjectByName('StringTheory')))
            .toBeUndefined();
    });
});
