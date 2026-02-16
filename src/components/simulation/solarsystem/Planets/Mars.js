// Mars.js - Red planet with 2 asteroid-like moons
// NASA JPL orbital parameters sourced from horizons.jpl.nasa.gov
// Last updated: 2026-01-01

class Mars extends Planet {
    constructor(scene, resourceLoader, data) {
        // NASA Rule 5: Assert preconditions
        console.assert(scene !== null && scene !== undefined,
            "Mars.constructor: scene must be valid");
        console.assert(resourceLoader !== null && resourceLoader !== undefined,
            "Mars.constructor: resourceLoader must be valid");
        console.assert(data !== null && data !== undefined,
            "Mars.constructor: data must be valid");

        super(scene, resourceLoader, data);

        // Define 2 asteroid-captured moons with NASA JPL orbital parameters
        // NASA Rule 6: Minimal scope (defined as instance property, not global)
        // NASA Rule 2: Fixed array size (2 moons, bounded iteration)
        this.moonsData = [
            {
                name: "Phobos",
                radius: 0.08, // Tiny, irregular asteroid
                distance: 2.5, // Closest moon in solar system to its planet
                rotationSpeed: 0.02, // Rotation rate
                orbitSpeed: 0.12, // Fastest moon in solar system (7h 39m)
                orbitalInclination: 1.08, // Degrees relative to Mars equator (NASA JPL)
                texturePath: 'src/assets/textures/planets/mars/moons/phobos.jpg',
                color: 0x8b7355, // Reddish-brown asteroid color
                segments: 16 // Low-poly for irregular asteroid appearance
            },
            {
                name: "Deimos",
                radius: 0.05, // Smaller asteroid
                distance: 4.0, // 2nd orbital position
                rotationSpeed: 0.015,
                orbitSpeed: 0.07, // 30h 18m orbital period
                orbitalInclination: 0.93, // Degrees relative to Mars equator (NASA JPL)
                texturePath: 'src/assets/textures/planets/mars/moons/deimos.jpg',
                color: 0x9b8b7b, // Lighter gray-brown
                segments: 16 // Low-poly for irregular asteroid appearance
            }
        ];

        // NASA Rule 6: Minimal scope (moon tracking arrays)
        this.moonGroup = null;
        this.moons = [];
    }

    async init() {
        // NASA Rule 5: Assert method preconditions
        console.assert(this.scene !== null,
            "Mars.init: scene must be initialized");
        console.assert(this.resourceLoader !== null,
            "Mars.init: resourceLoader must be initialized");

        // Initialize base planet (texture, geometry, positioning)
        const baseInitSuccess = await super.init();

        // NASA Rule 7: Check return values
        if (!baseInitSuccess) {
            console.error("Mars.init: Base planet initialization failed");
            return false;
        }

        // Create moon orbit group (attached to Mars mesh)
        this.moonGroup = new THREE.Group();
        this.mesh.add(this.moonGroup);

        // Create both moons
        const moonsCreated = await this.createMoons();

        // NASA Rule 7: Check return values
        if (!moonsCreated) {
            console.warn("Mars.init: Some moons failed to create");
            // Non-critical: planet still functional without moons
        }

        return true;
    }

    // Create both Martian moons
    // NASA Rule 4: Function ≤60 lines
    async createMoons() {
        // NASA Rule 5: Assert preconditions
        console.assert(this.moonGroup !== null,
            "Mars.createMoons: moonGroup must be initialized");
        console.assert(this.moonsData.length > 0,
            "Mars.createMoons: moonsData must have at least one entry");

        let successCount = 0;

        // NASA Rule 2: Fixed loop bounds (array.length = 2)
        for (let i = 0; i < this.moonsData.length; i++) {
            const moonData = this.moonsData[i];

            try {
                const moonCreated = await this.createSingleMoon(moonData);

                // NASA Rule 7: Check return values
                if (moonCreated) {
                    successCount++;
                } else {
                    console.warn(`Mars.createMoons: Failed to create ${moonData.name}`);
                }
            } catch (error) {
                console.error(`Mars.createMoons: Exception creating ${moonData.name}:`, error);
            }
        }

        // NASA Rule 5: Validate runtime results
        console.assert(successCount > 0, `Mars.createMoons: At least one moon must be created (got ${successCount}/${this.moonsData.length})`);
        console.assert(this.moons.length === successCount, `Mars.createMoons: Moons array length must match success count (${this.moons.length} vs ${successCount})`);

        // Return true if at least 1 moon created successfully
        return successCount > 0;
    }

    // Create a single moon with asteroid-like appearance
    // NASA Rule 4: Function ≤60 lines
    async createSingleMoon(moonData) {
        // NASA Rule 5: Assert preconditions
        console.assert(moonData !== null && moonData !== undefined,
            "Mars.createSingleMoon: moonData must be valid");
        console.assert(this.moonGroup !== null,
            "Mars.createSingleMoon: moonGroup must be initialized");

        let moonTexture = null;

        // Attempt to load moon texture
        try {
            moonTexture = await this.resourceLoader.loadTexture(moonData.texturePath);

            // NASA Rule 7: Check return value
            if (!moonTexture) {
                console.warn(`Mars.createSingleMoon: Texture load failed for ${moonData.name}, using color fallback`);
            }
        } catch (error) {
            console.warn(`Mars.createSingleMoon: Texture load error for ${moonData.name}:`, error);
            // Continue with color fallback
        }

        // Create moon geometry with low segment count for asteroid-like appearance
        // NASA Rule 6: Use moonData.segments for irregular, faceted surface
        const segmentCount = moonData.segments || 32;
        const moonGeometry = new THREE.SphereGeometry(
            moonData.radius,
            segmentCount,
            segmentCount
        );

        // Create material (texture or solid color fallback)
        const moonMaterial = new THREE.MeshPhongMaterial({
            map: moonTexture, // null if texture failed
            color: moonTexture ? 0xffffff : moonData.color, // Use color only if no texture
            shininess: 5, // Lower shininess for rocky asteroid
            flatShading: segmentCount < 32 // Enable flat shading for low-poly asteroids
        });

        // Create moon mesh
        const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);

        // Position moon in its orbital radius
        moonMesh.position.set(moonData.distance, 0, 0);

        // NASA Rule 5: Validate calculation results
        const positionMagnitude = moonMesh.position.length();
        console.assert(isFinite(positionMagnitude) && positionMagnitude > 0, `Mars.createSingleMoon: ${moonData.name} position must be finite and non-zero (got ${positionMagnitude})`);
        console.assert(positionMagnitude <= moonData.distance * 1.1, `Mars.createSingleMoon: ${moonData.name} position ${positionMagnitude} exceeds expected distance ${moonData.distance}`);

        // Add moon to orbit group (rotation of this group = orbital motion)
        this.moonGroup.add(moonMesh);

        // Store moon data for animation (follows Jupiter.js pattern)
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
        console.assert(typeof deltaTime === 'number' && deltaTime >= 0, "Mars.update: deltaTime must be non-negative number");
        console.assert(this.moons.length > 0 || this.moonsData.length === 0, "Mars.update: If moonsData exists, moons array should not be empty");

        // Update base planet (rotation, orbit) - pass j2000Days for time-sync mode
        super.update(deltaTime, j2000Days);

        // Update each moon's orbit individually
        // NASA Rule 2: Fixed loop bounds (this.moons.length ≤ 2)
        for (let i = 0; i < this.moons.length; i++) {
            const moon = this.moons[i];

            // NASA Rule 7: Check moon object validity
            if (!moon || !moon.mesh || !moon.data) {
                console.warn(`Mars.update: Invalid moon at index ${i}`);
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

            // Rotate moon on axis
            moon.mesh.rotation.y += moon.data.rotationSpeed * deltaTime;
        }
    }

    // Cleanup resources
    // NASA Rule 4: Function ≤60 lines
    dispose() {
        // NASA Rule 5: Assert preconditions
        console.assert(this.mesh !== null,
            "Mars.dispose: mesh should exist before disposal");

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

// IMPORTANT: Make Mars globally available
window.Mars = Mars;

// Testing commands:
// 1. Verify both moons visible:
//    console.log(solarSystem.planets.find(p => p.data.name === 'Mars').moons.length); // Should output: 2
//
// 2. Check orbital speeds (Phobos fastest):
//    const mars = solarSystem.planets.find(p => p.data.name === 'Mars');
//    mars.moons.forEach(m => console.log(m.data.name, m.data.orbitSpeed));
//
// 3. Verify asteroid-like appearance:
//    const phobos = mars.moons.find(m => m.data.name === 'Phobos');
//    console.log(phobos.mesh.geometry.parameters); // Should show segments: 16
//
// 4. Performance test (60 FPS check):
//    Open browser DevTools -> Performance tab -> Record 10 seconds -> Check FPS graph
//
// 5. Visual verification:
//    Zoom to Mars, verify 2 distinct moons with faceted, irregular surfaces
//    Phobos should orbit ~1.7x faster than Deimos
//    Both moons should appear angular/polygonal, not smooth spheres
//
// 6. Console error check:
//    Open DevTools Console -> Filter by "Mars" -> Should show no errors
