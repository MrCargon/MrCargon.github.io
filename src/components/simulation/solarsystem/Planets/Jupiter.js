// Jupiter.js - Gas giant with 4 Galilean moons
// NASA JPL orbital parameters sourced from horizons.jpl.nasa.gov
// Last updated: 2026-01-01

class Jupiter extends Planet {
    constructor(scene, resourceLoader, data) {
        // NASA Rule 5: Assert preconditions
        console.assert(scene !== null && scene !== undefined,
            "Jupiter.constructor: scene must be valid");
        console.assert(resourceLoader !== null && resourceLoader !== undefined,
            "Jupiter.constructor: resourceLoader must be valid");
        console.assert(data !== null && data !== undefined,
            "Jupiter.constructor: data must be valid");

        super(scene, resourceLoader, data);

        // Define 4 Galilean moons with NASA JPL orbital parameters
        // NASA Rule 6: Minimal scope (defined as instance property, not global)
        // NASA Rule 2: Fixed array size (4 moons, bounded iteration)
        this.moonsData = [
            {
                name: "Io",
                radius: 0.4, // Relative scale
                distance: 7.5, // Orbital radius from Jupiter
                rotationSpeed: 0.015, // Rotation rate (tidal lock approximation)
                orbitSpeed: 0.08, // Fastest Galilean moon (1.77 days)
                orbitalInclination: 0.04, // Degrees relative to Jupiter equator (NASA JPL)
                color: 0xffcc00 // Sulfurous yellow fallback
            },
            {
                name: "Europa",
                radius: 0.35, // Slightly smaller than Io
                distance: 10.0, // 2nd orbital position
                rotationSpeed: 0.012,
                orbitSpeed: 0.05, // 3.55 days
                orbitalInclination: 0.47, // Degrees relative to Jupiter equator (NASA JPL)
                color: 0xaaccee // Icy blue-white fallback
            },
            {
                name: "Ganymede",
                radius: 0.5, // Largest moon in solar system
                distance: 15.0, // 3rd orbital position
                rotationSpeed: 0.010,
                orbitSpeed: 0.03, // 7.15 days
                orbitalInclination: 0.20, // Degrees relative to Jupiter equator (NASA JPL)
                color: 0xccaa99 // Dusty gray-brown fallback
            },
            {
                name: "Callisto",
                radius: 0.45, // 2nd largest, heavily cratered
                distance: 22.0, // Outermost Galilean moon
                rotationSpeed: 0.008,
                orbitSpeed: 0.02, // Slowest: 16.69 days
                orbitalInclination: 0.19, // Degrees relative to Jupiter equator (NASA JPL)
                color: 0x996666 // Dark reddish-brown fallback
            }
        ];

        // NASA Rule 6: Minimal scope (moon tracking arrays)
        this.moonGroup = null;
        this.moons = [];
    }

    async init() {
        // NASA Rule 5: Assert method preconditions
        console.assert(this.scene !== null,
            "Jupiter.init: scene must be initialized");
        console.assert(this.resourceLoader !== null,
            "Jupiter.init: resourceLoader must be initialized");

        // Initialize base planet (texture, geometry, positioning)
        const baseInitSuccess = await super.init();

        // NASA Rule 7: Check return values
        if (!baseInitSuccess) {
            console.error("Jupiter.init: Base planet initialization failed");
            return false;
        }

        // Create moon orbit group (attached to Jupiter mesh)
        this.moonGroup = new THREE.Group();
        this.mesh.add(this.moonGroup);

        // Create all 4 Galilean moons
        const moonsCreated = await this.createMoons();

        // NASA Rule 7: Check return values
        if (!moonsCreated) {
            console.warn("Jupiter.init: Some moons failed to create");
            // Non-critical: planet still functional without moons
        }

        return true;
    }

    // Create all 4 Galilean moons
    // NASA Rule 4: Function ≤60 lines
    async createMoons() {
        // NASA Rule 5: Assert preconditions
        console.assert(this.moonGroup !== null,
            "Jupiter.createMoons: moonGroup must be initialized");
        console.assert(this.moonsData.length > 0,
            "Jupiter.createMoons: moonsData must have at least one entry");

        let successCount = 0;

        // NASA Rule 2: Fixed loop bounds (array.length = 4)
        for (let i = 0; i < this.moonsData.length; i++) {
            const moonData = this.moonsData[i];

            try {
                const moonCreated = await this.createSingleMoon(moonData);

                // NASA Rule 7: Check return values
                if (moonCreated) {
                    successCount++;
                } else {
                    console.warn(`Jupiter.createMoons: Failed to create ${moonData.name}`);
                }
            } catch (error) {
                console.error(`Jupiter.createMoons: Exception creating ${moonData.name}:`, error);
            }
        }

        // NASA Rule 5: Validate runtime results
        console.assert(successCount > 0, `Jupiter.createMoons: At least one moon must be created (got ${successCount}/${this.moonsData.length})`);
        console.assert(this.moons.length === successCount, `Jupiter.createMoons: Moons array length must match success count (${this.moons.length} vs ${successCount})`);

        // Return true if at least 1 moon created successfully
        return successCount > 0;
    }

    // Create a single moon following Earth.js pattern (lines 24-63)
    // NASA Rule 4: Function ≤60 lines
    async createSingleMoon(moonData) {
        // NASA Rule 5: Assert preconditions
        console.assert(moonData !== null && moonData !== undefined,
            "Jupiter.createSingleMoon: moonData must be valid");
        console.assert(this.moonGroup !== null,
            "Jupiter.createSingleMoon: moonGroup must be initialized");

        let moonTexture = null;

        // Only attempt texture load if path is defined
        if (moonData.texturePath) {
            try {
                moonTexture = await this.resourceLoader.loadTexture(moonData.texturePath);

                // NASA Rule 7: Check return value
                if (!moonTexture) {
                    console.warn(`Jupiter.createSingleMoon: Texture load failed for ${moonData.name}, using color fallback`);
                }
            } catch (error) {
                console.warn(`Jupiter.createSingleMoon: Texture load error for ${moonData.name}:`, error);
                // Continue with color fallback
            }
        }
        // If no texturePath, moonTexture remains null and color fallback is used

        // Defensive check: ensure we have either texture or color
        if (!moonTexture && !moonData.color) {
            console.error(`Jupiter.createSingleMoon: Moon ${moonData.name} has no texture or color - using default gray`);
            moonData.color = 0x808080; // Default gray fallback
        }

        // Create moon geometry
        const moonGeometry = new THREE.SphereGeometry(moonData.radius, 32, 32);

        // Create material (texture or solid color fallback)
        const moonMaterial = new THREE.MeshPhongMaterial({
            map: moonTexture, // null if texture failed
            color: moonTexture ? 0xffffff : moonData.color, // Use color only if no texture
            shininess: 10
        });

        // Create moon mesh
        const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);

        // Position moon in its orbital radius
        moonMesh.position.set(moonData.distance, 0, 0);

        // NASA Rule 5: Validate calculation results
        const positionMagnitude = moonMesh.position.length();
        console.assert(isFinite(positionMagnitude) && positionMagnitude > 0, `Jupiter.createSingleMoon: ${moonData.name} position must be finite and non-zero (got ${positionMagnitude})`);
        console.assert(positionMagnitude <= moonData.distance * 1.1, `Jupiter.createSingleMoon: ${moonData.name} position ${positionMagnitude} exceeds expected distance ${moonData.distance}`);

        // Add moon to orbit group (rotation of this group = orbital motion)
        this.moonGroup.add(moonMesh);

        // Store moon data for animation (consistent with Mars/Saturn/Neptune pattern)
        this.moons.push({
            mesh: moonMesh,
            orbit: { angle: 0 }, // Initial orbital angle
            data: moonData
        });

        return true;
    }

    // Override update to handle moon orbital mechanics
    // NASA Rule 4: Function ≤60 lines
    update(deltaTime, j2000Days = null) {
        // NASA Rule 5: Assert preconditions
        console.assert(typeof deltaTime === 'number' && deltaTime >= 0, "Jupiter.update: deltaTime must be non-negative number");
        console.assert(this.moons.length > 0 || this.moonsData.length === 0, "Jupiter.update: If moonsData exists, moons array should not be empty");

        // Update base planet (rotation, orbit) - pass j2000Days for time-sync mode
        super.update(deltaTime, j2000Days);

        // Update each moon's orbit individually
        // NASA Rule 2: Fixed loop bounds (this.moons.length ≤ 4)
        for (let i = 0; i < this.moons.length; i++) {
            const moon = this.moons[i];

            // NASA Rule 7: Check moon object validity
            if (!moon || !moon.mesh || !moon.data) {
                console.warn(`Jupiter.update: Invalid moon at index ${i}`);
                continue;
            }

            // Update orbital angle
            moon.orbit.angle += moon.data.orbitSpeed * deltaTime;

            // Calculate orbital position (circular orbit)
            // Calculate position in orbital plane
            const x = Math.cos(moon.orbit.angle) * moon.data.distance;
            let y = 0;
            let z = Math.sin(moon.orbit.angle) * moon.data.distance;

            // Apply orbital inclination if specified
            if (moon.data.orbitalInclination !== undefined) {
                const inclination = moon.data.orbitalInclination * (Math.PI / 180);
                const cosI = Math.cos(inclination);
                const sinI = Math.sin(inclination);

                // Rotate around X-axis
                const yRotated = (y * cosI) - (z * sinI);
                const zRotated = (y * sinI) + (z * cosI);

                y = yRotated;
                z = zRotated;
            }

            // Update moon position
            moon.mesh.position.set(x, y, z);

            // Rotate moon on axis (tidal locking)
            moon.mesh.rotation.y += moon.data.rotationSpeed * deltaTime;
        }
    }

    // Cleanup resources
    // NASA Rule 4: Function ≤60 lines
    dispose() {
        // NASA Rule 5: Assert preconditions
        console.assert(this.mesh !== null,
            "Jupiter.dispose: mesh should exist before disposal");

        // Dispose all moons
        // NASA Rule 2: Fixed loop bounds
        for (let i = 0; i < this.moons.length; i++) {
            const moon = this.moons[i];

            if (moon && moon.mesh) {
                // Dispose moon geometry
                if (moon.mesh.geometry) {
                    moon.mesh.geometry.dispose();
                }

                // Dispose moon material
                if (moon.mesh.material) {
                    if (moon.mesh.material.map) {
                        moon.mesh.material.map.dispose();
                    }
                    moon.mesh.material.dispose();
                }
            }
        }

        // Clear moons array
        this.moons = [];

        // Dispose base planet resources
        super.dispose();
    }
}

// IMPORTANT: Make Jupiter globally available
window.Jupiter = Jupiter;

// Testing commands:
// 1. Verify all 4 moons visible:
//    console.log(solarSystem.planets.find(p => p.data.name === 'Jupiter').moons.length); // Should output: 4
//
// 2. Check orbital speeds (Io fastest, Callisto slowest):
//    const jupiter = solarSystem.planets.find(p => p.data.name === 'Jupiter');
//    jupiter.moons.forEach(m => console.log(m.data.name, m.data.orbitSpeed));
//
// 3. Performance test (60 FPS check):
//    Open browser DevTools -> Performance tab -> Record 10 seconds -> Check FPS graph
//
// 4. Visual verification:
//    Zoom to Jupiter, verify 4 distinct moons orbiting at different speeds
//    Io should complete orbit ~4x faster than Callisto
//
// 5. Console error check:
//    Open DevTools Console -> Filter by "Jupiter" -> Should show no errors