import { test, expect } from '@playwright/test';

// Runs against the standard dev server from playwright.config.js.
//
// This used to need a separate static server: three.js comes from the browser import map
// pointing at a CDN and is deliberately not an npm dependency, and Vite did not honour
// import maps — it tried to resolve the bare specifier "three" from node_modules, failed,
// and returned 500 for the inline module, so `npm run dev` served a page with no THREE at
// all. The importMapPlugin in vite.config.js now resolves those specifiers to the CDN URLs
// declared in index.html, so dev and static builds finally agree.

/**
 * Conway's Game of Life — GPU correctness.
 *
 * tests/verify-patterns.cjs already proves the RLE strings are right, but it does so with
 * a CPU implementation. That says nothing about whether the FRAGMENT SHADER implements
 * B3/S23 correctly — a wrong neighbour tap, a filtering mistake or an off-by-one texel
 * offset would still produce something that moves and looks like Life.
 *
 * So these tests run the real shader and assert measurable physics:
 *   - a glider keeps its shape and moves exactly one cell diagonally per 4 generations
 *   - a blinker has period 2
 *   - switching to Seeds (B2/S) kills a block that is stable under Life
 *
 * Each builds its own renderer and disposes it, so a failure cannot leak a WebGL context
 * into the next test.
 */

/** Boot the app and wait for THREE + the Life classes to be republished on window. */
async function bootConway(page) {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/#conway');
    await page.waitForFunction(
        () => typeof window.THREE !== 'undefined'
            && typeof window.ConwayLife !== 'undefined'
            && typeof window.LifePatterns !== 'undefined',
        null,
        { timeout: 30000 }
    );
    return errors;
}

/**
 * Run a pattern on the GPU and return the live-cell sets before and after `gens` steps.
 * Everything happens inside one page.evaluate so the renderer never escapes the browser.
 */
async function runOnGpu(page, { pattern, gens, rule, size = 64 }) {
    return page.evaluate(({ pattern, gens, rule, size }) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const renderer = new window.THREE.WebGLRenderer({ canvas, antialias: false });
        const sim = new window.ConwayLife(renderer, { size });
        sim.init();
        if (rule) {
            const p = window.LifePatterns.parseRule(rule);
            sim.setRule(p.birth, p.survive);
        }
        const pat = window.LifePatterns.get(pattern);
        // Place well away from the edges: the world is a torus, and a pattern straddling
        // the wrap would still be correct but makes displacement arithmetic ambiguous.
        sim.setPattern(pat.cells, 20, 20);

        const readSet = () => {
            const buf = sim.readPixels();
            const out = [];
            if (!buf) return out;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    if (buf[(y * size + x) * 4] > 127) out.push(x + ',' + y);
                }
            }
            return out.sort();
        };

        const before = readSet();
        for (let i = 0; i < gens; i++) sim.step();
        const after = readSet();

        sim.dispose();
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
        return { before, after };
    }, { pattern, gens, rule, size });
}

/** Normalise a list of "x,y" keys to its bounding-box origin. */
function normalise(keys) {
    if (!keys.length) return { shape: '', minX: 0, minY: 0 };
    const pts = keys.map(k => k.split(',').map(Number));
    const minX = Math.min(...pts.map(p => p[0]));
    const minY = Math.min(...pts.map(p => p[1]));
    return {
        shape: pts.map(p => (p[0] - minX) + ',' + (p[1] - minY)).sort().join(' '),
        minX, minY
    };
}

test.describe("Conway's Game of Life — GPU shader", () => {

    test('page loads without console errors', async ({ page }) => {
        const errors = await bootConway(page);
        await expect(page.locator('#conway-canvas')).toBeVisible();
        // Only fail on errors from our own code; third-party/network noise is not the
        // subject of this test.
        const ours = errors.filter(e => /Conway|LifePatterns|ConwayLife|shader|GLSL/i.test(e));
        expect(ours, 'Conway-related console errors: ' + ours.join(' | ')).toEqual([]);
    });

    test('glider keeps its shape and moves one cell diagonally per 4 generations', async ({ page }) => {
        await bootConway(page);
        const { before, after } = await runOnGpu(page, { pattern: 'glider', gens: 4 });

        expect(before.length, 'glider should start with 5 cells').toBe(5);
        expect(after.length, 'glider should still have 5 cells').toBe(5);

        const a = normalise(before);
        const b = normalise(after);
        expect(b.shape, 'glider shape must be preserved after a full period').toBe(a.shape);

        // c/4 diagonal: exactly one cell on each axis per 4 generations. The sign of dy
        // depends on readback row order (WebGL reads bottom-up), so magnitude is the
        // honest assertion — the physics is "one cell diagonally", not "down-right".
        const dx = Math.abs(b.minX - a.minX);
        const dy = Math.abs(b.minY - a.minY);
        expect({ dx, dy }, 'glider must travel exactly (1,1) per 4 gens').toEqual({ dx: 1, dy: 1 });
    });

    test('blinker has period 2', async ({ page }) => {
        await bootConway(page);

        const one = await runOnGpu(page, { pattern: 'blinker', gens: 1 });
        expect(one.after.sort(), 'blinker must CHANGE after 1 generation').not.toEqual(one.before.sort());

        const two = await runOnGpu(page, { pattern: 'blinker', gens: 2 });
        expect(two.after.sort(), 'blinker must return to its start after 2 generations').toEqual(two.before.sort());
    });

    test('switching to Seeds (B2/S) kills a block that is stable under Life', async ({ page }) => {
        await bootConway(page);

        const life = await runOnGpu(page, { pattern: 'block', gens: 4 });
        expect(life.after.sort(), 'a block is a still life under B3/S23').toEqual(life.before.sort());

        // Seeds has an empty survival set: every live cell dies every generation, so the
        // block cannot persist. This proves the rule uniforms actually reach the shader
        // rather than B3/S23 being baked in.
        const seeds = await runOnGpu(page, { pattern: 'block', gens: 1, rule: 'B2/S' });
        expect(seeds.before.length, 'block should start with 4 cells').toBe(4);
        const survivors = seeds.after.filter(k => seeds.before.includes(k));
        expect(survivors, 'no original block cell may survive under B2/S').toEqual([]);
    });

    test('the page initialises and actually runs', async ({ page }) => {
        await bootConway(page);
        await page.waitForFunction(() => {
            const g = document.getElementById('conway-gen');
            return g && /generation (\d+)/.test(g.textContent) && +RegExp.$1 > 0;
        }, null, { timeout: 20000 });

        const state = await page.evaluate(() => ({
            gen: (document.getElementById('conway-gen') || {}).textContent,
            pop: (document.getElementById('conway-pop') || {}).textContent,
            patterns: (document.getElementById('conway-pattern') || {}).length,
            rules: (document.getElementById('conway-ruleset') || {}).length
        }));

        expect(state.patterns, 'all patterns should be listed').toBe(14);
        expect(state.rules, 'all universes should be listed').toBe(7);
        // Opens on the Gosper gun (36 cells) which grows without bound, so a running
        // simulation must show MORE than it started with.
        const pop = parseInt((state.pop || '').replace(/\D/g, ''), 10);
        expect(pop, 'Gosper gun population should exceed its initial 36 cells').toBeGreaterThan(36);
    });

    test('ConwayPage.cleanup() releases the renderer', async ({ page }) => {
        await bootConway(page);
        // Tests what THIS page owns: that cleanup() actually tears the context down.
        //
        // Deliberately NOT asserted here: that PageManager calls cleanup on every
        // navigation path. Measured on this build, navigating away by hash leaves
        // `_lifePage` set too — the pre-existing Artificial Life page behaves identically,
        // so that is a router-level issue affecting both WebGL pages and is reported
        // separately rather than blamed on this one.
        // Tear down the LIVE instance the page created, not a second copy of it.
        //
        // An earlier version of this test did `new ConwayPage(); init()`, which grabs
        // #conway-canvas — a canvas that already has a WebGL context owned by the page's
        // own instance. A canvas cannot hand out a second context, so init() returned
        // false. It only ever passed because the static server was slow enough that the
        // real instance had not claimed the canvas yet: an order-dependent test that
        // measured load timing rather than cleanup.
        await page.waitForFunction(() => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            return !!(pm && pm._conwayPage && pm._conwayPage.renderer);
        }, null, { timeout: 20000 });

        const released = await page.evaluate(() => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            const p = pm._conwayPage;
            const had = { renderer: !!p.renderer, sim: !!p.sim, raf: p.raf !== null };
            p.cleanup();
            return {
                had,
                after: { renderer: p.renderer, sim: p.sim, raf: p.raf }
            };
        });

        expect(released.had, 'the live page should hold a renderer, sim and rAF before cleanup')
            .toEqual({ renderer: true, sim: true, raf: true });
        expect(released.after, 'cleanup must null every handle it owns')
            .toEqual({ renderer: null, sim: null, raf: null });
    });
});
