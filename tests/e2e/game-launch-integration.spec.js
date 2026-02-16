import { test, expect } from '@playwright/test';

/**
 * Game Launch Integration Tests
 * Verifies clicking Play Game in portfolio actually launches games
 */

test.describe('Game Launch from Portfolio', () => {

    test.beforeEach(async ({ page }) => {
        // Navigate to portfolio and wait for it to load
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Navigate to projects page
        await page.click('a[href="#projects"]');
        await page.waitForTimeout(1000);
    });

    test('Snake game launches when Play Game clicked', async ({ page }) => {
        // Find and click the Snake game launch button
        const snakeBtn = page.locator('[data-game="snake"]');
        await snakeBtn.scrollIntoViewIfNeeded();
        await snakeBtn.click({ force: true });

        // Wait for game modal to open
        await page.waitForTimeout(2000);

        // Verify game container is visible
        const gameContainer = page.locator('#game-container');
        await expect(gameContainer).toHaveClass(/active/);

        // Verify game content loaded (snake welcome screen)
        const gameContent = page.locator('#game-content');
        const hasContent = await gameContent.evaluate(el => el.innerHTML.length > 0);
        expect(hasContent).toBeTruthy();
    });

    test('TicTacToe game launches when Play Game clicked', async ({ page }) => {
        // Find and click the TicTacToe game launch button
        const tttBtn = page.locator('[data-game="tictactoe"]');
        await tttBtn.scrollIntoViewIfNeeded();
        await tttBtn.click({ force: true });

        // Wait for game modal to open
        await page.waitForTimeout(2000);

        // Verify game container is visible
        const gameContainer = page.locator('#game-container');
        await expect(gameContainer).toHaveClass(/active/);

        // Verify game content loaded
        const gameContent = page.locator('#game-content');
        const hasContent = await gameContent.evaluate(el => el.innerHTML.length > 0);
        expect(hasContent).toBeTruthy();
    });

    test('Game closes when close button clicked', async ({ page }) => {
        // Launch snake game
        const snakeBtn = page.locator('[data-game="snake"]');
        await snakeBtn.scrollIntoViewIfNeeded();
        await snakeBtn.click({ force: true });
        await page.waitForTimeout(2000);

        // Click close button
        const closeBtn = page.locator('[data-action="close-game"]');
        await closeBtn.click();

        // Wait for close animation
        await page.waitForTimeout(500);

        // Verify game container is not active
        const gameContainer = page.locator('#game-container');
        await expect(gameContainer).not.toHaveClass(/active/);
    });

    test('Game closes when Escape pressed', async ({ page }) => {
        // Launch tictactoe game
        const tttBtn = page.locator('[data-game="tictactoe"]');
        await tttBtn.scrollIntoViewIfNeeded();
        await tttBtn.click({ force: true });
        await page.waitForTimeout(2000);

        // Press Escape
        await page.keyboard.press('Escape');

        // Wait for close animation
        await page.waitForTimeout(500);

        // Verify game container is not active
        const gameContainer = page.locator('#game-container');
        await expect(gameContainer).not.toHaveClass(/active/);
    });
});
