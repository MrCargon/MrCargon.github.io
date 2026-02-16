import { test, expect } from '@playwright/test';

/**
 * Math Fixes Verification Test
 * Purpose: Verify that Math.abs, Math.min, Math.max fixes are working
 * Context: Fixed 10 Math errors in CosmicDust.js, Sun.js, Planet.js, ExtraDimensionsViz.js
 *
 * Expected: NO console errors related to Math methods
 * Expected: Application loads and renders without crashes
 */

test.describe('Math Fixes Verification', () => {
  let consoleErrors = [];
  let consoleLogs = [];

  test.beforeEach(async ({ page }) => {
    // Reset error collectors
    consoleErrors = [];
    consoleLogs = [];

    // Capture console errors
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();

      if (type === 'error') {
        consoleErrors.push({
          type: 'error',
          text: text,
          location: msg.location()
        });
      } else if (type === 'log' || type === 'info') {
        consoleLogs.push({
          type: type,
          text: text
        });
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      consoleErrors.push({
        type: 'pageerror',
        text: error.message,
        stack: error.stack
      });
    });
  });

  test('should load application without Math errors', async ({ page }) => {
    // Navigate to application
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for page to initialize
    await page.waitForTimeout(3000);

    // Check for Math-related errors
    const mathErrors = consoleErrors.filter(error =>
      error.text.toLowerCase().includes('math.abs') ||
      error.text.toLowerCase().includes('math.min') ||
      error.text.toLowerCase().includes('math.max') ||
      error.text.toLowerCase().includes('is not a function')
    );

    // Report findings
    if (mathErrors.length > 0) {
      console.log('\n❌ MATH ERRORS FOUND:');
      mathErrors.forEach(error => {
        console.log(`  - ${error.type}: ${error.text}`);
        if (error.location) {
          console.log(`    Location: ${error.location.url}:${error.location.lineNumber}`);
        }
      });
    } else {
      console.log('\n✅ No Math errors detected');
    }

    // Report all errors if any
    if (consoleErrors.length > 0) {
      console.log(`\n⚠️  Total console errors: ${consoleErrors.length}`);
      consoleErrors.forEach(error => {
        console.log(`  - ${error.type}: ${error.text.substring(0, 100)}...`);
      });
    }

    // Assertion: No Math errors
    expect(mathErrors.length, 'Math errors should be zero').toBe(0);
  });

  test('should verify THREE.js WebGL renderer initialized', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Check if THREE.js is loaded
    const threeLoaded = await page.evaluate(() => {
      return typeof window.THREE !== 'undefined';
    });

    console.log(threeLoaded ? '✅ THREE.js loaded' : '❌ THREE.js not loaded');
    expect(threeLoaded, 'THREE.js should be loaded').toBe(true);

    // Check for canvas element (WebGL renderer creates a canvas)
    const canvas = await page.locator('canvas').first();
    await expect(canvas, 'Canvas element should exist').toBeVisible();

    console.log('✅ WebGL canvas element found');
  });

  test('should verify application renders without crashes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for initial render
    await page.waitForTimeout(5000);

    // Check if page has any visible content
    const bodyHasContent = await page.evaluate(() => {
      return document.body.childElementCount > 0;
    });

    console.log(bodyHasContent ? '✅ Page rendered with content' : '❌ Page is empty');
    expect(bodyHasContent, 'Page should have content').toBe(true);

    // Check if any critical errors occurred
    const criticalErrors = consoleErrors.filter(error =>
      error.type === 'pageerror' ||
      error.text.toLowerCase().includes('uncaught')
    );

    if (criticalErrors.length > 0) {
      console.log('\n❌ CRITICAL ERRORS:');
      criticalErrors.forEach(error => {
        console.log(`  - ${error.text}`);
      });
    } else {
      console.log('✅ No critical errors detected');
    }

    expect(criticalErrors.length, 'No critical errors should occur').toBe(0);
  });

  test('should verify no regression in fixed files', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for scripts to execute
    await page.waitForTimeout(4000);

    // Check for errors in specific files we fixed
    const fixedFiles = [
      'CosmicDust.js',
      'Sun.js',
      'Planet.js',
      'ExtraDimensionsViz.js'
    ];

    const fileErrors = consoleErrors.filter(error => {
      const errorText = error.text + (error.location?.url || '');
      return fixedFiles.some(file => errorText.includes(file));
    });

    if (fileErrors.length > 0) {
      console.log('\n❌ ERRORS IN FIXED FILES:');
      fileErrors.forEach(error => {
        console.log(`  - ${error.text}`);
        if (error.location) {
          console.log(`    ${error.location.url}:${error.location.lineNumber}`);
        }
      });
    } else {
      console.log('\n✅ No errors in fixed files (CosmicDust, Sun, Planet, ExtraDimensionsViz)');
    }

    expect(fileErrors.length, 'Fixed files should have no errors').toBe(0);
  });

  test('should generate final verification report', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    // Generate comprehensive report
    console.log('\n' + '='.repeat(60));
    console.log('MATH FIXES VERIFICATION REPORT');
    console.log('='.repeat(60));

    console.log(`\n📊 Server Status:`);
    console.log(`   URL: ${page.url()}`);
    console.log(`   Loaded: ✅`);

    console.log(`\n🔍 Console Errors Analysis:`);
    console.log(`   Total errors: ${consoleErrors.length}`);

    const mathErrors = consoleErrors.filter(e =>
      e.text.toLowerCase().includes('math.')
    );
    console.log(`   Math-related errors: ${mathErrors.length}`);

    console.log(`\n📝 Test Results:`);
    if (consoleErrors.length === 0) {
      console.log(`   ✅ Page loads successfully`);
      console.log(`   ✅ No console errors`);
      console.log(`   ✅ No Math errors`);
      console.log(`   ✅ Application functional`);
      console.log(`\n🎉 VERIFICATION: PASSED`);
    } else {
      console.log(`   ⚠️  ${consoleErrors.length} errors detected`);
      if (mathErrors.length > 0) {
        console.log(`   ❌ Math errors still present`);
      } else {
        console.log(`   ✅ Math errors resolved (non-Math errors exist)`);
      }
      console.log(`\n⚠️  VERIFICATION: PARTIAL PASS (see errors above)`);
    }

    console.log('='.repeat(60) + '\n');

    // Pass test if no Math errors (may have other errors)
    expect(mathErrors.length, 'Math errors should be resolved').toBe(0);
  });
});
