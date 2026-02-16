// Planet.js - Base class for all planets
class Planet {
    constructor(scene, resourceLoader, data) {
        this.scene = scene;
        this.resourceLoader = resourceLoader;
        this.data = data;
        this.mesh = null;
        this.orbit = { angle: Math.random() * Math.PI * 2 };
        this.cloudsMesh = null;
        this.ringsMesh = null;
        this.moonGroup = null;
        this.moons = [];
    }
    
    async init() {
        try {
            // Load the texture
            const texture = await this.resourceLoader.loadTexture(this.data.texturePath);

            // Create geometry and material
            const geometry = new THREE.SphereGeometry(this.data.radius, 64, 64);
            const material = new THREE.MeshPhongMaterial({
                map: texture,
                bumpScale: 0.05
            });

            // Load bump map if available
            if (this.data.bumpMapPath) {
                const bumpMap = await this.resourceLoader.loadTexture(this.data.bumpMapPath);
                material.bumpMap = bumpMap;
            }

            // Load specular map if available
            if (this.data.specularMapPath) {
                const specularMap = await this.resourceLoader.loadTexture(this.data.specularMapPath);
                material.specularMap = specularMap;
                material.shininess = 10;
            }

            // Create the mesh
            this.mesh = new THREE.Mesh(geometry, material);

            // Apply axial tilt (rotation around X-axis)
            const tiltRadians = THREE.MathUtils.degToRad(this.data.axialTilt || 0);
            this.mesh.rotation.x = tiltRadians;

            // Precompute orbital constants for performance optimization
            if (this.data.orbitalElements) {
                const e = this.data.orbitalElements.eccentricity;
                this.sqrtFactor = Math.sqrt(1 - (e * e));

                // Precompute argument of periapsis rotation matrix components
                const omega = THREE.MathUtils.degToRad(this.data.orbitalElements.argumentOfPeriapsis || 0);
                this.cosOmega = Math.cos(omega);
                this.sinOmega = Math.sin(omega);
            }

            // Position the planet based on its distance from the sun
            this.updatePosition();

            // Add to scene
            this.scene.add(this.mesh);

            // Create clouds if available
            if (this.data.cloudsPath) {
                await this.createClouds();
            }

            // Create rings if available
            if (this.data.ringsPath) {
                await this.createRings();
            }

            return true;
        } catch (error) {
            console.error(`Failed to initialize planet ${this.data.name}:`, error);
            return false;
        }
    }
    
    async createClouds() {
        const cloudsTexture = await this.resourceLoader.loadTexture(this.data.cloudsPath);
        
        const cloudsGeometry = new THREE.SphereGeometry(this.data.radius + 0.05, 64, 64);
        const cloudsMaterial = new THREE.MeshPhongMaterial({
            map: cloudsTexture,
            transparent: true,
            opacity: 0.8
        });
        
        this.cloudsMesh = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
        this.mesh.add(this.cloudsMesh);
    }
    
    async createRings() {
        // Load ring textures
        const ringsTexture = await this.resourceLoader.loadTexture(this.data.ringsPath);
        const ringsColorTexture = this.data.ringsColorPath ? 
            await this.resourceLoader.loadTexture(this.data.ringsColorPath) : null;
        
        // Create ring geometry
        const innerRadius = this.data.radius * 1.5;
        const outerRadius = this.data.radius * 2.5;
        const segments = 128;
        
        const ringsGeometry = new THREE.RingGeometry(innerRadius, outerRadius, segments);
        
        // Create mesh with double-sided material
        const ringsMaterial = new THREE.MeshPhongMaterial({
            map: ringsTexture,
            color: 0xffffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        
        if (ringsColorTexture) {
            ringsMaterial.alphaMap = ringsTexture;
            ringsMaterial.map = ringsColorTexture;
        }
        
        this.ringsMesh = new THREE.Mesh(ringsGeometry, ringsMaterial);
        
        // Rotate rings to be horizontal
        this.ringsMesh.rotation.x = Math.PI / 2;
        
        // Add rings to planet
        this.mesh.add(this.ringsMesh);
    }
    
    updatePosition() {
        // === ERROR HANDLING: Validate orbital elements ===
        const orbitalElements = this.data.orbitalElements;

        if (!orbitalElements ||
            orbitalElements.eccentricity >= 1.0 ||
            orbitalElements.eccentricity < 0 ||
            orbitalElements.semiMajorAxis <= 0) {

            if (orbitalElements && (orbitalElements.eccentricity >= 1.0 || orbitalElements.eccentricity < 0)) {
                console.warn(`Invalid orbital elements for ${this.data.name}: e=${orbitalElements.eccentricity}, using circular orbit`);
            }

            return this.updateCircularOrbit();
        }

        const { semiMajorAxis, eccentricity } = orbitalElements;

        // === KEPLER'S EQUATION: Solve for eccentric anomaly ===
        // Reference: Murray & Dermott (1999), Solar System Dynamics, Section 2.3
        const meanAnomaly = this.orbit.angle; // Mean anomaly from time
        let E = meanAnomaly; // Initial guess for eccentric anomaly

        // Newton-Raphson iteration (3-4 iterations sufficient for e < 0.21)
        for (let i = 0; i < 4; i++) {
            const deltaE = (E - eccentricity * Math.sin(E) - meanAnomaly) /
                           (1 - eccentricity * Math.cos(E));
            E -= deltaE;

            // Convergence check
            if (Math.abs(deltaE) < 1e-6) break;
        }

        // Validate convergence
        if (isNaN(E) || !isFinite(E)) {
            console.error(`Kepler solver failed for ${this.data.name}, E=${E}`);
            return this.updateCircularOrbit();
        }

        // === POSITION CALCULATION: Convert to Cartesian coordinates ===
        // Reference: Prussing & Conway (1993), Orbital Mechanics, Chapter 1
        const cosE = Math.cos(E);
        const sinE = Math.sin(E);

        // Use precomputed sqrtFactor from init() for performance
        const sqrtFactor = this.sqrtFactor || Math.sqrt(1 - (eccentricity * eccentricity));

        // Position in orbital plane (before rotation)
        const xOrbital = semiMajorAxis * (cosE - eccentricity);
        const zOrbital = semiMajorAxis * sqrtFactor * sinE;

        // Apply argument of periapsis rotation (orient ellipse)
        // Use precomputed cosOmega and sinOmega from init() for performance
        const cosOmega = this.cosOmega !== undefined ? this.cosOmega : 1;
        const sinOmega = this.sinOmega !== undefined ? this.sinOmega : 0;

        const x = (xOrbital * cosOmega) - (zOrbital * sinOmega);
        const z = (xOrbital * sinOmega) + (zOrbital * cosOmega);

        // Set position
        this.mesh.position.set(x, 0, z);

        // Calculate current distance for speed variation (Step 3)
        this.currentDistance = Math.sqrt((x * x) + (z * z));
    }

    // === FALLBACK: Circular orbit for invalid data ===
    updateCircularOrbit() {
        const distance = this.data.distance || this.data.orbitalElements?.semiMajorAxis || 50;
        const x = Math.cos(this.orbit.angle) * distance;
        const z = Math.sin(this.orbit.angle) * distance;
        this.mesh.position.set(x, 0, z);
        this.currentDistance = distance;
    }
    
    update(deltaTime, j2000Days = null) {
        // NASA Rule 7: Defensive guard against null mesh
        if (!this.mesh) {
            console.error(`Planet.update: ${this.data.name} has null mesh, skipping update`);
            return;
        }

        // BUG FIX 1: Sync rotation with TimeScaleManager (just like orbital position)
        // NASA Rule 7: Check if time-synchronized mode is available
        if (j2000Days !== null && this.data.rotationPeriodHours) {
            // NEW: Calculate rotation from real time
            const hoursPerDay = 24;
            const rotationsPerJ2000Day = hoursPerDay / this.data.rotationPeriodHours;
            const totalRotations = j2000Days * rotationsPerJ2000Day;

            // NASA Rule 5: Validate rotation period exists
            console.assert(this.data.rotationPeriodHours > 0,
                `Planet.update: ${this.data.name} has invalid rotationPeriodHours`);

            // Set rotation directly from time (modulo 2π to prevent overflow)
            this.mesh.rotation.y = (totalRotations * Math.PI * 2) % (Math.PI * 2);
        } else {
            // FALLBACK: Use old animation mode (not synced with time)
            this.mesh.rotation.y += this.data.rotationSpeed * deltaTime;
        }

        // Phase 2: Orbital position calculation
        // NASA Rule 7: Check if time-synchronized mode is available
        if (j2000Days !== null && this.data.orbitalPeriodDays && typeof OrbitalCalculator !== 'undefined') {
            // NEW: Calculate orbital position from real time
            const epochAnomaly = this.data.orbitalElements?.meanAnomalyAtEpoch || 0;
            const meanAnomaly = OrbitalCalculator.calculateMeanAnomaly(
                j2000Days,
                this.data.orbitalPeriodDays,
                epochAnomaly
            );

            // NASA Rule 5: Validate calculated anomaly
            if (isFinite(meanAnomaly)) {
                this.orbit.angle = meanAnomaly; // Use this in updatePosition()
            } else {
                console.warn(`Planet.update: Invalid mean anomaly for ${this.data.name}, using fallback`);
            }
        } else {
            // FALLBACK: Old animation mode (constant speed with Kepler's 2nd law)
            // Calculate speed multiplier (Kepler's 2nd Law: equal areas in equal times)
            // Angular velocity: dθ/dt = L/(m*r²) where L = angular momentum
            // For constant L: ω ∝ 1/r² (QUADRATIC, not linear)
            // Reference: Murray & Dermott (1999), Equation 2.38
            if (this.data.orbitalElements && this.currentDistance !== undefined) {
                const { semiMajorAxis } = this.data.orbitalElements;

                // CORRECTED: Quadratic relationship (NOT linear)
                const speedMultiplier = Math.pow(semiMajorAxis / this.currentDistance, 2);
                this.orbit.angle += this.data.orbitSpeed * speedMultiplier * deltaTime;
            } else {
                // Fallback: constant speed (circular orbit)
                this.orbit.angle += this.data.orbitSpeed * deltaTime;
            }
        }

        this.updatePosition();

        // Rotate clouds if they exist
        if (this.cloudsMesh) {
            this.cloudsMesh.rotation.y += this.data.rotationSpeed * 0.5 * deltaTime;
        }

        // Update moons (if they have update callbacks - e.g., Earth's moon)
        // NASA Rule 2: Fixed loop bounds
        // Phase 2: Pass j2000Days to moon update callbacks
        if (this.moons && this.moons.length > 0) {
            for (let i = 0; i < this.moons.length; i++) {
                const moon = this.moons[i];
                // Type guard: Support callback pattern (Earth) and manual update pattern (Mars/Jupiter/etc)
                if (moon && typeof moon.update === 'function') {
                    moon.update(deltaTime, j2000Days);
                }
            }
        }
        // Note: Planets with complex moon systems (Mars, Jupiter, Saturn, Uranus, Neptune)
        // handle moon updates in their own update() overrides for specialized orbital mechanics
    }
    
    getMesh() {
        return this.mesh;
    }

    dispose() {
        // NASA Rule 5: Assertions for critical preconditions
        console.assert(this.mesh !== null && this.mesh !== undefined,
            "Planet.dispose: mesh should exist when dispose is called");
        console.assert(this.scene !== null && this.scene !== undefined,
            "Planet.dispose: scene should exist when dispose is called");

        // Dispose main mesh
        if (this.mesh) {
            if (this.mesh.geometry) {
                this.mesh.geometry.dispose();
            }
            if (this.mesh.material) {
                // Note: texture stays in ResourceLoader cache
                // Will be fully cleaned when resourceLoader.purgeCache() called
                if (this.mesh.material.map) {
                    this.mesh.material.map.dispose();
                }
                if (this.mesh.material.bumpMap) {
                    this.mesh.material.bumpMap.dispose();
                }
                if (this.mesh.material.specularMap) {
                    this.mesh.material.specularMap.dispose();
                }
                this.mesh.material.dispose();
            }
        }

        // Dispose clouds mesh if exists
        if (this.cloudsMesh) {
            if (this.cloudsMesh.geometry) {
                this.cloudsMesh.geometry.dispose();
            }
            if (this.cloudsMesh.material) {
                if (this.cloudsMesh.material.map) {
                    this.cloudsMesh.material.map.dispose();
                }
                this.cloudsMesh.material.dispose();
            }
        }

        // Dispose ring mesh if exists
        if (this.ringsMesh) {
            if (this.ringsMesh.geometry) {
                this.ringsMesh.geometry.dispose();
            }
            if (this.ringsMesh.material) {
                if (this.ringsMesh.material.map) {
                    this.ringsMesh.material.map.dispose();
                }
                this.ringsMesh.material.dispose();
            }
        }

        // Dispose all moons iteratively (moon.dispose() may recursively dispose nested moons if they exist)
        for (const moon of this.moons) {
            if (moon.dispose) {
                moon.dispose();
            }
        }
        this.moons = [];
    }
}