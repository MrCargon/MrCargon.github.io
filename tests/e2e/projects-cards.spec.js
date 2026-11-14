import { test, expect } from '@playwright/test';

// Projects page shows only projects that exist (refresh 2026-11-13).
// "Space Explorer" and "Interactive Dashboard" were placeholder cards for
// projects that were never built; Unknown Underworld is the real game.
test.describe.configure({ timeout: 120000 });

test('projects page lists real projects only, and the new card opens', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));

    await page.goto('/#projects');
    const grid = page.locator('.project-grid');
    await expect(grid).toBeVisible({ timeout: 60000 });

    await expect(page.locator('#space-explorer')).toHaveCount(0);
    await expect(page.locator('#data-viz')).toHaveCount(0);

    // Featured is the default filter; the game card is featured.
    const uu = page.locator('#unknown-underworld');
    await expect(uu).toBeVisible();
    await expect(uu.locator('h3')).toHaveText('Unknown Underworld');

    await expect(page.locator('#life-sim-title')).toContainText('Particles');

    await uu.locator('.view-details-btn').click();
    const modal = page.locator('#project-info-content');
    await expect(modal).toContainText('leaky-integrator', { timeout: 10000 });

    expect(errors, 'no uncaught page errors').toEqual([]);
});
