import { test, expect } from '@playwright/test';

/**
 * Earth atmosphere layers: the five layers are ONE banded shell (one draw call), and
 * their names form a ladder beside the limb that never overlaps itself, the nav bar,
 * the footer or the Explore panel, and goes away when the shell fades out up close.
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

const place = (page, k) => page.evaluate((k) => {
    const se = window.spaceEnvironment, e = se.getEarthObject();
    const p = e.getMesh().getWorldPosition(new THREE.Vector3());
    const dir = se.camera.position.clone().sub(p).normalize();
    se.camera.position.copy(p).addScaledVector(dir, e.data.radius * k);
    se.controls.target.copy(p); se.controls.update();
}, k);

const ladder = (page) => page.evaluate(() => {
    const vis = (el) => {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return null;
        const b = el.getBoundingClientRect();
        return b.width > 0 ? { x: b.x, y: b.y, w: b.width, h: b.height } : null;
    };
    const labels = Array.from(document.querySelectorAll('.atmo-label')).map(vis).filter(Boolean);
    const avoid = Array.from(document.querySelectorAll(
        '#header-container > *, #footer-container > *, #explore-panel, .planet-selector-wrapper, .action-buttons-row'
    )).map(vis).filter(Boolean);
    const ov = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    let self = 0, chrome = 0, off = 0;
    for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) if (ov(labels[i], labels[j])) self++;
        for (const o of avoid) if (ov(labels[i], o)) chrome++;
        const L = labels[i];
        if (L.x < 0 || L.y < 0 || L.x + L.w > innerWidth || L.y + L.h > innerHeight) off++;
    }
    const al = window.spaceEnvironment.getEarthObject().atmosphereLayers;
    const meshes = new Set(al.shells.map((s) => s.mesh));
    return { shown: labels.length, total: document.querySelectorAll('.atmo-label').length,
        self, chrome, off, meshes: meshes.size, meshVisible: !!(al.mesh && al.mesh.visible) };
});

test('five layers draw as one shell; the ladder never overlaps', async ({ page }) => {
    await enterExplore(page);
    for (const k of [6, 3, 1.8]) {
        await place(page, k);
        await page.waitForTimeout(1500);
        const r = await ladder(page);
        expect(r.total, 'one label per layer').toBe(5);
        expect(r.meshes, 'all five layers share one mesh').toBe(1);
        expect(r.meshVisible, `shell visible at ${k}R`).toBe(true);
        expect(r.self, `labels overlap each other at ${k}R`).toBe(0);
        expect(r.chrome, `labels cover nav/panel at ${k}R`).toBe(0);
        expect(r.off, `labels off screen at ${k}R`).toBe(0);
        expect([0, 5]).toContain(r.shown);           // all or nothing, never a partial pile
    }
    await place(page, 1.3);                          // faded out up close
    await page.waitForTimeout(1500);
    const near = await ladder(page);
    expect(near.shown).toBe(0);
    expect(near.meshVisible).toBe(false);
});

test('labels carry each layer\'s altitude and note', async ({ page }) => {
    await enterExplore(page);
    const info = await page.evaluate(() => Array.from(document.querySelectorAll('.atmo-label'))
        .map((el) => el.getAttribute('aria-label')));
    expect(info).toHaveLength(5);
    expect(info[0]).toMatch(/^Troposphere, 0.12 km/);
    expect(info[4]).toMatch(/^Exosphere/);
});

// R3 #10: the five labels used to be five Tab stops BEFORE the Explore panel. Now the
// panel comes right after the nav/credits, the ladder is one stop after it, and the
// arrow keys (plus Home/End) reach every label, each still showing its note on focus.
// R3 #9a (P30): the globe canvas is one more stop, right after the ladder.
test('Tab reaches the panel before the ladder; arrows walk all five labels', async ({ page }) => {
    await enterExplore(page);
    await place(page, 3);
    await page.waitForTimeout(2000);
    await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
    const walk = [];
    for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        walk.push(await page.evaluate(() => {
            const a = document.activeElement;
            if (!a || a === document.body) return 'BODY';
            if (a.classList.contains('atmo-label')) return 'atmo';
            if (a === window.spaceEnvironment.renderer.domElement) return 'canvas';
            if (a.closest('#explore-detail')) return 'card';   // the intro/detail card's ✕, while shown
            if (a.closest('#explore-panel')) return 'panel';
            if (a.closest('#header-container, #footer-container')) return 'chrome';
            return 'other';
        }));
        if (walk[walk.length - 1] === 'BODY') break;
    }
    const firstPanel = walk.indexOf('panel'), firstAtmo = walk.indexOf('atmo');
    expect(firstPanel, 'panel reachable by Tab').toBeGreaterThan(0);
    expect(walk.slice(0, firstPanel).every((w) => w === 'chrome'), walk.join(',')).toBe(true);
    expect(walk.filter((w) => w === 'atmo'), 'the ladder is ONE Tab stop').toHaveLength(1);
    expect(firstAtmo, 'ladder comes after the panel').toBeGreaterThan(walk.lastIndexOf('panel'));
    expect(walk.filter((w) => w === 'canvas'), 'the globe is ONE Tab stop').toHaveLength(1);
    // After the ladder: the card's ✕ when a card is open, then the globe, then the end of the page.
    expect(walk.slice(firstAtmo + 1, walk.indexOf('canvas')).every((w) => w === 'card'),
        'only the open card sits between the ladder and the globe: ' + walk.join(',')).toBe(true);
    expect(walk.indexOf('canvas'), 'the globe comes after the ladder').toBeGreaterThan(firstAtmo);
    expect(walk[walk.indexOf('canvas') + 1], 'the globe is the last stop').toBe('BODY');

    // Land on the ladder, then walk it with the arrow keys.
    await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
    for (let i = 0; i <= firstAtmo; i++) await page.keyboard.press('Tab');
    const here = () => page.evaluate(() => {
        const a = document.activeElement;
        return { label: a.getAttribute('aria-label') || '', note: getComputedStyle(a.lastChild).display,
            stops: Array.from(document.querySelectorAll('.atmo-label')).filter((l) => l.tabIndex === 0).length };
    });
    const seen = [];
    let r = await here();
    seen.push(r.label.split(',')[0]);
    expect(r.note, 'focus shows the note').toBe('inline');
    for (let i = 0; i < 4; i++) {
        await page.keyboard.press('ArrowUp');
        r = await here();
        seen.push(r.label.split(',')[0]);
        expect(r.note).toBe('inline');
        expect(r.stops, 'roving: exactly one label is tabbable').toBe(1);
    }
    expect(seen).toEqual(['Troposphere', 'Stratosphere', 'Mesosphere', 'Thermosphere', 'Exosphere']);
    await page.keyboard.press('Home');
    expect((await here()).label).toMatch(/^Troposphere/);
    await page.keyboard.press('End');
    expect((await here()).label).toMatch(/^Exosphere/);
    await page.keyboard.press('ArrowDown');
    expect((await here()).label).toMatch(/^Thermosphere/);
    // Shift+Tab from the ladder goes back into the panel.
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('#explore-panel'))).toBe(true);
});
