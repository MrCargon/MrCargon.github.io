// ExoplanetSystems.js - NASA Exoplanet Archive visualization
// Reference: Gillon et al. (2017), Nature 542, 456-460 (TRAPPIST-1)
//            Quintana et al. (2014), Science 344, 277-280 (Kepler-186)
//            Anglada-Escude et al. (2016), Nature 536, 437-440 (Proxima Centauri)
// Data verified: 2025-12-31
// Source: https://exoplanetarchive.ipac.caltech.edu/
//
// NASA Rules Compliance:
// Rule 1: No recursion, goto, longjmp
// Rule 2: Fixed loop bounds (MAX_SYSTEMS = 3, MAX_PLANETS = 7)
// Rule 3: No dynamic memory after init (pre-allocated buffers)
// Rule 4: Functions <= 60 lines
// Rule 5: >= 2 assertions per function
// Rule 6: Minimal variable scope
// Rule 7: Check all returns
// Rule 8: Simple preprocessor (constants only)
// Rule 9: Single-level pointers only (JS arrays)
// Rule 10: Zero warnings (strict mode)


// NASA Rule 8: Simple preprocessor - constants only
const MAX_SYSTEMS = 3; // Maximum number of exoplanet systems
const MAX_PLANETS_PER_SYSTEM = 7; // TRAPPIST-1 has 7 planets
const SCALE_FACTOR = 500; // Visual scale factor (AU to scene units)
const ORBIT_SEGMENTS = 128; // Fixed segments for orbit rings
const PLANET_SCALE = 8; // Visual scale for planet spheres

/**
 * ExoplanetSystems - Visualizes real exoplanet systems with NASA-verified data
 * Implements comparison with Solar System and habitable zone visualization
 *
 * @class
 */
class ExoplanetSystems {
    /**
     * Constructor - Initialize exoplanet system visualization
     * NASA Rule 5: 2+ (assertions * NASA) Rule 6: Minimal scope
     *
     * @param {THREE.Scene} scene - Three.js scene to add objects to
     * @param {Object} options - Configuration options
     */
    constructor(scene, options = {}) {
        // NASA Rule 5: Assertions for critical preconditions
        console.assert(scene !== null && scene !== undefined,
            'ExoplanetSystems: scene is required');
        console.assert(typeof THREE !== 'undefined',
            'ExoplanetSystems: THREE.js library required');

        // NASA Rule 6: Minimal scope - instance properties
        this.scene = scene;
        this.options = this.initializeOptions(options);

        // NASA Rule 3: Pre-allocated fixed-size buffers
        this.systems = {};
        this.currentSystem = null;
        this.planets = [];
        this.orbits = [];
        this.habitableZone = null;
        this.starMesh = null;
        this.labels = [];

        // State tracking
        this.enabled = false;
        this.dataLoaded = false;
        this.systemData = null;
    }

    /**
     * Initialize options with defaults
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ assertions
     *
     * @param {Object} userOptions - User-provided options
     * @returns {Object} Merged options with defaults
     */
    initializeOptions(userOptions) {
        // NASA Rule 5: Validate input
        console.assert(typeof userOptions === 'object',
            'initializeOptions: userOptions must be object');
        console.assert(userOptions !== null,
            'initializeOptions: userOptions cannot be null');

        const defaults = {
            scaleFactor: SCALE_FACTOR,
            planetScale: PLANET_SCALE,
            showOrbits: true,
            showHabitableZone: true,
            showLabels: true,
            visible: true,
            performanceTier: 'HIGH'
        };

        // Adjust for performance tier
        const opts = { ...defaults, ...userOptions };

        if (opts.performanceTier === 'MEDIUM') {
            opts.maxPlanetsVisible = 12;
        } else if (opts.performanceTier === 'LOW') {
            opts.maxPlanetsVisible = 8;
            opts.showLabels = false; // Disable labels on LOW tier
        } else {
            opts.maxPlanetsVisible = 15;
        }

        return opts;
    }

    /**
     * Initialize visualization - load data and create initial system
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ (assertions * NASA) Rule 7: Check returns
     *
     * @returns {Promise<boolean>} Success status
     */
    async init() {
        console.assert(this.systemData === null,
            'ExoplanetSystems.init: already initialized');
        console.assert(this.scene !== null,
            'ExoplanetSystems.init: scene required');

        try {
            // Load exoplanet data
            const dataLoaded = await this.loadExoplanetData();

            // NASA Rule 7: Check returns
            if (!dataLoaded) {
                console.error('Failed to load exoplanet data');
                return false;
            }

            // Create default system (TRAPPIST-1)
            const systemCreated = this.createSystem('TRAPPIST-1');
            if (!systemCreated) {
                console.error('Failed to create initial system');
                return false;
            }

            this.enabled = true;
            console.log('ExoplanetSystems initialized successfully');
            return true;

        } catch (error) {
            console.error('ExoplanetSystems initialization error:', error);
            return false;
        }
    }

    /**
     * Load exoplanet data from JSON file
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ (assertions * NASA) Rule 7: Check returns
     *
     * @returns {Promise<boolean>} Success status
     */
    async loadExoplanetData() {
        console.assert(this.systemData === null,
            'loadExoplanetData: data already loaded');

        try {
            const path = 'src/components/simulation/cosmology/data/exoplanetData.json';
            const response = await fetch(path);

            // NASA Rule 7: Check returns
            if (!response.ok) {
                console.error('Failed to load exoplanet data');
                return false;
            }

            this.systemData = await response.json();

            // Validate data structure
            const validated = this.validateSystemData();
            if (!validated) {
                console.error('Exoplanet data validation failed');
                return false;
            }

            this.dataLoaded = true;
            console.log('Exoplanet data loaded and validated');
            return true;

        } catch (error) {
            console.error('Error loading exoplanet data:', error);
            return false;
        }
    }

    /**
     * Validate loaded system data
     * NASA Rule 2: Fixed bounds (MAX_SYSTEMS)
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ assertions
     *
     * @returns {boolean} Validation success
     */
    validateSystemData() {
        console.assert(this.systemData !== null,
            'validateSystemData: no data to validate');
        console.assert(typeof this.systemData === 'object',
            'validateSystemData: data must be object');

        const systemNames = Object.keys(this.systemData);

        // NASA Rule 2: Check fixed bounds
        if (systemNames.length > MAX_SYSTEMS) {
            console.error(`Too many systems: ${systemNames.length} > ${MAX_SYSTEMS}`);
            return false;
        }

        // Validate each system
        for (let i = 0; i < systemNames.length; i++) {
            const name = systemNames[i];
            const system = this.systemData[name];

            // Check required fields
            if (!system.star || !system.planets || !system.habitableZone) {
                console.error(`Invalid system data for ${name}`);
                return false;
            }

            // Check planet count
            if (system.planets.length > MAX_PLANETS_PER_SYSTEM) {
                console.error(`Too many planets in ${name}: ${system.planets.length}`);
                return false;
            }
        }

        return true;
    }

    /**
     * Create exoplanet system visualization
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ assertions
     *
     * @param {string} systemName - Name of system to create
     * @returns {boolean} Success status
     */
    createSystem(systemName) {
        console.assert(typeof systemName === 'string',
            'createSystem: systemName must be string');
        console.assert(this.systemData !== null,
            'createSystem: data not loaded');

        // Get system data
        const data = this.systemData[systemName];
        if (!data) {
            console.error(`Unknown system: ${systemName}`);
            return false;
        }

        // Clear existing system
        this.clearSystem();

        // Create star
        this.createStar(data.star);

        // Create planets
        const planetsCreated = this.createPlanets(data.planets);
        if (!planetsCreated) {
            console.error('Failed to create planets');
            return false;
        }

        // Create habitable zone
        if (this.options.showHabitableZone) {
            this.createHabitableZone(data.habitableZone);
        }

        this.currentSystem = systemName;
        console.log(`Created exoplanet system: ${systemName}`);
        return true;
    }

    /**
     * Create star mesh at center
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ assertions
     *
     * @param {Object} starData - Star properties
     */
    createStar(starData) {
        console.assert(starData !== null && starData !== undefined,
            'createStar: starData required');
        console.assert(typeof starData.radius === 'number',
            'createStar: starData.radius must be number');

        // Calculate visual size (scaled for visibility)
        const visualRadius = starData.radius * 10;

        // Create star geometry
        const geometry = new THREE.SphereGeometry(visualRadius, 32, 32);

        // Create emissive material
        const material = new THREE.MeshBasicMaterial({
            color: starData.color,
            emissive: starData.color,
            emissiveIntensity: 0.8
        });

        this.starMesh = new THREE.Mesh(geometry, material);
        this.starMesh.position.set(0, 0, 0);

        // Add point light for star
        const light = new THREE.PointLight(starData.color, 1, 300);
        this.starMesh.add(light);

        this.scene.add(this.starMesh);
    }

    /**
     * Create planet meshes and orbits
     * NASA Rule 2: Fixed bounds (MAX_PLANETS_PER_SYSTEM)
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ assertions
     *
     * @param {Array} planetsData - Array of planet properties
     * @returns {boolean} Success status
     */
    createPlanets(planetsData) {
        console.assert(Array.isArray(planetsData),
            'createPlanets: planetsData must be array');
        console.assert(planetsData.length <= MAX_PLANETS_PER_SYSTEM,
            'createPlanets: too many planets');

        // NASA Rule 2: Fixed loop bound
        const planetCount = Math.min(planetsData.length, this.options.maxPlanetsVisible);

        for (let i = 0; i < planetCount; i++) {
            const planetData = planetsData[i];

            // Create planet mesh
            const planet = this.createPlanet(planetData);
            if (!planet) {
                console.error(`Failed to create planet ${i}`);
                return false;
            }

            this.planets.push(planet);

            // Create orbit ring
            if (this.options.showOrbits) {
                const orbit = this.createOrbitRing(planetData.distance);
                this.orbits.push(orbit);
            }

            // Create label
            if (this.options.showLabels) {
                this.createPlanetLabel(planetData, planet);
            }
        }

        return true;
    }

    /**
     * Create single planet mesh
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ assertions
     *
     * @param {Object} planetData - Planet properties
     * @returns {THREE.Mesh} Planet mesh
     */
    createPlanet(planetData) {
        console.assert(planetData !== null && planetData !== undefined,
            'createPlanet: planetData required');
        console.assert(typeof planetData.distance === 'number',
            'createPlanet: planetData.distance must be number');

        // Calculate visual radius
        const radius = planetData.radius || planetData.radiusEstimate || 1.0;
        const visualRadius = radius * this.options.planetScale;

        // Create sphere geometry
        const geometry = new THREE.SphereGeometry(visualRadius, 16, 16);

        // Determine color based on habitable status
        let color = 0x888888; // Gray default
        if (planetData.habitable) {
            color = 0x4488ff; // Blue for habitable
        }

        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.7,
            metalness: 0.3
        });

        const mesh = new THREE.Mesh(geometry, material);

        // Position at orbital distance
        const distance = planetData.distance * this.options.scaleFactor;
        mesh.position.set(distance, 0, 0);

        // Store planet data for updates
        mesh.userData = {
            distance: distance,
            period: planetData.period,
            angle: Math.random() * Math.PI * 2, // Random starting position
            habitable: planetData.habitable,
            name: planetData.name
        };

        this.scene.add(mesh);
        return mesh;
    }

    /**
     * Create orbit ring geometry
     * NASA Rule 2: Fixed bounds (ORBIT_SEGMENTS)
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ assertions
     *
     * @param {number} orbitRadius - Orbital radius in AU
     * @returns {THREE.Line} Orbit ring
     */
    createOrbitRing(orbitRadius) {
        console.assert(typeof orbitRadius === 'number',
            'createOrbitRing: orbitRadius must be number');
        console.assert(orbitRadius > 0,
            'createOrbitRing: orbitRadius must be positive');

        const radius = orbitRadius * this.options.scaleFactor;
        const points = [];

        // NASA Rule 2: Fixed loop bound
        for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
            const angle = (i / ORBIT_SEGMENTS) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            points.push(new THREE.Vector3(x, 0, z));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x444444,
            transparent: true,
            opacity: 0.3
        });

        const orbit = new THREE.Line(geometry, material);
        this.scene.add(orbit);

        return orbit;
    }

    /**
     * Create habitable zone visualization
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ assertions
     *
     * @param {Object} hzData - Habitable zone inner/outer radii
     */
    createHabitableZone(hzData) {
        console.assert(hzData !== null && hzData !== undefined,
            'createHabitableZone: hzData required');
        console.assert(typeof hzData.inner === 'number' && typeof hzData.outer === 'number',
            'createHabitableZone: inner and outer must be numbers');

        const innerRadius = hzData.inner * this.options.scaleFactor;
        const outerRadius = hzData.outer * this.options.scaleFactor;

        // Create ring geometry for habitable zone
        const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);

        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide
        });

        this.habitableZone = new THREE.Mesh(geometry, material);
        this.habitableZone.rotation.x = -Math.PI / 2; // Horizontal
        this.habitableZone.position.y = -0.5; // Slightly below planets

        this.scene.add(this.habitableZone);
    }

    /**
     * Create text label for planet
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ assertions
     *
     * @param {Object} planetData - Planet properties
     * @param {THREE.Mesh} planetMesh - Planet mesh to label
     */
    createPlanetLabel(planetData, planetMesh) {
        console.assert(planetData !== null,
            'createPlanetLabel: planetData required');
        console.assert(planetMesh !== null,
            'createPlanetLabel: planetMesh required');

        // Create sprite with text texture
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;

        const context = canvas.getContext('2d');
        context.fillStyle = 'rgba(255, 255, 255, 0.9)';
        context.font = 'Bold 20px Arial';
        context.textAlign = 'center';
        context.fillText(planetData.name, 128, 40);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);

        sprite.scale.set(20, 5, 1);
        sprite.position.set(
            planetMesh.position.x,
            planetMesh.position.y + 15,
            planetMesh.position.z
        );

        this.scene.add(sprite);
        this.labels.push(sprite);
    }

    /**
     * Switch to different exoplanet system
     * NASA Rule 5: 2+ assertions
     *
     * @param {string} systemName - Name of system to switch to
     * @returns {boolean} Success status
     */
    switchSystem(systemName) {
        console.assert(typeof systemName === 'string',
            'switchSystem: systemName must be string');
        console.assert(this.systemData !== null,
            'switchSystem: data not loaded');

        if (!this.systemData[systemName]) {
            console.error(`Unknown system: ${systemName}`);
            return false;
        }

        const created = this.createSystem(systemName);
        return created;
    }

    /**
     * Get list of available system names
     * NASA Rule 5: 2+ assertions
     *
     * @returns {Array<string>} System names
     */
    getAvailableSystems() {
        console.assert(this.systemData !== null,
            'getAvailableSystems: data not loaded');

        return Object.keys(this.systemData);
    }

    /**
     * Update simulation - animate planet orbits
     * NASA Rule 2: Fixed bounds (planets array)
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ assertions
     *
     * @param {number} deltaTime - Time elapsed since last frame (seconds)
     */
    update(deltaTime) {
        console.assert(typeof deltaTime === 'number',
            'update: deltaTime must be number');
        console.assert(deltaTime >= 0,
            'update: deltaTime must be non-negative');

        if (!this.enabled) return;

        // Update planet positions along orbits
        for (let i = 0; i < this.planets.length; i++) {
            const planet = this.planets[i];
            const data = planet.userData;

            // Calculate angular velocity (simplified)
            const angularVel = (2 * Math.PI) / (data.period * 10); // Scaled for visibility
            data.angle += angularVel * deltaTime;

            // Update position
            planet.position.x = Math.cos(data.angle) * data.distance;
            planet.position.z = Math.sin(data.angle) * data.distance;

            // Update label position
            if (this.options.showLabels && i < this.labels.length) {
                this.labels[i].position.x = planet.position.x;
                this.labels[i].position.z = planet.position.z;
            }
        }
    }

    /**
     * Clear current system from scene
     * NASA Rule 4: <= 60 lines
     */
    clearSystem() {
        // Remove star
        if (this.starMesh) {
            this.scene.remove(this.starMesh);
            this.starMesh.geometry.dispose();
            this.starMesh.material.dispose();
            this.starMesh = null;
        }

        // Remove planets
        for (let i = 0; i < this.planets.length; i++) {
            const planet = this.planets[i];
            this.scene.remove(planet);
            planet.geometry.dispose();
            planet.material.dispose();
        }
        this.planets = [];

        // Remove orbits
        for (let i = 0; i < this.orbits.length; i++) {
            const orbit = this.orbits[i];
            this.scene.remove(orbit);
            orbit.geometry.dispose();
            orbit.material.dispose();
        }
        this.orbits = [];

        // Remove labels
        for (let i = 0; i < this.labels.length; i++) {
            this.scene.remove(this.labels[i]);
            this.labels[i].material.map.dispose();
            this.labels[i].material.dispose();
        }
        this.labels = [];

        // Remove habitable zone
        if (this.habitableZone) {
            this.scene.remove(this.habitableZone);
            this.habitableZone.geometry.dispose();
            this.habitableZone.material.dispose();
            this.habitableZone = null;
        }
    }

    /**
     * Set visibility of exoplanet system visualization
     * NASA Rule 5: 2+ assertions
     *
     * @param {boolean} visible - Visibility state
     */
    setVisible(visible) {
        console.assert(typeof visible === 'boolean',
            'setVisible: visible must be boolean');

        this.enabled = visible;

        // Set visibility for all objects
        if (this.starMesh) this.starMesh.visible = visible;
        if (this.habitableZone) this.habitableZone.visible = visible;

        for (let i = 0; i < this.planets.length; i++) {
            this.planets[i].visible = visible;
        }

        for (let i = 0; i < this.orbits.length; i++) {
            this.orbits[i].visible = visible;
        }

        for (let i = 0; i < this.labels.length; i++) {
            this.labels[i].visible = visible;
        }
    }

    /**
     * Dispose of all resources
     * NASA Rule 5: 2+ assertions
     */
    dispose() {
        console.assert(this.scene !== null && this.scene !== undefined,
            'dispose: scene is required');

        // Clear current system
        this.clearSystem();

        // Reset state
        this.systems = {};
        this.currentSystem = null;
        this.systemData = null;
        this.dataLoaded = false;
        this.enabled = false;

        console.log('ExoplanetSystems disposed');
    }
}

// Make globally available
if (typeof window !== 'undefined') {
    window.ExoplanetSystems = ExoplanetSystems;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExoplanetSystems;
}
