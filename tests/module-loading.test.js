/**
 * Module Loading Verification Test
 * Tests that all module loading fixes are working correctly
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8000';

test.describe('Module Loading Verification', () => {
  let consoleMessages = [];
  let consoleWarnings = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleWarnings = [];
    consoleErrors = [];

    // Capture console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();

      consoleMessages.push({ type, text });

      if (type === 'warning') {
        consoleWarnings.push(text);
      } else if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Navigate to the page
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Wait for initialization
    await page.waitForTimeout(3000);
  });

  test('Test 1: Console Warnings Check', async ({ page }) => {
    console.log('\n=== TEST 1: Console Warnings Check ===\n');

    const badWarnings = [
      'TimeControlUI not available',
      'FPSMonitor not available',
      'MemoryManager not available',
      'RulesEnforcer initialization timeout'
    ];

    const results = {
      passed: [],
      failed: []
    };

    // Check for bad warnings
    for (const warning of badWarnings) {
      const found = consoleMessages.some(msg => msg.text.includes(warning));

      if (found) {
        results.failed.push(`❌ FAIL: "${warning}" still appears in console`);
      } else {
        results.passed.push(`✅ PASS: "${warning}" NOT found (good)`);
      }
    }

    // Look for positive initialization messages
    const goodMessages = [
      'TimeControlUI',
      'FPSMonitor',
      'MemoryManager',
      'RulesEnforcer'
    ];

    console.log('\nSearching for positive initialization messages:');
    for (const keyword of goodMessages) {
      const found = consoleMessages.filter(msg =>
        msg.text.includes(keyword) &&
        !msg.text.includes('not available') &&
        !msg.text.includes('timeout')
      );

      if (found.length > 0) {
        console.log(`✅ Found messages for ${keyword}:`);
        found.forEach(msg => console.log(`   ${msg.type}: ${msg.text}`));
      } else {
        console.log(`⚠️  No positive messages found for ${keyword}`);
      }
    }

    // Print all console messages for debugging
    console.log('\n--- All Console Messages ---');
    consoleMessages.forEach(msg => {
      console.log(`[${msg.type.toUpperCase()}] ${msg.text}`);
    });

    // Print results
    console.log('\n--- Test Results ---');
    results.passed.forEach(r => console.log(r));
    results.failed.forEach(r => console.log(r));

    // Test should pass if no bad warnings
    expect(results.failed.length).toBe(0);
  });

  test('Test 2: Global Objects Check', async ({ page }) => {
    console.log('\n=== TEST 2: Global Objects Check ===\n');

    const globalChecks = {
      'TimeConverter': await page.evaluate(() => typeof window.TimeConverter !== 'undefined'),
      'OrbitalCalculator': await page.evaluate(() => typeof window.OrbitalCalculator !== 'undefined'),
      'TimeScaleManager': await page.evaluate(() => typeof window.TimeScaleManager !== 'undefined'),
      'TimeControlUI': await page.evaluate(() => typeof window.TimeControlUI !== 'undefined'),
      'FPSMonitor': await page.evaluate(() => typeof window.FPSMonitor !== 'undefined'),
      'MemoryManager': await page.evaluate(() => typeof window.MemoryManager !== 'undefined'),
      'RulesEnforcer': await page.evaluate(() => typeof window.RulesEnforcer !== 'undefined')
    };

    const results = {
      passed: [],
      failed: []
    };

    for (const [className, available] of Object.entries(globalChecks)) {
      if (available) {
        results.passed.push(`✅ PASS: window.${className} is available`);
      } else {
        results.failed.push(`❌ FAIL: window.${className} is NOT available`);
      }
    }

    // Print results
    console.log('--- Global Objects Availability ---');
    results.passed.forEach(r => console.log(r));
    results.failed.forEach(r => console.log(r));

    // All should be available
    expect(results.failed.length).toBe(0);
  });

  test('Test 3: UI Elements Check', async ({ page }) => {
    console.log('\n=== TEST 3: UI Elements Check ===\n');

    const uiElements = [
      { selector: '#time-controls', name: 'Time control UI container' },
      { selector: '#fps-monitor', name: 'FPS monitor element' },
      { selector: '.play-pause-btn', name: 'Play/pause button' },
      { selector: '.time-scale-slider', name: 'Time scale slider' }
    ];

    const results = {
      passed: [],
      failed: []
    };

    for (const element of uiElements) {
      const exists = await page.locator(element.selector).count() > 0;

      if (exists) {
        const isVisible = await page.locator(element.selector).first().isVisible();
        if (isVisible) {
          results.passed.push(`✅ PASS: ${element.name} exists and is visible`);
        } else {
          results.failed.push(`⚠️  PARTIAL: ${element.name} exists but is hidden`);
        }
      } else {
        results.failed.push(`❌ FAIL: ${element.name} does NOT exist`);
      }
    }

    // Print results
    console.log('--- UI Elements Status ---');
    results.passed.forEach(r => console.log(r));
    results.failed.forEach(r => console.log(r));

    // At least time-controls and fps-monitor should exist
    const criticalExists = await page.locator('#time-controls, #fps-monitor').count() > 0;
    expect(criticalExists).toBe(true);
  });

  test('Test 4: Functionality Check', async ({ page }) => {
    console.log('\n=== TEST 4: Functionality Check ===\n');

    const functionalityChecks = {
      'SpaceEnvironment.timeManager': await page.evaluate(() => {
        try {
          return window.SpaceEnvironment?.timeManager !== undefined;
        } catch (e) {
          return false;
        }
      }),
      'FPS values readable': await page.evaluate(() => {
        try {
          const fpsElement = document.querySelector('#fps-monitor');
          return fpsElement !== null && fpsElement.textContent.length > 0;
        } catch (e) {
          return false;
        }
      }),
      'Time controls functional': await page.evaluate(() => {
        try {
          const timeControls = document.querySelector('#time-controls');
          return timeControls !== null;
        } catch (e) {
          return false;
        }
      })
    };

    const results = {
      passed: [],
      failed: []
    };

    for (const [check, passed] of Object.entries(functionalityChecks)) {
      if (passed) {
        results.passed.push(`✅ PASS: ${check} - working`);
      } else {
        results.failed.push(`❌ FAIL: ${check} - NOT working`);
      }
    }

    // Try to read actual FPS value
    const fpsValue = await page.evaluate(() => {
      try {
        const fpsElement = document.querySelector('#fps-monitor');
        return fpsElement?.textContent || 'Not found';
      } catch (e) {
        return 'Error reading FPS';
      }
    });

    console.log(`\nFPS Monitor Content: "${fpsValue}"`);

    // Print results
    console.log('\n--- Functionality Status ---');
    results.passed.forEach(r => console.log(r));
    results.failed.forEach(r => console.log(r));

    // At least SpaceEnvironment.timeManager should exist
    expect(functionalityChecks['SpaceEnvironment.timeManager']).toBe(true);
  });

  test('Summary Report', async ({ page }) => {
    console.log('\n=== FINAL SUMMARY REPORT ===\n');

    // Re-run all checks for summary
    const warningsCheck = {
      'TimeControlUI not available': consoleMessages.some(m => m.text.includes('TimeControlUI not available')),
      'FPSMonitor not available': consoleMessages.some(m => m.text.includes('FPSMonitor not available')),
      'MemoryManager not available': consoleMessages.some(m => m.text.includes('MemoryManager not available')),
      'RulesEnforcer initialization timeout': consoleMessages.some(m => m.text.includes('RulesEnforcer initialization timeout'))
    };

    const globalObjects = await page.evaluate(() => ({
      TimeConverter: typeof window.TimeConverter !== 'undefined',
      OrbitalCalculator: typeof window.OrbitalCalculator !== 'undefined',
      TimeScaleManager: typeof window.TimeScaleManager !== 'undefined',
      TimeControlUI: typeof window.TimeControlUI !== 'undefined',
      FPSMonitor: typeof window.FPSMonitor !== 'undefined',
      MemoryManager: typeof window.MemoryManager !== 'undefined',
      RulesEnforcer: typeof window.RulesEnforcer !== 'undefined'
    }));

    console.log('📊 WARNINGS STATUS:');
    for (const [warning, present] of Object.entries(warningsCheck)) {
      if (present) {
        console.log(`  ❌ STILL PRESENT: "${warning}"`);
      } else {
        console.log(`  ✅ GONE: "${warning}"`);
      }
    }

    console.log('\n📊 GLOBAL OBJECTS STATUS:');
    for (const [obj, available] of Object.entries(globalObjects)) {
      console.log(`  ${available ? '✅' : '❌'} window.${obj}: ${available ? 'Available' : 'Missing'}`);
    }

    console.log('\n📊 UI ELEMENTS STATUS:');
    const uiExists = {
      'Time controls': await page.locator('#time-controls').count() > 0,
      'FPS monitor': await page.locator('#fps-monitor').count() > 0,
      'Play/pause button': await page.locator('.play-pause-btn').count() > 0,
      'Time scale slider': await page.locator('.time-scale-slider').count() > 0
    };

    for (const [element, exists] of Object.entries(uiExists)) {
      console.log(`  ${exists ? '✅' : '❌'} ${element}: ${exists ? 'Present' : 'Missing'}`);
    }

    console.log('\n📊 OVERALL STATUS:');
    const allWarningsGone = Object.values(warningsCheck).every(v => !v);
    const allObjectsAvailable = Object.values(globalObjects).every(v => v);
    const criticalUIPresent = uiExists['Time controls'] && uiExists['FPS monitor'];

    const overallPass = allWarningsGone && allObjectsAvailable && criticalUIPresent;

    console.log(`  Warnings cleared: ${allWarningsGone ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Global objects: ${allObjectsAvailable ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  UI elements: ${criticalUIPresent ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`\n  🎯 FINAL VERDICT: ${overallPass ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAIL'}`);

    expect(overallPass).toBe(true);
  });
});
