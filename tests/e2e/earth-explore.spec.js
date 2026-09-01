import { test, expect } from '@playwright/test';

/**
 * Earth Explore — real interaction, not scripted camera moves.
 *
 * Zoom is driven with actual wheel events so OrbitControls handles them the way it does
 * for a person; moving the camera in code would skip the whole input path and prove
 * nothing about whether scrolling works.
 */

test.use({ viewport: { width: 1280, height: 900 } });

async function bootMain(page) {
    await page.goto('/#main');
    await page.waitForFunction(() => !!(window.spaceEnvironment && window.spaceEnvironment.camera),
        null, { timeout: 40000 });
    await page.waitForTimeout(7000);           // scene + Earth build
}

const rr = (page) => page.evaluate(() => {
    const se = window.spaceEnvironment;
    const e = se.getEarthObject && se.getEarthObject();
    if (!e) return null;
    const R = (e.data && e.data.radius) || 2;
    const p = e.getMesh().getWorldPosition(new window.THREE.Vector3());
    return +(se.camera.position.distanceTo(p) / R).toFixed(4);
});

const probe = (page) => page.evaluate(() => {
    const q = (id) => {
        const el = document.getElementById(id);
        if (!el) return { present: false };
        const r = el.getBoundingClientRect();
        return { present: true, onScreen: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight };
    };
    const se = window.spaceEnvironment;
    return { button: q('explore-enter-btn'), panel: q('explore-panel'),
             exploreMode: !!(se && se.exploreMode), backgroundMode: !!(se && se.backgroundMode) };
});

test('scroll wheel actually zooms in and out', async ({ page }) => {
    await bootMain(page);
    const entered = await page.evaluate(() => {
        const se = window.spaceEnvironment;
        if (typeof se.selectPlanet === 'function') se.selectPlanet('Earth');
        return typeof se.enterExploreMode === 'function' ? se.enterExploreMode() : false;
    });
    expect(entered, 'should enter explore mode').toBeTruthy();
    await page.waitForTimeout(2500);

    const start = await rr(page);
    expect(start, 'explore should frame Earth a few radii out').toBeGreaterThan(1.0);

    // Zoom IN with the wheel, over the middle of the canvas.
    await page.mouse.move(640, 450);
    for (let i = 0; i < 16; i++) {
        await page.mouse.wheel(0, -240);
        await page.waitForTimeout(120);
    }
    await page.waitForTimeout(1500);
    const zoomedIn = await rr(page);
    expect(zoomedIn, `wheel-in must reduce distance (was ${start})`).toBeLessThan(start);

    // And back OUT again.
    for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, 240);
        await page.waitForTimeout(120);
    }
    await page.waitForTimeout(1500);
    const zoomedOut = await rr(page);
    expect(zoomedOut, `wheel-out must increase distance (was ${zoomedIn})`).toBeGreaterThan(zoomedIn);

    // Never through the surface, never past the leash.
    expect(zoomedIn, 'must not tunnel inside the globe').toBeGreaterThan(1.0);
    console.log(`WHEEL start=${start} in=${zoomedIn} out=${zoomedOut}`);
});

test('the Explore Earth button does not follow you to other pages', async ({ page }) => {
    await bootMain(page);

    // Select Earth but DO NOT explore — this is the case that leaked.
    await page.evaluate(() => {
        const se = window.spaceEnvironment;
        if (typeof se.selectPlanet === 'function') se.selectPlanet('Earth');
        else se.selectedPlanet = 'Earth';
        if (typeof se._updateExploreButton === 'function') se._updateExploreButton();
    });
    await page.waitForTimeout(2500);
    expect((await probe(page)).button.onScreen, 'button should show on Main with Earth selected').toBe(true);

    await page.locator('a[href="#projects"]').first().click();
    await page.waitForTimeout(4000);
    const after = await probe(page);
    expect(after.button.onScreen, 'button must be gone on another page').toBe(false);
    expect(after.backgroundMode, 'leaving Main must put the scene in background mode').toBe(true);
});

test('leaving mid-explore exits explore and takes the panel with it', async ({ page }) => {
    await bootMain(page);
    await page.evaluate(() => {
        const se = window.spaceEnvironment;
        if (typeof se.selectPlanet === 'function') se.selectPlanet('Earth');
        if (typeof se.enterExploreMode === 'function') se.enterExploreMode();
    });
    await page.waitForTimeout(2500);
    expect((await probe(page)).exploreMode, 'should be exploring').toBe(true);

    await page.locator('a[href="#about"]').first().click({ force: true });
    await page.waitForTimeout(4000);
    const after = await probe(page);
    expect(after.exploreMode, 'navigating away must exit explore').toBe(false);
    expect(after.panel.onScreen, 'panel must not remain on the new page').toBe(false);
    expect(after.button.onScreen, 'button must not remain either').toBe(false);
});
