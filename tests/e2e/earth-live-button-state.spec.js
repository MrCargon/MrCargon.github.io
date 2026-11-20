import { test, expect } from '@playwright/test';

/**
 * The Live tab's toggle buttons show their on-state (roast R3 #14).
 *
 * "Show demo visitors" used to look the same on and off: only aria-pressed changed. Now a
 * pressed .ep-btn gets the filled switch style and a decorative " · on" tag, while its
 * accessible name stays the same (a toggle's name must not flip). The mouse is moved away
 * first so the hover colour cannot pass for the on-state.
 */

test.use({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
test.setTimeout(90000);

test('Live tab: visitors button looks pressed when on, name unchanged', async ({ page }) => {
    for (const h of ['earthquake.usgs.gov', 'api.wheretheiss.at', 'celestrak.org', 'services.swpc.noaa.gov']) {
        await page.route('**' + h + '/**', (r) => r.abort('connectionrefused'));
    }
    await page.goto('/#main');
    await page.waitForFunction(() => {
        const se = window.spaceEnvironment;
        const e = se && se.getEarthObject && se.getEarthObject();
        return !!(e && e.mesh);
    }, null, { timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
        const se = window.spaceEnvironment;
        if (se.selectPlanet) se.selectPlanet('Earth');
        se.enterExploreMode();
    });
    await expect(page.locator('#ep-tab-presence')).toBeVisible({ timeout: 20000 });
    await page.locator('#ep-tab-presence').click();
    const btn = page.locator('#explore-toggle-presence');
    await expect(btn).toBeVisible();
    const look = () => btn.evaluate((b) => {
        const cs = getComputedStyle(b), after = getComputedStyle(b, '::after');
        return { bg: cs.backgroundColor, after: after.content };
    });
    await page.mouse.move(5, 400);
    const nameOff = await btn.evaluate((b) => b.innerText.trim());
    const off = await look();
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.move(5, 400);
    await page.waitForTimeout(400);                       // past the .ep-btn transition
    const on = await look();
    console.log('live button', JSON.stringify({ off, on }));
    expect(on.bg).not.toBe(off.bg);
    expect(on.after).toContain('on');
    expect(off.after === 'none' || off.after === 'normal').toBe(true);
    expect(await btn.evaluate((b) => b.innerText.trim())).toContain(nameOff);
});
