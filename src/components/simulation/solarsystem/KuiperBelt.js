import * as THREE from 'three';
import { BELT_PROPERTIES } from './planetData';

/**
 * Represents the Kuiper Belt - a region of the outer solar system beyond Neptune's orbit
 * containing numerous small, icy bodies.
 */
export class KuiperBelt {
    constructor(params = {}) {
        // Initialize properties with defaults from constants or passed parameters
        this.initializeProperties(params);
        
        // Create main group
        this.group = new THREE.Group();
        this.group.name = 'KuiperBelt';
        
        // Create the belt
        this.createBelt();
        
        // Optional debug visualization
        if (this.debug) {
            this.createDebugVisualization();
        }
    }

    initializeProperties(params) {
        const defaults = BELT_PROPERTIES.kuiper;
        
        // Core properties
        this.distanceScale = params.distanceScale || 200;
        this.innerRadius = (params.innerRadius || defaults.innerRadius) * this.distanceScale;
        this.outerRadius = (params.outerRadius || defaults.outerRadius) * this.distanceScale;
        this.thickness = (params.thickness || defaults.thickness) * this.distanceScale;
        
        // Particle properties
        this.particleCount = params.particleCount || defaults.particleCount;
        this.minParticleSize = params.minParticleSize || defaults.particleSize.min;
        this.maxParticleSize = params.maxParticleSize || defaults.particleSize.max;
        
        // Visual properties
        this.color = params.color || defaults.color;
        this.opacity = params.opacity || 1;
        
        // Physical properties (for simulation)
        this.orbitalSpeed = 0.00005; // Base orbital speed
        this.speedVariation = 0.00002; // Random variation in orbital speed
        this.inclination = THREE.MathUtils.degToRad(8); // Belt inclination
        this.inclinationSpread = THREE.MathUtils.degToRad(10); // Random spread in inclination
        
        // Optimization flags
        this.useInstancing = params.useInstancing !== false && this.particleCount > 1000;
        this.useLOD = params.useLOD !== false;
        this.debug = params.debug || false;
        
        // Performance monitoring
        this.lastUpdateTime = 0;
        this.frameCount = 0;
    }

    createBelt() {
        if (this.useInstancing) {
            this.createInstancedBelt();
        } else {
            this.createTraditionalBelt();
        }
    }

    createInstancedBelt() {
        // Create base geometry for instancing
        const particleGeometry = new THREE.TetrahedronGeometry(1, 0);
        
        // Create instanced mesh
        const instancedMesh = new THREE.InstancedMesh(
            particleGeometry,
            new THREE.MeshPhongMaterial({
                color: this.color,
                shininess: 0.5,
                flatShading: true
            }),
            this.particleCount
        );

        // Create matrices for each instance
        const dummy = new THREE.Object3D();
        const positions = [];
        const rotations = [];
        const scales = [];
        const speeds = [];

        for (let i = 0; i < this.particleCount; i++) {
            // Calculate position
            const position = this.generateRandomPosition();
            positions.push(position);
            
            // Calculate rotation
            const rotation = new THREE.Euler(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            rotations.push(rotation);
            
            // Calculate scale
            const scale = this.minParticleSize + 
                         Math.random() * (this.maxParticleSize - this.minParticleSize);
            scales.push(scale);
            
            // Calculate orbital speed
            speeds.push(this.orbitalSpeed + (Math.random() - 0.5) * this.speedVariation);
            
            // Set initial transform
            dummy.position.copy(position);
            dummy.rotation.copy(rotation);
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }

        // Store instance data for updates
        this.instanceData = {
            positions,
            rotations,
            scales,
            speeds,
            dummy
        };

        this.belt = instancedMesh;
        this.group.add(this.belt);
    }

    createTraditionalBelt() {
        const particleGeometry = new THREE.TetrahedronGeometry(1, 0);
        const particleMaterial = new THREE.MeshPhongMaterial({
            color: this.color,
            shininess: 0.5,
            flatShading: true
        });

        this.particles = [];

        for (let i = 0; i < this.particleCount; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            
            // Set position
            const position = this.generateRandomPosition();
            particle.position.copy(position);
            
            // Set rotation
            particle.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            
            // Set scale
            const scale = this.minParticleSize + 
                         Math.random() * (this.maxParticleSize - this.minParticleSize);
            particle.scale.set(scale, scale, scale);
            
            // Store orbital properties
            particle.userData.orbitalSpeed = this.orbitalSpeed + 
                                           (Math.random() - 0.5) * this.speedVariation;
            particle.userData.initialRadius = position.length();
            
            this.particles.push(particle);
            this.group.add(particle);
        }
    }

    generateRandomPosition() {
        // Generate random angle and radius
        const theta = Math.random() * Math.PI * 2;
        const radius = this.innerRadius + Math.random() * (this.outerRadius - this.innerRadius);
        
        // Calculate base position in orbital plane
        const x = radius * Math.cos(theta);
        const z = radius * Math.sin(theta);
        
        // Apply inclination and random height variation
        const baseInclination = this.inclination + 
                              (Math.random() - 0.5) * this.inclinationSpread;
        const y = Math.sin(baseInclination) * radius + 
                 (Math.random() - 0.5) * this.thickness;
        
        return new THREE.Vector3(x, y, z);
    }

    update(deltaTime) {
        if (this.useInstancing) {
            this.updateInstancedBelt(deltaTime);
        } else {
            this.updateTraditionalBelt(deltaTime);
        }
        
        this.monitorPerformance();
    }

    updateInstancedBelt(deltaTime) {
        const { positions, rotations, scales, speeds, dummy } = this.instanceData;
        
        for (let i = 0; i < this.particleCount; i++) {
            const position = positions[i];
            const speed = speeds[i];
            
            // Calculate new position
            const radius = position.length();
            const angle = Math.atan2(position.z, position.x) + speed * deltaTime;
            
            position.x = radius * Math.cos(angle);
            position.z = radius * Math.sin(angle);
            
            // Update instance matrix
            dummy.position.copy(position);
            dummy.rotation.copy(rotations[i]);
            dummy.scale.setScalar(scales[i]);
            dummy.updateMatrix();
            
            this.belt.setMatrixAt(i, dummy.matrix);
        }
        
        this.belt.instanceMatrix.needsUpdate = true;
    }

    updateTraditionalBelt(deltaTime) {
        this.particles.forEach(particle => {
            const speed = particle.userData.orbitalSpeed;
            const radius = particle.userData.initialRadius;
            
            // Calculate new position
            const currentAngle = Math.atan2(particle.position.z, particle.position.x);
            const newAngle = currentAngle + speed * deltaTime;
            
            particle.position.x = radius * Math.cos(newAngle);
            particle.position.z = radius * Math.sin(newAngle);
            
            // Add subtle wobble
            particle.rotation.x += deltaTime * 0.1;
            particle.rotation.y += deltaTime * 0.15;
        });
    }

    monitorPerformance() {
        this.frameCount++;
        const currentTime = performance.now();
        const elapsed = currentTime - this.lastUpdateTime;
        
        if (elapsed >= 1000) { // Log every second
            const fps = this.frameCount * 1000 / elapsed;
            console.debug(`KuiperBelt FPS: ${fps.toFixed(2)}`);
            
            this.frameCount = 0;
            this.lastUpdateTime = currentTime;
        }
    }

    createDebugVisualization() {
        // Create boundary visualizations
        const innerBoundary = new THREE.Line(
            new THREE.CircleGeometry(this.innerRadius, 64),
            new THREE.LineBasicMaterial({ color: 0xff0000 })
        );
        innerBoundary.rotation.x = -Math.PI / 2;
        
        const outerBoundary = new THREE.Line(
            new THREE.CircleGeometry(this.outerRadius, 64),
            new THREE.LineBasicMaterial({ color: 0x0000ff })
        );
        outerBoundary.rotation.x = -Math.PI / 2;
        
        this.group.add(innerBoundary);
        this.group.add(outerBoundary);
    }

    setVisibility(visible) {
        this.group.visible = visible;
    }

    setOpacity(opacity) {
        if (this.useInstancing) {
            this.belt.material.opacity = opacity;
            this.belt.material.transparent = opacity < 1;
        } else {
            this.particles.forEach(particle => {
                particle.material.opacity = opacity;
                particle.material.transparent = opacity < 1;
            });
        }
    }

    getGroup() {
        return this.group;
    }

    dispose() {
        if (this.useInstancing) {
            this.belt.geometry.dispose();
            this.belt.material.dispose();
        } else {
            this.particles.forEach(particle => {
                particle.geometry.dispose();
                particle.material.dispose();
            });
        }
        
        this.group.clear();
        this.particles = [];
        this.instanceData = null;
    }
}