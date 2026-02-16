// Uranus.js - Ice giant with 5 major moons
// NASA JPL orbital parameters sourced from horizons.jpl.nasa.gov
// Last updated: 2026-01-01

class Uranus extends Planet {
    constructor(scene, resourceLoader, data) {
        // NASA Rule 5: Assert preconditions
        console.assert(scene !== null && scene !== undefined,
            "Uranus.constructor: scene must be valid");
        console.assert(resourceLoader !== null && resourceLoader !== undefined,
            "Uranus.constructor: resourceLoader must be valid");
        console.assert(data !== null && data !== undefined,
            "Uranus.constructor: data must be valid");

        super(scene, resourceLoader, data);

        // Define 5 major moons with NASA JPL orbital parameters
        // NASA Rule 6: Minimal scope (defined as instance property, not global)
        // NASA Rule 2: Fixed array size (5 moons, bounded iteration)
        this.moonsData = [
            {
                name: "Miranda",
                radius: 0.14, // Smallest of the 5 major moons
                distance: 6.0, // Closest orbit
                rotationSpeed: 0.018, // Tidal lock approximation
                orbitSpeed: 0.07, // Fastest (1.41 days)
                orbitalInclination: 4.34, // Degrees relative to Uranus equator (NASA JPL)
                color: 0xccddee // Light blue-gray (patchwork terrain)
            },
            {
                name: "Ariel",
                radius: 0.22, // 4th largest
                distance: 9.0, // 2nd orbital position
                rotationSpeed: 0.015,
                orbitSpeed: 0.05, // 2.52 days
                orbitalInclination: 0.26, // Degrees relative to Uranus equator (NASA JPL)
                color: 0xddddcc // Bright grayish-white
            },
            {
                name: "Umbriel",
                radius: 0.23, // 3rd largest
                distance: 12.0, // 3rd orbital position
                rotationSpeed: 0.013,
                orbitSpeed: 0.04, // 4.14 days (darkest moon)
                orbitalInclination: 0.13, // Degrees relative to Uranus equator (NASA JPL)
                color: 0x445566 // Dark gray-blue (very low albedo)
            },
            {
                name: "Titania",
                radius: 0.30, // Largest Uranian moon
                distance: 16.0, // 4th orbital position
                rotationSpeed: 0.011,
                orbitSpeed: 0.03, // 8.71 days
                orbitalInclination: 0.08, // Degrees relative to Uranus equator (NASA JPL)
                color: 0xbbccdd // Reddish-gray icy surface
            },
            {
                name: "Oberon",
                radius: 0.29, // 2nd largest
                distance: 20.0, // Outermost major moon
                rotationSpeed: 0.009,
                orbitSpeed: 0.025, // Slowest: 13.46 days
                orbitalInclination: 0.07, // Degrees relative to Uranus equator (NASA JPL)
                color: 0xaabbcc // Cratered icy surface
            }
        ];

        // NASA Rule 6: Minimal scope (moon tracking arrays)
        this.moonGroup = null;
        this.moons = [];
    }

    async init() {
        // NASA Rule 5: Assert method preconditions
        console.assert(this.scene !== null,
            "Uranus.init: scene must be initialized");
        console.assert(this.resourceLoader !== null,
            "Uranus.init: resourceLoader must be initialized");

        // Initialize base planet (texture, geometry, positioning)
        const baseInitSuccess = await super.init();

        // NASA Rule 7: Check return values
        if (!baseInitSuccess) {
            console.error("Uranus.init: Base planet initialization failed");
            return false;
        }

        // Create moon orbit group (attached to Uranus mesh)
        this.moonGroup = new THREE.Group();
        this.mesh.add(this.moonGroup);

        // Create all 5 major moons
        const moonsCreated = await this.createMoons();

        // NASA Rule 7: Check return values
        if (!moonsCreated) {
            console.warn("Uranus.init: Some moons failed to create");
            // Non-critical: planet still functional without moons
        }

        return true;
    }

    // Create all 5 major moons
    // NASA Rule 4: Function ≤60 lines
    async createMoons() {
        // NASA Rule 5: Assert preconditions
        console.assert(this.moonGroup !== null,
            "Uranus.createMoons: moonGroup must be initialized");
        console.assert(this.moonsData.length > 0,
            "Uranus.createMoons: moonsData must have at least one entry");

        let successCount = 0;

        // NASA Rule 2: Fixed loop bounds (array.length = 5)
        for (let i = 0; i < this.moonsData.length; i++) {
            const moonData = this.moonsData[i];

            try {
                const moonCreated = await this.createSingleMoon(moonData);

                // NASA Rule 7: Check return values
                if (moonCreated) {
                    successCount++;
                } else {
                    console.warn(`Uranus.createMoons: Failed to create ${moonData.name}`);
                }
            } catch (error) {
                console.error(`Uranus.createMoons: Exception creating ${moonData.name}:`, error);
            }
        }

        // NASA Rule 5: Validate runtime results
        console.assert(successCount > 0, `Uranus.createMoons: At least one moon must be created (got ${successCount}/${this.moonsData.length})`);
        console.assert(this.moons.length === successCount, `Uranus.createMoons: Moons array length must match success count (${this.moons.length} vs ${successCount})`);

        // Return true if at least 1 moon created successfully
        return successCount > 0;
    }

    // Create a single moon following Jupiter.js pattern
    // NASA Rule 4: Function ≤60 lines
    async createSingleMoon(moonData) {
        // NASA Rule 5: Assert preconditions
        console.assert(moonData !== null && moonData !== undefined,
            "Uranus.createSingleMoon: moonData must be valid");
        console.assert(this.moonGroup !== null,
            "Uranus.createSingleMoon: moonGroup must be initialized");

        let moonTexture = null;

        // Only attempt texture load if path is defined
        if (moonData.texturePath) {
            try {
                moonTexture = await this.resourceLoader.loadTexture(moonData.texturePath);

                // NASA Rule 7: Check return value
                if (!moonTexture) {
                    console.warn(`Uranus.createSingleMoon: Texture load failed for ${moonData.name}, using color fallback`);
                }
            } catch (error) {
                console.warn(`Uranus.createSingleMoon: Texture load error for ${moonData.name}:`, error);
                // Continue with color fallback
            }
        }
        // If no texturePath, moonTexture remains null and color fallback is used

        // Defensive check: ensure we have either texture or color
        if (!moonTexture && !moonData.color) {
            console.error(`Uranus.createSingleMoon: Moon ${moonData.name} has no texture or color - using default gray`);
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
        console.assert(isFinite(positionMagnitude) && positionMagnitude > 0, `Uranus.createSingleMoon: ${moonData.name} position must be finite and non-zero (got ${positionMagnitude})`);
        console.assert(positionMagnitude <= moonData.distance * 1.1, `Uranus.createSingleMoon: ${moonData.name} position ${positionMagnitude} exceeds expected distance ${moonData.distance}`);

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
        console.assert(typeof deltaTime === 'number' && deltaTime >= 0, "Uranus.update: deltaTime must be non-negative number");
        console.assert(this.moons.length > 0 || this.moonsData.length === 0, "Uranus.update: If moonsData exists, moons array should not be empty");

        // Update base planet (rotation, orbit) - pass j2000Days for time-sync mode
        super.update(deltaTime, j2000Days);

        // Update each moon's orbit individually
        // NASA Rule 2: Fixed loop bounds (this.moons.length ≤ 5)
        for (let i = 0; i < this.moons.length; i++) {
            const moon = this.moons[i];

            // NASA Rule 7: Check moon object validity
            if (!moon || !moon.mesh || !moon.data) {
                console.warn(`Uranus.update: Invalid moon at index ${i}`);
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
            "Uranus.dispose: mesh should exist before disposal");

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

// IMPORTANT: Make Uranus globally available
window.Uranus = Uranus;

// Testing commands:
// 1. Verify all 5 moons visible:
//    console.log(solarSystem.planets.find(p => p.data.name === 'Uranus').moons.length); // Should output: 5
//
// 2. Check orbital speeds (Miranda fastest, Oberon slowest):
//    const uranus = solarSystem.planets.find(p => p.data.name === 'Uranus');
//    uranus.moons.forEach(m => console.log(m.data.name, m.data.orbitSpeed));
//
// 3. Check size hierarchy (Titania largest, Miranda smallest):
//    const uranus = solarSystem.planets.find(p => p.data.name === 'Uranus');
//    uranus.moons.forEach(m => console.log(m.data.name, m.data.radius));
//
// 4. Performance test (60 FPS check):
//    Open browser DevTools -> Performance tab -> Record 10 seconds -> Check FPS graph
//
// 5. Visual verification:
//    Zoom to Uranus, verify 5 distinct moons orbiting at different speeds
//    Miranda should complete orbit ~2.8x faster than Oberon
//    Titania should be visibly largest, Miranda smallest
//
// 6. Console error check:
//    Open DevTools Console -> Filter by "Uranus" -> Should show no errors
