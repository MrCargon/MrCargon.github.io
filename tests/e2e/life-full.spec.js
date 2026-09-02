import { test, expect } from '@playwright/test';

/**
 * End-to-end sweep of the Artificial Life page and the rest of the Projects surface.
 *
 * The point of this file is coverage of the WIRING, not the physics — conway-life.spec.js
 * already proves the shader implements B3/S23. Here every control is exercised and its
 * effect is measured, because a control that looks fine and changes nothing is the exact
 * failure this page has now had twice (Music/SFX sliders wired to no handler; a rule
 * uniform that never reached the shader).
 */

async function boot(page, hash = '#conway') {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e)));
    await page.goto('/' + hash);
    await page.waitForFunction(() => {
        const pm = window.pageManager || (window.app && window.app.pageManager);
        return !!(pm && pm._lifePage && pm._lifePage.view && pm._lifePage.renderer);
    }, null, { timeout: 30000 });
    return errors;
}

const lp = (page, fn) => page.evaluate(fn);

/**
 * Set a range input and fire the event the page actually listens for.
 * Playwright's fill() rejects some stepped values with "Malformed value", and the
 * handlers here are bound to 'input', so dispatching it directly is both more reliable
 * and closer to what a drag does.
 */
const setRange = (page, id, value) => page.evaluate(({ id, value }) => {
    const el = document.getElementById(id);
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return el.value;
}, { id, value });
const state = (page) => page.evaluate(() => {
    const pm = window.pageManager || (window.app && window.app.pageManager);
    const p = pm._lifePage;
    return {
        mode: p.mode, zoom: p.view.zoom, palette: p.view.palette,
        tool: p.tool, brush: p.brush, speed: p.speed, density: p.density,
        volume: p.volume, paused: p.paused,
        mu: p.sims.lenia ? p.sims.lenia.mu : null,
        sigma: p.sims.lenia ? p.sims.lenia.sigma : null,
        kmu: p.sims.lenia ? p.sims.lenia.kmu : null,
        dt: p.sims.lenia ? p.sims.lenia.dt : null,
        stops: p.view.getStops()
    };
});

test.describe('Life page — every control', () => {

    test('page loads clean and exposes both simulations', async ({ page }) => {
        const errors = await boot(page);
        const ours = errors.filter(e => /Life|Conway|Lenia|shader|GLSL|undefined is not/i.test(e));
        expect(ours, 'console errors: ' + ours.join(' | ')).toEqual([]);
        const s = await state(page);
        expect(s.mode).toBe('conway');
        expect(s.stops.low).toMatch(/^#[0-9a-f]{6}$/);
    });

    test('exit control returns to Projects', async ({ page }) => {
        await boot(page, '#conway');
        await expect(page.locator('#life-exit')).toBeVisible();
        await page.locator('#life-exit').click();
        await page.waitForTimeout(1200);
        expect(page.url()).toContain('#projects');
    });

    test('Escape also leaves the page', async ({ page }) => {
        await boot(page, '#conway');
        await page.locator('#life-canvas').click({ position: { x: 5, y: 5 } }).catch(() => {});
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1200);
        expect(page.url()).toContain('#projects');
    });

    test('every Conway control changes something measurable', async ({ page }) => {
        await boot(page, '#conway');

        // speed
        await setRange(page, 'life-speed', 7);
        expect((await state(page)).speed, 'speed slider').toBe(7);
        await expect(page.locator('#life-speed-out')).toHaveText('7×');

        // brush
        await setRange(page, 'life-brush', 5);
        expect((await state(page)).brush, 'brush slider').toBe(5);

        // seed density -> the note reports the value actually used
        await setRange(page, 'life-density', 55);
        expect((await state(page)).density, 'density slider').toBeCloseTo(0.55, 5);
        await page.locator('#life-reseed').click();
        await expect(page.locator('#life-note')).toContainText('55%');

        // pause / step
        await page.locator('#life-pause').click();
        expect((await state(page)).paused, 'pause').toBe(true);
        const g1 = await lp(page, () => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            return pm._lifePage.sims.conway.generation;
        });
        await page.locator('#life-step').click();
        const g2 = await lp(page, () => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            return pm._lifePage.sims.conway.generation;
        });
        expect(g2, 'step must advance exactly one generation').toBe(g1 + 1);

        // clear
        await page.locator('#life-clear').click();
        const alive = await lp(page, () => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            const b = pm._lifePage.sims.conway.readPixels();
            let n = 0; for (let i = 0; i < b.length; i += 4) if (b[i] > 127) n++;
            return n;
        });
        expect(alive, 'clear must empty the world').toBe(0);

        // pattern + rule
        await page.selectOption('#life-pattern', 'pulsar');
        await expect(page.locator('#life-note')).toContainText('Pulsar');
        await page.selectOption('#life-ruleset', 'B36/S23');
        await expect(page.locator('#life-rule')).toHaveText('B36/S23');
        const rule = await lp(page, () => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            return Array.from(pm._lifePage.sims.conway.birth);
        });
        expect(rule[6], 'HighLife must add birth on 6').toBe(1);

        // a rule that cannot parse must be flagged and must NOT change the universe
        await page.locator('#life-rule-input').fill('nonsense');
        await expect(page.locator('#life-rule-input')).toHaveClass(/invalid/);
        const still = await lp(page, () => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            return Array.from(pm._lifePage.sims.conway.birth);
        });
        expect(still, 'a bad rule must keep the previous universe').toEqual(rule);
    });

    test('every Lenia control reaches the simulation', async ({ page }) => {
        await boot(page, '#life');
        expect((await state(page)).mode).toBe('lenia');

        await setRange(page, 'life-mu', 0.25);
        expect((await state(page)).mu).toBeCloseTo(0.25, 4);
        await setRange(page, 'life-sigma', 0.04);
        expect((await state(page)).sigma).toBeCloseTo(0.04, 4);
        await setRange(page, 'life-kmu', 0.7);
        expect((await state(page)).kmu).toBeCloseTo(0.70, 3);
        await setRange(page, 'life-dt', 0.3);
        expect((await state(page)).dt).toBeCloseTo(0.30, 3);

        await setRange(page, 'life-volume', 72);
        expect((await state(page)).volume).toBeCloseTo(0.72, 3);
        await expect(page.locator('#life-volume-out')).toHaveText('72%');
    });

    test('mode switch shows the right controls for each simulation', async ({ page }) => {
        await boot(page, '#conway');
        await expect(page.locator('#pick-density-wrap')).toBeVisible();
        await expect(page.locator('#pick-sigma-wrap')).toBeHidden();

        await page.locator('#mode-lenia').click();
        await expect(page.locator('#pick-sigma-wrap')).toBeVisible();
        await expect(page.locator('#pick-kmu-wrap')).toBeVisible();
        await expect(page.locator('#pick-dt-wrap')).toBeVisible();
        await expect(page.locator('#pick-vol-wrap')).toBeVisible();
        await expect(page.locator('#pick-density-wrap')).toBeHidden();
        await expect(page.locator('#pick-pattern-wrap')).toBeHidden();
    });

    test('custom colour swatches reach the shader and reset restores the preset', async ({ page }) => {
        await boot(page, '#conway');
        await page.locator('#colour-wrap > summary').click();

        await page.evaluate(() => { const e = document.getElementById('life-col-high'); e.value = '#00ff00'; e.dispatchEvent(new Event('input', { bubbles: true })); });
        const custom = await state(page);
        expect(custom.stops.high, 'swatch must reach the uniform').toBe('#00ff00');
        expect(custom.palette, 'editing a stop marks the palette custom').toBe('custom');

        await page.locator('#life-col-reset').click();
        const back = await state(page);
        expect(back.stops.high, 'reset must restore a preset stop').not.toBe('#00ff00');
        expect(back.palette).not.toBe('custom');
    });

    test('preset palettes update the swatches so they agree', async ({ page }) => {
        await boot(page, '#conway');
        await page.selectOption('#life-palette', 'ice');
        const s = await state(page);
        const swatch = await page.locator('#life-col-high').inputValue();
        expect(swatch, 'swatch must show what the preset actually set').toBe(s.stops.high);
    });

    test('zoom, pan and reset all move the view', async ({ page }) => {
        await boot(page, '#conway');
        await page.locator('#life-zoom-in').click();
        await page.locator('#life-zoom-in').click();
        const z = (await state(page)).zoom;
        expect(z, 'two zoom-ins').toBeGreaterThan(1);

        await page.locator('#tool-pan').click();
        // Clicking controls below the canvas scrolls it; drag coordinates are useless if
        // the canvas is off-screen. Same lesson the draw test already learned.
        await page.locator('#life-canvas').scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        const box = await page.locator('#life-canvas').boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 6 });
        await page.mouse.up();
        const panned = await lp(page, () => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            return pm._lifePage.view.panX;
        });
        expect(Math.abs(panned), 'dragging must pan the view').toBeGreaterThan(0);

        await page.locator('#life-zoom-reset').click();
        const r = await state(page);
        expect(r.zoom).toBe(1);
        const pan = await lp(page, () => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            const v = pm._lifePage.view; return [v.panX, v.panY];
        });
        expect(pan, 'reset must recentre').toEqual([0, 0]);
    });

    test('erase removes cells that draw created', async ({ page }) => {
        await boot(page, '#conway');
        await page.locator('#life-pause').click();
        await page.locator('#life-clear').click();

        const count = () => lp(page, () => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            const b = pm._lifePage.sims.conway.readPixels();
            let n = 0; for (let i = 0; i < b.length; i += 4) if (b[i] > 127) n++;
            return n;
        });

        await page.locator('#tool-draw').click();
        await page.locator('#life-canvas').scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        let box = await page.locator('#life-canvas').boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 30, { steps: 10 });
        await page.mouse.up();
        const drawn = await count();
        expect(drawn, 'draw must create cells').toBeGreaterThan(0);

        await page.locator('#tool-erase').click();
        await page.locator('#life-canvas').scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        box = await page.locator('#life-canvas').boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 30, { steps: 10 });
        await page.mouse.up();
        expect(await count(), 'erase must remove some of them').toBeLessThan(drawn);
    });
});

test.describe('Projects surface', () => {

    test('only one Life card, and the count matches the cards', async ({ page }) => {
        await page.goto('/#projects');
        await page.waitForTimeout(2500);
        const r = await page.evaluate(() => ({
            cards: document.querySelectorAll('.project-card').length,
            lifeLinks: document.querySelectorAll('a[href="#life"], a[href="#conway"]').length,
            count: (document.getElementById('project-count') || {}).textContent
        }));
        expect(r.lifeLinks, 'exactly one card should open the Life page').toBe(1);
        expect(r.count, 'the count label must match the real number of cards')
            .toContain(String(r.cards));
    });

    test('the Barista game opens AND closes', async ({ page }) => {
        await page.goto('/#projects');
        await page.waitForTimeout(2500);
        await page.locator('[data-game="barista"]').first().click();
        await page.waitForTimeout(3000);

        const opened = await page.evaluate(() => {
            const g = document.getElementById('game-container');
            return g ? getComputedStyle(g).display !== 'none' : false;
        });
        expect(opened, 'game modal should open').toBe(true);

        // The close button must be the top element, not buried under the header — this
        // regressed once already when a z-index on #page-container trapped the modal.
        const top = await page.evaluate(() => {
            const cb = document.querySelector('[data-action="close-game"]');
            const r = cb.getBoundingClientRect();
            const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return t === cb || cb.contains(t) ? 'reachable' : (t.id || t.className || '').toString();
        });
        expect(top, 'close button must not be covered').toBe('reachable');

        await page.locator('[data-action="close-game"]').click();
        await page.waitForTimeout(1200);
        const closed = await page.evaluate(() => {
            const g = document.getElementById('game-container');
            return getComputedStyle(g).display === 'none';
        });
        expect(closed, 'game must actually close').toBe(true);
    });
});

test.describe('Particle Life — the third mode', () => {

    test('particle mode runs and reports its population', async ({ page }) => {
        await boot(page, '#particles');
        const s = await state(page);
        expect(s.mode, '#particles should open the particle sim').toBe('particles');

        await page.waitForFunction(() => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            const p = pm._lifePage.sims.particles;
            return p && p.generation > 3;
        }, null, { timeout: 20000 });

        await expect(page.locator('#life-pop')).toContainText('particles');
        await expect(page.locator('#life-gen')).toContainText('step');
    });

    test('particle controls change the simulation', async ({ page }) => {
        await boot(page, '#particles');
        const sim = () => page.evaluate(() => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            const p = pm._lifePage.sims.particles;
            return { count: p.count, types: p.types, radius: +p.radius.toFixed(4),
                     friction: +p.friction.toFixed(3), forceScale: +p.forceScale.toFixed(3) };
        });

        await setRange(page, 'life-pcount', 3200);
        expect((await sim()).count, 'particle count').toBe(3200);

        await setRange(page, 'life-ptypes', 3);
        expect((await sim()).types, 'species count').toBe(3);

        await setRange(page, 'life-prange', 120);
        expect((await sim()).radius, 'interaction range').toBeCloseTo(0.12, 4);

        await setRange(page, 'life-pfriction', 70);
        expect((await sim()).friction, 'friction').toBeCloseTo(0.70, 3);

        await setRange(page, 'life-pforce', 60);
        expect((await sim()).forceScale, 'force scale').toBeCloseTo(0.60, 3);
    });

    test('the interaction matrix is editable and asymmetric', async ({ page }) => {
        await boot(page, '#particles');
        await expect(page.locator('#matrix-wrap')).toBeVisible();
        await page.locator('#matrix-wrap > summary').click();

        // One cell per ORDERED pair, so N species give N*N cells plus N+1 headers.
        const cells = await page.locator('#life-matrix .lm-cell').count();
        const types = (await state(page)).mode === 'particles'
            ? await page.evaluate(() => {
                const pm = window.pageManager || (window.app && window.app.pageManager);
                return pm._lifePage.sims.particles.types;
            }) : 0;
        expect(cells, 'a cell for every ordered species pair').toBe(types * types);

        // Editing one cell must reach the matrix, and must NOT change its mirror.
        const read = (a, b) => page.evaluate(({ a, b }) => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            return +pm._lifePage.sims.particles.getForce(a, b).toFixed(3);
        }, { a, b });
        const mirrorBefore = await read(1, 0);
        await page.evaluate(() => {
            const c = document.querySelectorAll('#life-matrix .lm-cell')[1];   // row 0, col 1
            c.value = '85';
            c.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(await read(0, 1), 'edit reaches the matrix').toBeCloseTo(0.85, 2);
        expect(await read(1, 0), 'the mirror must be untouched — the matrix is asymmetric')
            .toBeCloseTo(mirrorBefore, 3);

        // Make mutual must then mirror it.
        await page.locator('#matrix-symmetric').click();
        expect(await read(1, 0), 'symmetrise mirrors the upper triangle').toBeCloseTo(0.85, 2);
    });

    test('switching modes keeps all three simulations alive', async ({ page }) => {
        await boot(page, '#conway');
        await page.locator('#mode-particles').click();
        await page.waitForTimeout(800);
        await page.locator('#mode-lenia').click();
        await page.waitForTimeout(800);
        const alive = await page.evaluate(() => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            const p = pm._lifePage;
            return { conway: !!p.sims.conway, lenia: !!p.sims.lenia, particles: !!p.sims.particles, mode: p.mode };
        });
        expect(alive).toEqual({ conway: true, lenia: true, particles: true, mode: 'lenia' });
    });

    test('cleanup disposes all three', async ({ page }) => {
        await boot(page, '#particles');
        const r = await page.evaluate(() => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            const p = pm._lifePage;
            const had = { c: !!p.sims.conway, l: !!p.sims.lenia, p: !!p.sims.particles };
            p.cleanup();
            return { had, after: { c: p.sims.conway, l: p.sims.lenia, p: p.sims.particles, r: p.renderer } };
        });
        expect(r.had).toEqual({ c: true, l: true, p: true });
        expect(r.after).toEqual({ c: null, l: null, p: null, r: null });
    });
});

test.describe('Density regulation — the control CodeNoodles calls the most important', () => {
    test('the toggle and both sliders reach the simulation', async ({ page }) => {
        await boot(page, '#particles');

        const read = () => page.evaluate(() => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            const s = pm._lifePage.sims.particles;
            return { on: s.densityRegulation, target: s.densityTarget, strength: s.densityStrength };
        });

        // Defaults come from measurement, not taste — see verify-particles.cjs.
        expect(await read()).toEqual({ on: true, target: 4, strength: 0.25 });

        // The matrix section is a <details>; its contents are not interactable closed.
        await page.evaluate(() => {
            const d = document.getElementById('matrix-wrap');
            if (d) d.open = true;
        });

        await page.locator('#pl-density').uncheck();
        expect((await read()).on, 'toggle switches it off').toBe(false);
        await page.locator('#pl-density').check();
        expect((await read()).on, 'and back on').toBe(true);

        // Ranges need a real input event; fill() does not dispatch one for stepped ranges.
        await page.evaluate(() => {
            const set = (id, v) => {
                const el = document.getElementById(id);
                el.value = String(v);
                el.dispatchEvent(new Event('input', { bubbles: true }));
            };
            set('pl-dens-target', 12);
            set('pl-dens-strength', 1.5);
        });
        const after = await read();
        expect(after.target, 'tolerance slider').toBe(12);
        expect(after.strength, 'firmness slider').toBe(1.5);
        expect(await page.locator('#pl-dens-target-val').textContent()).toBe('12');
        expect(await page.locator('#pl-dens-strength-val').textContent()).toBe('1.50');
    });

    test('turning it off measurably changes how the field settles', async ({ page }) => {
        await boot(page, '#particles');

        // Same seed, same matrix, 400 steps each way. Self-attraction only, which is the
        // case that segregates into single-colour balls — the failure the rule prevents.
        const run = (regulation) => page.evaluate((reg) => {
            const pm = window.pageManager || (window.app && window.app.pageManager);
            const s = pm._lifePage.sims.particles;
            s.densityRegulation = reg;
            s.seed(1200, 3);
            for (let a = 0; a < 6; a++)
                for (let b = 0; b < 6; b++) s.setForce(a, b, a === b ? 1 : 0);
            for (let i = 0; i < 400; i++) s.step();
            let peak = -Infinity;
            for (let i = 0; i < s.count; i++) if (s._density[i] > peak) peak = s._density[i];
            return peak;
        }, regulation);

        const off = await run(false);
        const on = await run(true);
        expect(off, 'unregulated field piles up past the threshold').toBeGreaterThan(10);
        expect(on, 'regulated field stays lower').toBeLessThan(off);
    });
});
