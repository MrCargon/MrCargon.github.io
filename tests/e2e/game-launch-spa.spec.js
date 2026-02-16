import { test, expect } from '@playwright/test';

/**
 * Game Launch Tests for SPA Portfolio
 */

test.describe('Game Launch in SPA', () => {

    test('Snake game launches from portfolio', async ({ page }) => {
        // Go to portfolio with projects hash
        await page.goto('/#projects');

        // Wait for SPA to load projects content
        await page.waitForSelector('.projects-section', { state: 'visible', timeout: 15000 });
        await page.waitForSelector('[data-game="snake"]', { state: 'visible', timeout: 10000 });

        // Click the snake game button
        await page.click('[data-game="snake"]');

        // Wait for game modal to appear
        await page.waitForSelector('#game-container.active', { timeout: 10000 });

        // Verify game content loaded
        const gameContent = page.locator('#game-content');
        await expect(gameContent).not.toBeEmpty();
    });

    test('TicTacToe game launches from portfolio', async ({ page }) => {
        await page.goto('/#projects');
        await page.waitForSelector('.projects-section', { state: 'visible', timeout: 15000 });
        await page.waitForSelector('[data-game="tictactoe"]', { state: 'visible', timeout: 10000 });

        await page.click('[data-game="tictactoe"]');
        await page.waitForSelector('#game-container.active', { timeout: 10000 });

        const gameContent = page.locator('#game-content');
        await expect(gameContent).not.toBeEmpty();
    });

});
