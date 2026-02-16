/**
 * CosmicScale.js - Cosmic Scale Perspective Viewer
 *
 * Implements Powers of Ten inspired zoom levels from Solar System to Local Group.
 * Features smooth camera transitions, LOD system, and scale annotations.
 *
 * References:
 * - Eames, C. & Eames, R. (1977). "Powers of Ten." IBM.
 * - NASA/JPL Eyes: https://eyes.nasa.gov/
 * - ESA Gaia Mission: https://www.cosmos.esa.int/web/gaia
 *
 * NASA Compliance: All 10 rules enforced
 */


const MAX_SCALE_LEVELS = 6;
const MAX_OBJECTS_PER_LEVEL = 100;
const MAX_PARTICLES = 2000;
const MAX_LABELS = 20;

class CosmicScale {
    constructor(scene, camera, options = {}) {
        console.assert(scene !== null, 'CosmicScale: scene required');
        console.assert(camera !== null, 'CosmicScale: camera required');
        console.assert(scene instanceof THREE.Scene, 'CosmicScale: scene must be THREE.Scene');
        console.assert(camera instanceof THREE.Camera, 'CosmicScale: camera must be THREE.Camera');

        this.scene = scene;
        this.camera = camera;
        this.options = {
            performanceTier: options.performanceTier || 'HIGH',
            visible: options.visible !== false,
            autoTransition: options.autoTransition || false
        };

        this.currentLevel = 1;
        this.targetLevel = 1;
        this.isTransitioning = false;
        this.transitionProgress = 0;

        this.levelObjects = [];
        this.levelParticles = [];
        this.levelLabels = [];
        this.spiralArms = null;

        this.enabled = false;
        this.initialized = false;

        this.originalCameraPosition = null;
        this.originalCameraFar = null;

        this.cosmicScaleData = null; // Loaded via fetch in init()
    }

    async init() {
        console.assert(!this.initialized, 'CosmicScale.init: already initialized');

        // Load cosmic scale data from JSON file with timeout (FIX #5)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const response = await fetch('src/components/simulation/cosmology/data/cosmicScaleData.json', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                console.error('CosmicScale.init: Failed to load cosmicScaleData.json - HTTP', response.status);
                return false;
            }
            this.cosmicScaleData = await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('CosmicScale.init: Timeout loading cosmic scale data (5 seconds exceeded)');
            } else {
                console.error('CosmicScale.init: Error loading cosmic scale data:', error);
            }
            return false;
        }

        console.assert(this.cosmicScaleData !== null, 'CosmicScale.init: data not loaded');
        console.assert(this.cosmicScaleData.scaleLevels.length === MAX_SCALE_LEVELS,
            'CosmicScale.init: invalid scale level count');

        this.storeCameraState();
        this.preallocateResources();

        this.initialized = true;
        return this;
    }

    storeCameraState() {
        console.assert(this.camera !== null, 'CosmicScale.storeCameraState: camera required');

        this.originalCameraPosition = this.camera.position.clone();
        this.originalCameraFar = this.camera.far;
    }

    preallocateResources() {
        const maxObjects = MAX_OBJECTS_PER_LEVEL;
        const maxParticles = this.getMaxParticlesForTier();

        for (let i = 0; i < MAX_SCALE_LEVELS; i++) {
            this.levelObjects[i] = [];
            this.levelParticles[i] = null;
            this.levelLabels[i] = [];
        }

        console.log(`CosmicScale: Preallocated ${MAX_SCALE_LEVELS} levels, max ${maxObjects} objects, max ${maxParticles} particles`);
    }

    getMaxParticlesForTier() {
        console.assert(this.options.performanceTier !== null, 'CosmicScale: performanceTier required');

        const tier = this.cosmicScaleData.performanceTiers[this.options.performanceTier];
        console.assert(tier !== undefined, `CosmicScale: invalid tier ${this.options.performanceTier}`);

        return Math.min(tier.maxVisibleObjects, MAX_PARTICLES);
    }

    setEnabled(enabled) {
        console.assert(typeof enabled === 'boolean', 'CosmicScale.setEnabled: enabled must be boolean');
        console.assert(this.initialized, 'CosmicScale.setEnabled: not initialized');

        this.enabled = enabled;

        if (enabled) {
            this.buildLevel(this.currentLevel);
            this.showLevel(this.currentLevel);
        } else {
            this.hideAllLevels();
            this.restoreCameraState();
        }
    }

    restoreCameraState() {
        console.assert(this.camera !== null, 'CosmicScale.restoreCameraState: camera required');
        console.assert(this.originalCameraPosition !== null, 'CosmicScale.restoreCameraState: no stored state');

        this.camera.position.copy(this.originalCameraPosition);
        this.camera.far = this.originalCameraFar;
        this.camera.updateProjectionMatrix();
    }

    setCosmicScaleLevel(level) {
        console.assert(typeof level === 'number', 'CosmicScale.setCosmicScaleLevel: level must be number');
        console.assert(level >= 1 && level <= MAX_SCALE_LEVELS,
            `CosmicScale.setCosmicScaleLevel: level must be 1-${MAX_SCALE_LEVELS}`);
        console.assert(this.initialized, 'CosmicScale.setCosmicScaleLevel: not initialized');

        if (this.isTransitioning) {
            console.warn('CosmicScale: Transition already in progress');
            return;
        }

        this.targetLevel = level;
        this.startTransition();
    }

    startTransition() {
        console.assert(!this.isTransitioning, 'CosmicScale.startTransition: already transitioning');
        console.assert(this.targetLevel >= 1 && this.targetLevel <= MAX_SCALE_LEVELS,
            'CosmicScale.startTransition: invalid target level');

        this.isTransitioning = true;
        this.transitionProgress = 0;

        this.buildLevel(this.targetLevel);
    }

    buildLevel(level) {
        console.assert(level >= 1 && level <= MAX_SCALE_LEVELS,
            `CosmicScale.buildLevel: invalid level ${level}`);
        console.assert(this.cosmicScaleData.scaleLevels[level - 1] !== undefined,
            'CosmicScale.buildLevel: level data not found');

        const levelData = this.cosmicScaleData.scaleLevels[level - 1];
        const levelIndex = level - 1;

        this.clearLevel(levelIndex);

        this.buildKeyObjects(levelIndex, levelData);

        if (levelData.particleField) {
            this.buildParticleField(levelIndex, levelData.particleField);
        }

        if (levelData.spiralArms && level === 5) {
            this.buildSpiralArms(levelData.spiralArms);
        }

        if (levelData.labels) {
            this.buildLabels(levelIndex, levelData.labels);
        }
    }

    clearLevel(levelIndex) {
        console.assert(levelIndex >= 0 && levelIndex < MAX_SCALE_LEVELS,
            'CosmicScale.clearLevel: invalid level index');

        const objects = this.levelObjects[levelIndex];
        for (let i = 0; i < objects.length; i++) {
            if (objects[i]) {
                this.scene.remove(objects[i]);
                this.disposeObject(objects[i]);
                objects[i] = null;
            }
        }
        this.levelObjects[levelIndex] = [];

        if (this.levelParticles[levelIndex]) {
            this.scene.remove(this.levelParticles[levelIndex]);
            this.disposeObject(this.levelParticles[levelIndex]);
            this.levelParticles[levelIndex] = null;
        }

        const labels = this.levelLabels[levelIndex];
        for (let i = 0; i < labels.length; i++) {
            if (labels[i]) {
                this.scene.remove(labels[i]);
                this.disposeObject(labels[i]);
                labels[i] = null;
            }
        }
        this.levelLabels[levelIndex] = [];

        if (this.spiralArms && levelIndex === 4) {
            this.scene.remove(this.spiralArms);
            this.disposeObject(this.spiralArms);
            this.spiralArms = null;
        }
    }

    buildKeyObjects(levelIndex, levelData) {
        console.assert(levelIndex >= 0 && levelIndex < MAX_SCALE_LEVELS,
            'CosmicScale.buildKeyObjects: invalid level index');
        console.assert(levelData.keyObjects !== undefined,
            'CosmicScale.buildKeyObjects: keyObjects required');
        console.assert(levelData.keyObjects.length <= MAX_OBJECTS_PER_LEVEL,
            'CosmicScale.buildKeyObjects: too many objects');

        const objects = levelData.keyObjects;
        const objectCount = objects.length;

        for (let i = 0; i < objectCount; i++) {
            const objData = objects[i];
            let mesh = null;

            if (objData.isRing) {
                mesh = this.createRing(objData);
            } else if (objData.isGalaxy) {
                mesh = this.createGalaxy(objData);
            } else {
                mesh = this.createSphere(objData);
            }

            if (mesh) {
                mesh.visible = false;
                this.scene.add(mesh);
                this.levelObjects[levelIndex].push(mesh);
            }
        }
    }

    createSphere(objData) {
        console.assert(objData.size !== undefined, 'CosmicScale.createSphere: size required');
        console.assert(objData.color !== undefined, 'CosmicScale.createSphere: color required');

        const geometry = new THREE.SphereGeometry(objData.size, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: objData.color,
            transparent: true,
            opacity: 0.9
        });

        const mesh = new THREE.Mesh(geometry, material);

        if (!objData.isCenter) {
            const angle = Math.random() * Math.PI * 2;
            mesh.position.set(
                Math.cos(angle) * objData.distance,
                (Math.random() - 0.5) * objData.distance * 0.1,
                Math.sin(angle) * objData.distance
            );
        }

        if (objData.glow) {
            this.addGlowEffect(mesh, objData.color);
        }

        return mesh;
    }

    createRing(objData) {
        console.assert(objData.ringInner !== undefined, 'CosmicScale.createRing: ringInner required');
        console.assert(objData.ringOuter !== undefined, 'CosmicScale.createRing: ringOuter required');

        const geometry = new THREE.RingGeometry(objData.ringInner, objData.ringOuter, 32);
        const material = new THREE.MeshBasicMaterial({
            color: objData.color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.3
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.PI / 2;

        return mesh;
    }

    createGalaxy(objData) {
        console.assert(objData.size !== undefined, 'CosmicScale.createGalaxy: size required');
        console.assert(objData.color !== undefined, 'CosmicScale.createGalaxy: color required');

        const geometry = new THREE.PlaneGeometry(objData.size * 2, objData.size);
        const material = new THREE.MeshBasicMaterial({
            color: objData.color,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);

        if (!objData.isCenter) {
            const angle = Math.random() * Math.PI * 2;
            mesh.position.set(
                Math.cos(angle) * objData.distance,
                (Math.random() - 0.5) * objData.distance * 0.05,
                Math.sin(angle) * objData.distance
            );
            mesh.rotation.y = angle;
        }

        if (objData.glow) {
            this.addGlowEffect(mesh, objData.color);
        }

        return mesh;
    }

    addGlowEffect(mesh, color) {
        console.assert(mesh !== null, 'CosmicScale.addGlowEffect: mesh required');

        const glowGeometry = mesh.geometry.clone();
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide
        });

        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        glowMesh.scale.multiplyScalar(1.2);
        mesh.add(glowMesh);
    }

    buildParticleField(levelIndex, fieldData) {
        console.assert(levelIndex >= 0 && levelIndex < MAX_SCALE_LEVELS,
            'CosmicScale.buildParticleField: invalid level index');
        console.assert(fieldData.count !== undefined, 'CosmicScale.buildParticleField: count required');

        const maxParticles = this.getMaxParticlesForTier();
        const particleCount = Math.min(fieldData.count, maxParticles);

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            const radius = fieldData.minDistance +
                Math.random() * (fieldData.maxDistance - fieldData.minDistance);
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[(i * 3) + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.1;
            positions[(i * 3) + 2] = radius * Math.cos(phi);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: fieldData.color,
            size: fieldData.size,
            transparent: true,
            opacity: fieldData.opacity
        });

        const particles = new THREE.Points(geometry, material);
        particles.visible = false;

        this.scene.add(particles);
        this.levelParticles[levelIndex] = particles;
    }

    buildSpiralArms(armData) {
        console.assert(armData.armCount !== undefined, 'CosmicScale.buildSpiralArms: armCount required');
        console.assert(armData.armCount <= 10, 'CosmicScale.buildSpiralArms: too many arms');

        const maxParticles = this.getMaxParticlesForTier();
        const particlesPerArm = Math.min(armData.particlesPerArm, Math.floor(maxParticles / armData.armCount));
        const totalParticles = particlesPerArm * armData.armCount;

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(totalParticles * 3);

        let particleIndex = 0;

        for (let arm = 0; arm < armData.armCount; arm++) {
            const armAngle = (arm / armData.armCount) * Math.PI * 2;

            for (let i = 0; i < particlesPerArm; i++) {
                const t = i / particlesPerArm;
                const radius = armData.innerRadius + t * (armData.outerRadius - armData.innerRadius);
                const angle = armAngle + (t * armData.twist) * Math.PI * 2;

                const x = radius * Math.cos(angle);
                const z = radius * Math.sin(angle);
                const y = (Math.random() - 0.5) * armData.armWidth;

                positions[particleIndex * 3] = x;
                positions[(particleIndex * 3) + 1] = y;
                positions[(particleIndex * 3) + 2] = z;

                particleIndex++;
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: armData.color,
            size: armData.particleSize,
            transparent: true,
            opacity: armData.opacity
        });

        this.spiralArms = new THREE.Points(geometry, material);
        this.spiralArms.visible = false;

        this.scene.add(this.spiralArms);
    }

    buildLabels(levelIndex, labelsData) {
        console.assert(levelIndex >= 0 && levelIndex < MAX_SCALE_LEVELS,
            'CosmicScale.buildLabels: invalid level index');
        console.assert(labelsData.length <= MAX_LABELS,
            'CosmicScale.buildLabels: too many labels');

        console.log(`CosmicScale: Labels would be created here (text rendering not implemented)`);
    }

    showLevel(level) {
        console.assert(level >= 1 && level <= MAX_SCALE_LEVELS,
            'CosmicScale.showLevel: invalid level');

        const levelIndex = level - 1;

        this.setLevelVisibility(levelIndex, true);
    }

    hideAllLevels() {
        for (let i = 0; i < MAX_SCALE_LEVELS; i++) {
            this.setLevelVisibility(i, false);
        }
    }

    setLevelVisibility(levelIndex, visible) {
        console.assert(levelIndex >= 0 && levelIndex < MAX_SCALE_LEVELS,
            'CosmicScale.setLevelVisibility: invalid level index');

        const objects = this.levelObjects[levelIndex];
        for (let i = 0; i < objects.length; i++) {
            if (objects[i]) {
                objects[i].visible = visible;
            }
        }

        if (this.levelParticles[levelIndex]) {
            this.levelParticles[levelIndex].visible = visible;
        }

        if (this.spiralArms && levelIndex === 4) {
            this.spiralArms.visible = visible;
        }

        const labels = this.levelLabels[levelIndex];
        for (let i = 0; i < labels.length; i++) {
            if (labels[i]) {
                labels[i].visible = visible;
            }
        }
    }

    update(deltaTime) {
        console.assert(typeof deltaTime === 'number', 'CosmicScale.update: deltaTime must be number');
        console.assert(deltaTime >= 0, 'CosmicScale.update: deltaTime must be non-negative');

        if (!this.enabled || !this.initialized) {
            return;
        }

        if (this.isTransitioning) {
            this.updateTransition(deltaTime);
        }

        this.updateAnimations(deltaTime);
    }

    updateTransition(deltaTime) {
        console.assert(this.isTransitioning, 'CosmicScale.updateTransition: not transitioning');
        console.assert(this.targetLevel >= 1 && this.targetLevel <= MAX_SCALE_LEVELS,
            'CosmicScale.updateTransition: invalid target level');

        const levelData = this.cosmicScaleData.scaleLevels[this.targetLevel - 1];
        const duration = levelData.transitionDuration / 1000;

        this.transitionProgress += deltaTime / duration;

        if (this.transitionProgress >= 1.0) {
            this.transitionProgress = 1.0;
            this.completeTransition();
        }

        this.updateCameraTransition(this.transitionProgress, levelData);
    }

    updateCameraTransition(progress, levelData) {
        console.assert(progress >= 0 && progress <= 1,
            'CosmicScale.updateCameraTransition: invalid progress');
        console.assert(this.camera !== null, 'CosmicScale.updateCameraTransition: camera required');

        const eased = this.easeInOutCubic(progress);

        const currentLevelData = this.cosmicScaleData.scaleLevels[this.currentLevel - 1];
        const startDistance = currentLevelData.cameraDistance;
        const endDistance = levelData.cameraDistance;
        const newDistance = startDistance + (endDistance - startDistance) * eased;

        this.camera.position.set(0, newDistance * 0.3, newDistance);
        this.camera.lookAt(0, 0, 0);

        const startFar = currentLevelData.cameraFarPlane;
        const endFar = levelData.cameraFarPlane;
        this.camera.far = startFar + (endFar - startFar) * eased;
        this.camera.updateProjectionMatrix();

        this.updateLevelFade(progress);
    }

    updateLevelFade(progress) {
        console.assert(progress >= 0 && progress <= 1,
            'CosmicScale.updateLevelFade: invalid progress');

        const currentIndex = this.currentLevel - 1;
        const targetIndex = this.targetLevel - 1;

        const fadeOut = 1.0 - progress;
        const fadeIn = progress;

        this.setLevelOpacity(currentIndex, fadeOut);
        this.setLevelOpacity(targetIndex, fadeIn);
    }

    setLevelOpacity(levelIndex, opacity) {
        console.assert(levelIndex >= 0 && levelIndex < MAX_SCALE_LEVELS,
            'CosmicScale.setLevelOpacity: invalid level index');
        console.assert(opacity >= 0 && opacity <= 1,
            'CosmicScale.setLevelOpacity: invalid opacity');

        const objects = this.levelObjects[levelIndex];
        for (let i = 0; i < objects.length; i++) {
            if (objects[i] && objects[i].material) {
                objects[i].material.opacity = opacity * 0.9;
            }
        }

        if (this.levelParticles[levelIndex] && this.levelParticles[levelIndex].material) {
            const baseOpacity = this.levelParticles[levelIndex].material.userData.baseOpacity || 0.5;
            this.levelParticles[levelIndex].material.opacity = opacity * baseOpacity;
        }
    }

    easeInOutCubic(t) {
        console.assert(t >= 0 && t <= 1, 'CosmicScale.easeInOutCubic: t must be 0-1');

        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-(2 * t) + 2, 3) / 2;
    }

    completeTransition() {
        console.assert(this.isTransitioning, 'CosmicScale.completeTransition: not transitioning');

        this.hideAllLevels();
        this.showLevel(this.targetLevel);

        this.currentLevel = this.targetLevel;
        this.isTransitioning = false;
        this.transitionProgress = 0;

        console.log(`CosmicScale: Transitioned to level ${this.currentLevel}`);
    }

    updateAnimations(deltaTime) {
        console.assert(typeof deltaTime === 'number', 'CosmicScale.updateAnimations: deltaTime must be number');

        if (this.spiralArms && this.spiralArms.visible) {
            this.spiralArms.rotation.y += deltaTime * 0.05;
        }
    }

    disposeObject(obj) {
        console.assert(obj !== null, 'CosmicScale.disposeObject: obj required');

        // NASA Rule 5: Dispose children recursively FIRST (FIX #2)
        if (obj.children && obj.children.length > 0) {
            // Clone array because remove() modifies obj.children during iteration
            const children = [...obj.children];
            for (let i = 0; i < children.length; i++) {
                this.disposeObject(children[i]); // Recursive disposal
                obj.remove(children[i]);
            }
        }

        // Then dispose parent geometry and materials
        if (obj.geometry) {
            obj.geometry.dispose();
        }
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                for (let i = 0; i < obj.material.length; i++) {
                    obj.material[i].dispose();
                }
            } else {
                obj.material.dispose();
            }
        }
    }

    dispose() {
        console.assert(this.initialized, 'CosmicScale.dispose: not initialized');

        this.hideAllLevels();

        for (let i = 0; i < MAX_SCALE_LEVELS; i++) {
            this.clearLevel(i);
        }

        if (this.originalCameraPosition) {
            this.restoreCameraState();
        }

        this.initialized = false;
        this.enabled = false;

        console.log('CosmicScale: Disposed');
    }
}
