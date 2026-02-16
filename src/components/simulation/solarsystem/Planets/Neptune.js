// Neptune.js - Ice giant with unique retrograde moon Triton
// NASA JPL orbital parameters sourced from horizons.jpl.nasa.gov
// Last updated: 2026-01-01

class Neptune extends Planet {
    constructor(scene, resourceLoader, data) {
        // NASA Rule 5: Assert preconditions
        console.assert(scene !== null && scene !== undefined,
            "Neptune.constructor: scene must be valid");
        console.assert(resourceLoader !== null && resourceLoader !== undefined,
            "Neptune.constructor: resourceLoader must be valid");
        console.assert(data !== null && data !== undefined,
            "Neptune.constructor: data must be valid");

        super(scene, resourceLoader, data);

        // Define 1 major moon with NASA JPL orbital parameters
        // NASA Rule 6: Minimal scope (defined as instance property, not global)
        // NASA Rule 2: Fixed array size (1 moon, bounded iteration)
        this.moonsData = [
            {
                name: "Triton",
                radius: 0.32, // 3rd largest moon in solar system
                distance: 13.0, // Orbital radius
                rotationSpeed: 0.016, // Tidally locked rotation
                orbitSpeed: -0.04, // ⚠️ NEGATIVE = RETROGRADE ORBIT (unique!)
                orbitalInclination: 156.8, // Degrees relative to Neptune equator (NASA JPL)
                color: 0xccddff // Icy blue-white (nitrogen ice surface)
            }
        ];

        // NASA Rule 6: Minimal scope (moon tracking arrays)
        this.moonGroup = null;
        this.moons = [];
    }

    async init() {
        // NASA Rule 5: Assert method preconditions
        console.assert(this.scene !== null,
            "Neptune.init: scene must be initialized");
        console.assert(this.resourceLoader !== null,
            "Neptune.init: resourceLoader must be initialized");

        // Initialize base planet (texture, geometry, positioning)
        const baseInitSuccess = await super.init();

        // NASA Rule 7: Check return values
        if (!baseInitSuccess) {
            console.error("Neptune.init: Base planet initialization failed");
            return false;
        }

        // Create moon orbit group (attached to Neptune mesh)
        this.moonGroup = new THREE.Group();
        this.mesh.add(this.moonGroup);

        // Create Triton
        const moonsCreated = await this.createMoons();

        // NASA Rule 7: Check return values
        if (!moonsCreated) {
            console.warn("Neptune.init: Moon creation failed");
            // Non-critical: planet still functional without moons
        }

        return true;
    }

    // Create Triton moon
    // NASA Rule 4: Function ≤60 lines
    async createMoons() {
        // NASA Rule 5: Assert preconditions
        console.assert(this.moonGroup !== null,
            "Neptune.createMoons: moonGroup must be initialized");
        console.assert(this.moonsData.length > 0,
            "Neptune.createMoons: moonsData must have at least one entry");

        let successCount = 0;

        // NASA Rule 2: Fixed loop bounds (array.length = 1)
        for (let i = 0; i < this.moonsData.length; i++) {
            const moonData = this.moonsData[i];

            try {
                const moonCreated = await this.createSingleMoon(moonData);

                // NASA Rule 7: Check return values
                if (moonCreated) {
                    successCount++;
                } else {
                    console.warn(`Neptune.createMoons: Failed to create ${moonData.name}`);
                }
            } catch (error) {
                console.error(`Neptune.createMoons: Exception creating ${moonData.name}:`, error);
            }
        }

        // NASA Rule 5: Validate runtime results
        console.assert(successCount > 0, `Neptune.createMoons: At least one moon must be created (got ${successCount}/${this.moonsData.length})`);
        console.assert(this.moons.length === successCount, `Neptune.createMoons: Moons array length must match success count (${this.moons.length} vs ${successCount})`);

        // Return true if moon created successfully
        return successCount > 0;
    }

    // Create single moon with icy surface
    // NASA Rule 4: Function ≤60 lines
    async createSingleMoon(moonData) {
        // NASA Rule 5: Assert preconditions
        console.assert(moonData !== null && moonData !== undefined,
            "Neptune.createSingleMoon: moonData must be valid");
        console.assert(this.moonGroup !== null,
            "Neptune.createSingleMoon: moonGroup must be initialized");

        let moonTexture = null;

        // Only attempt texture load if path is defined
        if (moonData.texturePath) {
            try {
                moonTexture = await this.resourceLoader.loadTexture(moonData.texturePath);

                // NASA Rule 7: Check return value
                if (!moonTexture) {
                    console.warn(`Neptune.createSingleMoon: Texture load failed for ${moonData.name}, using color fallback`);
                }
            } catch (error) {
                console.warn(`Neptune.createSingleMoon: Texture load error for ${moonData.name}:`, error);
                // Continue with color fallback
            }
        }
        // If no texturePath, moonTexture remains null and color fallback is used

        // Defensive check: ensure we have either texture or color
        if (!moonTexture && !moonData.color) {
            console.error(`Neptune.createSingleMoon: Moon ${moonData.name} has no texture or color - using default gray`);
            moonData.color = 0x808080; // Default gray fallback
        }

        // Create moon geometry with standard segment count for smooth icy surface
        const moonGeometry = new THREE.SphereGeometry(
            moonData.radius,
            32,
            32
        );

        // Create material (texture or solid color fallback)
        const moonMaterial = new THREE.MeshPhongMaterial({
            map: moonTexture, // null if texture failed
            color: moonTexture ? 0xffffff : moonData.color, // Use color only if no texture
            shininess: 20 // Higher shininess for icy surface
        });

        // Create moon mesh
        const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);

        // Position moon in its orbital radius
        moonMesh.position.set(moonData.distance, 0, 0);

        // NASA Rule 5: Validate calculation results
        const positionMagnitude = moonMesh.position.length();
        console.assert(isFinite(positionMagnitude) && positionMagnitude > 0, `Neptune.createSingleMoon: ${moonData.name} position must be finite and non-zero (got ${positionMagnitude})`);
        console.assert(positionMagnitude <= moonData.distance * 1.1, `Neptune.createSingleMoon: ${moonData.name} position ${positionMagnitude} exceeds expected distance ${moonData.distance}`);

        // Add moon to orbit group (rotation of this group = orbital motion)
        this.moonGroup.add(moonMesh);

        // Store moon data for animation (follows Mars.js pattern)
        this.moons.push({
            mesh: moonMesh,
            orbit: { angle: 0 }, // Initial orbital angle
            data: moonData
        });

        return true;
    }

    // Override update to handle moon orbital mechanics (including retrograde)
    // NASA Rule 4: Function ≤60 lines
    update(deltaTime, j2000Days = null) {
        // NASA Rule 5: Assert preconditions
        console.assert(typeof deltaTime === 'number' && deltaTime >= 0, "Neptune.update: deltaTime must be non-negative number");
        console.assert(this.moons.length > 0 || this.moonsData.length === 0, "Neptune.update: If moonsData exists, moons array should not be empty");

        // Update base planet (rotation, orbit) - pass j2000Days for time-sync mode
        super.update(deltaTime, j2000Days);

        // Update Triton's orbit (retrograde motion via negative orbitSpeed)
        // NASA Rule 2: Fixed loop bounds (this.moons.length = 1)
        for (let i = 0; i < this.moons.length; i++) {
            const moon = this.moons[i];

            // NASA Rule 7: Check moon object validity
            if (!moon || !moon.mesh || !moon.data) {
                console.warn(`Neptune.update: Invalid moon at index ${i}`);
                continue;
            }

            // Update orbital angle (negative orbitSpeed creates retrograde motion)
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

            // Rotate moon on axis
            moon.mesh.rotation.y += moon.data.rotationSpeed * deltaTime;
        }
    }

    // Cleanup resources
    // NASA Rule 4: Function ≤60 lines
    dispose() {
        // NASA Rule 5: Assert preconditions
        console.assert(this.mesh !== null,
            "Neptune.dispose: mesh should exist before disposal");

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

// IMPORTANT: Make Neptune globally available
window.Neptune = Neptune;

// Testing commands:
// 1. Verify Triton visible:
//    console.log(solarSystem.planets.find(p => p.data.name === 'Neptune').moons.length); // Should output: 1
//
// 2. Check retrograde orbit (negative speed):
//    const neptune = solarSystem.planets.find(p => p.data.name === 'Neptune');
//    console.log(neptune.moons[0].data.orbitSpeed); // Should output: -0.04 (negative!)
//
// 3. Visual retrograde verification:
//    Zoom to Neptune, observe Triton orbiting BACKWARD (clockwise when viewed from above)
//    Compare to Mars moons (Phobos/Deimos orbit counter-clockwise)
//
// 4. Verify moon size:
//    const triton = neptune.moons.find(m => m.data.name === 'Triton');
//    console.log(triton.data.radius); // Should output: 0.32 (larger than most moons)
//
// 5. Performance test (60 FPS check):
//    Open browser DevTools -> Performance tab -> Record 10 seconds -> Check FPS graph
//
// 6. Console error check:
//    Open DevTools Console -> Filter by "Neptune" -> Should show no errors
