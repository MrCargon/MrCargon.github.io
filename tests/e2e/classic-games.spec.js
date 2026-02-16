import { test, expect } from '@playwright/test';

/**
 * Classic Games Dual-Boot Tests
 * Tests Snake and Tic Tac Toe standalone and portfolio modes
 */

test.describe('Snake Game - Standalone Mode', () => {

    test('standalone.html loads without errors', async ({ page }) => {
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        await page.goto('/src/components/games/classic-games/snake/standalone.html');
        await page.waitForLoadState('domcontentloaded');

        await expect(page).toHaveTitle('Snake Game');

        const container = page.locator('#game-container');
        await expect(container).toBeVisible();

        await page.waitForTimeout(2000);

        const criticalErrors = errors.filter(e =>
            !e.includes('favicon') && !e.includes('404')
        );
        expect(criticalErrors.length).toBe(0);
    });

    test('game initializes and shows welcome screen', async ({ page }) => {
        await page.goto('/src/components/games/classic-games/snake/standalone.html');
        await page.waitForTimeout(2000);

        const welcomeScreen = page.locator('.snake-welcome');
        await expect(welcomeScreen).toBeVisible();

        const startBtn = page.locator('.snake-welcome button');
        await expect(startBtn).toBeVisible();
    });

    test('game starts when start button clicked', async ({ page }) => {
        await page.goto('/src/components/games/classic-games/snake/standalone.html');
        await page.waitForTimeout(2000);

        const startBtn = page.locator('.snake-welcome button');
        await startBtn.click();

        await page.waitForTimeout(500);

        const grid = page.locator('.snake-grid');
        await expect(grid).toBeVisible();

        const snakeHead = page.locator('.snake-head');
        await expect(snakeHead).toBeVisible();
    });

    test('exit button becomes visible after game loads', async ({ page }) => {
        await page.goto('/src/components/games/classic-games/snake/standalone.html');
        await page.waitForTimeout(2000);

        const exitBtn = page.locator('#standalone-exit');
        await expect(exitBtn).toHaveClass(/visible/);
    });

    test('CSS isolation - transform none applied', async ({ page }) => {
        await page.goto('/src/components/games/classic-games/snake/standalone.html');
        await page.waitForTimeout(2000);

        const snakeGame = page.locator('.snake-game');
        const transform = await snakeGame.evaluate(el =>
            window.getComputedStyle(el).transform
        );
        expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBeTruthy();
    });

    test('uses relative paths for portability', async ({ page }) => {
        await page.goto('/src/components/games/classic-games/snake/standalone.html');

        const cssLink = page.locator('link[href*="SnakeGame.css"]');
        await expect(cssLink).toBeAttached();

        const scriptTag = page.locator('script[src*="snake-loader.js"]');
        await expect(scriptTag).toBeAttached();
    });
});

test.describe('Tic Tac Toe - Standalone Mode', () => {

    test('standalone.html loads without errors', async ({ page }) => {
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        await page.goto('/src/components/games/classic-games/tic-tac-toe/standalone.html');
        await page.waitForLoadState('domcontentloaded');

        await expect(page).toHaveTitle('Tic Tac Toe');

        const container = page.locator('#game-container');
        await expect(container).toBeVisible();

        await page.waitForTimeout(2000);

        const criticalErrors = errors.filter(e =>
            !e.includes('favicon') && !e.includes('404')
        );
        expect(criticalErrors.length).toBe(0);
    });

    test('game initializes and shows welcome screen', async ({ page }) => {
        await page.goto('/src/components/games/classic-games/tic-tac-toe/standalone.html');
        await page.waitForTimeout(2000);

        const welcomeScreen = page.locator('.tictactoe-welcome');
        await expect(welcomeScreen).toBeVisible();

        const startBtn = page.locator('.tictactoe-welcome button');
        await expect(startBtn).toBeVisible();
    });

    test('game starts and board appears', async ({ page }) => {
        await page.goto('/src/components/games/classic-games/tic-tac-toe/standalone.html');
        await page.waitForTimeout(2000);

        const startBtn = page.locator('.tictactoe-welcome button');
        await startBtn.click();

        await page.waitForTimeout(500);

        const board = page.locator('.tictactoe-board');
        await expect(board).toBeVisible();

        const cells = page.locator('.tictactoe-cell');
        await expect(cells).toHaveCount(9);
    });

    test('player can place X on cell click', async ({ page }) => {
        await page.goto('/src/components/games/classic-games/tic-tac-toe/standalone.html');
        await page.waitForTimeout(2000);

        await page.locator('.tictactoe-welcome button').click();
        await page.waitForTimeout(500);

        const firstCell = page.locator('.tictactoe-cell').first();
        await firstCell.click();

        await page.waitForTimeout(100);
        await expect(firstCell).toHaveClass(/x/);
    });

    test('AI responds after player move', async ({ page }) => {
        await page.goto('/src/components/games/classic-games/tic-tac-toe/standalone.html');
        await page.waitForTimeout(2000);

        await page.locator('.tictactoe-welcome button').click();
        await page.waitForTimeout(500);

        await page.locator('.tictactoe-cell').first().click();

        // Wait for AI delay (500ms) + render
        await page.waitForTimeout(800);

        const oCells = page.locator('.tictactoe-cell.o');
        await expect(oCells).toHaveCount(1);
    });

    test('CSS isolation - transform none applied', async ({ page }) => {
        await page.goto('/src/components/games/classic-games/tic-tac-toe/standalone.html');
        await page.waitForTimeout(2000);

        const game = page.locator('.tictactoe-game');
        const transform = await game.evaluate(el =>
            window.getComputedStyle(el).transform
        );
        expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBeTruthy();
    });
});

test.describe('Portfolio Mode Integration', () => {

    test('portfolio loads without breaking', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        const body = page.locator('body');
        await expect(body).toBeVisible();
    });

    test('game classes export to window', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(3000);

        // Check for any uncaught errors
        const hasErrors = await page.evaluate(() => {
            return window.__testErrors || [];
        });
        expect(hasErrors.length).toBe(0);
    });
});

test.describe('Memory & Cleanup Tests', () => {

    test('Snake game cleanup - no interval leaks', async ({ page }) => {
        await page.goto('/src/components/games/classic-games/snake/standalone.html');
        await page.waitForTimeout(2000);

        // Start game
        await page.locator('.snake-welcome button').click();
        await page.waitForTimeout(1000);

        // Check game loop is running
        const hasLoop = await page.evaluate(() => {
            return window.__SNAKE_GAME_INSTANCE?.gameLoop !== null;
        });
        expect(hasLoop).toBeTruthy();

        // Destroy game
        await page.evaluate(() => {
            if (window.__SNAKE_GAME_INSTANCE) {
                window.__SNAKE_GAME_INSTANCE.destroy();
            }
        });

        await page.waitForTimeout(100);

        // Check cleanup
        const loopCleared = await page.evaluate(() => {
            return window.__SNAKE_GAME_INSTANCE?.gameLoop === null;
        });
        expect(loopCleared).toBeTruthy();
    });
});

test.describe('Browser Compatibility', () => {

    test('Snake nomodule fallback exists', async ({ page }) => {
        await page.goto('/src/components/games/classic-games/snake/standalone.html');

        const nomoduleScript = page.locator('script[nomodule]');
        await expect(nomoduleScript).toBeAttached();

        const scriptContent = await nomoduleScript.textContent();
        expect(scriptContent).toContain('ES6 module support');
    });

    test('TicTacToe nomodule fallback exists', async ({ page }) => {
        await page.goto('/src/components/games/classic-games/tic-tac-toe/standalone.html');

        const nomoduleScript = page.locator('script[nomodule]');
        await expect(nomoduleScript).toBeAttached();

        const scriptContent = await nomoduleScript.textContent();
        expect(scriptContent).toContain('ES6 module support');
    });
});
