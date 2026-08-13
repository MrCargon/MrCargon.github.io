import { test, expect } from '@playwright/test';

/**
 * Simple Game Launch Tests
 *
 * NOTE (2026-08-13): the projects grid defaults to the "Featured" filter (3 of 7
 * projects) - Snake isn't featured, so its button is hidden until the "All"
 * filter is selected. Fixed here after this test was found always-timing-out
 * against `[data-game="snake"]` never becoming visible - a test bug, not a
 * device/browser issue.
 */

test.describe('Simple Game Launch', () => {

    test('Snake button exists and is clickable', async ({ page }) => {
        await page.goto('/#projects');
        await page.waitForTimeout(3000);

        // Switch off the default "Featured" filter so non-featured games show
        await page.click('#current-filter-btn');
        await page.click('.inline-filter-btn[data-category="all"]');
        await page.waitForTimeout(500);

        const snakeBtn = page.locator('[data-game="snake"]').first();
        await snakeBtn.scrollIntoViewIfNeeded();

        // Verify button exists
        const count = await page.locator('[data-game="snake"]').count();
        expect(count).toBeGreaterThan(0);

        // Click it
        await snakeBtn.click({ force: true });
        await page.waitForTimeout(3000);

        // Check if game container became active
        const gameContainer = page.locator('#game-container');
        const isActive = await gameContainer.evaluate(el => el.classList.contains('active'));

        console.log('Game container active:', isActive);
        expect(isActive).toBeTruthy();
    });

});
