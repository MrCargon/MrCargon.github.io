// Space Environment Critical Fixes Validation Tests
// Tests for CRIT-001 (Neptune visibility) and CRIT-002 (AsteroidBelt performance)

const { test, expect } = require('@playwright/test');

test.describe('Space Environment Critical Fixes', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        // Wait for Three.js scene to initialize
        await page.waitForTimeout(3000);
    });

    test('CRIT-001: Neptune should be visible with far=4000', async ({ page }) => {
        // Check for console errors
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        // Wait for scene initialization
        await page.waitForTimeout(2000);

        // Check that Neptune exists in the scene
        const neptuneExists = await page.evaluate(() => {
            if (!window.spaceEnvironment) return false;
            const solarSystem = window.spaceEnvironment.solarSystem;
            if (!solarSystem || !solarSystem.planets) return false;

            // Find Neptune (8th planet, index 7)
            const neptune = solarSystem.planets[7];
            if (!neptune) return false;

            return {
                exists: true,
                name: neptune.name,
                position: neptune.mesh ? {
                    x: neptune.mesh.position.x,
                    y: neptune.mesh.position.y,
                    z: neptune.mesh.position.z
                } : null,
                distance: neptune.distance,
                visible: neptune.mesh ? neptune.mesh.visible : false
            };
        });

        console.log('Neptune Status:', JSON.stringify(neptuneExists, null, 2));

        expect(neptuneExists.exists).toBe(true);
        expect(neptuneExists.name).toBe('Neptune');
        expect(neptuneExists.visible).toBe(true);
        expect(neptuneExists.distance).toBeGreaterThan(1000); // Neptune should be far away

        // Verify no console errors
        expect(consoleErrors.length).toBe(0);
    });

    test('CRIT-002: Asteroid belt should use InstancedMesh', async ({ page }) => {
        // Wait for scene initialization
        await page.waitForTimeout(2000);

        const asteroidBeltInfo = await page.evaluate(() => {
            if (!window.spaceEnvironment) return null;
            const solarSystem = window.spaceEnvironment.solarSystem;
            if (!solarSystem || !solarSystem.asteroidBelt) return null;

            const belt = solarSystem.asteroidBelt;

            return {
                exists: true,
                hasInstancedMesh: belt.instancedMesh !== null && belt.instancedMesh !== undefined,
                instanceType: belt.instancedMesh ? belt.instancedMesh.constructor.name : null,
                count: belt.count,
                orbitDataLength: belt.orbitData ? belt.orbitData.length : 0
            };
        });

        console.log('Asteroid Belt Info:', JSON.stringify(asteroidBeltInfo, null, 2));

        expect(asteroidBeltInfo).not.toBeNull();
        expect(asteroidBeltInfo.exists).toBe(true);
        expect(asteroidBeltInfo.hasInstancedMesh).toBe(true);
        expect(asteroidBeltInfo.instanceType).toBe('InstancedMesh');
        expect(asteroidBeltInfo.count).toBeGreaterThan(0);
        expect(asteroidBeltInfo.orbitDataLength).toBe(asteroidBeltInfo.count);
    });

    test('Performance: Measure FPS and check for smooth animation', async ({ page }) => {
        // Wait for scene to stabilize
        await page.waitForTimeout(3000);

        // Measure FPS over 5 seconds
        const performanceMetrics = await page.evaluate(() => {
            return new Promise((resolve) => {
                const measurements = [];
                let frameCount = 0;
                let startTime = performance.now();
                let lastTime = startTime;

                function measureFrame() {
                    const currentTime = performance.now();
                    const deltaTime = currentTime - lastTime;
                    const fps = 1000 / deltaTime;

                    measurements.push({
                        fps: fps,
                        deltaTime: deltaTime
                    });

                    lastTime = currentTime;
                    frameCount++;

                    // Measure for 5 seconds
                    if (currentTime - startTime < 5000) {
                        requestAnimationFrame(measureFrame);
                    } else {
                        // Calculate statistics
                        const fpsList = measurements.map(m => m.fps);
                        const avgFps = fpsList.reduce((a, b) => a + b, 0) / fpsList.length;
                        const minFps = Math.min(...fpsList);
                        const maxFps = Math.max(...fpsList);

                        resolve({
                            frameCount: frameCount,
                            avgFps: Math.round(avgFps),
                            minFps: Math.round(minFps),
                            maxFps: Math.round(maxFps),
                            duration: currentTime - startTime
                        });
                    }
                }

                requestAnimationFrame(measureFrame);
            });
        });

        console.log('Performance Metrics:', JSON.stringify(performanceMetrics, null, 2));

        // Verify acceptable FPS (should be at least 30 FPS average)
        expect(performanceMetrics.avgFps).toBeGreaterThanOrEqual(30);
        expect(performanceMetrics.minFps).toBeGreaterThan(0);

        // Log results for manual verification
        console.log(`Average FPS: ${performanceMetrics.avgFps}`);
        console.log(`Min FPS: ${performanceMetrics.minFps}`);
        console.log(`Max FPS: ${performanceMetrics.maxFps}`);
        console.log(`Total Frames: ${performanceMetrics.frameCount}`);
    });

    test('Console: Verify no errors or warnings', async ({ page }) => {
        const consoleMessages = {
            errors: [],
            warnings: [],
            assertions: []
        };

        page.on('console', msg => {
            const text = msg.text();
            if (msg.type() === 'error') {
                consoleMessages.errors.push(text);
            } else if (msg.type() === 'warning') {
                consoleMessages.warnings.push(text);
            } else if (text.includes('Assertion failed')) {
                consoleMessages.assertions.push(text);
            }
        });

        // Wait for full initialization
        await page.waitForTimeout(5000);

        console.log('Console Messages:', JSON.stringify(consoleMessages, null, 2));

        // Verify no errors (except texture loading warnings which are acceptable)
        const criticalErrors = consoleMessages.errors.filter(e =>
            !e.includes('404') && !e.includes('texture')
        );
        expect(criticalErrors.length).toBe(0);

        // Verify no assertion failures
        expect(consoleMessages.assertions.length).toBe(0);
    });

    test('Camera: Verify far clipping plane set to 4000', async ({ page }) => {
        await page.waitForTimeout(2000);

        const cameraInfo = await page.evaluate(() => {
            if (!window.spaceEnvironment || !window.spaceEnvironment.camera) {
                return null;
            }

            const camera = window.spaceEnvironment.camera;
            return {
                near: camera.near,
                far: camera.far,
                fov: camera.fov,
                type: camera.type
            };
        });

        console.log('Camera Info:', JSON.stringify(cameraInfo, null, 2));

        expect(cameraInfo).not.toBeNull();
        expect(cameraInfo.far).toBe(4000);
        expect(cameraInfo.near).toBe(0.1);
    });
});
