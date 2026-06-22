// SolarSystem.js - Main class that orchestrates all solar system objects
class SolarSystem {
    constructor(environment, options = {}) {
        this.environment = environment;
        this.scene = environment.scene;
        
        // Parse options with defaults
        this.options = {
            progressiveLoading: options?.progressiveLoading || false,
            prioritizeCentralBodies: options?.prioritizeCentralBodies || false
        };
        
        this.objects = new Map();
        this.animationEnabled = true;
        this.showOrbits = true;
        this.orbitLines = new THREE.Group();
        
        // Add orbit lines group to scene
        this.scene.add(this.orbitLines);
        
        // Load planet data
        this.planetData = null;
        
        // Use the environment's resource loader if available
        this.resourceLoader = environment.resourceLoader || new ResourceLoader();
    }
    
    async init() {
        try {
            // Load planet data
            await this.loadPlanetData();
            
            // Create sun
            await this.createSun();
            
            // Create planets
            await this.createPlanets();

            // Create dwarf planets
            await this.createDwarfPlanets();

            // Create asteroid belt
            await this.createAsteroidBelt();

            // Create Kuiper Belt
            this.createKuiperBelt();

            // Create cosmic dust (zodiacal light)
            await this.createCosmicDust();

            // Create habitable zone indicator
            this.createHabitableZone();
            
            // Create background stars
            this.createBackgroundStars();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize Solar System:', error);
            return false;
        }
    }
    
    async loadPlanetData() {
        // This would normally load from a JSON file
        // For GitHub Pages compatibility, we'll inline the data
        // Planetary axial tilt values sourced from NASA Planetary Fact Sheet
        // https://nssdc.gsfc.nasa.gov/planetary/factsheet/
        // Values accurate as of 2025, angles in degrees from orbital plane
        this.planetData = {
            sun: {
                name: "Sun",
                radius: 20,
                texturePath: "src/assets/textures/sun/sun_map.jpg"
            },
            planets: [
                {
                    name: "Mercury",
                    radius: 1,
                    distance: 35,
                    rotationSpeed: 0.004,
                    orbitSpeed: 0.02,
                    axialTilt: 0.03,
                    orbitalPeriodDays: 87.969, // Phase 2: NASA JPL Horizons orbital period
                    texturePath: "src/assets/textures/planets/mercury/mercury_map.jpg",
                    bumpMapPath: "src/assets/textures/planets/mercury/mercury_bump.jpg",
                    description: "The smallest and innermost planet in the Solar System.",
                    // NASA JPL Horizons orbital elements (Epoch J2000.0)
                    // Source: https://ssd.jpl.nasa.gov/planets/approx_pos.html
                    orbitalElements: {
                        semiMajorAxis: 35, // a (scaled from 0.387 AU)
                        eccentricity: 0.2056, // e (NASA JPL Horizons)
                        perihelion: 27.8, // 35 * (1 - 0.2056)
                        aphelion: 42.2, // 35 * (1 + 0.2056)
                        argumentOfPeriapsis: 29.1, // ω (degrees, ellipse orientation)
                        meanAnomalyAtEpoch: 0 // M₀ at J2000 (radians)
                    }
                },
                {
                    name: "Venus",
                    radius: 1.8,
                    distance: 45,
                    rotationSpeed: 0.002,
                    orbitSpeed: 0.015,
                    axialTilt: 177.4,
                    orbitalPeriodDays: 224.701, // Phase 2: NASA JPL Horizons orbital period
                    texturePath: "src/assets/textures/planets/venus/venus_map.jpg",
                    bumpMapPath: "src/assets/textures/planets/venus/venus_bump.jpg",
                    cloudsPath: "src/assets/textures/planets/venus/venus_clouds.jpg",
                    description: "The second planet from the Sun with a thick toxic atmosphere.",
                    // NASA JPL Horizons orbital elements (Epoch J2000.0)
                    orbitalElements: {
                        semiMajorAxis: 45, // a (scaled from 0.723 AU)
                        eccentricity: 0.0068, // e (NASA JPL Horizons)
                        perihelion: 44.7, // 45 * (1 - 0.0068)
                        aphelion: 45.3, // 45 * (1 + 0.0068)
                        argumentOfPeriapsis: 54.9, // ω (degrees, ellipse orientation)
                        meanAnomalyAtEpoch: 0 // M₀ at J2000 (radians)
                    }
                },
                {
                    name: "Earth",
                    radius: 2,
                    distance: 60,
                    rotationSpeed: 0.131, // Fallback: 48-second rotation (2π/48 ≈ 0.131 rad/s)
                    rotationPeriodHours: 23.9344695944, // NASA: Earth's sidereal day (enables time-sync)
                    orbitSpeed: 0.01,
                    axialTilt: 23.4,
                    orbitalPeriodDays: 365.25636, // Phase 2: NASA JPL Horizons orbital period (includes leap years)
                    texturePath: "src/assets/textures/planets/earth/earth_day.jpg",
                    nightLightsPath: "src/assets/textures/planets/earth/earth_night.jpg",
                    normalMapPath: "src/assets/textures/planets/earth/earth_normal.jpg",
                    bumpMapPath: "src/assets/textures/planets/earth/earth_bump.jpg", // day-side relief for the custom Earth shader (derivative-bump path)
                    cloudsPath: "src/assets/textures/planets/earth/earth_clouds.jpg",
                    specularMapPath: "src/assets/textures/planets/earth/earth_specular.jpg",
                    description: "Our home planet, the only known celestial body to harbor life.",
                    // NASA JPL Horizons orbital elements (Epoch J2000.0)
                    orbitalElements: {
                        semiMajorAxis: 60, // a (scaled from 1.000 AU)
                        eccentricity: 0.0167, // e (NASA JPL Horizons)
                        perihelion: 59.0, // 60 * (1 - 0.0167)
                        aphelion: 61.0, // 60 * (1 + 0.0167)
                        argumentOfPeriapsis: 288.1, // ω (degrees, ellipse orientation)
                        meanAnomalyAtEpoch: 0 // M₀ at J2000 (radians)
                    }
                },
                {
                    name: "Mars",
                    radius: 1.5,
                    distance: 92,
                    rotationSpeed: 0.008,
                    orbitSpeed: 0.008,
                    axialTilt: 25.2,
                    orbitalPeriodDays: 686.980, // Phase 2: NASA JPL Horizons orbital period
                    texturePath: "src/assets/textures/planets/mars/mars_map.jpg",
                    description: "The Red Planet, known for its iron oxide surface.",
                    // NASA JPL Horizons orbital elements (Epoch J2000.0)
                    orbitalElements: {
                        semiMajorAxis: 92, // a (scaled from 1.524 AU)
                        eccentricity: 0.0934, // e (NASA JPL Horizons)
                        perihelion: 83.4, // 92 * (1 - 0.0934)
                        aphelion: 100.6, // 92 * (1 + 0.0934)
                        argumentOfPeriapsis: 286.5, // ω (degrees, ellipse orientation)
                        meanAnomalyAtEpoch: 0 // M₀ at J2000 (radians)
                    }
                },
                {
                    name: "Jupiter",
                    radius: 5,
                    distance: 312,
                    rotationSpeed: 0.02,
                    orbitSpeed: 0.005,
                    axialTilt: 3.1,
                    orbitalPeriodDays: 4332.589, // Phase 2: NASA JPL Horizons orbital period (~11.86 years)
                    texturePath: "src/assets/textures/planets/jupiter/jupiter_map.jpg",
                    description: "The largest planet in our Solar System, a gas giant.",
                    // NASA JPL Horizons orbital elements (Epoch J2000.0)
                    orbitalElements: {
                        semiMajorAxis: 312, // a (scaled from 5.203 AU)
                        eccentricity: 0.0489, // e (NASA JPL Horizons)
                        perihelion: 297.0, // 312 * (1 - 0.0489)
                        aphelion: 327.0, // 312 * (1 + 0.0489)
                        argumentOfPeriapsis: 273.9, // ω (degrees, ellipse orientation)
                        meanAnomalyAtEpoch: 0 // M₀ at J2000 (radians)
                    }
                },
                {
                    name: "Saturn",
                    radius: 4.5,
                    distance: 572,
                    rotationSpeed: 0.018,
                    orbitSpeed: 0.003,
                    axialTilt: 26.7,
                    orbitalPeriodDays: 10759.22, // Phase 2: NASA JPL Horizons orbital period (~29.46 years)
                    texturePath: "src/assets/textures/planets/saturn/saturn_map.jpg",
                    ringsPath: "src/assets/textures/planets/saturn/saturn_rings.jpg",
                    ringsColorPath: "src/assets/textures/planets/saturn/saturn_rings_color.jpg",
                    description: "Known for its prominent ring system composed of ice and rock particles.",
                    // NASA JPL Horizons orbital elements (Epoch J2000.0)
                    orbitalElements: {
                        semiMajorAxis: 572, // a (scaled from 9.537 AU)
                        eccentricity: 0.0565, // e (NASA JPL Horizons)
                        perihelion: 540.0, // 572 * (1 - 0.0565)
                        aphelion: 604.0, // 572 * (1 + 0.0565)
                        argumentOfPeriapsis: 339.4, // ω (degrees, ellipse orientation)
                        meanAnomalyAtEpoch: 0 // M₀ at J2000 (radians)
                    }
                },
                {
                    name: "Uranus",
                    radius: 3.5,
                    distance: 1151,
                    rotationSpeed: 0.012,
                    orbitSpeed: 0.002,
                    axialTilt: 97.8,
                    orbitalPeriodDays: 30688.5, // Phase 2: NASA JPL Horizons orbital period (~84.02 years)
                    texturePath: "src/assets/textures/planets/uranus/uranus_map.jpg",
                    ringsPath: "src/assets/textures/planets/uranus/uranus_rings.jpg",
                    ringsColorPath: "src/assets/textures/planets/uranus/uranus_rings_color.jpg",
                    description: "An ice giant with a tilted rotation axis of 97.8 degrees.",
                    // NASA JPL Horizons orbital elements (Epoch J2000.0)
                    orbitalElements: {
                        semiMajorAxis: 1151, // a (scaled from 19.191 AU)
                        eccentricity: 0.0473, // e (NASA JPL Horizons)
                        perihelion: 1096.6, // 1151 * (1 - 0.0473)
                        aphelion: 1205.4, // 1151 * (1 + 0.0473)
                        argumentOfPeriapsis: 96.7, // ω (degrees, ellipse orientation)
                        meanAnomalyAtEpoch: 0 // M₀ at J2000 (radians)
                    }
                },
                {
                    name: "Neptune",
                    radius: 3.5,
                    distance: 1804,
                    rotationSpeed: 0.014,
                    orbitSpeed: 0.001,
                    axialTilt: 28.3,
                    orbitalPeriodDays: 60182, // Phase 2: NASA JPL Horizons orbital period (~164.8 years)
                    texturePath: "src/assets/textures/planets/neptune/neptune_map.jpg",
                    description: "The windiest planet in our Solar System, with winds up to 2,100 km/h.",
                    // NASA JPL Horizons orbital elements (Epoch J2000.0)
                    orbitalElements: {
                        semiMajorAxis: 1804, // a (scaled from 30.069 AU)
                        eccentricity: 0.0086, // e (NASA JPL Horizons)
                        perihelion: 1789.5, // 1804 * (1 - 0.0086)
                        aphelion: 1818.5, // 1804 * (1 + 0.0086)
                        argumentOfPeriapsis: 273.2, // ω (degrees, ellipse orientation)
                        meanAnomalyAtEpoch: 0 // M₀ at J2000 (radians)
                    }
                }
            ]
        };
    }
    
    async createSun() {
        const sun = new Sun(this.scene, this.resourceLoader, this.planetData.sun);

        // NASA Rule 7: Check initialization return value
        const initSuccess = await sun.init();

        if (!initSuccess) {
            console.warn('SolarSystem: Sun initialization failed, using fallback rendering');
            // Sun class should handle fallback internally
            // Still add to scene - will render with basic material
        }

        this.objects.set('sun', sun);
    }
    
    async createPlanets() {
        for (const planetData of this.planetData.planets) {
            // Create planet instance based on its name
            let planet;

            switch (planetData.name) {
                case 'Mercury':
                    planet = new Mercury(this.scene, this.resourceLoader, planetData);
                    break;
                case 'Venus':
                    planet = new Venus(this.scene, this.resourceLoader, planetData);
                    break;
                case 'Earth':
                    planet = new Earth(this.scene, this.resourceLoader, planetData);
                    break;
                case 'Mars':
                    planet = new Mars(this.scene, this.resourceLoader, planetData);
                    break;
                case 'Jupiter':
                    planet = new Jupiter(this.scene, this.resourceLoader, planetData);
                    break;
                case 'Saturn':
                    planet = new Saturn(this.scene, this.resourceLoader, planetData);
                    break;
                case 'Uranus':
                    planet = new Uranus(this.scene, this.resourceLoader, planetData);
                    break;
                case 'Neptune':
                    planet = new Neptune(this.scene, this.resourceLoader, planetData);
                    break;
                default:
                    planet = new Planet(this.scene, this.resourceLoader, planetData);
            }

            // NASA Rule 7: Check initialization return value
            const initSuccess = await planet.init();

            if (!initSuccess) {
                console.warn(`SolarSystem: ${planetData.name} initialization failed, using fallback rendering`);
                // Planet base class should handle fallback internally
                // Still add to scene - will render with basic material
            }

            this.objects.set(planetData.name.toLowerCase(), planet);

            // Create orbit visualization
            this.createOrbitLine(planetData);
        }
    }

    async createDwarfPlanets() {
        // NASA Rule 5: Assert critical state
        console.assert(this.scene !== null && this.scene !== undefined, 'SolarSystem.createDwarfPlanets: scene required');
        console.assert(this.resourceLoader !== null && this.resourceLoader !== undefined, 'SolarSystem.createDwarfPlanets: resourceLoader required');

        // Create 5 dwarf planets using factory methods from DwarfPlanet class
        const dwarfPlanets = [
            DwarfPlanet.createPluto(this.scene, this.resourceLoader),
            DwarfPlanet.createCeres(this.scene, this.resourceLoader),
            DwarfPlanet.createEris(this.scene, this.resourceLoader),
            DwarfPlanet.createHaumea(this.scene, this.resourceLoader),
            DwarfPlanet.createMakemake(this.scene, this.resourceLoader)
        ];

        // Initialize each dwarf planet and add to scene
        // NASA Rule 7: Check all return values
        for (let i = 0; i < dwarfPlanets.length; i++) {
            const dwarfPlanet = dwarfPlanets[i];
            const initSuccess = await dwarfPlanet.init();

            // NASA Rule 7: Handle initialization failure with fallback
            if (!initSuccess) {
                console.warn(`SolarSystem: ${dwarfPlanet.data.name} texture failed, using fallback color 0x${dwarfPlanet.data.fallbackColor.toString(16)}`);
                const fallbackSuccess = await dwarfPlanet.createFallbackTexture(dwarfPlanet.data.fallbackColor);

                if (!fallbackSuccess) {
                    console.error(`SolarSystem: ${dwarfPlanet.data.name} fallback also failed, skipping planet`);
                    continue;
                }
            }

            this.objects.set(dwarfPlanet.data.name.toLowerCase(), dwarfPlanet);

            // Create orbit visualization (includes orbital inclination)
            this.createOrbitLine(dwarfPlanet.data);
        }

        console.log('SolarSystem: Created 5 dwarf planets with orbital inclination');
    }

    createOrbitLine(planetData) {
        const segments = 128;
        const orbitGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array((segments + 1) * 3);

        // Check if elliptical orbits enabled
        if (planetData.orbitalElements) {
            const { semiMajorAxis, eccentricity, argumentOfPeriapsis } = planetData.orbitalElements;

            // Precompute rotation matrix components for argument of periapsis
            const omega = THREE.MathUtils.degToRad(argumentOfPeriapsis || 0);
            const cosOmega = Math.cos(omega);
            const sinOmega = Math.sin(omega);

            // Precompute sqrt(1 - e²) for performance
            const sqrtFactor = Math.sqrt(1 - (eccentricity * eccentricity));

            // Generate ellipse points using eccentric anomaly
            for (let i = 0; i <= segments; i++) {
                const E = (i / segments) * Math.PI * 2; // Eccentric anomaly
                const cosE = Math.cos(E);
                const sinE = Math.sin(E);

                // Position in orbital plane (before rotation)
                const xOrbital = semiMajorAxis * (cosE - eccentricity);
                const zOrbital = semiMajorAxis * sqrtFactor * sinE;

                // Apply argument of periapsis rotation
                const x = (xOrbital * cosOmega) - (zOrbital * sinOmega);
                const z = (xOrbital * sinOmega) + (zOrbital * cosOmega);

                positions[i * 3] = x;
                positions[(i * 3) + 1] = 0;
                positions[(i * 3) + 2] = z;
            }
        } else {
            // Fallback: circular orbit (existing code for backward compatibility)
            const distance = planetData.distance;
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                positions[i * 3] = Math.cos(angle) * distance;
                positions[(i * 3) + 1] = 0;
                positions[(i * 3) + 2] = Math.sin(angle) * distance;
            }
        }

        orbitGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const orbitMaterial = new THREE.LineBasicMaterial({
            color: 0x444444,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending
        });

        const orbit = new THREE.LineLoop(orbitGeometry, orbitMaterial);
        this.orbitLines.add(orbit);
    }
    
    async createAsteroidBelt() {
        const asteroidBelt = new AsteroidBelt(this.scene, 85, 95, 1000);

        // NASA Rule 7: Check initialization return value
        const initSuccess = await asteroidBelt.init();

        if (!initSuccess) {
            console.warn('SolarSystem: AsteroidBelt initialization failed, using fallback rendering');
            // AsteroidBelt class should handle fallback internally
            // Still add to scene - will render with reduced particles
        }

        this.objects.set('asteroidBelt', asteroidBelt);
    }

    createKuiperBelt() {
        // Kuiper Belt: 30-50 AU from Sun (Neptune at 30 AU)
        // Scaled to simulation units with 30-unit gap from Neptune (210 units)
        // Particle count: 1500 (conservative for 60fps target, reduce to 1000 if performance degrades)
        const kuiperBelt = new KuiperBelt(
            this.scene,
            240, // Inner radius (30 AU scaled, 30-unit gap from Neptune at 210)
            380, // Outer radius (50 AU scaled, maintains ~140 unit belt width)
            1500 // Particle count (reduced from 2000 for performance safety)
        );
        this.objects.set('kuiperBelt', kuiperBelt);
    }

    async createCosmicDust() {
        // Cosmic Dust (Zodiacal Light): Interplanetary dust disk
        // Radial range: 50-400 units (Mars to Jupiter region, ~1.5-5 AU scaled)
        // Density: Power law r^(-1.5) - more dust near Sun
        // Vertical: Gaussian distribution, scale height ~7 units (thin disk)
        // Particle count: Performance-tiered (HIGH: 3000, MEDIUM: 1500, LOW: 750)
        const cosmicDust = new CosmicDust(this.scene, this.resourceLoader);

        // NASA Rule 7: Check initialization return value
        const initSuccess = await cosmicDust.init();

        if (!initSuccess) {
            console.warn('SolarSystem: CosmicDust initialization failed, using fallback rendering');
            // CosmicDust class should handle fallback internally
            // Still add to scene - will render with reduced particles or simpler shader
        }

        this.objects.set('cosmicDust', cosmicDust);
    }

    createHabitableZone() {
        const habitableZone = new HabitableZone(this.scene, 58, 68);
        habitableZone.init();
        this.objects.set('habitableZone', habitableZone);
    }
    
    createBackgroundStars() {
        const galaxy = new Galaxy(this.scene, 5000);
        galaxy.init();
        this.objects.set('galaxy', galaxy);
    }
    
    update(deltaTime, j2000Days = null) {
        if (!this.animationEnabled) return;

        // Phase 2: Pass time to all celestial objects
        // NASA Rule 7: j2000Days is optional (null = fallback to animation mode)
        for (const object of this.objects.values()) {
            if (object.update) {
                object.update(deltaTime, j2000Days);
            }
        }
    }
    
    toggleAnimation() {
        this.animationEnabled = !this.animationEnabled;
        return this.animationEnabled;
    }
    
    toggleOrbits() {
        this.showOrbits = !this.showOrbits;
        this.orbitLines.visible = this.showOrbits;
        return this.showOrbits;
    }
    
    getPlanetInfo(planetName) {
        if (planetName === 'Sun') {
            return {
                name: this.planetData.sun.name,
                description: "The star at the center of our Solar System.",
                diameter: "1,392,700 km",
                distanceFromSun: "0 km",
                orbitalPeriod: "N/A"
            };
        }
        
        const planet = this.planetData.planets.find(p => 
            p.name.toLowerCase() === planetName.toLowerCase());
            
        if (!planet) return null;
        
        return {
            name: planet.name,
            description: planet.description,
            diameter: `${planet.radius * 12742} km`, // Simplified conversion
            distanceFromSun: `${planet.distance * 1500000} km`, // Simplified conversion
            orbitalPeriod: `${Math.round(365 / planet.orbitSpeed)} Earth days` // Simplified
        };
    }
    
    getPlanetByName(planetName) {
        if (planetName.toLowerCase() === 'sun') {
            return this.objects.get('sun');
        }
        return this.objects.get(planetName.toLowerCase());
    }

    focusOnPlanet(planetName) {
        const planetObj = this.objects.get(planetName.toLowerCase());
        if (!planetObj || !planetObj.getMesh) return null;
        
        const mesh = planetObj.getMesh();
        const position = mesh.position.clone();
        
        // Get planet radius (if available) or use default values
        let planetRadius = 1;
        if (planetName === 'Sun') {
            planetRadius = 20;
        } else if (planetObj.data && planetObj.data.radius) {
            planetRadius = planetObj.data.radius;
        }
        
        // Calculate appropriate camera distance based on planet size
        let viewDistance = planetRadius * 5;
        
        // Sun needs a special distance since it's much larger
        if (planetName === 'Sun') {
            viewDistance = planetRadius * 4;
        }
        
        // Ensure minimum viewing distance
        viewDistance = Math.max(viewDistance, 5);
        
        // Position camera at an angle to see the planet better
        const cameraOffset = new THREE.Vector3(
            viewDistance * 0.866, // sin(30 degrees)
            viewDistance * 0.5, // cos(30 degrees)
            viewDistance * 0.866 // sin(30 degrees)
        );
        
        const cameraPosition = position.clone().add(cameraOffset);
        
        return {
            position: cameraPosition,
            lookAt: position
        };
    }
    
    dispose() {
        // Dispose all objects
        for (const object of this.objects.values()) {
            if (object.dispose) {
                object.dispose();
            }
        }
        
        // Clear orbit lines
        if (this.orbitLines) {
            this.scene.remove(this.orbitLines);
            for (const child of this.orbitLines.children) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
            this.orbitLines.clear();
        }
        
        // Clear objects map
        this.objects.clear();
    }
}

// Make globally available
window.SolarSystem = SolarSystem;