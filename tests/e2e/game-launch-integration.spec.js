import { test, expect } from '@playwright/test';

/**
 * Game Launch Integration Tests
 * Verifies clicking Play Game in portfolio actually launches games.
 * All three games (barista, snake, tictactoe) are multi-repo spokes, embedded
 * via <iframe> - see PageManager.launchExternalGame() / ProjectsPageManager
 * .launchExternalGame(). These tests only check the local wrapper (modal opens,
 * iframe frame is injected) - they don't assert on the external site's content.
 */

test.describe('Game Launch from Portfolio', () => {

    test.beforeEach(async ({ page }) => {
        // Navigate to portfolio and wait for it to load
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Navigate to projects page
        await page.click('a[href="#projects"]');
        await page.waitForTimeout(1000);

        // Switch off the default "Featured" filter (3 of 7 projects) so every
        // game's button is present - Snake/TicTacToe aren't featured and their
        // buttons stay hidden/undiscoverable under the default filter.
        await page.click('#current-filter-btn');
        await page.click('.inline-filter-btn[data-category="all"]');
        await page.waitForTimeout(500);
    });

    for (const gameType of ['barista', 'snake', 'tictactoe']) {
        test(`${gameType} game launches when Play Game clicked`, async ({ page }) => {
            const btn = page.locator(`[data-game="${gameType}"]`);
            await btn.scrollIntoViewIfNeeded();
            await btn.click({ force: true });

            // Wait for game modal to open
            await page.waitForTimeout(2000);

            // Verify game container is visible
            const gameContainer = page.locator('#game-container');
            await expect(gameContainer).toHaveClass(/active/);

            // Verify the external-game iframe frame was injected
            const frame = page.locator('#game-content .external-game-frame iframe');
            await expect(frame).toBeAttached();
        });
    }

    test('Game closes when close button clicked', async ({ page }) => {
        const snakeBtn = page.locator('[data-game="snake"]');
        await snakeBtn.scrollIntoViewIfNeeded();
        await snakeBtn.click({ force: true });
        await page.waitForTimeout(2000);

        const closeBtn = page.locator('[data-action="close-game"]');
        await closeBtn.click();
        await page.waitForTimeout(500);

        const gameContainer = page.locator('#game-container');
        await expect(gameContainer).not.toHaveClass(/active/);
    });

    test('Game closes when Escape pressed', async ({ page }) => {
        const tttBtn = page.locator('[data-game="tictactoe"]');
        await tttBtn.scrollIntoViewIfNeeded();
        await tttBtn.click({ force: true });
        await page.waitForTimeout(2000);

        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        const gameContainer = page.locator('#game-container');
        await expect(gameContainer).not.toHaveClass(/active/);
    });
});
