// DwarfPlanet.js - Extended Planet class for dwarf planets with orbital inclination
// Supports: Pluto, Ceres, Eris, Haumea, Makemake
// NASA Rules Compliance: All 10 rules enforced

class DwarfPlanet extends Planet {
    constructor(scene, resourceLoader, data) {
        // NASA Rule 5: Assertions for critical preconditions
        console.assert(scene !== null && scene !== undefined,
            "DwarfPlanet.constructor: scene is required");
        console.assert(resourceLoader !== null && resourceLoader !== undefined,
            "DwarfPlanet.constructor: resourceLoader is required");
        console.assert(data !== null && data !== undefined,
            "DwarfPlanet.constructor: data is required");

        super(scene, resourceLoader, data);

        // NASA Rule 6: Minimal variable scope - store inclination locally
        this.orbitalInclination = data.orbitalInclination || 0;

        // Precompute inclination angle for performance (NASA Rule 6)
        this.inclinationRadians = this.orbitalInclination * (Math.PI / 180);
        this.cosInclination = Math.cos(this.inclinationRadians);
        this.sinInclination = Math.sin(this.inclinationRadians);
    }

    async init() {
        // NASA Rule 7: Check all async returns
        const result = await super.init();

        // NASA Rule 5: Assertions for postconditions
        console.assert(result === true || result === false,
            "DwarfPlanet.init: parent init should return boolean");
        console.assert(result === false || (this.mesh !== null && this.mesh !== undefined),
            "DwarfPlanet.init: mesh should be created when parent init succeeds");

        return result;
    }

    updatePosition() {
        // NASA Rule 5: Assertions for critical state
        console.assert(this.mesh !== null && this.mesh !== undefined,
            "DwarfPlanet.updatePosition: mesh must exist");
        console.assert(this.data !== null && this.data !== undefined,
            "DwarfPlanet.updatePosition: data must exist");

        // Call parent updatePosition to handle elliptical orbit
        super.updatePosition();

        // Apply orbital inclination if specified (tilt orbit out of ecliptic plane)
        // NASA Rule 2: Fixed loop bounds - no loops here, direct calculation
        if (this.orbitalInclination !== 0) {
            this.applyOrbitalInclination();
        }
    }

    applyOrbitalInclination() {
        // NASA Rule 5: Assertions for method preconditions
        console.assert(this.mesh !== null && this.mesh !== undefined,
            "DwarfPlanet.applyOrbitalInclination: mesh required");
        console.assert(isFinite(this.cosInclination) && isFinite(this.sinInclination),
            "DwarfPlanet.applyOrbitalInclination: precomputed trig values must be finite");

        // Rotate position around X-axis to simulate orbital inclination
        // This tilts the entire orbit out of the ecliptic plane (y=0)
        // Reference: Murray & Dermott (1999), Solar System Dynamics, Chapter 2

        // NASA Rule 6: Minimal scope - store original values locally
        const y = this.mesh.position.y;
        const z = this.mesh.position.z;

        // Apply rotation matrix for X-axis rotation
        // y' = (y * cos(i)) - (z * sin(i))
        // z' = (y * sin(i)) + (z * cos(i))
        // x remains unchanged
        this.mesh.position.y = (y * this.cosInclination) - (z * this.sinInclination);
        this.mesh.position.z = (y * this.sinInclination) + (z * this.cosInclination);

        // NASA Rule 5: Assertions for postconditions
        console.assert(isFinite(this.mesh.position.y) && isFinite(this.mesh.position.z),
            "DwarfPlanet.applyOrbitalInclination: resulting position must be finite");
    }

    // Fallback texture creation with solid color (NASA Rule 7: error handling)
    async createFallbackTexture(color) {
        // NASA Rule 5: Assertions for input validation
        console.assert(typeof color === 'number' && color >= 0 && color <= 0xFFFFFF,
            "DwarfPlanet.createFallbackTexture: color must be valid hex value");
        console.assert(this.scene !== null && this.scene !== undefined,
            "DwarfPlanet.createFallbackTexture: scene must exist");
        console.assert(this.data !== null && this.data !== undefined,
            "DwarfPlanet.createFallbackTexture: data must exist");

        try {
            // Case 1: Mesh exists with material - update color (existing behavior)
            if (this.mesh && this.mesh.material) {
                this.mesh.material.color.setHex(color);
                return true;
            }

            // Case 2: Mesh is null - create new mesh from scratch (NEW behavior)
            // NASA Rule 7: Dispose old mesh if it exists but has no material
            if (this.mesh !== null) {
                if (this.mesh.geometry) this.mesh.geometry.dispose();
                if (this.mesh.material) this.mesh.material.dispose();
                this.scene.remove(this.mesh);
                this.mesh = null;
            }

            // Create new mesh with fallback color
            const geometry = new THREE.SphereGeometry(this.data.radius, 64, 64);
            const material = new THREE.MeshPhongMaterial({
                color: color,
                shininess: 10
            });

            this.mesh = new THREE.Mesh(geometry, material);

            // Apply axial tilt
            const tiltRadians = THREE.MathUtils.degToRad(this.data.axialTilt || 0);
            this.mesh.rotation.x = tiltRadians;

            // Compute orbital constants with NaN guards
            if (this.data.orbitalElements && this.data.orbitalElements.eccentricity !== undefined) {
                const e = this.data.orbitalElements.eccentricity;
                this.sqrtFactor = Math.sqrt(1 - (e * e));

                // NaN guard: invalid eccentricity gives imaginary sqrt
                if (!isFinite(this.sqrtFactor)) {
                    console.error(`Invalid eccentricity for ${this.data.name}: ${e}`);
                    this.sqrtFactor = 1;
                }

                // Precompute argument of periapsis rotation
                const omega = THREE.MathUtils.degToRad(this.data.orbitalElements.argumentOfPeriapsis || 0);
                this.cosOmega = Math.cos(omega);
                this.sinOmega = Math.sin(omega);
            }

            // Position planet
            this.updatePosition();

            // Add to scene
            this.scene.add(this.mesh);

            return true;
        } catch (error) {
            console.error(`DwarfPlanet.createFallbackTexture: Failed to create fallback for ${this.data.name}:`, error);
            return false;
        }
    }
}

// NASA Rule 10: Zero warnings - Global export pattern
window.DwarfPlanet = DwarfPlanet;

// ===================================================================
// DWARF PLANET DATA DEFINITIONS
// Source: NASA JPL Small-Body Database & IAU definitions
// ===================================================================

// Static factory method for creating dwarf planets (NASA Rule 4: function ≤60 lines)
DwarfPlanet.createPluto = function(scene, resourceLoader) {
    // NASA Rule 5: Assertions
    console.assert(scene !== null && scene !== undefined,
        "DwarfPlanet.createPluto: scene required");
    console.assert(resourceLoader !== null && resourceLoader !== undefined,
        "DwarfPlanet.createPluto: resourceLoader required");

    const data = {
        name: "Pluto",
        radius: 0.18,
        rotationSpeed: 0.0001,
        orbitSpeed: 0.002,
        axialTilt: 122.5,
        orbitalInclination: 17.2, // Highly inclined orbit
        texturePath: "src/assets/textures/planets/dwarfplanets/pluto.jpg",
        fallbackColor: 0xccaa99,
        description: "Pluto, the most famous dwarf planet, located in the Kuiper Belt.",
        orbitalElements: {
            semiMajorAxis: 550,
            eccentricity: 0.2488, // Highly elliptical
            perihelion: 413, // 550 * (1 - 0.2488)
            aphelion: 687, // 550 * (1 + 0.2488)
            argumentOfPeriapsis: 113.8
        }
    };

    return new DwarfPlanet(scene, resourceLoader, data);
};

DwarfPlanet.createCeres = function(scene, resourceLoader) {
    // NASA Rule 5: Assertions
    console.assert(scene !== null && scene !== undefined,
        "DwarfPlanet.createCeres: scene required");
    console.assert(resourceLoader !== null && resourceLoader !== undefined,
        "DwarfPlanet.createCeres: resourceLoader required");

    const data = {
        name: "Ceres",
        radius: 0.07,
        rotationSpeed: 0.0002,
        orbitSpeed: 0.008,
        axialTilt: 4.0,
        orbitalInclination: 10.6,
        texturePath: "src/assets/textures/planets/dwarfplanets/ceres.jpg",
        fallbackColor: 0x999999,
        description: "Ceres, the largest object in the asteroid belt between Mars and Jupiter.",
        orbitalElements: {
            semiMajorAxis: 280,
            eccentricity: 0.0758,
            perihelion: 259, // 280 * (1 - 0.0758)
            aphelion: 301, // 280 * (1 + 0.0758)
            argumentOfPeriapsis: 73.6
        }
    };

    return new DwarfPlanet(scene, resourceLoader, data);
};

DwarfPlanet.createEris = function(scene, resourceLoader) {
    // NASA Rule 5: Assertions
    console.assert(scene !== null && scene !== undefined,
        "DwarfPlanet.createEris: scene required");
    console.assert(resourceLoader !== null && resourceLoader !== undefined,
        "DwarfPlanet.createEris: resourceLoader required");

    const data = {
        name: "Eris",
        radius: 0.17,
        rotationSpeed: 0.00008,
        orbitSpeed: 0.001,
        axialTilt: 78.0,
        orbitalInclination: 44.0, // Extremely inclined orbit
        texturePath: "src/assets/textures/planets/dwarfplanets/eris.jpg",
        fallbackColor: 0xdddddd,
        description: "Eris, one of the most distant known dwarf planets in our solar system.",
        orbitalElements: {
            semiMajorAxis: 950,
            eccentricity: 0.4407, // Very elliptical
            perihelion: 531, // 950 * (1 - 0.4407)
            aphelion: 1369, // 950 * (1 + 0.4407)
            argumentOfPeriapsis: 151.4
        }
    };

    return new DwarfPlanet(scene, resourceLoader, data);
};

DwarfPlanet.createHaumea = function(scene, resourceLoader) {
    // NASA Rule 5: Assertions
    console.assert(scene !== null && scene !== undefined,
        "DwarfPlanet.createHaumea: scene required");
    console.assert(resourceLoader !== null && resourceLoader !== undefined,
        "DwarfPlanet.createHaumea: resourceLoader required");

    const data = {
        name: "Haumea",
        radius: 0.12,
        rotationSpeed: 0.0003, // Fastest rotating known large object
        orbitSpeed: 0.0015,
        axialTilt: 126.0,
        orbitalInclination: 28.2,
        texturePath: "src/assets/textures/planets/dwarfplanets/haumea.jpg",
        fallbackColor: 0xbbaa99,
        description: "Haumea, an elongated dwarf planet with a rapid rotation period.",
        orbitalElements: {
            semiMajorAxis: 600,
            eccentricity: 0.1913,
            perihelion: 485, // 600 * (1 - 0.1913)
            aphelion: 715, // 600 * (1 + 0.1913)
            argumentOfPeriapsis: 239.0
        }
    };

    return new DwarfPlanet(scene, resourceLoader, data);
};

DwarfPlanet.createMakemake = function(scene, resourceLoader) {
    // NASA Rule 5: Assertions
    console.assert(scene !== null && scene !== undefined,
        "DwarfPlanet.createMakemake: scene required");
    console.assert(resourceLoader !== null && resourceLoader !== undefined,
        "DwarfPlanet.createMakemake: resourceLoader required");

    const data = {
        name: "Makemake",
        radius: 0.11,
        rotationSpeed: 0.00009,
        orbitSpeed: 0.0014,
        axialTilt: 0.0, // Unknown, assumed 0
        orbitalInclination: 29.0,
        texturePath: "src/assets/textures/planets/dwarfplanets/makemake.jpg",
        fallbackColor: 0xccbbaa,
        description: "Makemake, the second-brightest object in the Kuiper Belt after Pluto.",
        orbitalElements: {
            semiMajorAxis: 650,
            eccentricity: 0.1559,
            perihelion: 549, // 650 * (1 - 0.1559)
            aphelion: 751, // 650 * (1 + 0.1559)
            argumentOfPeriapsis: 298.4
        }
    };

    return new DwarfPlanet(scene, resourceLoader, data);
};
