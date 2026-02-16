// Saturn.js - Ringed gas giant with 7 major moons
// NASA JPL orbital parameters sourced from horizons.jpl.nasa.gov
// Last updated: 2026-01-01

class Saturn extends Planet {
    constructor(scene, resourceLoader, data) {
        // NASA Rule 5: Assert preconditions
        console.assert(scene !== null && scene !== undefined,
            "Saturn.constructor: scene must be valid");
        console.assert(resourceLoader !== null && resourceLoader !== undefined,
            "Saturn.constructor: resourceLoader must be valid");
        console.assert(data !== null && data !== undefined,
            "Saturn.constructor: data must be valid");

        super(scene, resourceLoader, data);

        // Define 7 major moons with NASA JPL orbital parameters
        // NASA Rule 6: Minimal scope (defined as instance property, not global)
        // NASA Rule 2: Fixed array size (7 moons, bounded iteration)
        this.moonsData = [
            {
                name: "Titan",
                radius: 0.6, // Largest moon, bigger than Mercury
                distance: 18.0, // Orbital radius from Saturn
                rotationSpeed: 0.01, // Tidal locked rotation
                orbitSpeed: 0.025, // 15.95 days orbital period
                orbitalInclination: 0.34, // Degrees relative to Saturn equator (NASA JPL)
                color: 0xffaa44, // Orange haze fallback
                hasAtmosphere: true, // Dense nitrogen atmosphere
                atmosphereColor: 0xffaa44,
                atmosphereOpacity: 0.3
            },
            {
                name: "Enceladus",
                radius: 0.15, // Small, active moon
                distance: 7.0, // 2nd orbital position
                rotationSpeed: 0.015,
                orbitSpeed: 0.06, // 1.37 days (fastest)
                orbitalInclination: 0.00, // Degrees relative to Saturn equator (NASA JPL)
                color: 0xffffff, // Bright icy white
                hasAtmosphere: false
            },
            {
                name: "Mimas",
                radius: 0.12, // "Death Star" moon
                distance: 5.5, // Innermost major moon
                rotationSpeed: 0.018,
                orbitSpeed: 0.08, // 0.94 days
                orbitalInclination: 1.53, // Degrees relative to Saturn equator (NASA JPL)
                color: 0xcccccc, // Light gray
                hasAtmosphere: false
            },
            {
                name: "Rhea",
                radius: 0.25, // 2nd largest moon
                distance: 12.0, // Mid-range orbit
                rotationSpeed: 0.012,
                orbitSpeed: 0.04, // 4.52 days
                orbitalInclination: 0.33, // Degrees relative to Saturn equator (NASA JPL)
                color: 0xaaaaaa, // Gray-white
                hasAtmosphere: false
            },
            {
                name: "Tethys",
                radius: 0.20, // Medium-sized moon
                distance: 9.0, // 3rd orbital position
                rotationSpeed: 0.014,
                orbitSpeed: 0.05, // 1.89 days
                orbitalInclination: 1.09, // Degrees relative to Saturn equator (NASA JPL)
                color: 0xdddddd, // Light gray
                hasAtmosphere: false
            },
            {
                name: "Dione",
                radius: 0.22, // Slightly larger than Tethys
                distance: 10.5, // 4th orbital position
                rotationSpeed: 0.013,
                orbitSpeed: 0.045, // 2.74 days
                orbitalInclination: 0.02, // Degrees relative to Saturn equator (NASA JPL)
                color: 0xbbbbbb, // Gray
                hasAtmosphere: false
            },
            {
                name: "Iapetus",
                radius: 0.28, // 3rd largest, two-tone surface
                distance: 24.0, // Outermost major moon
                rotationSpeed: 0.008,
                orbitSpeed: 0.015, // Slowest: 79.33 days
                orbitalInclination: 15.47, // Degrees relative to Saturn equator (NASA JPL)
                color: 0x886644, // Two-tone brown-white fallback
                hasAtmosphere: false
            }
        ];

        // NASA Rule 6: Minimal scope (moon tracking arrays)
        this.moonGroup = null;
        this.moons = [];
    }

    async init() {
        // NASA Rule 5: Assert method preconditions
        console.assert(this.scene !== null,
            "Saturn.init: scene must be initialized");
        console.assert(this.resourceLoader !== null,
            "Saturn.init: resourceLoader must be initialized");

        // Initialize base planet (texture, geometry, positioning, rings)
        const baseInitSuccess = await super.init();

        // NASA Rule 7: Check return values
        if (!baseInitSuccess) {
            console.error("Saturn.init: Base planet initialization failed");
            return false;
        }

        // Create moon orbit group (attached to Saturn mesh)
        this.moonGroup = new THREE.Group();
        this.mesh.add(this.moonGroup);

        // Create all 7 major moons
        const moonsCreated = await this.createMoons();

        // NASA Rule 7: Check return values
        if (!moonsCreated) {
            console.warn("Saturn.init: Some moons failed to create");
            // Non-critical: planet still functional without moons
        }

        return true;
    }

    // Create all 7 major moons
    // NASA Rule 4: Function ≤60 lines
    async createMoons() {
        // NASA Rule 5: Assert preconditions
        console.assert(this.moonGroup !== null,
            "Saturn.createMoons: moonGroup must be initialized");
        console.assert(this.moonsData.length > 0,
            "Saturn.createMoons: moonsData must have at least one entry");

        let successCount = 0;

        // NASA Rule 2: Fixed loop bounds (array.length = 7)
        for (let i = 0; i < this.moonsData.length; i++) {
            const moonData = this.moonsData[i];

            try {
                const moonCreated = await this.createSingleMoon(moonData);

                // NASA Rule 7: Check return values
                if (moonCreated) {
                    successCount++;
                } else {
                    console.warn(`Saturn.createMoons: Failed to create ${moonData.name}`);
                }
            } catch (error) {
                console.error(`Saturn.createMoons: Exception creating ${moonData.name}:`, error);
            }
        }

        // NASA Rule 5: Validate runtime results
        console.assert(successCount > 0, `Saturn.createMoons: At least one moon must be created (got ${successCount}/${this.moonsData.length})`);
        console.assert(this.moons.length === successCount, `Saturn.createMoons: Moons array length must match success count (${this.moons.length} vs ${successCount})`);

        // Return true if at least 1 moon created successfully
        return successCount > 0;
    }

    // Create a single moon with optional atmosphere (Titan)
    // NASA Rule 4: Function ≤60 lines
    async createSingleMoon(moonData) {
        // NASA Rule 5: Assert preconditions
        console.assert(moonData !== null && moonData !== undefined,
            "Saturn.createSingleMoon: moonData must be valid");
        console.assert(this.moonGroup !== null,
            "Saturn.createSingleMoon: moonGroup must be initialized");

        let moonTexture = null;

        // Only attempt texture load if path is defined
        if (moonData.texturePath) {
            try {
                moonTexture = await this.resourceLoader.loadTexture(moonData.texturePath);

                // NASA Rule 7: Check return value
                if (!moonTexture) {
                    console.warn(`Saturn.createSingleMoon: Texture load failed for ${moonData.name}, using color fallback`);
                }
            } catch (error) {
                console.warn(`Saturn.createSingleMoon: Texture load error for ${moonData.name}:`, error);
                // Continue with color fallback
            }
        }
        // If no texturePath, moonTexture remains null and color fallback is used

        // Defensive check: ensure we have either texture or color
        if (!moonTexture && !moonData.color) {
            console.error(`Saturn.createSingleMoon: Moon ${moonData.name} has no texture or color - using default gray`);
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

        // Add atmosphere layer if specified (Titan only)
        if (moonData.hasAtmosphere) {
            const atmosphereSuccess = this.createAtmosphere(moonMesh, moonData);

            // NASA Rule 7: Check return value
            if (!atmosphereSuccess) {
                console.warn(`Saturn.createSingleMoon: Failed to create atmosphere for ${moonData.name}`);
            }
        }

        // Position moon in its orbital radius
        moonMesh.position.set(moonData.distance, 0, 0);

        // NASA Rule 5: Validate calculation results
        const positionMagnitude = moonMesh.position.length();
        console.assert(isFinite(positionMagnitude) && positionMagnitude > 0, `Saturn.createSingleMoon: ${moonData.name} position must be finite and non-zero (got ${positionMagnitude})`);
        console.assert(positionMagnitude <= moonData.distance * 1.1, `Saturn.createSingleMoon: ${moonData.name} position ${positionMagnitude} exceeds expected distance ${moonData.distance}`);

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

    // Create atmosphere layer for Titan
    // NASA Rule 4: Function ≤60 lines
    createAtmosphere(moonMesh, moonData) {
        // NASA Rule 5: Assert preconditions
        console.assert(moonMesh !== null && moonMesh !== undefined,
            "Saturn.createAtmosphere: moonMesh must be valid");
        console.assert(moonData !== null && moonData !== undefined,
            "Saturn.createAtmosphere: moonData must be valid");

        try {
            // Create atmosphere geometry (20% larger than moon)
            const atmosphereRadius = moonData.radius * 1.2;
            const atmosphereGeometry = new THREE.SphereGeometry(atmosphereRadius, 32, 32);

            // Create transparent material with orange haze
            const atmosphereMaterial = new THREE.MeshPhongMaterial({
                color: moonData.atmosphereColor || 0xffaa44,
                transparent: true,
                opacity: moonData.atmosphereOpacity || 0.3,
                shininess: 5,
                side: THREE.FrontSide
            });

            // Create atmosphere mesh
            const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);

            // Add atmosphere as child of moon mesh (inherits moon's transformations)
            moonMesh.add(atmosphereMesh);

            return true;
        } catch (error) {
            console.error("Saturn.createAtmosphere: Failed to create atmosphere:", error);
            return false;
        }
    }

    // Override update to handle moon orbital mechanics
    // NASA Rule 4: Function ≤60 lines
    update(deltaTime, j2000Days = null) {
        // NASA Rule 5: Assert preconditions
        console.assert(typeof deltaTime === 'number' && deltaTime >= 0, "Saturn.update: deltaTime must be non-negative number");
        console.assert(this.moons.length > 0 || this.moonsData.length === 0, "Saturn.update: If moonsData exists, moons array should not be empty");

        // Update base planet (rotation, orbit, rings) - pass j2000Days for time-sync mode
        super.update(deltaTime, j2000Days);

        // Update each moon's orbit individually
        // NASA Rule 2: Fixed loop bounds (this.moons.length ≤ 7)
        for (let i = 0; i < this.moons.length; i++) {
            const moon = this.moons[i];

            // NASA Rule 7: Check moon object validity
            if (!moon || !moon.mesh || !moon.data) {
                console.warn(`Saturn.update: Invalid moon at index ${i}`);
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
            "Saturn.dispose: mesh should exist before disposal");

        // Dispose all moons
        // NASA Rule 2: Fixed loop bounds
        for (let i = 0; i < this.moons.length; i++) {
            const moon = this.moons[i];

            if (moon && moon.mesh) {
                // Dispose atmosphere if exists (child meshes)
                // NASA Rule 2: Fixed bounds (children array length)
                const childrenCount = moon.mesh.children.length;
                for (let j = 0; j < childrenCount; j++) {
                    const child = moon.mesh.children[j];

                    if (child && child.geometry) {
                        child.geometry.dispose();
                    }
                    if (child && child.material) {
                        child.material.dispose();
                    }
                }

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

        // Dispose base planet resources (including rings)
        super.dispose();
    }
}

// IMPORTANT: Make Saturn globally available
window.Saturn = Saturn;

// Testing commands:
// 1. Verify all 7 moons visible:
//    console.log(solarSystem.planets.find(p => p.data.name === 'Saturn').moons.length); // Should output: 7
//
// 2. Check orbital speeds (Mimas fastest, Iapetus slowest):
//    const saturn = solarSystem.planets.find(p => p.data.name === 'Saturn');
//    saturn.moons.forEach(m => console.log(m.data.name, m.data.orbitSpeed));
//
// 3. Verify Titan atmosphere:
//    const titan = saturn.moons.find(m => m.data.name === 'Titan');
//    console.log(titan.mesh.children.length); // Should be 1 (atmosphere layer)
//
// 4. Performance test (60 FPS check):
//    Open browser DevTools -> Performance tab -> Record 10 seconds -> Check FPS graph
//
// 5. Visual verification:
//    Zoom to Saturn, verify 7 distinct moons orbiting at different speeds
//    Titan should have visible orange haze around it
//    Mimas should complete orbit ~5x faster than Iapetus
//
// 6. Console error check:
//    Open DevTools Console -> Filter by "Saturn" -> Should show no errors
