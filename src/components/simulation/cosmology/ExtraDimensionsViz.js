// ExtraDimensionsViz.js - RENAMED from CalabiYauMesh
//
// DISCLAIMER: This is an ILLUSTRATIVE representation of compactified
// extra dimensions, NOT a mathematically accurate Calabi-Yau manifold.
//
// True Calabi-Yau manifolds:
// - Are 6-dimensional complex surfaces
// - Cannot be faithfully projected to 3D
// - Require advanced mathematical visualization techniques
//
// This simplified visualization is intended to communicate the CONCEPT
// of compactified dimensions, not their actual mathematical structure.
//
// Reference: Hanson, A. J. (1994). "A Construction for Computer
// Visualization of Certain Complex Curves." Notices of the AMS.

class ExtraDimensionsViz {
    constructor(scene, options = {}) {
        // NASA Rule 5: Assertions
        const Assert = window.Assert || {};
        if (typeof Assert.assert === 'function') {
            Assert.assert(scene !== null, 'ExtraDimensionsViz: scene required');
        }

        this.scene = scene;
        this.options = {
            size: options.size || 5,
            resolution: options.resolution || 32, // NASA Rule 2: Fixed bound
            complexity: options.complexity || 5, // Visual complexity parameter
            visible: options.visible !== false,
            rotationSpeed: options.rotationSpeed || 0.0005
        };

        this.mesh = null;
        this.material = null;
    }

    // MANDATORY disclaimer getter
    static get DISCLAIMER() {
        return `
IMPORTANT: This visualization is an ARTISTIC REPRESENTATION of
extra dimensions, NOT a mathematically accurate Calabi-Yau manifold.

True Calabi-Yau manifolds:
- Are 6-dimensional complex surfaces
- Cannot be faithfully projected to 3D
- Require advanced mathematical visualization techniques

This simplified visualization is intended to communicate the CONCEPT
of compactified dimensions, not their actual mathematical structure.

Reference: Hanson, A. J. (1994). "A Construction for Computer
Visualization of Certain Complex Curves." Notices of the AMS.
        `.trim();
    }

    // Generate parametric surface (ILLUSTRATIVE ONLY)
    // NASA Rule 4: Function <= 60 lines
    generateSurface() {
        // NASA Rule 5: Assertions
        const Assert = window.Assert || {};
        if (typeof Assert.assert === 'function') {
            Assert.assert(this.options.resolution > 0, 'ExtraDimensionsViz.generateSurface: resolution must be positive');
        }

        const resolution = this.options.resolution;
        const n = this.options.complexity;
        const size = this.options.size;

        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];

        // NASA Rule 2: Fixed iteration bounds
        const maxIterations = resolution * resolution;
        let iterations = 0;

        for (let i = 0; i < resolution; i++) {
            for (let j = 0; j < resolution; j++) {
                // NASA Rule 2: Guard against infinite loop
                iterations++;
                if (iterations > maxIterations) {
                    console.warn('ExtraDimensionsViz: max iterations reached');
                    break;
                }

                const u = (i / resolution) * 2 * Math.PI;
                const v = (j / resolution) * 2 * Math.PI;

                // ILLUSTRATIVE surface - NOT real Calabi-Yau
                // Modulated sphere with trigonometric complexity
                const k = 1 + 0.3 * Math.cos(n * u) * Math.cos(n * v);

                const x = size * Math.cos(u) * Math.sin(v) * k;
                const y = size * Math.sin(u) * Math.sin(v) * k;
                const z = size * Math.cos(v) * k;

                positions.push(x, y, z);

                // Color based on position (gradient effect)
                colors.push(
                    0.5 + 0.5 * Math.sin(u),
                    0.5 + 0.5 * Math.sin(v),
                    0.5 + 0.5 * Math.cos(u + v)
                );
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        return geometry;
    }

    // Initialize visualization
    async init() {
        // NASA Rule 5: Assertions
        const Assert = window.Assert || {};
        if (typeof Assert.assert === 'function') {
            Assert.assert(this.mesh === null, 'ExtraDimensionsViz.init: already initialized');
        }

        // Log disclaimer on initialization
        console.info('ExtraDimensionsViz:', ExtraDimensionsViz.DISCLAIMER);

        const geometry = this.generateSurface();
        this.material = new THREE.PointsMaterial({
            size: 0.15,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });

        this.mesh = new THREE.Points(geometry, this.material);
        this.scene.add(this.mesh);

        return this;
    }

    // Update visualization (gentle rotation)
    update(deltaTime) {
        // NASA Rule 5: Assertions
        const Assert = window.Assert || {};
        if (typeof Assert.assert === 'function') {
            Assert.assert(this.mesh !== null, 'ExtraDimensionsViz.update: not initialized');
            Assert.assert(typeof deltaTime === 'number', 'ExtraDimensionsViz.update: deltaTime must be number');
        }

        // Gentle rotation on multiple axes for visual interest
        this.mesh.rotation.x += this.options.rotationSpeed * deltaTime * 10;
        this.mesh.rotation.y += this.options.rotationSpeed * deltaTime * 15;
        this.mesh.rotation.z += this.options.rotationSpeed * deltaTime * 8;
    }

    // Set visibility
    setVisible(visible) {
        if (this.mesh) {
            this.mesh.visible = visible;
        }
    }

    // Cleanup resources
    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.material.dispose();
            this.mesh = null;
            this.material = null;
        }
    }
}

// NASA Rule 6: No global pollution beyond class definition
if (typeof window !== 'undefined') {
    window.ExtraDimensionsViz = ExtraDimensionsViz;
}
