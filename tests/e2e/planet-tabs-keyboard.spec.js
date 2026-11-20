import { test, expect } from '@playwright/test';

/**
 * Planet chips are one tablist with a roving tabindex (roast R3 #14).
 *
 * The 9 chips used to be 9 separate Tab stops. Now only the selected chip is in the Tab
 * order; ArrowRight / ArrowLeft / Home / End move focus between chips without flying the
 * camera (manual activation); Enter selects, and the Tab stop follows the selection.
 */

test.use({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
test.setTimeout(90000);

test('planet chips: one Tab stop, arrows move focus, Enter selects', async ({ page }) => {
    await page.goto('/#main');
    await page.waitForFunction(() => !!(window.spaceEnvironment && window.spaceEnvironment.camera), null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    const tabs = page.locator('.planet-selector [role="tab"]');
    await expect(tabs).toHaveCount(9);
    const stops = () => tabs.evaluateAll((b) => b.filter((x) => x.tabIndex >= 0).map((x) => x.id));
    expect(await stops()).toEqual(['tab-Sun']);

    await page.locator('#tab-Sun').focus();
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('tab-Mercury');
    await expect(page.locator('#tab-Sun')).toHaveAttribute('aria-selected', 'true');   // focus only
    await page.keyboard.press('End');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('tab-Neptune');
    await page.keyboard.press('ArrowRight');                                          // wraps
    expect(await page.evaluate(() => document.activeElement.id)).toBe('tab-Sun');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('tab-Uranus');
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('tab-Earth');
    await page.keyboard.press('Enter');
    await expect(page.locator('#tab-Earth')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#tab-Sun')).toHaveAttribute('aria-selected', 'false');
    expect(await stops()).toEqual(['tab-Earth']);
});
