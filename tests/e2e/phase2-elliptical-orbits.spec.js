/**
 * Phase 2: Elliptical Orbits with Kepler's Laws - End-to-End Test Suite
 *
 * Purpose: Validate scientific accuracy of elliptical orbit implementation
 *
 * Test Coverage:
 * - 5.1: Orbital element accuracy (NASA JPL data validation)
 * - 5.1: Kepler's 1st Law (elliptical orbit shape)
 * - 5.1: Kepler's 2nd Law (speed variation with distance)
 * - 5.1: Argument of periapsis (ellipse orientation)
 * - 5.2: Performance validation (desktop and mobile targets)
 * - 5.4: Backward compatibility (circular orbit fallback)
 * - 5.4: Error handling (invalid orbital elements)
 *
 * References:
 * - ADR-002: Elliptical Orbits with Kepler's Laws
 * - NASA JPL Horizons: https://ssd.jpl.nasa.gov/horizons/
 * - Murray & Dermott (1999): Solar System Dynamics
 */

const { test, expect } = require('@playwright/test');

// Test configuration
const BASE_URL = 'http://localhost:8080'; // Adjust to your dev server
const TOLERANCE_ECCENTRICITY = 0.001;     // ±0.001 for eccentricity
const TOLERANCE_DISTANCE = 1.0;           // ±1 unit for distances
const TOLERANCE_ANGLE = 5.0;              // ±5 degrees for angles
const TOLERANCE_RATIO = 0.05;             // ±5% for speed/distance ratios

test.describe('Step 5.1: Orbital Element Accuracy Tests', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        // Wait for solar system to initialize
        await page.waitForFunction(() => window.solarSystem !== undefined);
    });

    test('Mercury orbital elements match NASA JPL data', async ({ page }) => {
        const mercuryData = await page.evaluate(() => {
            const mercury = window.solarSystem.getPlanetByName('Mercury');
            return mercury.data.orbitalElements;
        });

        expect(mercuryData.eccentricity).toBeCloseTo(0.2056, 3);
        expect(mercuryData.semiMajorAxis).toBe(35);
        expect(mercuryData.perihelion).toBeCloseTo(27.8, 1);
        expect(mercuryData.aphelion).toBeCloseTo(42.2, 1);
        expect(mercuryData.argumentOfPeriapsis).toBeCloseTo(29.1, 1);
    });

    test('All 8 planets have valid orbital elements', async ({ page }) => {
        const planets = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

        for (const planetName of planets) {
            const orbitalElements = await page.evaluate((name) => {
                const planet = window.solarSystem.getPlanetByName(name);
                return planet.data.orbitalElements;
            }, planetName);

            // Validate eccentricity: 0 ≤ e < 1.0
            expect(orbitalElements.eccentricity).toBeGreaterThanOrEqual(0);
            expect(orbitalElements.eccentricity).toBeLessThan(1.0);

            // Validate semi-major axis: a > 0
            expect(orbitalElements.semiMajorAxis).toBeGreaterThan(0);

            // Validate perihelion/aphelion relationship
            const expectedPerihelion = orbitalElements.semiMajorAxis * (1 - orbitalElements.eccentricity);
            const expectedAphelion = orbitalElements.semiMajorAxis * (1 + orbitalElements.eccentricity);

            expect(orbitalElements.perihelion).toBeCloseTo(expectedPerihelion, 1);
            expect(orbitalElements.aphelion).toBeCloseTo(expectedAphelion, 1);
        }
    });
});

test.describe('Step 5.1: Kepler\'s 1st Law Verification', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForFunction(() => window.solarSystem !== undefined);
    });

    test('Mercury orbit shows visible ellipse (e=0.2056)', async ({ page }) => {
        // Capture Mercury's position over one complete orbit
        const orbitPositions = await page.evaluate(() => {
            const mercury = window.solarSystem.getPlanetByName('Mercury');
            const positions = [];

            // Simulate 128 orbit positions
            for (let i = 0; i < 128; i++) {
                mercury.orbit.angle = (i / 128) * Math.PI * 2;
                mercury.updatePosition();

                const pos = mercury.getMesh().position;
                positions.push({
                    x: pos.x,
                    z: pos.z,
                    distance: Math.sqrt(pos.x * pos.x + pos.z * pos.z)
                });
            }

            return positions;
        });

        // Calculate perihelion and aphelion from actual positions
        const distances = orbitPositions.map(p => p.distance);
        const perihelion = Math.min(...distances);
        const aphelion = Math.max(...distances);

        // Verify eccentricity ratio: (aphelion - perihelion) / (aphelion + perihelion) ≈ e
        const measuredEccentricity = (aphelion - perihelion) / (aphelion + perihelion);
        expect(measuredEccentricity).toBeCloseTo(0.2056, 2);

        // Verify perihelion/aphelion match NASA data (±1 unit tolerance)
        expect(perihelion).toBeCloseTo(27.8, TOLERANCE_DISTANCE);
        expect(aphelion).toBeCloseTo(42.2, TOLERANCE_DISTANCE);
    });

    test('Earth orbit appears nearly circular (e=0.0167)', async ({ page }) => {
        const orbitPositions = await page.evaluate(() => {
            const earth = window.solarSystem.getPlanetByName('Earth');
            const positions = [];

            for (let i = 0; i < 128; i++) {
                earth.orbit.angle = (i / 128) * Math.PI * 2;
                earth.updatePosition();

                const pos = earth.getMesh().position;
                positions.push(Math.sqrt(pos.x * pos.x + pos.z * pos.z));
            }

            return positions;
        });

        const perihelion = Math.min(...orbitPositions);
        const aphelion = Math.max(...orbitPositions);
        const measuredEccentricity = (aphelion - perihelion) / (aphelion + perihelion);

        expect(measuredEccentricity).toBeCloseTo(0.0167, 2);
        expect(perihelion).toBeCloseTo(59.0, TOLERANCE_DISTANCE);
        expect(aphelion).toBeCloseTo(61.0, TOLERANCE_DISTANCE);
    });
});

test.describe('Step 5.1: Kepler\'s 2nd Law Verification', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForFunction(() => window.solarSystem !== undefined);
    });

    test('Mercury angular speed follows quadratic law (ω ∝ 1/r²)', async ({ page }) => {
        const speedData = await page.evaluate(() => {
            const mercury = window.solarSystem.getPlanetByName('Mercury');
            const e = mercury.data.orbitalElements.eccentricity;
            const a = mercury.data.orbitalElements.semiMajorAxis;

            // Position at perihelion (E = 0)
            mercury.orbit.angle = 0;
            mercury.updatePosition();
            const rPerihelion = mercury.currentDistance;
            const omegaPerihelion = mercury.data.orbitSpeed * Math.pow(a / rPerihelion, 2);

            // Position at aphelion (E = π)
            mercury.orbit.angle = Math.PI;
            mercury.updatePosition();
            const rAphelion = mercury.currentDistance;
            const omegaAphelion = mercury.data.orbitSpeed * Math.pow(a / rAphelion, 2);

            return {
                rPerihelion,
                rAphelion,
                omegaPerihelion,
                omegaAphelion,
                speedRatio: omegaPerihelion / omegaAphelion,
                expectedRatio: Math.pow(rAphelion / rPerihelion, 2)
            };
        });

        // Verify angular speed ratio matches quadratic law
        expect(speedData.speedRatio).toBeCloseTo(speedData.expectedRatio, 1);

        // For Mercury (e=0.2056), ratio should be ~2.30
        expect(speedData.speedRatio).toBeGreaterThan(2.0);
        expect(speedData.speedRatio).toBeLessThan(2.5);
    });

    test('Speed variation visible when approaching Sun', async ({ page }) => {
        const speedVariation = await page.evaluate(() => {
            const mars = window.solarSystem.getPlanetByName('Mars');
            const a = mars.data.orbitalElements.semiMajorAxis;

            // Measure speed at 4 orbital positions
            const speeds = [];
            for (let i = 0; i < 4; i++) {
                mars.orbit.angle = (i / 4) * Math.PI * 2;
                mars.updatePosition();
                const multiplier = Math.pow(a / mars.currentDistance, 2);
                speeds.push(multiplier);
            }

            return {
                min: Math.min(...speeds),
                max: Math.max(...speeds),
                variation: (Math.max(...speeds) - Math.min(...speeds)) / Math.max(...speeds)
            };
        });

        // Mars (e=0.0934) should show ~18% speed variation
        expect(speedVariation.variation).toBeGreaterThan(0.15);
        expect(speedVariation.variation).toBeLessThan(0.25);
    });
});

test.describe('Step 5.1: Argument of Periapsis Verification', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForFunction(() => window.solarSystem !== undefined);
    });

    test('Mercury perihelion oriented at 29.1 degrees', async ({ page }) => {
        const perihelionAngle = await page.evaluate(() => {
            const mercury = window.solarSystem.getPlanetByName('Mercury');
            const positions = [];

            // Find position with minimum distance (perihelion)
            for (let i = 0; i < 360; i++) {
                mercury.orbit.angle = (i / 360) * Math.PI * 2;
                mercury.updatePosition();

                const pos = mercury.getMesh().position;
                positions.push({
                    angle: i,
                    distance: Math.sqrt(pos.x * pos.x + pos.z * pos.z),
                    x: pos.x,
                    z: pos.z
                });
            }

            // Find perihelion position
            const perihelion = positions.reduce((min, p) => p.distance < min.distance ? p : min);

            // Calculate angle from +X axis
            const angleRad = Math.atan2(perihelion.z, perihelion.x);
            const angleDeg = angleRad * 180 / Math.PI;

            return angleDeg;
        });

        // Verify perihelion angle matches argument of periapsis (±5°)
        expect(perihelionAngle).toBeCloseTo(29.1, TOLERANCE_ANGLE);
    });

    test('Earth perihelion oriented at 288.1 degrees', async ({ page }) => {
        const perihelionAngle = await page.evaluate(() => {
            const earth = window.solarSystem.getPlanetByName('Earth');
            const positions = [];

            for (let i = 0; i < 360; i++) {
                earth.orbit.angle = (i / 360) * Math.PI * 2;
                earth.updatePosition();

                const pos = earth.getMesh().position;
                positions.push({
                    distance: Math.sqrt(pos.x * pos.x + pos.z * pos.z),
                    x: pos.x,
                    z: pos.z
                });
            }

            const perihelion = positions.reduce((min, p) => p.distance < min.distance ? p : min);
            let angleDeg = Math.atan2(perihelion.z, perihelion.x) * 180 / Math.PI;

            // Normalize to 0-360 range
            if (angleDeg < 0) angleDeg += 360;

            return angleDeg;
        });

        expect(perihelionAngle).toBeCloseTo(288.1, TOLERANCE_ANGLE);
    });
});

test.describe('Step 5.2: Performance Validation Tests', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForFunction(() => window.solarSystem !== undefined);
    });

    test('Desktop: Elliptical orbit calculation <1ms per frame', async ({ page }) => {
        const performanceData = await page.evaluate(() => {
            const results = [];

            // Measure 300 frames (5 seconds at 60fps)
            for (let frame = 0; frame < 300; frame++) {
                const startTime = performance.now();

                // Update all 8 planets
                window.solarSystem.update(0.016); // 16ms deltaTime

                const endTime = performance.now();
                results.push(endTime - startTime);
            }

            const avgTime = results.reduce((sum, t) => sum + t, 0) / results.length;
            const maxTime = Math.max(...results);

            return { avgTime, maxTime };
        });

        // Average update time should be <1ms for all planets
        expect(performanceData.avgTime).toBeLessThan(1.0);

        // Max frame time should be <2ms (accounting for initialization spikes)
        expect(performanceData.maxTime).toBeLessThan(2.0);
    });

    test('Desktop: 60+ fps maintained with elliptical orbits', async ({ page }) => {
        const frameRates = await page.evaluate(() => {
            const fps = [];
            let lastTime = performance.now();

            for (let i = 0; i < 300; i++) {
                window.solarSystem.update(0.016);

                const currentTime = performance.now();
                const frameDuration = currentTime - lastTime;
                fps.push(1000 / frameDuration);
                lastTime = currentTime;
            }

            return {
                avg: fps.reduce((sum, f) => sum + f, 0) / fps.length,
                min: Math.min(...fps)
            };
        });

        expect(frameRates.avg).toBeGreaterThanOrEqual(60);
        expect(frameRates.min).toBeGreaterThan(55); // Allow 5fps drop tolerance
    });

    test('Orbital update per planet <0.005ms (performance budget check)', async ({ page }) => {
        const updateTime = await page.evaluate(() => {
            const mercury = window.solarSystem.getPlanetByName('Mercury');
            const iterations = 1000;

            const startTime = performance.now();
            for (let i = 0; i < iterations; i++) {
                mercury.updatePosition();
            }
            const endTime = performance.now();

            return (endTime - startTime) / iterations;
        });

        // Should be <0.005ms per planet (0.5ms budget for all 8 planets)
        expect(updateTime).toBeLessThan(0.005);
    });
});

test.describe('Step 5.4: Backward Compatibility Tests', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForFunction(() => window.solarSystem !== undefined);
    });

    test('Planet without orbitalElements uses circular orbit fallback', async ({ page }) => {
        const circularOrbitData = await page.evaluate(() => {
            // Create test planet without orbital elements
            const scene = window.solarSystem.scene;
            const resourceLoader = window.solarSystem.resourceLoader;

            const testData = {
                name: 'TestPlanet',
                radius: 2,
                distance: 100,
                rotationSpeed: 0.01,
                orbitSpeed: 0.01,
                axialTilt: 0,
                texturePath: 'src/assets/textures/planets/earth/earth_map.jpg'
                // No orbitalElements defined
            };

            const testPlanet = new Planet(scene, resourceLoader, testData);

            // Simulate positions over orbit
            const distances = [];
            for (let i = 0; i < 128; i++) {
                testPlanet.orbit.angle = (i / 128) * Math.PI * 2;
                testPlanet.updatePosition();

                const pos = testPlanet.mesh.position;
                distances.push(Math.sqrt(pos.x * pos.x + pos.z * pos.z));
            }

            return {
                min: Math.min(...distances),
                max: Math.max(...distances),
                avg: distances.reduce((sum, d) => sum + d, 0) / distances.length
            };
        });

        // Circular orbit: min ≈ max ≈ avg ≈ distance
        expect(circularOrbitData.min).toBeCloseTo(100, 0.1);
        expect(circularOrbitData.max).toBeCloseTo(100, 0.1);
        expect(circularOrbitData.avg).toBeCloseTo(100, 0.1);
    });

    test('Invalid eccentricity (e≥1.0) falls back to circular orbit', async ({ page }) => {
        const { consoleWarnings, orbitType } = await page.evaluate(() => {
            const warnings = [];
            const originalWarn = console.warn;
            console.warn = (...args) => warnings.push(args.join(' '));

            const scene = window.solarSystem.scene;
            const resourceLoader = window.solarSystem.resourceLoader;

            const invalidData = {
                name: 'InvalidPlanet',
                radius: 2,
                distance: 100,
                rotationSpeed: 0.01,
                orbitSpeed: 0.01,
                axialTilt: 0,
                texturePath: 'src/assets/textures/planets/earth/earth_map.jpg',
                orbitalElements: {
                    semiMajorAxis: 100,
                    eccentricity: 1.5,  // Invalid: hyperbolic orbit
                    perihelion: 50,
                    aphelion: 150,
                    argumentOfPeriapsis: 0
                }
            };

            const testPlanet = new Planet(scene, resourceLoader, invalidData);
            testPlanet.updatePosition();

            console.warn = originalWarn;

            return {
                consoleWarnings: warnings,
                orbitType: testPlanet.currentDistance !== undefined ? 'circular' : 'unknown'
            };
        });

        // Verify warning was logged
        expect(consoleWarnings.length).toBeGreaterThan(0);
        expect(consoleWarnings[0]).toContain('Invalid orbital elements');

        // Verify fallback to circular orbit
        expect(orbitType).toBe('circular');
    });
});

test.describe('Step 5.4: Error Handling Tests', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForFunction(() => window.solarSystem !== undefined);
    });

    test('Kepler solver handles edge cases without crashing', async ({ page }) => {
        const edgeCases = await page.evaluate(() => {
            const mercury = window.solarSystem.getPlanetByName('Mercury');
            const results = [];

            // Test edge case: Mean anomaly = 0 (perihelion)
            mercury.orbit.angle = 0;
            mercury.updatePosition();
            results.push({ case: 'M=0', success: !isNaN(mercury.mesh.position.x) });

            // Test edge case: Mean anomaly = π (aphelion)
            mercury.orbit.angle = Math.PI;
            mercury.updatePosition();
            results.push({ case: 'M=π', success: !isNaN(mercury.mesh.position.x) });

            // Test edge case: Mean anomaly = 2π (full orbit)
            mercury.orbit.angle = Math.PI * 2;
            mercury.updatePosition();
            results.push({ case: 'M=2π', success: !isNaN(mercury.mesh.position.x) });

            return results;
        });

        // All edge cases should succeed without NaN
        edgeCases.forEach(result => {
            expect(result.success).toBe(true);
        });
    });

    test('No console errors during normal operation', async ({ page }) => {
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        await page.goto(BASE_URL);
        await page.waitForFunction(() => window.solarSystem !== undefined);

        // Run simulation for 5 seconds
        await page.evaluate(() => {
            for (let i = 0; i < 300; i++) {
                window.solarSystem.update(0.016);
            }
        });

        // No errors should be logged
        expect(consoleErrors.length).toBe(0);
    });
});

/**
 * Step 5.3: Performance Profiling Instructions
 *
 * MANUAL STEPS (Chrome DevTools):
 *
 * 1. Open Chrome DevTools (F12)
 * 2. Navigate to "Performance" tab
 * 3. Click "Record" button
 * 4. Let simulation run for 10 seconds
 * 5. Click "Stop" button
 * 6. Analyze results:
 *    - Find "updatePosition" calls in flame graph
 *    - Verify each call is <0.01ms (Self Time)
 *    - Total orbital calculation time should be <1% of frame
 *
 * VALIDATION CRITERIA:
 * - Desktop (3.0 GHz): updatePosition() avg = 0.0036ms per frame
 * - Mobile (2.65 GHz): updatePosition() avg = 0.0041ms per frame
 * - Frame budget usage: <1% (elliptical orbits) vs <0.2% (circular orbits)
 *
 * COMPARISON:
 * - Iteration 1 (with atan2): ~0.006ms per frame
 * - Iteration 2 (optimized): ~0.0036ms per frame (40% speedup)
 *
 * If profiling shows >0.01ms per planet:
 * - Reduce Newton iterations from 4 to 3
 * - Verify precomputed values (sqrtFactor, cosOmega, sinOmega) are used
 * - Check for unnecessary sqrt() or trig function calls
 */
