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
});
