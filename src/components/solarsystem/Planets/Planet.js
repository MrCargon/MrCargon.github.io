// src/components/celestial/Planet.js
import * as THREE from 'three';
import { VISUALIZATION_SCALES } from './planetData.js';


/**
 * Represents a planet in the solar system with all its associated visual elements
 * including atmosphere, rings, and orbit trail
 */
export class Planet {
    constructor(planetData, sizeScale, distanceScale, index, textureLoader, validateGeometryFn) {
        // Core properties from constructor
        this.data = planetData;
        this.sizeScale = sizeScale;
        this.distanceScale = distanceScale;
        this.index = index;
        this.textureLoader = textureLoader;

        // Cached calculations
        this.scaledRadius = this.data.radius * this.sizeScale;
        this.scaledDistance = this.data.distance * this.distanceScale;
        
        // Reusable objects
        this.reusableQuaternion = new THREE.Quaternion();
        this.reusableVector = new THREE.Vector3();
        this.reusableMatrix = new THREE.Matrix4();

        this.validateGeometry = validateGeometryFn || this.defaultValidateGeometry.bind(this);

        // Time and rotation properties
        this.timeProperties = {
            // Convert periods from days to seconds for more accurate calculations
            orbitalPeriod: this.data.orbitalPeriod * 24 * 60 * 60,
            rotationPeriod: Math.abs(this.data.rotationPeriod) * 24 * 60 * 60,
            currentOrbitalAngle: (this.index / 8) * Math.PI * 2,
            currentRotationAngle: 0,
            // Base speeds in radians per second
            baseOrbitalSpeed: 0,
            baseRotationSpeed: 0,
            // Speed multipliers for visualization
            orbitalSpeedScale: 100000,
            rotationSpeedScale: 10000,
            timeDirection: 1
        };

        // Calculate base speeds
        this.initializeSpeedProperties();
        
        // Initialize quaternions for rotation
        this.rotationState = {
            axialTilt: new THREE.Quaternion(),
            orbitalInclination: new THREE.Quaternion(),
            currentRotation: new THREE.Quaternion(),
            // Cache frequently used vectors
            upVector: new THREE.Vector3(0, 1, 0),
            rightVector: new THREE.Vector3(1, 0, 0)
        };

        // Initialize quaternions
        this.initializeQuaternions();
        
        // Setup core groups 
        this.group = new THREE.Group();
        this.planetGroup = new THREE.Group();
        this.orbitGroup = new THREE.Group();
        
        // Force visibility
        this.group.visible = true;
        this.planetGroup.visible = true;
        this.orbitGroup.visible = true;
        
        // Add material and geometry pools
        this.geometryPool = new Map();
        this.materialPool = new Map();

        // Initialize the planet
        this.initialize();
    }

    initialize() {
        // Set up group hierarchy
        this.orbitGroup.add(this.planetGroup);
        this.group.add(this.orbitGroup);
        
        // Create planet elements
        this.createPlanet();
        if (this.data.hasAtmosphere) {
            this.createAtmosphere();
        }
        if (this.data.ringSystem) {
            this.createRings();
        }
        
        this.createMoons();

        // Create orbital elements
        this.createOrbit();
        this.createTrail();
        
        // Set initial position and rotation
        this.setInitialPosition();
    }

    initializeSpeedProperties() {
        // Calculate orbital speed (radians per second)
        this.timeProperties.baseOrbitalSpeed = 
            (2 * Math.PI) / this.timeProperties.orbitalPeriod;

        // Calculate rotation speed (radians per second)
        this.timeProperties.baseRotationSpeed = 
            (2 * Math.PI) / this.timeProperties.rotationPeriod;

        // Adjust for retrograde rotation
        if (this.data.rotationPeriod < 0) {
            this.timeProperties.baseRotationSpeed *= -1;
        }
    }

    initializeQuaternions() {
        // Set axial tilt quaternion
        this.rotationState.axialTilt.setFromAxisAngle(
            this.rotationState.rightVector,
            THREE.MathUtils.degToRad(this.data.axialTilt)
        );

        // Set orbital inclination quaternion
        this.rotationState.orbitalInclination.setFromAxisAngle(
            this.rotationState.rightVector,
            THREE.MathUtils.degToRad(this.data.orbitalInclination)
        );
    }

    createPlanet() {
        this.lod = new THREE.LOD();
        
        const lodLevels = [
            { segments: 64, distance: 0 },
            { segments: 32, distance: this.scaledRadius * 20 },
            { segments: 16, distance: this.scaledRadius * 100 },
            { segments: 8, distance: this.scaledRadius * 500 }
        ];
    
        // Create all LOD levels synchronously first
        lodLevels.forEach(level => {
            const geometry = new THREE.SphereGeometry(
                this.scaledRadius,
                level.segments,
                level.segments / 2
            );
            
            // Create material
            const material = new THREE.MeshPhysicalMaterial({
                map: null,
                bumpMap: null,
                roughnessMap: null,
                color: this.data.id === 'earth' ? 0xffffff : this.data.materials.color,
                emissive: this.data.materials.emissive || 0x000000,
                roughness: this.data.materials.roughness || 0.5,
                metalness: this.data.materials.metalness || 0.1,
                clearcoat: 0.1,
                clearcoatRoughness: 0.4,
                transparent: false
            });
    
            const mesh = new THREE.Mesh(geometry, material);
            this.lod.addLevel(mesh, level.distance);
        });
    
        // Add to scene first
        this.planetMesh = this.lod;
        this.planetGroup.add(this.lod);
    
        // Then load textures asynchronously
        this.loadPlanetTextures().then(() => {
            // Force material update after textures load
            this.updateMaterial();
        });
    }

    async loadPlanetTextures() {
        try {
            // Load all textures in parallel
            const [mapTexture, bumpTexture, specularTexture] = await Promise.all([
                this.data.textures.map ? this.loadTexture(this.data.textures.map) : null,
                this.data.textures.bumpMap ? this.loadTexture(this.data.textures.bumpMap) : null,
                this.data.textures.specularMap ? this.loadTexture(this.data.textures.specularMap) : null
            ]);
    
            // Apply textures to all LOD levels
            this.lod.traverse(mesh => {
                if (mesh instanceof THREE.Mesh) {
                    if (mapTexture) {
                        mesh.material.map = mapTexture;
                    }
                    if (bumpTexture) {
                        mesh.material.bumpMap = bumpTexture;
                        mesh.material.bumpScale = this.data.materials.bumpScale || 0.02;
                    }
                    if (specularTexture) {
                        mesh.material.roughnessMap = specularTexture;
                    }
                    mesh.material.needsUpdate = true;
                }
            });
    
            // Create atmosphere and clouds after textures are loaded
            if (this.data.id === 'earth' && this.data.textures.cloudsMap) {
                await this.createClouds(this.data.textures.cloudsMap);
            }
            if (this.data.hasAtmosphere) {
                this.createAtmosphere();
            }
    
        } catch (error) {
            console.error(`Error loading textures for ${this.data.name}:`, error);
        }
    }

    createPlanetMaterial() {
        if (this.data.id === 'earth') {
            // Special handling for Earth
            return new THREE.MeshPhysicalMaterial({
                map: null,  // Will be set later
                bumpMap: null,  // Will be set later
                roughnessMap: null,  // Use roughnessMap instead of specularMap
                bumpScale: 0.05,
                color: 0xffffff,  // Use white to not tint the texture
                emissive: 0x000000,
                roughness: 0.5,
                metalness: 0.1,
                clearcoat: 0.3,
                clearcoatRoughness: 0.4,
                transparent: false
            });
        }
    
        // Default material for other planets
        return new THREE.MeshPhysicalMaterial({
            color: this.data.materials.color,
            emissive: this.data.materials.emissive,
            roughness: this.data.materials.roughness,
            metalness: this.data.materials.metalness,
            clearcoat: 0.1,
            clearcoatRoughness: 0.4,
            transparent: false
        });
    }

    async createMoons() {
        if (!this.data.moons || this.data.moons.length === 0) return;
        
        this.moons = new Map();
        
        for (const moonData of this.data.moons) {
            if (typeof moonData === 'string') continue;
            
            try {
                const moonGroup = new THREE.Group();
                
                // Convert moon's distance to be relative to planet radius
                // Earth radius is 6371 km, Moon distance is 384,399 km
                // Calculate moon scale relative to planet
                const moonSizeRatio = moonData.radius / this.data.radius;
                const moonRadius = this.scaledRadius * moonSizeRatio;
                
                // Calculate orbit distance relative to planet radius
                const moonDistanceRatio = moonData.distance / this.data.radius;
                const moonDistance = this.scaledRadius * moonDistanceRatio * 0.1;
                
                // Create moon mesh with LOD
                const moonLOD = new THREE.LOD();
                const levels = [
                    { segments: 32, distance: 0 },
                    { segments: 16, distance: moonRadius * 10 },
                    { segments: 8, distance: moonRadius * 50 }
                ];
                
                levels.forEach(level => {
                    const geometry = new THREE.SphereGeometry(
                        moonRadius,
                        level.segments,
                        level.segments
                    );
                    
                    const material = new THREE.MeshPhysicalMaterial({
                        color: moonData.materials?.color || 0xDDDDDD,
                        emissive: moonData.materials?.emissive || 0x000000,
                        roughness: moonData.materials?.roughness || 0.8,
                        metalness: moonData.materials?.metalness || 0.1,
                        bumpScale: moonData.materials?.bumpScale || 0.005,
                        transparent: false
                    });
                    
                    const mesh = new THREE.Mesh(geometry, material);
                    moonLOD.addLevel(mesh, level.distance);
                });

                // Create a container for the moon's orbital tilt
                const moonOrbitGroup = new THREE.Group();
                
                // Apply orbital inclination
                moonOrbitGroup.rotation.x = THREE.MathUtils.degToRad(moonData.orbitalInclination || 0);
                
                // Set initial position on the tilted orbit
                const initialAngle = Math.random() * Math.PI * 2;
                const x = Math.cos(initialAngle) * moonDistance;
                const z = Math.sin(initialAngle) * moonDistance;
                moonGroup.position.set(x, 0, z);
                
                moonGroup.add(moonLOD);
                
                // Create orbit line in the tilted plane
                const orbitLine = this.createMoonOrbit(moonDistance);
                moonOrbitGroup.add(orbitLine);
                moonOrbitGroup.add(moonGroup);
                
                // Add the tilted orbit group to the planet group
                this.planetGroup.add(moonOrbitGroup);
                
                this.moons.set(moonData.name, {
                    group: moonGroup,
                    orbitGroup: moonOrbitGroup,
                    lod: moonLOD,
                    data: moonData,
                    currentAngle: initialAngle,
                    orbitRadius: moonDistance,
                    orbitalSpeed: (2 * Math.PI) / (moonData.orbitalPeriod * 24 * 60 * 60),
                    rotationSpeed: (2 * Math.PI) / (moonData.rotationPeriod * 24 * 60 * 60)
                });
                
                await this.loadMoonTextures(moonLOD, moonData);
                
            } catch (error) {
                console.warn(`Failed to create moon ${moonData.name}:`, error);
            }
        }
    }

    createMoonOrbit(radius) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const segments = 128;
        
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            vertices.push(
                radius * Math.cos(theta),
                0,
                radius * Math.sin(theta)
            );
        }
        
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(vertices, 3)
        );
        
        const material = new THREE.LineBasicMaterial({
            color: 0x444444,
            transparent: true,
            opacity: 0.3,
            depthWrite: false
        });
        
        return new THREE.Line(geometry, material);
    }

    setupRotationQuaternions() {
        // Set up axial tilt quaternion - corrected axis
        this.axialTiltQuaternion.setFromAxisAngle(
            new THREE.Vector3(0, 0, 1), // Tilt around X-axis for proper pole orientation
            THREE.MathUtils.degToRad(this.data.axialTilt)
        );
    
        // Set up orbital inclination quaternion
        this.orbitalInclinationQuaternion.setFromAxisAngle(
            new THREE.Vector3(1, 0, 0), // Inclination around X-axis
            THREE.MathUtils.degToRad(this.data.orbitalInclination)
        );
    
        // Create a reference quaternion for maintaining proper rotation
        this.referenceQuaternion = new THREE.Quaternion();
        this.referenceQuaternion.setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            0
        );
    }

    async loadMoonTextures(moonLOD, moonData) {
        if (!moonData.textures) return;
        
        try {
            // Load textures in parallel
            const [mapTexture, bumpTexture] = await Promise.all([
                this.loadTexture(moonData.textures.map),
                this.loadTexture(moonData.textures.bumpMap)
            ]);
            
            // Apply textures to all LOD levels
            moonLOD.traverse(mesh => {
                if (mesh instanceof THREE.Mesh) {
                    if (mapTexture) {
                        mesh.material.map = mapTexture;
                        mesh.material.needsUpdate = true;
                    }
                    if (bumpTexture) {
                        mesh.material.bumpMap = bumpTexture;
                        mesh.material.bumpScale = 0.02;
                        mesh.material.needsUpdate = true;
                    }
                }
            });
            
        } catch (error) {
            console.warn(`Failed to load textures for moon ${moonData.name}:`, error);
        }
    }

    updateMoons(deltaTime) {
        if (!this.moons || this.moons.size === 0) return;
        
        this.moons.forEach((moon, name) => {
            try {
                // Update orbital position
                moon.currentAngle = (moon.currentAngle + moon.orbitalSpeed * deltaTime) % (Math.PI * 2);
                
                // Calculate new position in the tilted orbit plane
                const x = Math.cos(moon.currentAngle) * moon.orbitRadius;
                const z = Math.sin(moon.currentAngle) * moon.orbitRadius;
                moon.group.position.set(x, 0, z);
                
                // Handle rotation based on tidal locking
                if (moon.data.rotationPeriod === moon.data.orbitalPeriod) {
                    // Tidally locked - keep same face toward planet
                    moon.lod.rotation.y = moon.currentAngle + Math.PI;
                } else {
                    // Free rotation
                    moon.lod.rotation.y += moon.rotationSpeed * deltaTime;
                    moon.lod.rotation.y %= Math.PI * 2;
                }
    
                // Rotate the entire orbit group
                if (moon.orbitGroup) {
                    moon.orbitGroup.rotation.y += moon.orbitalSpeed * deltaTime * 0.1; // Adjust speed multiplier as needed
                }
                
                // Update LOD if camera is available
                if (this.camera && moon.lod) {
                    moon.lod.update(this.camera);
                }
                
                // Update moon-specific effects (if any)
                if (moon.data.id === 'luna') {
                    this.updateLunarEffects(moon, deltaTime);
                }
            } catch (error) {
                console.warn(`Update error for moon ${name}:`, error);
            }
        });
    }

    updateLunarEffects(moon, deltaTime) {
        // Special effects for Earth's moon
        if (moon.data.id === 'luna') {
            // Calculate phase angle based on position relative to sun
            const moonToSun = new THREE.Vector3(1, 0, 0); // Assuming sun at (1,0,0)
            const moonToEarth = moon.group.position.clone().normalize();
            const phaseAngle = moonToSun.angleTo(moonToEarth);
            
            // Update moon shader uniforms if using custom shader
            if (moon.lod) {
                moon.lod.traverse(mesh => {
                    if (mesh.material && mesh.material.uniforms) {
                        // Update phase-based lighting
                        if (mesh.material.uniforms.phaseAngle) {
                            mesh.material.uniforms.phaseAngle.value = phaseAngle;
                        }
                        // Update earthshine effect
                        if (mesh.material.uniforms.earthshine) {
                            const earthshineIntensity = Math.max(0, Math.cos(phaseAngle));
                            mesh.material.uniforms.earthshine.value = earthshineIntensity * 0.1;
                        }
                    }
                });
            }
        }
    }

    async loadTexture(url) {
        if (!url) return null;
        
        try {
            // Handle imported textures directly if they're imported modules
            if (typeof url === 'object' && url.default) {
                const texture = new THREE.Texture(url.default);
                texture.needsUpdate = true;
                return texture;
            }
            
            // For paths, ensure they're relative to the assets directory
            const textureUrl = url.startsWith('/') ? url.slice(1) : url;
            
            return new Promise((resolve, reject) => {
                this.textureLoader.load(
                    textureUrl,
                    (texture) => {
                        texture.colorSpace = THREE.SRGBColorSpace;
                        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                        texture.minFilter = THREE.LinearMipmapLinearFilter;
                        texture.magFilter = THREE.LinearFilter;
                        texture.anisotropy = 16;
                        texture.needsUpdate = true;
                        resolve(texture);
                    },
                    undefined,
                    (error) => {
                        console.error(`Texture load error for ${textureUrl}:`, error);
                        // Create and return a fallback texture instead of rejecting
                        const fallbackTexture = this.createFallbackTexture();
                        resolve(fallbackTexture);
                    }
                );
            });
        } catch (error) {
            console.error('Texture loading error:', error);
            return this.createFallbackTexture();
        }
    }

    async loadTextures(material) {
        if (!this.textureLoader || !this.data.textures) {
            console.warn(`Missing texture loader or texture data for ${this.data.name}`);
            return;
        }
    
        try {
            // Log the incoming texture data
            console.debug(`Loading textures for ${this.data.name}:`, this.data.textures);
    
            // Load textures sequentially to better track issues
            if (this.data.textures.map) {
                const mapTexture = await this.loadTexture(this.data.textures.map);
                if (mapTexture) {
                    material.map = mapTexture;
                    material.needsUpdate = true;
                    console.debug(`Applied diffuse map to ${this.data.name}`);
                }
            }
    
            if (this.data.textures.bumpMap) {
                const bumpTexture = await this.loadTexture(this.data.textures.bumpMap);
                if (bumpTexture) {
                    material.bumpMap = bumpTexture;
                    material.bumpScale = this.data.materials.bumpScale || 0.02;
                    material.needsUpdate = true;
                    console.debug(`Applied bump map to ${this.data.name}`);
                }
            }
    
            if (this.data.textures.specularMap) {
                const specularTexture = await this.loadTexture(this.data.textures.specularMap);
                if (specularTexture) {
                    material.roughnessMap = specularTexture;
                    material.roughness = 0.5;
                    material.needsUpdate = true;
                    console.debug(`Applied specular map to ${this.data.name}`);
                }
            }
    
            // Ensure material updates
            material.needsUpdate = true;
    
            // Create planet-specific features
            if (this.data.id === 'earth' && this.data.textures.cloudsMap) {
                await this.createClouds(this.data.textures.cloudsMap);
            }
    
        } catch (error) {
            console.error(`Error in texture loading for ${this.data.name}:`, error);
            // Apply fallback color
            material.color.setHex(this.data.materials.color);
            material.needsUpdate = true;
        }
    }

    updateMaterial() {
        if (!this.planetMesh) return;
        
        this.lod.traverse(mesh => {
            if (mesh instanceof THREE.Mesh) {
                mesh.material.needsUpdate = true;
                
                // Force texture update
                if (mesh.material.map) {
                    mesh.material.map.needsUpdate = true;
                }
                if (mesh.material.bumpMap) {
                    mesh.material.bumpMap.needsUpdate = true;
                }
                if (mesh.material.roughnessMap) {
                    mesh.material.roughnessMap.needsUpdate = true;
                }
            }
        });
    }

    async createClouds(cloudsTexturePath) {
        if (!cloudsTexturePath) return;
    
        try {
            const cloudTexture = await this.loadTexture(cloudsTexturePath);
            if (!cloudTexture) return;
    
            const cloudsGeometry = new THREE.SphereGeometry(
                this.scaledRadius * 1.01,
                64,
                32
            );
    
            const cloudsMaterial = new THREE.MeshPhysicalMaterial({
                map: cloudTexture,
                transparent: true,
                opacity: 0.4,
                depthWrite: false,
                roughness: 1,
                metalness: 0,
                color: 0xffffff
            });
    
            this.cloudsMesh = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
            this.planetGroup.add(this.cloudsMesh);
    
        } catch (error) {
            console.warn(`Failed to create clouds for ${this.data.name}:`, error);
        }
    }

    createAtmosphere() {
        // Use thickness based on planet type
        const atmosphereScale = (() => {
            switch(this.data.id) {
                case 'venus': return 1.15; // Very thick atmosphere
                case 'earth': return 1.03; // Moderate atmosphere
                case 'mars': return 1.01;  // Thin atmosphere
                default: return 1.05;
            }
        })();
    
        const atmosphereGeometry = new THREE.SphereGeometry(
            this.scaledRadius * atmosphereScale,
            64,
            32
        );
        
        const atmosphereMaterial = new THREE.ShaderMaterial({
            uniforms: {
                atmosphereColor: { value: new THREE.Color(this.data.materials.atmosphereColor) },
                intensity: { value: this.data.hasAtmosphere ? 0.5 : 0.2 },
                planetRadius: { value: this.scaledRadius },
                atmosphereThickness: { value: atmosphereScale - 1.0 },
                sunDirection: { value: new THREE.Vector3(1, 0, 0) }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 atmosphereColor;
                uniform float intensity;
                uniform float atmosphereThickness;
                uniform vec3 sunDirection;
                
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                
                void main() {
                    float sunDot = max(0.0, dot(vNormal, sunDirection));
                    float rimLight = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
                    
                    // Atmospheric scattering
                    float scatter = pow(sunDot * 0.5 + 0.5, 2.0) * atmosphereThickness;
                    
                    // Combine direct and scattered light
                    float lightIntensity = mix(rimLight, scatter, 0.6);
                    
                    // Adjust alpha based on view angle and atmosphere thickness
                    float alpha = rimLight * intensity * (1.0 + atmosphereThickness * 2.0);
                    
                    gl_FragColor = vec4(atmosphereColor, alpha * lightIntensity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            depthWrite: false
        });
    
        this.atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.planetGroup.add(this.atmosphereMesh);
    }

    defaultValidateGeometry(geometry) {
        if (!geometry) return;
        
        // Basic validation for when the full validation function isn't provided
        if (geometry.attributes.position) {
            const positions = geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i++) {
                if (isNaN(positions[i]) || !isFinite(positions[i])) {
                    positions[i] = 0;
                }
            }
            geometry.attributes.position.needsUpdate = true;
        }
        
        if (!geometry.boundingSphere) {
            geometry.computeBoundingSphere();
        }
    }

    // createRings to use the validation function
    createRings() {
        if (!this.data.materials.ringColor) return;
    
        try {
            const minRadius = Math.max(0.1, this.scaledRadius * 1.2);
            const maxRadius = Math.max(minRadius + 0.1, this.scaledRadius * 2.3);
            
            const ringsGeometry = new THREE.RingGeometry(
                minRadius,
                maxRadius,
                128,
                1,
                0,
                Math.PI * 2
            );
            
            // Use the provided or default validation function
            this.validateGeometry(ringsGeometry);
            
            const ringsMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    ringColor: { value: new THREE.Color(this.data.materials.ringColor) }
                },
                vertexShader: `
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3 ringColor;
                    varying vec2 vUv;
                    void main() {
                        float alpha = smoothstep(0.0, 1.0, 1.0 - abs(vUv.y - 0.5) * 2.0);
                        gl_FragColor = vec4(ringColor, alpha * 0.5);
                    }
                `,
                side: THREE.DoubleSide,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
    
            this.ringsMesh = new THREE.Mesh(ringsGeometry, ringsMaterial);
            this.ringsMesh.rotation.x = Math.PI / 2;
            this.ringsMesh.renderOrder = -1;
            this.planetGroup.add(this.ringsMesh);
    
        } catch (error) {
            console.error('Error creating rings for planet:', error);
        }
    }

    createOrbit() {
        // Create a complete circle for the orbit
        const segments = 128;
        const orbitGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array((segments + 1) * 3);
        
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const x = Math.cos(theta) * this.scaledDistance;
            const z = Math.sin(theta) * this.scaledDistance;
            positions[i * 3] = x;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = z;
        }
        
        orbitGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const orbitMaterial = new THREE.LineBasicMaterial({
            color: this.data.materials.color,
            transparent: true,
            opacity: 0.3,
            depthWrite: false
        });
    
        this.orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
        this.orbitLine.renderOrder = -1;
        this.group.add(this.orbitLine);
    }

    createTrail() {
        const trailGeometry = new THREE.BufferGeometry();
        this.trailPositions = new Float32Array(this.trailLength * 3);
        const initialPos = this.planetGroup.position;
        
        // Initialize all positions to the starting point
        for (let i = 0; i < this.trailLength; i++) {
            this.trailPositions[i * 3] = initialPos.x;
            this.trailPositions[i * 3 + 1] = initialPos.y;
            this.trailPositions[i * 3 + 2] = initialPos.z;
        }
        
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
        
        const trailMaterial = new THREE.LineBasicMaterial({
            color: this.data.materials.color,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
    
        this.trailMesh = new THREE.Line(trailGeometry, trailMaterial);
        this.trailMesh.frustumCulled = false;
        this.trailMesh.visible = false; // Start with trail hidden
        this.group.add(this.trailMesh);
    }

    setInitialPosition() {
        this.currentAngle = (this.index / 8) * Math.PI * 2;
        this.updatePosition();
        
        // Initialize trail positions
        const pos = this.planetGroup.position;
        for (let i = 0; i < this.trailLength; i++) {
            this.trailPositions[i * 3] = pos.x;
            this.trailPositions[i * 3 + 1] = pos.y;
            this.trailPositions[i * 3 + 2] = pos.z;
        }
    }

    updatePosition() {
        const x = Math.cos(this.currentAngle) * this.scaledDistance;
        const z = Math.sin(this.currentAngle) * this.scaledDistance;
        this.planetGroup.position.set(x, 0, z);
    }

    // Add this method to validate trail geometry
    validateTrailGeometry() {
        if (!this.trailMesh?.geometry) return;
        
        const positions = this.trailPositions;
        if (!positions) return;
        
        let needsUpdate = false;
        
        // Check and fix any NaN values
        for (let i = 0; i < positions.length; i++) {
            if (isNaN(positions[i])) {
                positions[i] = 0;
                needsUpdate = true;
            }
        }
        
        if (needsUpdate) {
            const positionAttribute = this.trailMesh.geometry.getAttribute('position');
            positionAttribute.needsUpdate = true;
        }
        
        // Ensure bounding sphere exists
        if (!this.trailMesh.geometry.boundingSphere) {
            this.trailMesh.geometry.boundingSphere = new THREE.Sphere(
                new THREE.Vector3(0, 0, 0),
                this.scaledDistance * 2
            );
        }
    }

    update(deltaTime, timeScale) {
        if (!isFinite(deltaTime) || deltaTime === 0) return;
    
        // Store current time scale
        this.currentTimeScale = timeScale;
    
        // Calculate effective delta time based on time scale
        const effectiveDeltaTime = deltaTime * Math.abs(timeScale);
        const timeDirection = Math.sign(timeScale) || 1;
    
        // Skip updates if paused
        if (timeScale === 0) return;
    
        // Update orbital motion
        this.updateOrbit(effectiveDeltaTime, timeDirection);
        this.updateRotation(effectiveDeltaTime, timeDirection);
    
        // Update visual effects
        if (this.atmosphereMesh) {
            this.updateAtmosphere(deltaTime);
        }
        if (this.ringsMesh) {
            this.updateRings(deltaTime, timeDirection);
        }
        if (this.moons?.size > 0) {
            this.updateMoons(effectiveDeltaTime);
        }
    
        // Periodic material refresh to ensure textures are displayed
        this._materialUpdateTimer = (this._materialUpdateTimer || 0) + deltaTime;
        if (this._materialUpdateTimer > 1.0) { // Check every second
            this.updateMaterial();
            this._materialUpdateTimer = 0;
        }

        // Force matrix updates
        this.planetGroup.updateMatrixWorld(true);
    }

    updateAtmosphere(deltaTime) {
        if (!this.atmosphereMesh?.material?.uniforms) return;

        // Update sun direction relative to planet
        const sunDirection = new THREE.Vector3(1, 0, 0);
        sunDirection.applyQuaternion(this.group.quaternion);
        this.atmosphereMesh.material.uniforms.sunDirection.value.copy(sunDirection);

        // Update atmosphere time-based effects
        if (this.atmosphereMesh.material.uniforms.time) {
            this.atmosphereMesh.material.uniforms.time.value += deltaTime;
        }
    }

    updateRings(deltaTime, timeDirection) {
        if (!this.ringsMesh?.material?.uniforms) return;

        // Update ring rotation to match planet
        this.ringsMesh.quaternion.copy(this.rotationState.axialTilt);

        // Update ring shader effects
        if (this.ringsMesh.material.uniforms.time) {
            this.ringsMesh.material.uniforms.time.value += deltaTime * timeDirection;
        }
    }

    updateOrbit(scaledDeltaTime, timeDirection) {
        // Calculate orbital movement
        const orbitalDelta = 
            this.timeProperties.baseOrbitalSpeed * 
            this.timeProperties.orbitalSpeedScale * 
            scaledDeltaTime * 
            timeDirection;

        // Update orbital angle
        this.timeProperties.currentOrbitalAngle = 
            (this.timeProperties.currentOrbitalAngle + orbitalDelta) % (Math.PI * 2);
    
        // Calculate new position
        const x = Math.cos(this.timeProperties.currentOrbitalAngle) * this.scaledDistance;
        const z = Math.sin(this.timeProperties.currentOrbitalAngle) * this.scaledDistance;
        
        // Update position
        this.planetGroup.position.set(x, 0, z);
    }

    updateRotation(scaledDeltaTime, timeDirection) {
        // Calculate rotation delta with proper Earth's sidereal day period
        const rotationDelta = 
            this.timeProperties.baseRotationSpeed * 
            this.timeProperties.rotationSpeedScale * 
            scaledDeltaTime * 
            timeDirection;
    
        // Update rotation angle
        this.timeProperties.currentRotationAngle = 
            (this.timeProperties.currentRotationAngle + rotationDelta) % (Math.PI * 2);
    
        // For Earth, we want to apply axial tilt and proper rotation
        if (this.data.id === 'earth') {
            // Create base rotation around Y-axis (planet's spin)
            const rotationQuat = new THREE.Quaternion();
            rotationQuat.setFromAxisAngle(
                this.rotationState.upVector,
                this.timeProperties.currentRotationAngle
            );
    
            // Create axial tilt (23.5 degrees for Earth)
            const tiltQuat = new THREE.Quaternion();
            tiltQuat.setFromAxisAngle(
                new THREE.Vector3(1, 0, 0), // Tilt around X axis for proper orientation
                THREE.MathUtils.degToRad(23.5)
            );
    
            // Combine rotations
            const finalRotation = new THREE.Quaternion();
            finalRotation.multiplyQuaternions(tiltQuat, rotationQuat);
    
            // Apply to planet mesh
            if (this.lod) {
                this.lod.quaternion.copy(finalRotation);
    
                // Also update any atmosphere or clouds
                if (this.atmosphereMesh) {
                    this.atmosphereMesh.quaternion.copy(finalRotation);
                }
                if (this.cloudsMesh) {
                    // Rotate clouds slightly faster than the planet
                    const cloudRotation = rotationQuat.clone();
                    cloudRotation.setFromAxisAngle(
                        this.rotationState.upVector,
                        this.timeProperties.currentRotationAngle * 1.1
                    );
                    const cloudsFinalRotation = new THREE.Quaternion();
                    cloudsFinalRotation.multiplyQuaternions(tiltQuat, cloudRotation);
                    this.cloudsMesh.quaternion.copy(cloudsFinalRotation);
                }
            }
        } else {
            // Standard rotation for other planets
            const rotationQuat = new THREE.Quaternion();
            rotationQuat.setFromAxisAngle(
                this.rotationState.upVector,
                this.timeProperties.currentRotationAngle
            );
    
            if (this.lod) {
                this.lod.quaternion.copy(rotationQuat);
            }
        }
    }

    updateLOD(camera) {
        if (!this.lod || !camera) return;
        
        // Calculate distance to camera
        const distance = this.planetGroup.position.distanceTo(camera.position);
        
        // Update LOD level based on distance
        this.lod.update(camera);
        
        // Update material quality based on distance
        if (distance > this.scaledDistance * 10) {
            this.setLowQualityMaterials();
        } else {
            this.setHighQualityMaterials();
        }
    }

    setLowQualityMaterials() {
        if (!this.planetMesh) return;
        
        this.lod.traverse(mesh => {
            if (mesh instanceof THREE.Mesh) {
                mesh.material.flatShading = true;
                if (mesh.material.map) {
                    mesh.material.map.minFilter = THREE.NearestFilter;
                    mesh.material.map.magFilter = THREE.NearestFilter;
                }
            }
        });
    }

    updateAtmosphericFeatures(deltaTime) {
        // Update clouds if present
        if (this.cloudsMesh) {
            this.cloudsMesh.rotation.y += (this.rotationSpeed * 1.1) * deltaTime;
            this.cloudsMesh.rotation.y %= Math.PI * 2;
            
            // Update cloud shader uniforms if using custom shader
            const material = this.cloudsMesh.material;
            if (material.uniforms && material.uniforms.time) {
                material.uniforms.time.value += deltaTime;
            }
        }
        
        // Update atmosphere if present
        if (this.atmosphereMesh) {
            const material = this.atmosphereMesh.material;
            if (material.uniforms && material.uniforms.sunDirection) {
                // Update sun direction relative to planet
                const sunDirection = new THREE.Vector3(1, 0, 0);
                sunDirection.applyQuaternion(this.group.quaternion);
                material.uniforms.sunDirection.value = sunDirection;
            }
        }
    }

    updateTrail() {
        if (!this.trailMesh || !this.trailPositions || !this.trailMesh.visible) return;
    
        try {
            const pos = this.planetGroup.position;
            
            // Shift existing positions back
            for (let i = this.trailPositions.length - 3; i >= 3; i -= 3) {
                this.trailPositions[i] = this.trailPositions[i - 3];
                this.trailPositions[i + 1] = this.trailPositions[i - 2];
                this.trailPositions[i + 2] = this.trailPositions[i - 1];
            }
            
            // Add new position
            this.trailPositions[0] = pos.x;
            this.trailPositions[1] = pos.y;
            this.trailPositions[2] = pos.z;
    
            const positionAttribute = this.trailMesh.geometry.getAttribute('position');
            positionAttribute.needsUpdate = true;
        } catch (error) {
            console.warn(`Error updating trail for ${this.data.name}:`, error);
        }
    }

    getGroup() {
        return this.group;
    }

    validateRingGeometry(geometry) {
        if (!geometry) return;
        
        try {
            // Ensure positions are valid
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
    
            // Validate UV coordinates if they exist
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
    
            // Create or fix bounding sphere
            if (!geometry.boundingSphere || !isFinite(geometry.boundingSphere.radius)) {
                let maxRadius = 0;
                const positions = geometry.attributes.position.array;
                
                for (let i = 0; i < positions.length; i += 3) {
                    const x = positions[i];
                    const y = positions[i + 1];
                    const z = positions[i + 2];
                    if (isFinite(x) && isFinite(y) && isFinite(z)) {
                        maxRadius = Math.max(maxRadius, Math.sqrt(x * x + y * y + z * z));
                    }
                }
                
                geometry.boundingSphere = new THREE.Sphere(
                    new THREE.Vector3(0, 0, 0),
                    Math.max(maxRadius, 1) // Ensure non-zero radius
                );
            }
            
            // Update normals
            geometry.computeVertexNormals();
            
        } catch (error) {
            console.warn('Error validating ring geometry:', error);
            // Create safe fallback geometry
            const safeGeometry = new THREE.BufferGeometry();
            safeGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
            safeGeometry.computeBoundingSphere();
            
            // Copy safe properties to original geometry
            geometry.attributes = safeGeometry.attributes;
            geometry.boundingSphere = safeGeometry.boundingSphere;
        }
        
        // Ensure valid UV coordinates
        if (geometry.attributes.uv) {
            const uvs = geometry.attributes.uv.array;
            let needsUpdate = false;
            
            for (let i = 0; i < uvs.length; i++) {
                if (isNaN(uvs[i])) {
                    uvs[i] = 0;
                    needsUpdate = true;
                }
            }
            
            if (needsUpdate) {
                geometry.attributes.uv.needsUpdate = true;
            }
        }
        
        // Create or fix bounding sphere
        if (!geometry.boundingSphere || isNaN(geometry.boundingSphere.radius)) {
            let maxRadius = 0;
            const positions = geometry.attributes.position.array;
            
            for (let i = 0; i < positions.length; i += 3) {
                const x = positions[i];
                const y = positions[i + 1];
                const z = positions[i + 2];
                maxRadius = Math.max(maxRadius, Math.sqrt(x * x + y * y + z * z));
            }
            
            geometry.boundingSphere = new THREE.Sphere(
                new THREE.Vector3(0, 0, 0),
                maxRadius || 1000
            );
        }
    }

    dispose() {
        // Clear from pools
        Planet.geometryPool.forEach((geometry, key) => {
            geometry.dispose();
        });
        Planet.materialPool.forEach((material, key) => {
            material.dispose();
        });
    
        // Existing disposal code...
        const disposeMaterial = (material) => {
            if (!material) return;
            Object.values(material).forEach(prop => {
                if (prop instanceof THREE.Texture) {
                    prop.dispose();
                }
            });
            material.dispose();
        };
    
        [this.planetMesh, this.cloudsMesh, this.atmosphereMesh, 
         this.ringsMesh, this.trailMesh, this.orbitLine].forEach(mesh => {
            if (!mesh) return;
            if (mesh.geometry) mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(disposeMaterial);
            } else {
                disposeMaterial(mesh.material);
            }
        });
    
        // Clear references
        this.planetGroup.clear();
        this.group.clear();
        this.moons?.clear();
    }
}