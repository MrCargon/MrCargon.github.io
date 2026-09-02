import { test, expect } from '@playwright/test';

/**
 * Scene selection — swapping the site's backdrop between the solar system and the 3D
 * particle field.
 *
 * Everything here goes through the actual buttons. Calling setSceneMode() from
 * page.evaluate would skip the wiring, which is the part most likely to be broken — an
 * earlier bug on this site was exactly that: a mode that worked when invoked directly and
 * did nothing when clicked, because its route was never registered.
 */

test.use({ viewport: { width: 1280, height: 900 } });

async function bootMain(page) {
    await page.goto('/#main');
    await page.waitForFunction(() => !!(window.spaceEnvironment && window.spaceEnvironment.camera),
        null, { timeout: 40000 });
    await page.waitForTimeout(5000);           // scene builds
}

/** Open the camera-controls popup, which is where the Scene switch lives. */
async function openControls(page) {
    const tab = page.locator('#camera-controls-popup .popup-tab');
    if (await tab.count()) await tab.first().click({ force: true });
    await page.waitForTimeout(400);
}

/** Click a scene button and wait out both halves of the fade. */
async function pickScene(page, id) {
    await page.locator('#' + id).click({ force: true });
    await page.waitForTimeout(900);            // 260ms out + swap + 260ms back, with slack
}

const mode = (page) => page.evaluate(() => window.spaceEnvironment?.sceneMode);

test('the particle scene is reachable from the UI and reversible', async ({ page }) => {
    await bootMain(page);
    await openControls(page);

    expect(await mode(page), 'starts on the solar system').toBe('solar');

    await pickScene(page, 'scene-particles');
    expect(await mode(page), 'switches to particles').toBe('particles');

    const built = await page.evaluate(() => {
        const f = window.spaceEnvironment.particleField;
        return f ? { count: f.count, types: f.types, gen: f.generation } : null;
    });
    expect(built, 'the field was actually built').not.toBeNull();
    expect(built.count).toBeGreaterThan(500);

    // It must be RUNNING, not just constructed.
    await page.waitForTimeout(1200);
    const later = await page.evaluate(() => window.spaceEnvironment.particleField.generation);
    expect(later, 'the simulation is stepping').toBeGreaterThan(built.gen);

    await pickScene(page, 'scene-solar');
    expect(await mode(page), 'switches back').toBe('solar');
});

test('solar-only chrome disappears with the solar system and comes back', async ({ page }) => {
    await bootMain(page);
    await openControls(page);

    const visible = (sel) => page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }, sel);

    expect(await visible('.planet-selector-wrapper'), 'planets listed in solar mode').toBe(true);

    await pickScene(page, 'scene-particles');
    expect(await visible('.planet-selector-wrapper'), 'planet list hidden').toBe(false);
    expect(await visible('#time-panel-inline'), 'time panel hidden').toBe(false);
    // The Ctrl action deliberately survives — it is how the popup is reopened.
    expect(await visible('.action-btn[data-action="controls"]'), 'Ctrl stays').toBe(true);
    // And the particle options appear.
    expect(await visible('#scene-particle-options'), 'particle options shown').toBe(true);

    await pickScene(page, 'scene-solar');
    expect(await visible('.planet-selector-wrapper'), 'planet list back').toBe(true);
    expect(await visible('#scene-particle-options'), 'particle options hidden again').toBe(false);
});

test('the Explore Earth button does not survive into the particle scene', async ({ page }) => {
    await bootMain(page);
    // Select Earth so the button is legitimately showing, then switch scenes. This is the
    // same class of leak as the button surviving page navigation: selectedPlanet outlives
    // the thing that justified the button.
    //
    // Clicked, not called. The first version of this used se.selectPlanet('Earth') with
    // optional chaining — and there IS no selectPlanet (the method is focusOnPlanet), so
    // it silently did nothing and the test failed on its own setup.
    await page.locator('#tab-Earth').click({ force: true });
    await page.waitForTimeout(3000);

    const shown = (page_) => page_.evaluate(() => {
        const b = document.getElementById('explore-enter-btn');
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return !b.hidden && r.width > 0 && r.height > 0;
    });
    expect(await shown(page), 'button shows for Earth on the solar backdrop').toBe(true);

    await openControls(page);
    await pickScene(page, 'scene-particles');
    expect(await shown(page), 'button gone over the particle field').toBe(false);

    await pickScene(page, 'scene-solar');
    expect(await shown(page), 'button returns with the solar system').toBe(true);
});

test('the particle options actually change the field', async ({ page }) => {
    await bootMain(page);
    await openControls(page);
    await pickScene(page, 'scene-particles');

    const read = () => page.evaluate(() => {
        const f = window.spaceEnvironment.particleField;
        return { count: f.count, types: f.types, m01: f.getForce(0, 1) };
    });
    const before = await read();

    // Ranges need a real input event, not fill() — the handler listens for 'input'.
    await page.evaluate(() => {
        const set = (id, v) => {
            const el = document.getElementById(id);
            el.value = String(v);
            el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        set('scene-density', 1000);
        set('scene-species', 3);
    });
    await page.waitForTimeout(300);
    const after = await read();
    expect(after.count, 'density slider moved the particle count').toBe(1000);
    expect(after.types, 'species slider moved the species count').toBe(3);
    expect(await page.locator('#scene-density-value').textContent()).toBe('1000');
    expect(await page.locator('#scene-species-value').textContent()).toBe('3');

    // New Rules must produce a different matrix; Reseed must not.
    await page.locator('#scene-rematrix').click({ force: true });
    await page.waitForTimeout(200);
    const rolled = await read();
    expect(rolled.m01, 'new rules changed the relationships').not.toBe(before.m01);

    const beforeSeed = await page.evaluate(() => window.spaceEnvironment.particleField.getForce(0, 1));
    await page.locator('#scene-reseed').click({ force: true });
    await page.waitForTimeout(200);
    const afterSeed = await page.evaluate(() => ({
        m01: window.spaceEnvironment.particleField.getForce(0, 1),
        gen: window.spaceEnvironment.particleField.generation
    }));
    expect(afterSeed.m01, 'reseed keeps the relationships').toBe(beforeSeed);
    expect(afterSeed.gen, 'reseed restarts the clock').toBeLessThan(60);
});

test('the choice survives a reload and a trip to another page', async ({ page }) => {
    // Two full scene boots plus three navigations. It lands at ~22s of the default 30s
    // budget on an idle machine and times out on a busy one, which is a flake, not a
    // finding — the same run passes serially and fails under parallel workers.
    test.setTimeout(90000);
    await bootMain(page);
    await openControls(page);
    await pickScene(page, 'scene-particles');

    await page.reload();
    await page.waitForFunction(() => !!(window.spaceEnvironment && window.spaceEnvironment.camera),
        null, { timeout: 40000 });
    await page.waitForTimeout(4000);
    expect(await mode(page), 'restored on reload').toBe('particles');

    // Navigate away and back: the field keeps running as a background, and the switch
    // still reads the right state on the freshly-rendered controls.
    //
    // Clicked through the header, not page.goto. goto('/#projects') is a full document
    // load, which tears down the SpaceEnvironment and builds a new one — so it tested
    // cold-boot routing, not the in-page navigation this is actually about, and read
    // backgroundMode off an instance that had not finished initialising.
    await page.locator('header a[href="#projects"]').first().click();
    await page.waitForTimeout(2500);
    expect(await mode(page), 'still particles on another page').toBe('particles');
    const bg = await page.evaluate(() => window.spaceEnvironment.backgroundMode);
    expect(bg, 'and it is in background mode there').toBe(true);

    await page.locator('header a[href="#main"]').first().click();
    await page.waitForTimeout(3000);
    const pressed = await page.locator('#scene-particles').getAttribute('aria-pressed');
    expect(pressed, 'the button reflects the live mode after re-render').toBe('true');

    // Leave the machine on the default so a later run starts clean.
    await openControls(page);
    await pickScene(page, 'scene-solar');
    expect(await mode(page)).toBe('solar');
});

test('the solar system stops costing anything while particles are showing', async ({ page }) => {
    await bootMain(page);
    // Watch the solar system's own clock: animate() advances it every frame in solar
    // mode, and must not touch it at all in particle mode.
    const gen = () => page.evaluate(() => {
        const se = window.spaceEnvironment;
        return se.solarSystem && se.solarSystem.getPlanetByName
            ? (se.solarSystem.getPlanetByName('Earth')?.getMesh()?.rotation.y ?? null)
            : null;
    });
    const a = await gen();
    await page.waitForTimeout(1200);
    const b = await gen();
    expect(a, 'solar system is live to begin with').not.toBeNull();

    await openControls(page);
    await pickScene(page, 'scene-particles');
    const c = await gen();
    await page.waitForTimeout(1500);
    const d = await gen();
    expect(d, 'Earth stops rotating — the solar branch is skipped entirely').toBe(c);
    // Sanity: it really was moving before, or the assertion above proves nothing.
    expect(b).not.toBe(a);
});
