import { test, expect } from '@playwright/test';

/**
 * Phase 1 Implementation Validation Tests
 * Purpose: Verify Kuiper Belt, Axial Tilt, and Star Spectral Diversity implementations
 * Date: 2025-12-30
 * Tasks: Validate Phase 1 completion (Kuiper Belt integration, axial tilt, star colors)
 */

test.describe('Phase 1: Space Environment Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Collect console messages for validation
    page.on('console', message => {
      const type = message.type();
      const text = message.text();

      // Log errors for debugging
      if (type === 'error') {
        console.log(`[BROWSER ERROR]: ${text}`);
      }
    });

    // Navigate to home page
    await page.goto('/');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Wait for solar system to initialize (give it 3 seconds)
    await page.waitForTimeout(3000);
  });

  test('should have zero console errors related to Phase 1', async ({ page }) => {
    const errors = [];

    // Capture console errors
    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    // Reload to capture all errors
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Filter Phase 1 related errors
    const phase1Errors = errors.filter(error =>
      error.includes('KuiperBelt') ||
      error.includes('Planet') && error.includes('rotation') ||
      error.includes('Galaxy') ||
      error.includes('axialTilt') ||
      error.includes('undefined') && error.includes('update')
    );

    // Log all errors for debugging
    if (phase1Errors.length > 0) {
      console.log('Phase 1 Errors Found:');
      phase1Errors.forEach(err => console.log(`  - ${err}`));
    }

    expect(phase1Errors.length).toBe(0);
  });

  test('should verify Kuiper Belt exists in scene', async ({ page }) => {
    // Execute JavaScript in browser to check Kuiper Belt existence
    const kuiperBeltExists = await page.evaluate(() => {
      // Access the SolarSystem instance (assuming it's globally accessible)
      // This might need adjustment based on actual implementation

      // Try multiple ways to access the solar system
      const solarSystem = window.solarSystem ||
                         window.scene?.children.find(c => c.constructor.name === 'SolarSystem');

      if (!solarSystem) {
        return { exists: false, reason: 'SolarSystem not found in window or scene' };
      }

      // Check if Kuiper Belt is in the objects Map
      const kuiperBelt = solarSystem.objects?.get('kuiperBelt');

      if (!kuiperBelt) {
        return { exists: false, reason: 'Kuiper Belt not in objects Map' };
      }

      // Check if Kuiper Belt has particles
      const hasParticles = kuiperBelt.particleCount > 0;

      // Check if update method exists
      const hasUpdateMethod = typeof kuiperBelt.update === 'function';

      return {
        exists: true,
        particleCount: kuiperBelt.particleCount,
        hasUpdateMethod: hasUpdateMethod,
        innerRadius: kuiperBelt.innerRadius,
        outerRadius: kuiperBelt.outerRadius
      };
    });

    console.log('Kuiper Belt Check:', kuiperBeltExists);

    expect(kuiperBeltExists.exists).toBe(true);
    if (kuiperBeltExists.exists) {
      expect(kuiperBeltExists.particleCount).toBeGreaterThan(1000);
      expect(kuiperBeltExists.hasUpdateMethod).toBe(true);
      expect(kuiperBeltExists.innerRadius).toBeGreaterThan(200);
      expect(kuiperBeltExists.outerRadius).toBeGreaterThan(300);
    }
  });

  test('should verify all planets have axial tilt data', async ({ page }) => {
    const axialTiltData = await page.evaluate(() => {
      const solarSystem = window.solarSystem ||
                         window.scene?.children.find(c => c.constructor.name === 'SolarSystem');

      if (!solarSystem || !solarSystem.planetData) {
        return { success: false, reason: 'Planet data not accessible' };
      }

      const planets = solarSystem.planetData.planets || [];
      const tiltData = planets.map(planet => ({
        name: planet.name,
        axialTilt: planet.axialTilt,
        hasTilt: planet.axialTilt !== undefined
      }));

      return {
        success: true,
        planets: tiltData,
        allHaveTilt: tiltData.every(p => p.hasTilt)
      };
    });

    console.log('Axial Tilt Data:', axialTiltData);

    expect(axialTiltData.success).toBe(true);
    if (axialTiltData.success) {
      expect(axialTiltData.allHaveTilt).toBe(true);

      // Verify specific planets have correct values
      const uranus = axialTiltData.planets.find(p => p.name === 'Uranus');
      const earth = axialTiltData.planets.find(p => p.name === 'Earth');

      if (uranus) {
        expect(uranus.axialTilt).toBeCloseTo(97.8, 1);
      }
      if (earth) {
        expect(earth.axialTilt).toBeCloseTo(23.4, 1);
      }
    }
  });

  test('should verify Uranus has extreme axial tilt applied to mesh', async ({ page }) => {
    const uranusRotation = await page.evaluate(() => {
      const solarSystem = window.solarSystem ||
                         window.scene?.children.find(c => c.constructor.name === 'SolarSystem');

      if (!solarSystem) {
        return { success: false, reason: 'SolarSystem not found' };
      }

      // Find Uranus planet object
      const uranusPlanet = Array.from(solarSystem.objects?.values() || [])
        .find(obj => obj.data?.name === 'Uranus');

      if (!uranusPlanet || !uranusPlanet.mesh) {
        return { success: false, reason: 'Uranus planet or mesh not found' };
      }

      // Get rotation in radians
      const rotationX = uranusPlanet.mesh.rotation.x;

      // Convert to degrees for verification
      const rotationDegrees = rotationX * (180 / Math.PI);

      return {
        success: true,
        rotationRadians: rotationX,
        rotationDegrees: rotationDegrees,
        expectedDegrees: 97.8,
        expectedRadians: 97.8 * (Math.PI / 180)
      };
    });

    console.log('Uranus Rotation:', uranusRotation);

    expect(uranusRotation.success).toBe(true);
    if (uranusRotation.success) {
      // Verify rotation is approximately 97.8 degrees (allow 5% tolerance)
      expect(uranusRotation.rotationDegrees).toBeGreaterThan(93);
      expect(uranusRotation.rotationDegrees).toBeLessThan(103);
    }
  });

  test('should verify star spectral diversity (70% red dwarfs)', async ({ page }) => {
    const starDistribution = await page.evaluate(() => {
      const scene = window.scene;

      if (!scene) {
        return { success: false, reason: 'Scene not found' };
      }

      // Find Galaxy object (stars)
      const galaxy = scene.children.find(c => c.constructor.name === 'Points');

      if (!galaxy || !galaxy.geometry) {
        return { success: false, reason: 'Galaxy particle system not found' };
      }

      const colors = galaxy.geometry.attributes.color.array;
      const totalStars = colors.length / 3;

      // Sample 200 stars to verify distribution
      const sampleSize = Math.min(200, totalStars);
      let redCount = 0;
      let yellowOrangeCount = 0;
      let whiteCount = 0;
      let blueCount = 0;

      for (let i = 0; i < sampleSize; i++) {
        const randomIndex = Math.floor(Math.random() * totalStars) * 3;
        const r = colors[randomIndex];
        const g = colors[randomIndex + 1];
        const b = colors[randomIndex + 2];

        // Classify by dominant color
        if (r > 0.8 && g < 0.5 && b < 0.4) {
          redCount++; // M-type red dwarf
        } else if (r > 0.9 && g > 0.7 && b < 0.7) {
          yellowOrangeCount++; // K/G-type
        } else if (r > 0.9 && g > 0.9 && b > 0.7) {
          whiteCount++; // F/A-type
        } else if (b > 0.9) {
          blueCount++; // O/B-type
        }
      }

      const redPercent = (redCount / sampleSize) * 100;
      const yellowOrangePercent = (yellowOrangeCount / sampleSize) * 100;
      const whitePercent = (whiteCount / sampleSize) * 100;
      const bluePercent = (blueCount / sampleSize) * 100;

      return {
        success: true,
        sampleSize: sampleSize,
        redCount: redCount,
        redPercent: redPercent,
        yellowOrangePercent: yellowOrangePercent,
        whitePercent: whitePercent,
        bluePercent: bluePercent
      };
    });

    console.log('Star Distribution:', starDistribution);

    expect(starDistribution.success).toBe(true);
    if (starDistribution.success) {
      // Verify ≥65% red stars (70% target with ±5% tolerance)
      expect(starDistribution.redPercent).toBeGreaterThan(60);

      // Verify not dominated by white/blue (should be minority)
      expect(starDistribution.whitePercent).toBeLessThan(15);
      expect(starDistribution.bluePercent).toBeLessThan(10);
    }
  });

  test('should measure desktop frame rate performance', async ({ page }) => {
    // Measure FPS by counting animation frames over 3 seconds
    const fpsData = await page.evaluate(() => {
      return new Promise((resolve) => {
        let frameCount = 0;
        const startTime = performance.now();
        const duration = 3000; // 3 seconds

        function countFrame() {
          frameCount++;
          const elapsed = performance.now() - startTime;

          if (elapsed < duration) {
            requestAnimationFrame(countFrame);
          } else {
            const fps = (frameCount / (elapsed / 1000));
            resolve({
              fps: fps,
              frameCount: frameCount,
              duration: elapsed
            });
          }
        }

        requestAnimationFrame(countFrame);
      });
    });

    console.log('FPS Measurement:', fpsData);

    // Verify ≥60 FPS (allow some margin: ≥55 FPS acceptable)
    expect(fpsData.fps).toBeGreaterThan(55);
  });

  test('should measure memory usage', async ({ page }) => {
    // Use performance.memory API (Chrome only)
    const memoryData = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          usedMB: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)
        };
      } else {
        return { available: false };
      }
    });

    console.log('Memory Usage:', memoryData);

    if (memoryData.available !== false) {
      const usedMB = parseFloat(memoryData.usedMB);

      // Verify <800MB desktop target
      expect(usedMB).toBeLessThan(800);
    }
  });

  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(1000); // Wait for solar system init

    const loadTime = Date.now() - startTime;

    console.log('Load Time:', loadTime, 'ms');

    // Performance budget: <5 seconds
    expect(loadTime).toBeLessThan(5000);
  });
});

test.describe('Phase 1: Kuiper Belt Spec Deviation Check', () => {
  test('should document Kuiper Belt parameters', async ({ page }) => {
    const kuiperBeltParams = await page.evaluate(() => {
      const solarSystem = window.solarSystem ||
                         window.scene?.children.find(c => c.constructor.name === 'SolarSystem');

      if (!solarSystem) {
        return { success: false };
      }

      const kuiperBelt = solarSystem.objects?.get('kuiperBelt');

      if (!kuiperBelt) {
        return { success: false };
      }

      return {
        success: true,
        innerRadius: kuiperBelt.innerRadius,
        outerRadius: kuiperBelt.outerRadius,
        particleCount: kuiperBelt.particleCount,
        specInner: 220,
        specOuter: 350,
        specParticles: 2000,
        deviationInner: kuiperBelt.innerRadius - 220,
        deviationOuter: kuiperBelt.outerRadius - 350,
        deviationParticles: kuiperBelt.particleCount - 2000
      };
    });

    console.log('Kuiper Belt Parameters:');
    console.log('  Implementation:', {
      inner: kuiperBeltParams.innerRadius,
      outer: kuiperBeltParams.outerRadius,
      particles: kuiperBeltParams.particleCount
    });
    console.log('  Roadmap Spec:', {
      inner: kuiperBeltParams.specInner,
      outer: kuiperBeltParams.specOuter,
      particles: kuiperBeltParams.specParticles
    });
    console.log('  Deviations:', {
      inner: kuiperBeltParams.deviationInner,
      outer: kuiperBeltParams.deviationOuter,
      particles: kuiperBeltParams.deviationParticles
    });

    // This test documents but doesn't enforce spec
    // User decision required: see PHASE1-RUNTIME-VALIDATION-CHECKLIST.md
    expect(kuiperBeltParams.success).toBe(true);
  });
});
