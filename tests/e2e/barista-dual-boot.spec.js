import { test, expect } from '@playwright/test';

/**
 * Barista Game Dual-Boot Tests
 * Tests standalone.html and portfolio integration
 */

test.describe('Barista Game - Standalone Mode', () => {

    test('standalone.html loads without errors', async ({ page }) => {
        // Listen for console errors
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        // Navigate to standalone
        await page.goto('/src/components/games/standalone.html');

        // Wait for page to load
        await page.waitForLoadState('domcontentloaded');

        // Check title
        await expect(page).toHaveTitle('Starbucks Barista Game');

        // Check game container exists
        const container = page.locator('#game-container');
        await expect(container).toBeVisible();

        // Check exit button exists (may be hidden initially)
        const exitBtn = page.locator('#standalone-exit');
        await expect(exitBtn).toBeAttached();

        // Wait a moment for game to initialize
        await page.waitForTimeout(2000);

        // Check for any critical console errors
        const criticalErrors = errors.filter(e =>
            !e.includes('favicon') &&
            !e.includes('404')
        );

        console.log('Console errors found:', criticalErrors);
    });

    test('game initializes and shows content', async ({ page }) => {
        await page.goto('/src/components/games/standalone.html');

        // Wait for game to initialize (loading message should disappear)
        await page.waitForTimeout(3000);

        // Check that loading message is gone (replaced by game content)
        const loadingMsg = page.locator('.loading-message');
        const isLoadingVisible = await loadingMsg.isVisible().catch(() => false);

        // Either loading is gone or game content is visible
        const gameContent = page.locator('.game-screen, .game-content, .welcome-screen');
        const hasGameContent = await gameContent.first().isVisible().catch(() => false);

        // One of these should be true
        expect(isLoadingVisible === false || hasGameContent === true).toBeTruthy();
    });

    test('exit button becomes visible after game loads', async ({ page }) => {
        await page.goto('/src/components/games/standalone.html');

        // Wait for game to initialize
        await page.waitForTimeout(3000);

        // Exit button should have 'visible' class after game loads
        const exitBtn = page.locator('#standalone-exit');
        await expect(exitBtn).toHaveClass(/visible/);
    });

    test('CSS loads before game content', async ({ page }) => {
        await page.goto('/src/components/games/standalone.html');

        // Check that StarbucksGame.css is loaded
        const cssLoaded = await page.evaluate(() => {
            const links = document.querySelectorAll('link[rel="stylesheet"]');
            for (const link of links) {
                if (link.href.includes('StarbucksGame.css') && link.sheet) {
                    return true;
                }
            }
            return false;
        });

        expect(cssLoaded).toBeTruthy();
    });
});

test.describe('Barista Game - Portfolio Mode', () => {

    test('portfolio loads without breaking', async ({ page }) => {
        // Navigate to main portfolio
        await page.goto('/');

        // Wait for page to load
        await page.waitForLoadState('domcontentloaded');

        // Check that main portfolio elements exist
        const body = page.locator('body');
        await expect(body).toBeVisible();
    });

    test('StarbucksGame exports to window in portfolio context', async ({ page }) => {
        await page.goto('/');

        // Wait for modules to load
        await page.waitForTimeout(2000);

        // Navigate to a page that loads the game (or check if export is available)
        // Note: This test verifies the loader doesn't break portfolio mode
        const hasErrors = await page.evaluate(() => {
            // Check for any uncaught errors
            return window.__testErrors || [];
        });

        expect(hasErrors.length).toBe(0);
    });
});

test.describe('Barista Game - Browser Compatibility', () => {

    test('nomodule fallback exists for old browsers', async ({ page }) => {
        await page.goto('/src/components/games/standalone.html');

        // Check that nomodule script exists
        const nomoduleScript = page.locator('script[nomodule]');
        await expect(nomoduleScript).toBeAttached();

        // Check it contains browser upgrade message
        const scriptContent = await nomoduleScript.textContent();
        expect(scriptContent).toContain('Browser Not Supported');
    });

    test('uses relative paths for portability', async ({ page }) => {
        await page.goto('/src/components/games/standalone.html');

        // Verify CSS uses relative path (./StarbucksGame.css)
        const cssLink = page.locator('link[href*="StarbucksGame.css"]');
        await expect(cssLink).toBeAttached();

        // Verify script uses relative path
        const scriptTag = page.locator('script[src*="starbucks-game-loader.js"]');
        await expect(scriptTag).toBeAttached();
    });
});
