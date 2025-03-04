import * as THREE from 'three';
import { Sun } from './Sun';
import { Planet } from './Planets/Planet';
import { 
    PLANET_DATA, 
    SOLAR_SYSTEM_ZONES, 
    BELT_PROPERTIES, 
    VISUALIZATION_SCALES 
} from './Planets/planetData';

class RobustTextureLoader {
    constructor(maxRetries = 3, retryDelay = 1000) {
      this.loader = new THREE.TextureLoader();
      this.maxRetries = maxRetries;
      this.retryDelay = retryDelay;
      this.cache = new Map();
    }
  
    async load(url, onProgress) {
      if (this.cache.has(url)) {
        return this.cache.get(url);
      }
  
      let lastError;
      for (let attempt = 0; attempt < this.maxRetries; attempt++) {
        try {
          const texture = await this.loadAttempt(url, onProgress);
          this.cache.set(url, texture);
          return texture;
        } catch (error) {
          lastError = error;
          console.warn(`Attempt ${attempt + 1} failed to load texture ${url}`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
      throw lastError;
    }
  
    loadAttempt(url, onProgress) {
      return new Promise((resolve, reject) => {
        this.loader.load(
          url,
          (texture) => {
            texture.needsUpdate = true;
            resolve(texture);
          },
          onProgress,
          reject
        );
      });
    }
}

/**
 * Manages the entire solar system visualization including the sun,
 * planets, zones, and belts
 */
export default class SolarSystem {
    constructor(params = {}) {
        this.initializeProperties(params);
        this.setupLoadingManager();
        this.group = new THREE.Group();
        
        // Start initialization
        this.initPromise = this.initialize();

        // Time control properties
        this.timeProperties = {
            multiplier: 1,
            isPaused: false,
            isReversed: false,
            baseSpeed: 0.05,
            lastScale: 1,
            currentScale: 1,
            targetScale: 1,
            realTimeFactors: {
                earthDay: 86400,
                earthYear: 31557600,
                visualizationFactor: 0.05
            }
        };

        // Performance optimization properties
        this.optimizationProperties = {
            frustumCulling: true,
            lodEnabled: true,
            lodDistance: 1000000,  // Distance for LOD switching
            particlePoolSize: 1000,
            maxParticlesVisible: 500  // Limit visible particles for performance
        };

        this.validateGeometry = this.validateGeometryConsolidated.bind(this);
    }

    setupLoadingManager() {
        this.loadingManager = new THREE.LoadingManager(
            // onLoad
            () => {
                console.debug('Solar system textures loaded');
                this._isInitialized = true;
                this.onInitialized();
            },
            // onProgress
            (url, loaded, total) => {
                const progress = Math.round((loaded / total) * 100);
                this.onProgress(progress);
            },
            // onError
            (url) => {
                console.warn(`Failed to load texture: ${url}`);
                if (!this._isInitialized) {
                    this._isInitialized = true;
                    this.onInitialized();
                }
            }
        );
    
        // Create robust texture loader with proper settings
        const textureLoader = new THREE.TextureLoader(this.loadingManager);
        textureLoader.crossOrigin = 'anonymous';
    
        // Wrap the texture loader with additional settings
        this.textureLoader = {
            load: (url, onLoad, onProgress, onError) => {
                return new Promise((resolve, reject) => {
                    textureLoader.load(
                        url,
                        (texture) => {
                            // Configure texture properly to avoid mipmap issues
                            texture.generateMipmaps = false;
                            texture.minFilter = THREE.LinearFilter;
                            texture.magFilter = THREE.LinearFilter;
                            texture.anisotropy = this.renderer?.capabilities.getMaxAnisotropy() || 1;
                            texture.needsUpdate = true;
    
                            if (onLoad) onLoad(texture);
                            resolve(texture);
                        },
                        onProgress,
                        (error) => {
                            console.warn(`Error loading texture ${url}:`, error);
                            if (onError) onError(error);
                            // Create and return fallback texture instead of rejecting
                            const fallbackTexture = this.createFallbackTexture();
                            resolve(fallbackTexture);
                        }
                    );
                });
            }
        };
    
        // Initialize texture cache
        this.textureCache = new Map();
    }

    async loadTexture(url) {
        // Check cache first
        if (this.textureCache.has(url)) {
            return this.textureCache.get(url);
        }
    
        try {
            const texture = await new Promise((resolve, reject) => {
                this.textureLoader.load(url,
                    (texture) => {
                        texture.needsUpdate = true;
                        this.textureCache.set(url, texture);
                        resolve(texture);
                    },
                    undefined,
                    (error) => {
                        console.warn(`Error loading texture ${url}:`, error);
                        const fallbackTexture = this.createFallbackTexture();
                        this.textureCache.set(url, fallbackTexture);
                        resolve(fallbackTexture);
                    }
                );
            });
            return texture;
        } catch (error) {
            console.error('Texture loading error:', error);
            return this.createFallbackTexture();
        }
    }

    createFallbackTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 64; // Smaller size for fallback
        const ctx = canvas.getContext('2d');
        
        // Create a simple gradient
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, '#666666');
        gradient.addColorStop(1, '#333333');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        // Configure fallback texture
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        
        return texture;
    }

    validateGeometryConsolidated(geometry) {
        if (!geometry) return;
    
        try {
            // Handle position attributes
            if (geometry.attributes.position) {
                const positions = geometry.attributes.position.array;
                let needsUpdate = false;
                
                for (let i = 0; i < positions.length; i++) {
                    if (isNaN(positions[i]) || !isFinite(positions[i])) {
                        positions[i] = 0;
                        needsUpdate = true;
                    }
                }
                
                if (needsUpdate) {
                    geometry.attributes.position.needsUpdate = true;
                }
            }
    
            // Handle UV coordinates
            if (geometry.attributes.uv) {
                const uvs = geometry.attributes.uv.array;
                let needsUpdate = false;
                
                for (let i = 0; i < uvs.length; i++) {
                    if (isNaN(uvs[i]) || !isFinite(uvs[i])) {
                        uvs[i] = 0;
                        needsUpdate = true;
                    }
                }
                
                if (needsUpdate) {
                    geometry.attributes.uv.needsUpdate = true;
                }
            }
    
            // Ensure valid bounding sphere
            if (!geometry.boundingSphere || !isFinite(geometry.boundingSphere.radius)) {
                let maxRadius = 0;
                const positions = geometry.attributes.position.array;
                
                for (let i = 0; i < positions.length; i += 3) {
                    const x = positions[i];
                    const y = positions[i + 1];
                    const z = positions[i + 2];
                    if (isFinite(x) && isFinite(y) && isFinite(z)) {
                        const radius = Math.sqrt(x * x + y * y + z * z);
                        maxRadius = Math.max(maxRadius, radius);
                    }
                }
                
                geometry.boundingSphere = new THREE.Sphere(
                    new THREE.Vector3(0, 0, 0),
                    Math.max(maxRadius, 1000)
                );
            }
    
            // Update normals
            if (geometry.attributes.normal) {
                geometry.computeVertexNormals();
            }
    
        } catch (error) {
            console.warn('Error validating geometry:', error);
            // Create safe fallback geometry
            const safeGeometry = new THREE.BufferGeometry();
            safeGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
            safeGeometry.computeBoundingSphere();
            
            // Copy safe properties to original geometry
            geometry.attributes = safeGeometry.attributes;
            geometry.boundingSphere = safeGeometry.boundingSphere;
        }
    }

    // Time control methods
    setTimeMultiplier(multiplier) {
        this.timeProperties.multiplier = Math.max(-10, Math.min(10, multiplier));
        this.updateTimeScale();
    }

    pauseTime() {
        if (!this.timeProperties.isPaused) {
            this.timeProperties.lastScale = this.timeProperties.currentScale;
            this.setTimeScale(0);
        }
    }

    reverseTime() {
        this.timeProperties.isReversed = !this.timeProperties.isReversed;
        this.updateTimeScale();
    }

    updateTimeScale() {
        const direction = this.timeProperties.isReversed ? -1 : 1;
        const speed = this.timeProperties.isPaused ? 0 : this.timeProperties.multiplier;
        
        // Calculate time scale with proper astronomical values
        this.timeScale = this.timeProperties.baseSpeed * 
                        speed * 
                        direction * 
                        this.timeProperties.realTimeFactors.visualizationFactor;
                        
        // Apply time scale to all planets
        this.planets.forEach(planet => {
            if (planet?.update) {
                planet.ORBITAL_SPEED_SCALE = Math.abs(this.timeScale) * 100000;
                planet.ROTATION_SPEED_SCALE = Math.abs(this.timeScale) * 10000;
            }
        });
    }

    async initializeAsync(params) {
        try {
            
            // Create and await core components
            await Promise.all([
                this.createSun(),
                this.createHabitableZone(),
                this.createAsteroidBelt(),
                this.createKuiperBelt()
            ]);

            // Create planets after core components
            await this.createPlanets();
            
            this.isInitialized = true;
            this.onInitialized();
            
            return true;
        } catch (error) {
            this.onError(error);
            throw error;
        }
    }

    initializeProperties(params) {
        this._isInitialized = false;
        this.onProgress = params.onProgress || (() => {});
        this.onError = params.onError || console.error;
        this.onInitialized = params.onInitialized || (() => {});
        
        this.distanceScale = params.distanceScale || VISUALIZATION_SCALES.distance;
        this.sizeScale = params.sizeScale || VISUALIZATION_SCALES.size;
        this.timeScale = params.timeScale || VISUALIZATION_SCALES.time.orbital;
        
        this.planets = [];
        this.zones = new Map();
        this.belts = new Map();
    }


    validateAllGeometries() {
        this.group.traverse((object) => {
            if (object.geometry) {
                this.validateGeometry(object.geometry);
            }
        });
    }

    setupTextureLoader() {
        this.loadingManager = new THREE.LoadingManager(
            // onLoad
            () => { 
                this.isInitialized = true;
                this.validateAllGeometries(); // Validate all geometries after loading
            },
            // onProgress
            (url, loaded, total) => {
                const progress = (loaded / total * 100).toFixed(2);
                console.log(`Loading ${url}: ${progress}%`);
            },
            // onError
            (url) => {
                console.error(`Error loading texture: ${url}`);
                // Continue initialization even if some textures fail
                this.isInitialized = true;
            }
        );
        
        this.textureLoader = new THREE.TextureLoader(this.loadingManager);
    }

    async initializeTextures(textureLoader) {
        return new Promise((resolve, reject) => {
            const texturesToLoad = [];
            
            // Add textures to load queue
            this.planets.forEach(planet => {
                if (planet.textures) {
                    Object.values(planet.textures).forEach(texturePath => {
                        if (texturePath) {
                            texturesToLoad.push(
                                new Promise((res, rej) => {
                                    textureLoader.load(
                                        texturePath,
                                        (texture) => {
                                            texture.flipY = false;  // Often needed for correct orientation
                                            res(texture);
                                        },
                                        undefined,
                                        rej
                                    );
                                })
                            );
                        }
                    });
                }
            });
    
            // Wait for all textures to load
            Promise.all(texturesToLoad)
                .then(() => {
                    console.log('All textures loaded successfully');
                    resolve();
                })
                .catch((error) => {
                    console.error('Error loading textures:', error);
                    reject(error);
                });
        });
    }

    validateVisibility() {
        if (!this.group) return;
        
        // Ensure solar system group is visible
        this.group.visible = true;
        
        // Ensure sun is visible
        if (this.sun?.surface) {
            this.sun.surface.visible = true;
            this.sun.surface.material.needsUpdate = true;
        }
        
        // Ensure all planets are visible
        this.planets.forEach(planet => {
            if (planet?.planetMesh) {
                planet.planetMesh.visible = true;
                planet.planetGroup.visible = true;
                
                // Update material properties
                if (planet.planetMesh.material) {
                    planet.planetMesh.material.needsUpdate = true;
                    planet.planetMesh.material.transparent = false;
                    planet.planetMesh.material.opacity = 1;
                }
                
                // Ensure orbit line is visible
                if (planet.orbitLine) {
                    planet.orbitLine.visible = true;
                }
            }
        });
        
        // Update all positions and materials
        this.update(0);
    }

    async initialize() {
        try {
            // Create sun with more robust error handling
            this.sun = await this.createSun().catch(error => {
                console.warn('Error creating sun, using basic version:', error);
                return new Sun(this.sizeScale, this.textureLoader);
            });

            if (this.sun) {
                const sunGroup = this.sun.getGroup();
                sunGroup.position.set(0, 0, 0);
                sunGroup.visible = true;
                this.group.add(sunGroup);
            }
    
            // Add strong ambient light first
            const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
            this.group.add(ambientLight);
    
            // Add point light at sun position
            const sunLight = new THREE.PointLight(0xffffff, 2.0, 0, 1);
            sunLight.position.set(0, 0, 0);
            this.group.add(sunLight);
    
            // Create planets with forced visibility
            await Promise.all([
                this.createPlanets(),
                this.createAsteroidBelt(),
                this.createKuiperBelt()
            ]);
    
            // Force visibility of all objects
            this.group.traverse((object) => {
                if (object instanceof THREE.Mesh || object instanceof THREE.Group) {
                    object.visible = true;
                }
            });
    
            // Set scale and position
            this.group.scale.set(1, 1, 1);
            this.group.position.set(0, 0, 0);
            this.group.visible = true;
    
            // Mark as initialized
            this._isInitialized = true;
            this.onInitialized();
            
            return true;
        } catch (error) {
            console.error('Solar system initialization failed:', error);
            this.onError(error);
            throw error;
        }
    }

    forceVisibilityUpdate() {
        if (!this.group) return;
        
        console.debug('Forcing visibility update of solar system');
        
        // Force main group visibility
        this.group.visible = true;
        this.group.updateMatrixWorld(true);
        
        // Force sun visibility
        if (this.sun?.getGroup()) {
            const sunGroup = this.sun.getGroup();
            sunGroup.visible = true;
            sunGroup.traverse(child => {
                if (child.isMesh) {
                    child.visible = true;
                    if (child.material) {
                        child.material.transparent = false;
                        child.material.opacity = 1;
                        child.material.needsUpdate = true;
                    }
                }
            });
        }
        
        // Force planet visibility
        this.planets.forEach(planet => {
            if (!planet?.getGroup()) return;
            
            const planetGroup = planet.getGroup();
            planetGroup.visible = true;
            
            // Force orbit lines visible
            if (planet.orbitLine) {
                planet.orbitLine.visible = true;
                if (planet.orbitLine.material) {
                    planet.orbitLine.material.transparent = true;
                    planet.orbitLine.material.opacity = 0.5;
                    planet.orbitLine.material.needsUpdate = true;
                }
            }
            
            // Force planet mesh visible
            planetGroup.traverse(child => {
                if (child.isMesh || child.isLine) {
                    child.visible = true;
                    if (child.material) {
                        child.material.needsUpdate = true;
                    }
                }
            });
        });
        
        // Update positions
        this.update(0);
    }

    updateVisibility() {
        if (!this.group) return;
        
        this.group.visible = true;
        this.group.traverse((object) => {
            if (object instanceof THREE.Mesh || object instanceof THREE.Group) {
                object.visible = true;
                if (object.material) {
                    object.material.needsUpdate = true;
                }
            }
        });
    }

    async createSun() {
        const sun = new Sun(this.sizeScale, this.textureLoader);
        // Wait for sun initialization
        await new Promise(resolve => {
            const checkInit = () => {
                if (sun.isInitialized) {
                    resolve();
                } else {
                    setTimeout(checkInit, 100);
                }
            };
            checkInit();
        });
        return sun;
    }

    createHabitableZone() {
        Object.entries(SOLAR_SYSTEM_ZONES).forEach(([zoneName, zoneData]) => {
            const zone = this.createZone(zoneData);
            //this.zones.set(zoneName, zone);
            //this.group.add(zone);
        });
    }

    async createPlanets() {
        console.debug('Starting planet creation...');
        const planetPromises = PLANET_DATA.map(async (planetData, index) => {
            try {
                const planet = new Planet(
                    planetData,
                    this.sizeScale,
                    this.distanceScale,
                    index,
                    this.textureLoader,
                    this.validateGeometry.bind(this)
                );
                
                // Set initial time scaling
                planet.ORBITAL_SPEED_SCALE = Math.abs(this.timeScale) * 1000000;
                planet.ROTATION_SPEED_SCALE = Math.abs(this.timeScale) * 100000;
                
                // Force visibility of the planet group and its components
                const planetGroup = planet.getGroup();
                if (planetGroup) {
                    planetGroup.visible = true;
                    planetGroup.traverse(child => {
                        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
                            child.visible = true;
                            if (child.material) {
                                child.material.transparent = false;
                                child.material.opacity = 1;
                                child.material.needsUpdate = true;
                            }
                        }
                    });
                }
                
                this.planets.push(planet);
                this.group.add(planetGroup);
                console.debug(`Created planet: ${planetData.name}`);
                return planet;
                
            } catch (error) {
                console.error(`Failed to create planet ${planetData.name}:`, error);
                return null;
            }
        });
    
        const planets = await Promise.all(planetPromises);
        const validPlanets = planets.filter(planet => planet !== null);
        console.debug(`Successfully created ${validPlanets.length} planets`);
        return validPlanets;
    }

    isReady() {
        return this._isInitialized;
    }

    createAsteroidBelt() {
        this.belts.set('asteroid', this.createBelt(BELT_PROPERTIES.asteroid));
    }

    createKuiperBelt() {
        this.belts.set('kuiper', this.createBelt(BELT_PROPERTIES.kuiper));
    }

    createBelt(beltData) {
        const {
            innerRadius,
            outerRadius,
            thickness,
            particleCount,
            particleSize,
            color
        } = beltData;

        const belt = new THREE.Group();
        const particleGeometry = new THREE.SphereGeometry(1, 4, 4);
        const particleMaterial = new THREE.MeshPhongMaterial({
            color: color,
            shininess: 0.5
        });

        // Create particle pool
        const particlePool = new Array(particleCount).fill(null).map(() => {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.active = true;  // Track active state
            belt.add(particle);
            return particle;
        });

        // Store particle pool on belt object
        belt.particles = particlePool;
        belt.innerRadius = innerRadius * this.distanceScale;
        belt.outerRadius = outerRadius * this.distanceScale;
        belt.thickness = thickness * this.distanceScale;

        // Initial particle positioning
        particlePool.forEach(particle => this.recycleParticle(particle, belt));

        this.group.add(belt);
        return belt;
    }

    createZone(zoneData) {
        const { innerBoundary, outerBoundary, color, opacity } = zoneData;
        const segments = 128;
        
        try {
            // Ensure valid values for ring geometry
            const innerRadius = Math.max(0.1, innerBoundary * this.distanceScale);
            const outerRadius = Math.max(innerRadius + 0.1, outerBoundary * this.distanceScale);
            
            const geometry = new THREE.RingGeometry(
                innerRadius,
                outerRadius,
                segments
            );
            
            this.validateGeometry(geometry)
            
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: opacity,
                side: THREE.DoubleSide,
                depthWrite: false
            });
    
            const zone = new THREE.Mesh(geometry, material);
            zone.rotation.x = -Math.PI / 2;
            zone.renderOrder = -1;
            
            return zone;
            
        } catch (error) {
            console.error('Error creating zone:', error);
            return new THREE.Object3D(); // Return empty object if creation fails
        }
    }

    update(deltaTime) {
        // Don't update if not initialized
        if (!this._isInitialized) return;

        // Always update even if paused (with zero time scale)
        const effectiveDeltaTime = this.timeProperties.isPaused ? 0 : deltaTime;

        this.planets.forEach(planet => {
            try {
                if (planet?.update) {
                    // Pass current time scale to planet update
                    planet.update(effectiveDeltaTime, this.timeScale);
                }
            } catch (error) {
                console.warn(`Error updating planet ${planet?.data?.name}:`, error);
            }
        });

        // Ensure matrix updates
        this.group.updateMatrixWorld(true);
    }

    resumeTime() {
        if (this.timeProperties.isPaused) {
            this.timeProperties.isPaused = false;
            // Use the last known scale or default to 1
            const scale = this.timeProperties.lastScale || 1;
            this.setTimeScale(this.timeProperties.isReversed ? -scale : scale);
        }
    }

    isInView(position) {
        // Simple frustum culling check
        if (!this.camera) return true;

        const frustum = new THREE.Frustum();
        const projScreenMatrix = new THREE.Matrix4();

        projScreenMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse
        );
        frustum.setFromProjectionMatrix(projScreenMatrix);

        return frustum.containsPoint(position);
    }

    updateBeltsOptimized(deltaTime) {
        const cameraPosition = this.camera?.position || new THREE.Vector3();
        const maxVisibleParticles = this.optimizationProperties.maxParticlesVisible;
        let visibleParticles = 0;
    
        this.belts.forEach((belt, name) => {
            if (!belt) return;
    
            belt.rotation.y += 0.0001 * deltaTime;
    
            if (belt.particles) {
                belt.particles.forEach(particle => {
                    if (!particle.active) return;
                    
                    // Only update visible particles
                    if (visibleParticles < maxVisibleParticles && 
                        (!this.optimizationProperties.frustumCulling || 
                         this.isInView(particle.position))) {
                        
                        particle.position.applyAxisAngle(
                            new THREE.Vector3(0, 1, 0),
                            0.0001 * deltaTime
                        );
    
                        if (particle.position.length() > belt.outerRadius) {
                            this.recycleParticle(particle, belt);
                        }
                        
                        visibleParticles++;
                    } else {
                        particle.visible = false;
                    }
                });
            }
        });
    }

    recycleParticle(particle, belt) {
        // Reset particle to new random position within belt boundaries
        const radius = belt.innerRadius + 
                      Math.random() * (belt.outerRadius - belt.innerRadius);
        const theta = Math.random() * Math.PI * 2;
        const y = (Math.random() - 0.5) * belt.thickness;

        particle.position.set(
            radius * Math.cos(theta),
            y,
            radius * Math.sin(theta)
        );

        // Add random rotation
        particle.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
    }

    checkSceneVisibility() {
        console.debug('Solar System Visibility Check:');
        console.debug('Main group visible:', this.group.visible);
        console.debug('Number of planets:', this.planets.length);
        
        this.planets.forEach(planet => {
            const group = planet.getGroup();
            console.debug(`Planet ${planet.data.name}:`, {
                hasGroup: !!group,
                groupVisible: group?.visible,
                meshVisible: planet.planetMesh?.visible,
                orbitVisible: planet.orbitLine?.visible,
                position: group?.position.toArray()
            });
        });
    }

    validateSceneStructure() {
        console.debug('Validating solar system structure');
        
        const countVisibleObjects = (group) => {
            let count = 0;
            group.traverse(obj => {
                if (obj.visible) count++;
            });
            return count;
        };
        
    }

    forceSceneUpdate() {
        this.group.updateMatrixWorld(true);
        this.validateVisibility();
        this.update(0);
    }
    
    // Public methods for external control
    setTimeScale(scale) {
        console.debug(`Setting time scale to: ${scale}`);
        
        // Handle pause state
        if (scale === 0) {
            this.timeProperties.isPaused = true;
            this.timeProperties.lastScale = this.timeProperties.currentScale;
        } else {
            this.timeProperties.isPaused = false;
            this.timeProperties.currentScale = Math.abs(scale);
            this.timeProperties.isReversed = scale < 0;
        }
    
        // Calculate the actual time scale value
        const effectiveScale = this.timeProperties.isPaused ? 0 : 
            scale * this.timeProperties.baseSpeed * 
            this.timeProperties.realTimeFactors.visualizationFactor;
    
        // Store for reference
        this.timeScale = effectiveScale;
    
        // Update all planets
        this.planets.forEach(planet => {
            if (planet?.timeProperties) {
                // Update planet time properties
                planet.timeProperties.timeDirection = Math.sign(scale) || 1;
                planet.timeProperties.isPaused = scale === 0;
                
                // Scale the speeds appropriately
                const speedScale = Math.abs(effectiveScale);
                planet.timeProperties.orbitalSpeedScale = speedScale * 100000;
                planet.timeProperties.rotationSpeedScale = speedScale * 10000;
            }
        });
    
        console.debug('Updated time properties:', {
            scale: effectiveScale,
            isPaused: this.timeProperties.isPaused,
            isReversed: this.timeProperties.isReversed
        });
    }

    togglePlanetTrails(visible) {
        this.planets.forEach(planet => {
            if (planet.trailMesh) {
                planet.trailMesh.visible = visible;
            }
        });
    }

    toggleOrbits(visible) {
        this.planets.forEach(planet => {
            if (planet.orbitLine) {
                planet.orbitLine.visible = visible;
            }
        });
    }

    toggleZones(visible) {
        this.zones.forEach(zone => {
            zone.visible = visible;
        });
    }

    selectPlanet(planetName) {
        this.selectedPlanet = this.planets.find(
            planet => planet.data.name.toLowerCase() === planetName.toLowerCase()
        );
        return this.selectedPlanet;
    }

    getPlanetPosition(planetName) {
        const planet = this.planets.find(
            p => p?.data?.name.toLowerCase() === planetName.toLowerCase()
        );
        
        if (planet) {
            const worldPosition = new THREE.Vector3();
            planet.planetGroup.getWorldPosition(worldPosition);
            return worldPosition;
        }
        return null;
    }

    getGroup() {
        return this.group;
    }

    dispose() {
        this._isInitialized = false;
        
        // Dispose sun
        if (this.sun?.dispose) {
            this.sun.dispose();
        }

        // Dispose planets
        this.planets.forEach(planet => {
            if (planet?.dispose) {
                planet.dispose();
            }
        });

        // Clear collections
        this.planets = [];
        this.zones.clear();
        this.belts.clear();

        // Clear textures
        this.textureLoader?.clearCache();
    }
}