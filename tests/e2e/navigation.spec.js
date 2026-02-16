import { test, expect } from '@playwright/test';

/**
 * Navigation E2E Tests
 * Purpose: Verify page navigation functionality works correctly
 * Rule 5: Test critical user flows
 */

test.describe('Page Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page before each test
    await page.goto('/');

    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
  });

  test('should load the home page successfully', async ({ page }) => {
    // Verify page title
    await expect(page).toHaveTitle(/MrCargon/i);

    // Verify main container exists
    const pageContainer = page.locator('#page-container');
    await expect(pageContainer).toBeVisible();
  });

  test('should navigate to About page', async ({ page }) => {
    // Click About link in header
    await page.click('a[href="#about"]');

    // Wait for navigation
    await page.waitForURL('**/about');

    // Verify About page content loaded
    const aboutContent = page.locator('#page-container');
    await expect(aboutContent).toBeVisible();

    // Verify URL hash changed
    expect(page.url()).toContain('#about');
  });

  test('should navigate to Projects page', async ({ page }) => {
    // Click Projects link
    await page.click('a[href="#projects"]');

    // Wait for navigation
    await page.waitForURL('**/projects');

    // Verify Projects page content
    const projectsContent = page.locator('#page-container');
    await expect(projectsContent).toBeVisible();

    expect(page.url()).toContain('#projects');
  });

  test('should navigate to Contact page', async ({ page }) => {
    // Click Contact link
    await page.click('a[href="#contact"]');

    // Wait for navigation
    await page.waitForURL('**/contact');

    // Verify Contact page content
    const contactContent = page.locator('#page-container');
    await expect(contactContent).toBeVisible();

    expect(page.url()).toContain('#contact');
  });

  test('should handle browser back button', async ({ page }) => {
    // Navigate to About
    await page.click('a[href="#about"]');
    await page.waitForURL('**/about');

    // Navigate to Projects
    await page.click('a[href="#projects"]');
    await page.waitForURL('**/projects');

    // Go back
    await page.goBack();

    // Should be on About page
    expect(page.url()).toContain('#about');

    // Go back again
    await page.goBack();

    // Should be on main page
    expect(page.url()).not.toContain('#');
  });

  test('should have working header navigation', async ({ page }) => {
    // Verify all header links exist
    const homeLink = page.locator('a[href="#main"]');
    const aboutLink = page.locator('a[href="#about"]');
    const projectsLink = page.locator('a[href="#projects"]');
    const contactLink = page.locator('a[href="#contact"]');

    await expect(homeLink).toBeVisible();
    await expect(aboutLink).toBeVisible();
    await expect(projectsLink).toBeVisible();
    await expect(contactLink).toBeVisible();
  });
});

test.describe('Page Loading', () => {
  test('should have no console errors on page load', async ({ page }) => {
    const errors = [];

    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out expected errors (if any)
    const criticalErrors = errors.filter(error =>
      !error.includes('Deprecated') &&
      !error.includes('Warning')
    );

    expect(criticalErrors.length).toBe(0);
  });

  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('load');

    const loadTime = Date.now() - startTime;

    // Performance budget: should load in under 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });
});
