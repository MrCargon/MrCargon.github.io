import { test, expect } from '@playwright/test';

/**
 * Simple Game Launch Tests
 */

test.describe('Simple Game Launch', () => {

    test('Snake button exists and is clickable', async ({ page }) => {
        await page.goto('/#projects');
        await page.waitForTimeout(3000);

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
