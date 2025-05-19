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
            
            // Create asteroid belt
            await this.createAsteroidBelt();
            
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
                    texturePath: "src/assets/textures/planets/mercury/mercury_map.jpg",
                    bumpMapPath: "src/assets/textures/planets/mercury/mercury_bump.jpg",
                    description: "The smallest and innermost planet in the Solar System."
                },
                {
                    name: "Venus",
                    radius: 1.8,
                    distance: 45,
                    rotationSpeed: 0.002,
                    orbitSpeed: 0.015,
                    texturePath: "src/assets/textures/planets/venus/venus_map.jpg",
                    bumpMapPath: "src/assets/textures/planets/venus/venus_bump.jpg",
                    cloudsPath: "src/assets/textures/planets/venus/venus_clouds.jpg",
                    description: "The second planet from the Sun with a thick toxic atmosphere."
                },
                {
                    name: "Earth",
                    radius: 2,
                    distance: 60,
                    rotationSpeed: 0.01,
                    orbitSpeed: 0.01,
                    texturePath: "src/assets/textures/planets/earth/earth_map.jpg",
                    bumpMapPath: "src/assets/textures/planets/earth/earth_bump.jpg",
                    cloudsPath: "src/assets/textures/planets/earth/earth_clouds.jpg",
                    specularMapPath: "src/assets/textures/planets/earth/earth_specular.jpg",
                    description: "Our home planet, the only known celestial body to harbor life."
                },
                {
                    name: "Mars",
                    radius: 1.5,
                    distance: 75,
                    rotationSpeed: 0.008,
                    orbitSpeed: 0.008,
                    texturePath: "src/assets/textures/planets/mars/mars_map.jpg",
                    description: "The Red Planet, known for its iron oxide surface."
                },
                {
                    name: "Jupiter",
                    radius: 5,
                    distance: 100,
                    rotationSpeed: 0.02,
                    orbitSpeed: 0.005,
                    texturePath: "src/assets/textures/planets/jupiter/jupiter_map.jpg",
                    description: "The largest planet in our Solar System, a gas giant."
                },
                {
                    name: "Saturn",
                    radius: 4.5,
                    distance: 135,
                    rotationSpeed: 0.018,
                    orbitSpeed: 0.003,
                    texturePath: "src/assets/textures/planets/saturn/saturn_map.jpg",
                    ringsPath: "src/assets/textures/planets/saturn/saturn_rings.jpg",
                    ringsColorPath: "src/assets/textures/planets/saturn/saturn_rings_color.jpg",
                    description: "Known for its prominent ring system composed of ice and rock particles."
                },
                {
                    name: "Uranus",
                    radius: 3.5,
                    distance: 175,
                    rotationSpeed: 0.012,
                    orbitSpeed: 0.002,
                    texturePath: "src/assets/textures/planets/uranus/uranus_map.jpg",
                    ringsPath: "src/assets/textures/planets/uranus/uranus_rings.jpg",
                    ringsColorPath: "src/assets/textures/planets/uranus/uranus_rings_color.jpg",
                    description: "An ice giant with a tilted rotation axis of 97.8 degrees."
                },
                {
                    name: "Neptune",
                    radius: 3.5,
                    distance: 210,
                    rotationSpeed: 0.014,
                    orbitSpeed: 0.001,
                    texturePath: "src/assets/textures/planets/neptune/neptune_map.jpg",
                    description: "The windiest planet in our Solar System, with winds up to 2,100 km/h."
                }
            ]
        };
    }
    
    async createSun() {
        const sun = new Sun(this.scene, this.resourceLoader, this.planetData.sun);
        await sun.init();
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
            
            await planet.init();
            this.objects.set(planetData.name.toLowerCase(), planet);
            
            // Create orbit visualization
            this.createOrbitLine(planetData.distance);
        }
    }
    
    createOrbitLine(distance) {
        const segments = 128;
        const orbitGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(segments * 3);
        
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            positions[i * 3] = Math.cos(angle) * distance;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = Math.sin(angle) * distance;
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
        await asteroidBelt.init();
        this.objects.set('asteroidBelt', asteroidBelt);
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
    
    update(deltaTime) {
        if (!this.animationEnabled) return;
        
        // Update all celestial objects
        for (const object of this.objects.values()) {
            if (object.update) {
                object.update(deltaTime);
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
    
    focusOnPlanet(planetName) {
        const planetObj = this.objects.get(planetName.toLowerCase());
        if (!planetObj || !planetObj.getMesh) return null;
        
        const mesh = planetObj.getMesh();
        const position = mesh.position.clone();
        const cameraPosition = position.clone().add(new THREE.Vector3(0, 5, 20));
        
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