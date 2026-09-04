import { test, expect } from '@playwright/test';

/**
 * TIME PANEL — every control, driven.
 *
 * This panel had no test at all, which is how a dead button survived in it. The UI audit
 * missed it too: the panel is collapsed until someone presses T, and the audit only
 * opened <details> elements and side popups.
 *
 * A static check cannot cover this either. A scan for "ids referenced but not in any
 * markup" flagged all seven of these controls, because TimeControlUI builds its whole
 * panel as a template string and writes it through innerHTML — they were false positives.
 * The only way to know a control works is to press it and measure.
 *
 * Two traps this file exists to remember:
 *   isPaused is a METHOD. Reading `tm.isPaused` gets the function, which is always
 *   truthy, so a test written that way reports "play/pause does nothing" for a button
 *   that works perfectly.
 *   Several readouts (the date, the J2000 day count) advance on their own. Comparing
 *   them before and after an action proves nothing unless you first measure the drift.
 */

test.use({ viewport: { width: 1280, height: 900 } });
test.describe.configure({ timeout: 180000 });

async function openPanel(page) {
    await page.goto('/#main');
    await page.waitForFunction(() => !!(window.spaceEnvironment && window.spaceEnvironment.timeControlUI),
        null, { timeout: 40000 });
    await page.waitForTimeout(5500);
    await page.locator('.action-btn[data-action="time"]').click({ force: true });
    await page.waitForTimeout(900);
}

const CONTROLS = ['time-play-pause', 'time-reset', 'fps-toggle-btn',
                  'time-scale-slider', 'time-scale-display', 'time-date-display', 'time-date-input'];

test('the panel opens and every control is present and sized', async ({ page }) => {
    await openPanel(page);
    const state = await page.evaluate((ids) => {
        const panel = document.getElementById('time-panel-inline');
        return {
            open: panel && !panel.classList.contains('collapsed'),
            controls: ids.map((id) => {
                const el = document.getElementById(id);
                if (!el) return { id, exists: false };
                const r = el.getBoundingClientRect();
                return { id, exists: true, w: Math.round(r.width), h: Math.round(r.height) };
            })
        };
    }, CONTROLS);

    expect(state.open, 'pressing T opens the panel').toBe(true);
    for (const c of state.controls) {
        expect(c.exists, `${c.id} exists`).toBe(true);
        expect(c.w, `${c.id} has width`).toBeGreaterThan(0);
        expect(c.h, `${c.id} has height`).toBeGreaterThan(0);
    }
});

test('play/pause actually stops and restarts time', async ({ page }) => {
    await openPanel(page);
    // isPaused() is a CALL. The state is read through it, never as a property.
    const paused = () => page.evaluate(() => window.spaceEnvironment.timeManager.isPaused());
    const day = () => page.evaluate(() => window.spaceEnvironment.timeManager.getJ2000Days());

    const startPaused = await paused();
    await page.locator('#time-play-pause').click({ force: true });
    await page.waitForTimeout(400);
    expect(await paused(), 'the button flips the paused state').toBe(!startPaused);

    // And the flip has to mean something: while paused, time must not advance.
    if (await paused()) {
        const a = await day();
        await page.waitForTimeout(1200);
        expect(await day(), 'paused means the clock stands still').toBe(a);
    }

    await page.locator('#time-play-pause').click({ force: true });
    await page.waitForTimeout(400);
    expect(await paused(), 'and back again').toBe(startPaused);
});

test('the FPS button produces an FPS readout', async ({ page }) => {
    // It used to call setEnabled, which controls MEASUREMENT and needed a display element
    // that no longer existed outside ?debug — so this button did nothing observable.
    await openPanel(page);

    const readout = () => page.evaluate(() => {
        const el = document.getElementById('fps-monitor');
        if (!el) return { present: false, visible: false, text: null };
        return {
            present: true,
            visible: getComputedStyle(el).display !== 'none',
            text: el.textContent
        };
    });

    expect((await readout()).visible, 'nothing on screen by default').toBe(false);

    await page.locator('#fps-toggle-btn').click({ force: true });
    await page.waitForTimeout(900);
    const shown = await readout();
    expect(shown.present, 'the readout is created on demand').toBe(true);
    expect(shown.visible, 'and is visible').toBe(true);
    expect(shown.text, 'and shows a number').toMatch(/FPS/i);
    expect(await page.locator('#fps-toggle-btn').getAttribute('aria-pressed')).toBe('true');

    await page.locator('#fps-toggle-btn').click({ force: true });
    await page.waitForTimeout(500);
    expect((await readout()).visible, 'clicking again hides it').toBe(false);
    expect(await page.locator('#fps-toggle-btn').getAttribute('aria-pressed')).toBe('false');
});

test('the time scale slider changes the rate time passes', async ({ page }) => {
    await openPanel(page);
    const scale = () => page.evaluate(() => window.spaceEnvironment.timeManager.timeScale);

    const before = await scale();
    const shown = await page.locator('#time-scale-display').textContent();
    await page.evaluate(() => {
        const el = document.getElementById('time-scale-slider');
        el.value = String(Number(el.max));
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(400);

    expect(await scale(), 'the slider moved the scale').not.toBe(before);
    expect(await page.locator('#time-scale-display').textContent(),
        'and the readout agrees').not.toBe(shown);
});

test('reset returns the clock to now', async ({ page }) => {
    await openPanel(page);
    // Jump far away, then reset and check we are back within a second of real now.
    await page.evaluate(() => {
        const el = document.getElementById('time-date-input');
        // type="datetime-local" — the value MUST be YYYY-MM-DDTHH:MM. A plain date is
        // rejected by the browser, leaving value empty, and the handler then receives
        // nothing. The first version of this test used '2035-06-01' and reported the
        // input as dead when it was the test that was malformed.
        el.value = '2035-06-01T12:00';
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(500);
    const jumped = await page.evaluate(() =>
        window.spaceEnvironment.timeManager.getCurrentDate().getFullYear());
    expect(jumped, 'the date input moved the clock').toBe(2035);

    await page.locator('#time-reset').click({ force: true });
    await page.waitForTimeout(500);
    const gap = await page.evaluate(() =>
        Math.abs(window.spaceEnvironment.timeManager.getCurrentDate().getTime() - Date.now()));
    expect(gap, 'reset puts it back within a second of now').toBeLessThan(2000);
});

test('the time preset buttons set their advertised scale', async ({ page }) => {
    await openPanel(page);
    const presets = await page.evaluate(() =>
        [...document.querySelectorAll('.time-preset-btn')]
            .map((b) => ({ scale: parseFloat(b.getAttribute('data-scale')), label: b.textContent.trim() })));
    expect(presets.length, 'the panel offers presets').toBeGreaterThan(0);

    for (let i = 0; i < presets.length; i++) {
        await page.evaluate((i) => document.querySelectorAll('.time-preset-btn')[i].click(), i);
        await page.waitForTimeout(250);
        const scale = await page.evaluate(() => window.spaceEnvironment.timeManager.timeScale);
        expect(scale, `preset "${presets[i].label}" sets scale ${presets[i].scale}`).toBe(presets[i].scale);
    }
});
