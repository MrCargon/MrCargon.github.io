import * as THREE from 'three';
import { BELT_PROPERTIES } from './planetData';

/**
 * Represents the Asteroid Belt - the region between Mars and Jupiter
 * containing numerous rocky and metallic bodies.
 */
export class AsteroidBelt {
    constructor(params = {}) {
        // Initialize core properties
        this.initializeProperties(params);
        
        // Create main group
        this.group = new THREE.Group();
        this.group.name = 'AsteroidBelt';
        
        // Initialize object pool
        this.objectPool = {
            active: new Set(),
            inactive: new Set(),
            maxSize: this.particleCount * 1.2 // 20% buffer
        };
        
        // Initialize the belt
        this.initialize();
        
        // Setup WebGL optimization hints
        this.setupWebGLOptimizations();
    }

    setupWebGLOptimizations() {
        this.sharedUniforms = {
            baseColor: { value: new THREE.Color(this.baseColor) },
            time: { value: 0 },
            globalScale: { value: 1.0 }
        };
        
        // Update material to use shared uniforms
        if (this.useInstancing) {
            this.instancedMesh.material.uniforms = {
                ...this.instancedMesh.material.uniforms,
                ...this.sharedUniforms
            };
        }
    }

    cleanupObjectPool() {
        // Clean up inactive objects
        this.objectPool.inactive.forEach(object => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) object.material.dispose();
        });
        
        this.objectPool.inactive.clear();
        this.objectPool.active.clear();
    }

    getAsteroidFromPool() {
        let asteroid;
        if (this.objectPool.inactive.size > 0) {
            asteroid = this.objectPool.inactive.values().next().value;
            this.objectPool.inactive.delete(asteroid);
        } else if (this.objectPool.active.size < this.objectPool.maxSize) {
            asteroid = this.createNewAsteroid();
        } else {
            return null;
        }
        
        this.objectPool.active.add(asteroid);
        return asteroid;
    }

    returnAsteroidToPool(asteroid) {
        if (this.objectPool.active.has(asteroid)) {
            this.objectPool.active.delete(asteroid);
            this.objectPool.inactive.add(asteroid);
            asteroid.visible = false;
        }
    }

    initializeProperties(params) {
        const defaults = BELT_PROPERTIES.asteroid;
        
        // Core dimensions
        this.distanceScale = params.distanceScale || 200;
        this.innerRadius = (params.innerRadius || defaults.innerRadius) * this.distanceScale;
        this.outerRadius = (params.outerRadius || defaults.outerRadius) * this.distanceScale;
        this.thickness = (params.thickness || defaults.thickness) * this.distanceScale;
        
        // Particle configuration
        this.particleCount = params.particleCount || defaults.particleCount;
        this.minParticleSize = params.minParticleSize || defaults.particleSize.min;
        this.maxParticleSize = params.maxParticleSize || defaults.particleSize.max;
        
        // Visual properties
        this.colorPalette = [
            0x8B7355, // Rock brown
            0xA0522D, // Metallic brown
            0x6B6B6B, // Dark gray
            0x8B8989, // Light gray
            0x698B69  // Greenish (for some M-type asteroids)
        ];
        this.baseColor = params.color || defaults.color;
        
        // Physical properties
        this.orbitalSpeed = 0.00015; // Base speed (faster than Kuiper Belt)
        this.speedVariation = 0.00005;
        this.inclination = THREE.MathUtils.degToRad(6); // Main belt inclination
        this.inclinationSpread = THREE.MathUtils.degToRad(15);
        
        // Distribution properties (Kirkwood gaps)
        this.kirkwoodGaps = [
            2.06, // 4:1 resonance with Jupiter
            2.5,  // 3:1 resonance
            2.82, // 5:2 resonance
            2.95  // 7:3 resonance
        ].map(au => au * this.distanceScale);
        
        // Performance settings
        this.useInstancing = params.useInstancing !== false && this.particleCount > 1000;
        this.useLOD = params.useLOD !== false;
        this.debug = params.debug || false;
        
        // Create geometries for different asteroid types
        this.createAsteroidGeometries();
    }

    createAsteroidGeometries() {
        
        // Create different geometric shapes for variety
        this.geometries = {
            irregular: new THREE.IcosahedronGeometry(1, 0),  // Most common
            rocky: new THREE.DodecahedronGeometry(1, 0),     // For larger asteroids
            chunky: new THREE.OctahedronGeometry(1, 0),      // For medium asteroids
            smooth: new THREE.SphereGeometry(1, 4, 4)        // For small asteroids
        };

        // Deform geometries for more realistic shapes
        Object.values(this.geometries).forEach(geometry => {
            const positions = geometry.attributes.position;
            const vertex = new THREE.Vector3();

            for (let i = 0; i < positions.count; i++) {
                vertex.fromBufferAttribute(positions, i);
                // Add random deformation
                vertex.add(new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2
                ));
                positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
            }

            geometry.computeVertexNormals();
        });
    }

    initialize() {
        if (this.useInstancing) {
            this.createInstancedBelt();
        } else {
            this.createTraditionalBelt();
        }

        if (this.debug) {
            this.createDebugVisualization();
        }
    }

    createInstancedBelt() {
        const instanceCount = this.particleCount;
        const geometry = this.geometries.irregular; // Base geometry
        
        // Create instanced mesh
        const material = new THREE.MeshPhongMaterial({
            color: this.baseColor,
            flatShading: true,
            shininess: 30,
            vertexColors: true
        });

        this.instancedMesh = new THREE.InstancedMesh(geometry, material, instanceCount);
        
        // Set up instance data
        const dummy = new THREE.Object3D();
        const matrix = new THREE.Matrix4();
        const positions = [];
        const scales = [];
        const rotations = [];
        const speeds = [];
        const colors = [];

        for (let i = 0; i < instanceCount; i++) {
            const position = this.generateAsteroidPosition();
            const scale = this.calculateAsteroidScale(position.length());
            const rotation = new THREE.Euler(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            const speed = this.calculateOrbitalSpeed(position.length());
            const color = new THREE.Color(
                this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)]
            );

            positions.push(position);
            scales.push(scale);
            rotations.push(rotation);
            speeds.push(speed);
            colors.push(color);

            // Set initial transform
            dummy.position.copy(position);
            dummy.rotation.copy(rotation);
            dummy.scale.setScalar(scale);
            dummy.updateMatrix();

            this.instancedMesh.setMatrixAt(i, dummy.matrix);
            this.instancedMesh.setColorAt(i, color);
        }

        // Store instance data for updates
        this.instanceData = {
            positions,
            scales,
            rotations,
            speeds,
            colors,
            dummy,
            matrix
        };

        this.group.add(this.instancedMesh);
    }

    createTraditionalBelt() {
        this.asteroids = [];
        
        for (let i = 0; i < this.particleCount; i++) {
            // Choose geometry based on size probability
            const geometryType = this.chooseGeometryType();
            const geometry = this.geometries[geometryType];
            
            const material = new THREE.MeshPhongMaterial({
                color: this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)],
                flatShading: true,
                shininess: 30
            });

            const asteroid = new THREE.Mesh(geometry, material);
            
            const position = this.generateAsteroidPosition();
            asteroid.position.copy(position);
            
            const scale = this.calculateAsteroidScale(position.length());
            asteroid.scale.setScalar(scale);
            
            asteroid.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );

            // Store orbital properties
            asteroid.userData.orbitalSpeed = this.calculateOrbitalSpeed(position.length());
            asteroid.userData.rotationSpeed = {
                x: (Math.random() - 0.5) * 0.01,
                y: (Math.random() - 0.5) * 0.01,
                z: (Math.random() - 0.5) * 0.01
            };
            asteroid.userData.initialRadius = position.length();

            this.asteroids.push(asteroid);
            this.group.add(asteroid);
        }
    }

    generateAsteroidPosition() {
        let validPosition = false;
        let position;

        while (!validPosition) {
            const theta = Math.random() * Math.PI * 2;
            const radius = this.innerRadius + Math.random() * (this.outerRadius - this.innerRadius);
            
            // Check if position is in a Kirkwood gap
            validPosition = !this.isInKirkwoodGap(radius);
            
            if (validPosition) {
                const baseInclination = this.inclination + 
                                      (Math.random() - 0.5) * this.inclinationSpread;
                                      
                position = new THREE.Vector3(
                    radius * Math.cos(theta),
                    Math.sin(baseInclination) * radius + 
                    (Math.random() - 0.5) * this.thickness,
                    radius * Math.sin(theta)
                );
            }
        }

        return position;
    }

    isInKirkwoodGap(radius) {
        return this.kirkwoodGaps.some(gap => 
            Math.abs(radius - gap) < this.distanceScale * 0.1
        );
    }

    calculateAsteroidScale(radius) {
        // Larger asteroids are more common in the middle of the belt
        const normalizedRadius = (radius - this.innerRadius) / (this.outerRadius - this.innerRadius);
        const sizeBias = 1 - Math.abs(normalizedRadius - 0.5) * 2; // Peak in the middle
        
        return this.minParticleSize + 
               Math.random() * (this.maxParticleSize - this.minParticleSize) * 
               (1 + sizeBias);
    }

    calculateOrbitalSpeed(radius) {
        // Kepler's Third Law: orbital period squared is proportional to radius cubed
        const baseSpeed = this.orbitalSpeed * Math.pow(this.innerRadius / radius, 1.5);
        return baseSpeed + (Math.random() - 0.5) * this.speedVariation;
    }

    chooseGeometryType() {
        const rand = Math.random();
        if (rand < 0.6) return 'irregular';      // 60% irregular
        if (rand < 0.8) return 'rocky';          // 20% rocky
        if (rand < 0.95) return 'chunky';        // 15% chunky
        return 'smooth';                         // 5% smooth
    }

    update(deltaTime) {
        if (this.useInstancing) {
            this.updateInstancedBelt(deltaTime);
        } else {
            this.updateTraditionalBelt(deltaTime);
        }
    }

    updateInstancedBelt(deltaTime) {
        const { positions, rotations, scales, speeds, dummy, matrix } = this.instanceData;

        for (let i = 0; i < this.particleCount; i++) {
            const position = positions[i];
            const speed = speeds[i];
            const rotation = rotations[i];
            
            // Update orbital position
            const radius = position.length();
            const angle = Math.atan2(position.z, position.x) + speed * deltaTime;
            
            position.x = radius * Math.cos(angle);
            position.z = radius * Math.sin(angle);
            
            // Update rotation
            rotation.x += deltaTime * 0.5;
            rotation.y += deltaTime * 0.3;
            rotation.z += deltaTime * 0.4;
            
            // Update instance matrix
            dummy.position.copy(position);
            dummy.rotation.copy(rotation);
            dummy.scale.setScalar(scales[i]);
            dummy.updateMatrix();
            
            this.instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        
        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    updateTraditionalBelt(deltaTime) {
        this.asteroids.forEach(asteroid => {
            const speed = asteroid.userData.orbitalSpeed;
            const radius = asteroid.userData.initialRadius;
            
            // Update orbital position
            const currentAngle = Math.atan2(asteroid.position.z, asteroid.position.x);
            const newAngle = currentAngle + speed * deltaTime;
            
            asteroid.position.x = radius * Math.cos(newAngle);
            asteroid.position.z = radius * Math.sin(newAngle);
            
            // Update rotation
            const rotation = asteroid.userData.rotationSpeed;
            asteroid.rotation.x += rotation.x * deltaTime;
            asteroid.rotation.y += rotation.y * deltaTime;
            asteroid.rotation.z += rotation.z * deltaTime;
        });
    }

    createDebugVisualization() {
        // Create boundary visualization
        const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
        
        // Inner boundary
        const innerCircle = new THREE.Line(
            new THREE.CircleGeometry(this.innerRadius, 64),
            boundaryMaterial
        );
        innerCircle.rotation.x = -Math.PI / 2;
        
        // Outer boundary
        const outerCircle = new THREE.Line(
            new THREE.CircleGeometry(this.outerRadius, 64),
            boundaryMaterial
        );
        outerCircle.rotation.x = -Math.PI / 2;
        
        // Kirkwood gaps visualization
        this.kirkwoodGaps.forEach(gap => {
            const gapCircle = new THREE.Line(
                new THREE.CircleGeometry(gap, 64),
                new THREE.LineBasicMaterial({ color: 0xff0000 })
            );
            gapCircle.rotation.x = -Math.PI / 2;
            this.group.add(gapCircle);
        });
        
        this.group.add(innerCircle);
        this.group.add(outerCircle);
    }

    setVisibility(visible) {
        this.group.visible = visible;
    }

    getGroup() {
        return this.group;
    }

    dispose() {
        // Dispose geometries
        Object.values(this.geometries).forEach(geometry => {
            geometry.dispose();
        });

        if (this.useInstancing) {
            this.instancedMesh.geometry.dispose();
            this.instancedMesh.material.dispose();
        } else {
            this.asteroids.forEach(asteroid => {
                asteroid.geometry.dispose();
                asteroid.material.dispose();
            });
        }

        // Clean up object pool
        this.cleanupObjectPool();

        this.group.clear();
        this.asteroids = [];
        this.instanceData = null;
    }
}