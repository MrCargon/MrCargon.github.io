import { test, expect } from '@playwright/test';

/**
 * Game Launch Tests for SPA Portfolio (hash-routed entry, not a full page nav
 * through the nav bar). Filter switched to "all" for the same reason as
 * game-launch-integration.spec.js - Snake/TicTacToe aren't in the default
 * "Featured" set.
 */

test.describe('Game Launch in SPA', () => {

    for (const gameType of ['barista', 'snake', 'tictactoe']) {
        test(`${gameType} game launches from portfolio`, async ({ page }) => {
            await page.goto('/#projects');
            await page.waitForSelector('.projects-section', { state: 'visible', timeout: 15000 });

            await page.click('#current-filter-btn');
            await page.click('.inline-filter-btn[data-category="all"]');
            await page.waitForTimeout(500);

            await page.waitForSelector(`[data-game="${gameType}"]`, { state: 'visible', timeout: 10000 });
            await page.click(`[data-game="${gameType}"]`);

            await page.waitForSelector('#game-container.active', { timeout: 10000 });

            const gameContent = page.locator('#game-content');
            await expect(gameContent).not.toBeEmpty();
        });
    }

});
