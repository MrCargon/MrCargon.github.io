/**
 * Represents the Kuiper Belt - a region of the outer solar system beyond Neptune's orbit
 * containing numerous small, icy bodies.
 */

// Constants for Kuiper Belt properties
const BELT_PROPERTIES = {
    kuiper: {
        innerRadius: 30, // AU
        outerRadius: 50, // AU
        thickness: 10, // AU
        particleCount: 2000,
        particleSize: { min: 0.5, max: 2 },
        color: 0xaaaaaa
    }
};

class KuiperBelt {
    constructor(scene, innerRadius = 220, outerRadius = 350, particleCount = 2000) {
        console.assert(scene !== undefined && scene !== null, 'KuiperBelt: scene parameter is required');
        console.assert(innerRadius < outerRadius, 'KuiperBelt: innerRadius must be less than outerRadius');

        this.scene = scene;

        // Initialize with parameters
        const params = {
            innerRadius: innerRadius,
            outerRadius: outerRadius,
            particleCount: particleCount,
            distanceScale: 1 // Direct radius values, no scaling
        };

        this.initializeProperties(params);

        // Create main group
        this.group = new THREE.Group();
        this.group.name = 'KuiperBelt';

        // Create the belt
        this.createBelt();

        // Add to scene
        this.addToScene();

        // Optional debug visualization
        if (this.debug) {
            this.createDebugVisualization();
        }
    }

    addToScene() {
        console.assert(this.scene !== null && this.scene !== undefined, 'KuiperBelt.addToScene: scene is not initialized');
        console.assert(this.group !== null && this.group !== undefined, 'KuiperBelt.addToScene: group is not initialized');

        if (this.scene && this.group) {
            this.scene.add(this.group);
        }
    }

    initializeProperties(params) {
        const defaults = BELT_PROPERTIES.kuiper;

        // Core properties
        this.distanceScale = params.distanceScale || 200;
        this.innerRadius = params.innerRadius || (defaults.innerRadius * this.distanceScale);
        this.outerRadius = params.outerRadius || (defaults.outerRadius * this.distanceScale);
        this.thickness = params.thickness || (defaults.thickness * this.distanceScale);
        
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

        // LOD system for camera-distance-based optimization (NASA Rule 3: Pre-declare)
        this.currentLOD = 'HIGH';
        this.lodConfig = {
            HIGH: { maxDistance: 100, activeCount: this.particleCount },
            MEDIUM: { maxDistance: 250, activeCount: Math.floor(this.particleCount * 0.5) },
            LOW: { maxDistance: Infinity, activeCount: Math.floor(this.particleCount * 0.25) }
        };
        this.originalPositions = null;
    }

    createBelt() {
        console.assert(this.particleCount > 0, 'KuiperBelt.createBelt: particleCount must be positive');
        console.assert(this.innerRadius < this.outerRadius, 'KuiperBelt.createBelt: innerRadius must be less than outerRadius');

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
        const radii = [];

        for (let i = 0; i < this.particleCount; i++) {
            // Calculate position
            const position = this.generateRandomPosition();
            positions.push(position);
            radii.push(Math.sqrt((position.x * position.x) + (position.z * position.z)));
            
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
            radii,
            dummy
        };

        this.belt = instancedMesh;
        this.group.add(this.belt);

        // Store original positions for LOD restoration (NASA Rule 3: Pre-allocate)
        this.originalPositions = new Float32Array(this.particleCount * 3);
        for (let i = 0; i < this.particleCount; i++) {
            this.originalPositions[i * 3] = positions[i].x;
            this.originalPositions[(i * 3) + 1] = positions[i].y;
            this.originalPositions[(i * 3) + 2] = positions[i].z;
        }
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

    /**
     * Update particle LOD based on camera distance
     * NASA Rule 4: <= 60 lines | Rule 2: Fixed bounds | Rule 5: 2+ assertions
     * @param {number} cameraDistance - Distance from camera to belt center
     */
    updateParticleLOD(cameraDistance) {
        // NASA Rule 5: Assertions
        console.assert(typeof cameraDistance === 'number',
            'KuiperBelt.updateParticleLOD: cameraDistance must be number');
        console.assert(cameraDistance >= 0,
            'KuiperBelt.updateParticleLOD: cameraDistance must be non-negative');

        // Early exit if not using instancing or positions not stored
        if (!this.useInstancing || !this.originalPositions || !this.instanceData) return;

        // Determine target LOD based on camera distance (NASA Rule 2: Fixed set)
        let targetLOD;
        if (cameraDistance < this.lodConfig.HIGH.maxDistance) {
            targetLOD = 'HIGH';
        } else if (cameraDistance < this.lodConfig.MEDIUM.maxDistance) {
            targetLOD = 'MEDIUM';
        } else {
            targetLOD = 'LOW';
        }

        // Only rebuild particles if LOD changed
        if (targetLOD === this.currentLOD) return;

        this.currentLOD = targetLOD;
        const targetCount = this.lodConfig[targetLOD].activeCount;
        const maxCount = this.particleCount;
        const { positions, rotations, scales, dummy } = this.instanceData;

        // NASA Rule 2: Fixed iteration bound
        // Hide particles beyond target count by moving to origin
        for (let i = targetCount; i < maxCount; i++) {
            dummy.position.set(0, 0, 0);
            dummy.rotation.copy(rotations[i]);
            dummy.scale.setScalar(scales[i]);
            dummy.updateMatrix();
            this.belt.setMatrixAt(i, dummy.matrix);
        }

        // Restore particles within target count from original positions
        for (let i = 0; i < targetCount; i++) {
            dummy.position.set(
                this.originalPositions[i * 3],
                this.originalPositions[(i * 3) + 1],
                this.originalPositions[(i * 3) + 2]
            );
            dummy.rotation.copy(rotations[i]);
            dummy.scale.setScalar(scales[i]);
            dummy.updateMatrix();
            this.belt.setMatrixAt(i, dummy.matrix);
        }

        this.belt.instanceMatrix.needsUpdate = true;
        console.log(`KuiperBelt LOD changed to ${targetLOD} (${targetCount}/${maxCount} particles) at distance ${cameraDistance.toFixed(1)}`);
    }

    update(deltaTime, j2000Days = null) {
        // Update LOD system based on camera distance (NASA Rule 2: Fixed conditionals)
        if (this.group && this.group.parent && this.group.parent.userData && this.group.parent.userData.camera) {
            const camera = this.group.parent.userData.camera;
            const cameraDistance = this.group.position.distanceTo(camera.position);
            this.updateParticleLOD(cameraDistance);
        }

        if (this.useInstancing) {
            this.updateInstancedBelt(deltaTime, j2000Days);
        } else {
            this.updateTraditionalBelt(deltaTime, j2000Days);
        }

        this.monitorPerformance();
    }

    updateInstancedBelt(deltaTime, j2000Days = null) {
        const { positions, rotations, scales, speeds, radii, dummy } = this.instanceData;

        // Time-synchronized rotation (respects TimeScaleManager time scale)
        // NASA Rule 7: Check if time-synchronized mode is available
        let scaledDelta = deltaTime;
        if (j2000Days !== null) {
            if (!this.lastJ2000Days) {
                this.lastJ2000Days = j2000Days;
            }
            const j2000Delta = j2000Days - this.lastJ2000Days;
            const secondsPerDay = 86400;
            scaledDelta = j2000Delta * secondsPerDay;
            this.lastJ2000Days = j2000Days;
        }

        for (let i = 0; i < this.particleCount; i++) {
            const position = positions[i];
            const speed = speeds[i];
            const radius = radii[i];

            // Calculate new angle (radius stays constant)
            const angle = Math.atan2(position.z, position.x) + (speed * scaledDelta);

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

    updateTraditionalBelt(deltaTime, j2000Days = null) {
        // Time-synchronized rotation (respects TimeScaleManager time scale)
        // NASA Rule 7: Check if time-synchronized mode is available
        let scaledDelta = deltaTime;
        if (j2000Days !== null) {
            if (!this.lastJ2000Days) {
                this.lastJ2000Days = j2000Days;
            }
            const j2000Delta = j2000Days - this.lastJ2000Days;
            const secondsPerDay = 86400;
            scaledDelta = j2000Delta * secondsPerDay;
            this.lastJ2000Days = j2000Days;
        }

        this.particles.forEach(particle => {
            const speed = particle.userData.orbitalSpeed;
            const radius = particle.userData.initialRadius;

            // Calculate new position
            const currentAngle = Math.atan2(particle.position.z, particle.position.x);
            const newAngle = currentAngle + (speed * scaledDelta);

            particle.position.x = radius * Math.cos(newAngle);
            particle.position.z = radius * Math.sin(newAngle);

            // Add subtle wobble
            particle.rotation.x += scaledDelta * 0.1;
            particle.rotation.y += scaledDelta * 0.15;
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
        this.originalPositions = null;
    }
}

// Make globally available
window.KuiperBelt = KuiperBelt;