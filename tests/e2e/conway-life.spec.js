import { test, expect } from '@playwright/test';

/**
 * Artificial Life page — Conway + Lenia behind one mode switch.
 *
 * Two layers of proof, because they cover different failures:
 *
 *   tests/verify-patterns.cjs   the RLE strings are right (CPU simulation)
 *   this file                   the SHADER implements B3/S23, and every control on the
 *                               merged page is actually wired to something
 *
 * A wrong neighbour tap or texel offset would still produce something that moves and looks
 * convincing, so the shader tests assert measurable physics rather than "it renders".
 */

/** Boot the page and wait for THREE + the Life classes to be republished on window. */
async function bootLife(page, hash = '#conway') {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/' + hash);
    await page.waitForFunction(
        () => typeof window.THREE !== 'undefined'
            && typeof window.ConwayLife !== 'undefined'
            && typeof window.LifePatterns !== 'undefined'
            && typeof window.LifeView !== 'undefined',
        null,
        { timeout: 30000 }
    );
    // Wait for the PAGE too, not just the classes. The classes are defined by deferred
    // scripts long before PageManager has built the controller, and a test that reads
    // pm._lifePage right after the class check races it.
    await page.waitForFunction(() => {
        const pm = window.pageManager || (window.app && window.app.pageManager);
        return !!(pm && pm._lifePage && pm._lifePage.view);
    }, null, { timeout: 30000 });
    return errors;
}

/** Run a pattern on the GPU in an isolated renderer and return live cells before/after. */
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
        // Well away from the edges: the world is a torus, and a pattern straddling the
        // wrap is still correct but makes displacement arithmetic ambiguous.
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

function normalise(keys) {
    if (!keys.length) return { shape: '', minX: 0, minY: 0 };
    const pts = keys.map(k => k.split(',').map(Number));
    const minX = Math.min(...pts.map(p => p[0]));
    const minY = Math.min(...pts.map(p => p[1]));
    return { shape: pts.map(p => (p[0] - minX) + ',' + (p[1] - minY)).sort().join(' '), minX, minY };
}

test.describe('Life — GPU shader correctness', () => {

    test('page loads without console errors', async ({ page }) => {
        const errors = await bootLife(page);
        await expect(page.locator('#life-canvas')).toBeVisible();
        const ours = errors.filter(e => /Conway|LifePatterns|ConwayLife|LifeView|LifePage|shader|GLSL/i.test(e));
        expect(ours, 'Life-related console errors: ' + ours.join(' | ')).toEqual([]);
    });

    test('glider keeps its shape and moves one cell diagonally per 4 generations', async ({ page }) => {
        await bootLife(page);
        const { before, after } = await runOnGpu(page, { pattern: 'glider', gens: 4 });
        expect(before.length, 'glider starts with 5 cells').toBe(5);
        expect(after.length, 'glider still has 5 cells').toBe(5);

        const a = normalise(before), b = normalise(after);
        expect(b.shape, 'shape must survive a full period').toBe(a.shape);
        // c/4 diagonal. Sign of dy depends on readback row order (WebGL reads bottom-up),
        // so magnitude is the honest assertion: the physics is "one cell diagonally".
        expect({ dx: Math.abs(b.minX - a.minX), dy: Math.abs(b.minY - a.minY) })
            .toEqual({ dx: 1, dy: 1 });
    });

    test('blinker has period 2', async ({ page }) => {
        await bootLife(page);
        const one = await runOnGpu(page, { pattern: 'blinker', gens: 1 });
        expect(one.after.sort(), 'must change after 1 generation').not.toEqual(one.before.sort());
        const two = await runOnGpu(page, { pattern: 'blinker', gens: 2 });
        expect(two.after.sort(), 'must return after 2 generations').toEqual(two.before.sort());
    });

    test('switching to Seeds (B2/S) kills a block that is stable under Life', async ({ page }) => {
        await bootLife(page);
        const life = await runOnGpu(page, { pattern: 'block', gens: 4 });
        expect(life.after.sort(), 'a block is a still life under B3/S23').toEqual(life.before.sort());

        // Seeds has an empty survival set, so the block cannot persist. This proves the
        // rule uniforms actually reach the shader rather than B3/S23 being baked in.
        const seeds = await runOnGpu(page, { pattern: 'block', gens: 1, rule: 'B2/S' });
        expect(seeds.before.length).toBe(4);
        expect(seeds.after.filter(k => seeds.before.includes(k)),
            'no original block cell may survive under B2/S').toEqual([]);
    });
});

test.describe('Life — merged page controls', () => {

    test('opens in Conway from #conway and Lenia from #life', async ({ page }) => {
        await bootLife(page, '#conway');
        await expect(page.locator('#mode-conway')).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#pick-pattern-wrap')).toBeVisible();
        await expect(page.locator('#pick-mu-wrap')).toBeHidden();

        await bootLife(page, '#life');
        await expect(page.locator('#mode-lenia')).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#pick-mu-wrap')).toBeVisible();
        await expect(page.locator('#pick-pattern-wrap')).toBeHidden();
    });

    test('mode switch swaps the controls and keeps both worlds alive', async ({ page }) => {
        await bootLife(page, '#conway');
        await page.click('#mode-lenia');
        await expect(page.locator('#pick-mu-wrap')).toBeVisible();
        const bothAlive = await page.evaluate(() => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            const lp = pm && pm._lifePage;
            return lp ? { conway: !!lp.sims.conway, lenia: !!lp.sims.lenia, mode: lp.mode } : null;
        });
        expect(bothAlive, 'both simulations must survive a mode switch')
            .toEqual({ conway: true, lenia: true, mode: 'lenia' });
    });

    test('the simulation actually runs and the pickers are populated', async ({ page }) => {
        await bootLife(page, '#conway');
        await page.waitForFunction(() => {
            const g = document.getElementById('life-gen');
            return g && /generation (\d+)/.test(g.textContent) && +RegExp.$1 > 0;
        }, null, { timeout: 20000 });

        const s = await page.evaluate(() => ({
            patterns: document.getElementById('life-pattern').length,
            rules: document.getElementById('life-ruleset').length,
            palettes: document.getElementById('life-palette').length,
            pop: document.getElementById('life-pop').textContent
        }));
        expect(s.patterns, 'all patterns listed').toBe(14);
        expect(s.rules, 'all universes listed').toBe(7);
        expect(s.palettes, 'all palettes listed').toBeGreaterThan(3);
        // Opens on the Gosper gun (36 cells), which grows without bound.
        expect(parseInt(s.pop.replace(/\D/g, ''), 10)).toBeGreaterThan(36);
    });

    test('zoom controls change the view and reset restores it', async ({ page }) => {
        await bootLife(page, '#conway');
        const read = () => page.evaluate(() => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            return pm._lifePage.view.zoom;
        });
        const start = await read();
        await page.click('#life-zoom-in');
        const zoomed = await read();
        expect(zoomed, 'zoom in must increase magnification').toBeGreaterThan(start);
        await expect(page.locator('#life-zoom-out-label')).toContainText('×');

        await page.click('#life-zoom-reset');
        expect(await read(), 'reset must restore 1x').toBe(1);
    });

    test('drawing puts live cells on the grid', async ({ page }) => {
        await bootLife(page, '#conway');
        await page.click('#life-pause');           // freeze so the rule cannot eat the stroke
        await page.click('#life-clear');
        await page.click('#tool-draw');

        const before = await page.evaluate(() => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            const s = pm._lifePage.sims.conway;
            const b = s.readPixels();
            let n = 0; for (let i = 0; i < b.length; i += 4) if (b[i] > 127) n++;
            return n;
        });
        expect(before, 'clear must leave an empty world').toBe(0);

        // The tool buttons sit BELOW the canvas, so clicking them scrolls the panel and
        // can push the canvas centre off-screen — mouse events then land on whatever is
        // at those coordinates instead. Scroll it back before drawing and re-read the box.
        await page.locator('#life-canvas').scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        const box = await page.locator('#life-canvas').boundingBox();
        expect(box.y, 'canvas must be on screen before drawing').toBeGreaterThan(-1);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 25, { steps: 8 });
        await page.mouse.up();

        const after = await page.evaluate(() => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            const s = pm._lifePage.sims.conway;
            const b = s.readPixels();
            let n = 0; for (let i = 0; i < b.length; i += 4) if (b[i] > 127) n++;
            return n;
        });
        expect(after, 'dragging with the draw tool must create cells').toBeGreaterThan(0);
    });

    test('palette selection reaches the shader', async ({ page }) => {
        await bootLife(page, '#conway');
        await page.selectOption('#life-palette', 'ice');
        const applied = await page.evaluate(() => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            const v = pm._lifePage.view;
            const u = v._quad.material.uniforms;
            return { name: v.palette, high: [u.uHigh.value.r, u.uHigh.value.g, u.uHigh.value.b] };
        });
        expect(applied.name).toBe('ice');
        // Ice's high stop is a pale blue: blue must dominate red, which is not true of
        // the default ember palette — so this proves the uniform actually changed.
        expect(applied.high[2]).toBeGreaterThan(applied.high[0]);
    });

    test('LifePage.cleanup() releases the renderer and both sims', async ({ page }) => {
        await bootLife(page, '#conway');
        await page.waitForFunction(() => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            return !!(pm && pm._lifePage && pm._lifePage.renderer);
        }, null, { timeout: 20000 });

        const r = await page.evaluate(() => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            const p = pm._lifePage;
            const had = { renderer: !!p.renderer, conway: !!p.sims.conway, lenia: !!p.sims.lenia };
            p.cleanup();
            return { had, after: { renderer: p.renderer, conway: p.sims.conway, lenia: p.sims.lenia, raf: p.raf, view: p.view } };
        });
        expect(r.had).toEqual({ renderer: true, conway: true, lenia: true });
        expect(r.after, 'cleanup must null every handle it owns')
            .toEqual({ renderer: null, conway: null, lenia: null, raf: null, view: null });
    });
});
