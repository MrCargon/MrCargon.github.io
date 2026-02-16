// VibratingString.js - Vertex shader animated vibrating string
// ZERO allocations per frame - all animation in GPU
//
// IMPORTANT DISCLAIMER: String theory is a theoretical framework that has
// NOT been experimentally verified. This visualization represents mathematical
// concepts, not observed physics.
//
// Reference: Polchinski, J. (1998). String Theory. Cambridge University Press.

class VibratingString {
    constructor(scene, options = {}) {
        // NASA Rule 5: Assertions for critical preconditions
        const Assert = window.Assert || {};
        if (typeof Assert.assert === 'function') {
            Assert.assert(scene !== null, 'VibratingString: scene required');
            Assert.assert(options.position instanceof THREE.Vector3,
                'VibratingString: position must be Vector3');
        }

        this.scene = scene;
        this.options = {
            length: options.length || 10,
            amplitude: options.amplitude || 2,
            frequency: options.frequency || 1.0,
            modes: options.modes || [1], // Vibrational modes (1-3)
            color: options.color || 0xffffff,
            segments: options.segments || 64, // NASA Rule 2: Fixed bound
            position: options.position || new THREE.Vector3(),
            particleType: options.particleType || 'electron'
        };

        this.mesh = null;
        this.material = null;
        this.uniforms = null;
    }

    // Create geometry ONCE - never disposed until cleanup
    // Animation happens entirely in vertex shader
    createGeometry() {
        // NASA Rule 5: Validate parameters
        const Assert = window.Assert || {};
        if (typeof Assert.assert === 'function') {
            Assert.assert(this.options.segments > 0, 'VibratingString.createGeometry: segments must be positive');
            Assert.assert(this.options.length > 0, 'VibratingString.createGeometry: length must be positive');
        }

        const segments = this.options.segments;
        const length = this.options.length;

        // Create cylinder geometry ONCE (tube approximation)
        // Vertices are displaced by shader, not CPU
        const geometry = new THREE.CylinderGeometry(0.1, 0.1, length, 8, segments, true);

        // Store base positions as custom attribute for shader
        const positions = geometry.attributes.position;
        const basePositions = new Float32Array(positions.count * 3);

        // NASA Rule 2: Fixed iteration bound
        for (let i = 0; i < positions.count; i++) {
            basePositions[i * 3] = positions.getX(i);
            basePositions[(i * 3) + 1] = positions.getY(i);
            basePositions[(i * 3) + 2] = positions.getZ(i);
        }

        geometry.setAttribute('basePosition',
            new THREE.BufferAttribute(basePositions, 3));

        return geometry;
    }

    // Create shader material with uniforms
    createMaterial() {
        // NASA Rule 5: Validate modes array
        const Assert = window.Assert || {};
        if (typeof Assert.assert === 'function') {
            Assert.assert(Array.isArray(this.options.modes), 'VibratingString.createMaterial: modes must be array');
            Assert.assert(this.options.modes.length <= 3, 'VibratingString.createMaterial: max 3 modes allowed');
        }

        this.uniforms = {
            time: { value: 0.0 },
            amplitude: { value: this.options.amplitude },
            frequency: { value: this.options.frequency },
            mode1: { value: this.options.modes[0] || 1 },
            mode2: { value: this.options.modes[1] || 0 },
            mode3: { value: this.options.modes[2] || 0 },
            stringLength: { value: this.options.length },
            color: { value: new THREE.Color(this.options.color) }
        };

        // Load shaders
        const vertexShader = this.loadShader('vibratingString.vert');
        const fragmentShader = this.loadShader('vibratingString.frag');

        return new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.DoubleSide,
            transparent: true
        });
    }

    // Load shader from external file or inline
    // NASA Rule 4: Function <= 60 lines
    loadShader(filename) {
        // NASA Rule 5: Assertions
        const Assert = window.Assert || {};
        if (typeof Assert.assert === 'function') {
            Assert.assert(typeof filename === 'string', 'VibratingString.loadShader: filename must be string');
        }

        // Since we can't do synchronous XHR in modern browsers,
        // embed shaders inline for now
        if (filename === 'vibratingString.vert') {
            return `
                uniform float time;
                uniform float amplitude;
                uniform float frequency;
                uniform float mode1;
                uniform float mode2;
                uniform float mode3;
                uniform float stringLength;

                attribute vec3 basePosition;

                varying vec3 vNormal;
                varying vec3 vPosition;
                varying float vModeIntensity;

                const int MAX_MODES = 3;
                const float PI = 3.14159265359;

                void main() {
                    vec3 pos = basePosition;
                    float t = (pos.y + (stringLength * 0.5)) / stringLength;
                    t = clamp(t, 0.0, 1.0);

                    float displacementX = 0.0;
                    float displacementZ = 0.0;
                    float totalModeStrength = 0.0;

                    if (mode1 > 0.0) {
                        float modeFreq = frequency * mode1;
                        float modeAmp = amplitude / mode1;
                        float spatial = sin(mode1 * PI * t);
                        float temporal = cos(2.0 * PI * modeFreq * time);
                        float temporalZ = sin(2.0 * PI * (modeFreq * time) + 0.785);
                        displacementX += modeAmp * spatial * temporal;
                        displacementZ += modeAmp * spatial * temporalZ;
                        totalModeStrength += abs(spatial);
                    }

                    if (mode2 > 0.0) {
                        float modeFreq = frequency * mode2;
                        float modeAmp = amplitude / mode2;
                        float spatial = sin(mode2 * PI * t);
                        float temporal = cos(2.0 * PI * modeFreq * time);
                        float temporalZ = sin(2.0 * PI * (modeFreq * time) + 0.785);
                        displacementX += modeAmp * spatial * temporal;
                        displacementZ += modeAmp * spatial * temporalZ;
                        totalModeStrength += abs(spatial);
                    }

                    if (mode3 > 0.0) {
                        float modeFreq = frequency * mode3;
                        float modeAmp = amplitude / mode3;
                        float spatial = sin(mode3 * PI * t);
                        float temporal = cos(2.0 * PI * modeFreq * time);
                        float temporalZ = sin(2.0 * PI * (modeFreq * time) + 0.785);
                        displacementX += modeAmp * spatial * temporal;
                        displacementZ += modeAmp * spatial * temporalZ;
                        totalModeStrength += abs(spatial);
                    }

                    pos.x += displacementX;
                    pos.z += displacementZ;

                    vPosition = pos;
                    vNormal = normal;
                    vModeIntensity = totalModeStrength / 3.0;

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `;
        } else if (filename === 'vibratingString.frag') {
            return `
                uniform vec3 color;
                varying vec3 vNormal;
                varying vec3 vPosition;
                varying float vModeIntensity;

                void main() {
                    vec3 light = normalize(vec3(1.0, 1.0, 1.0));
                    float diffuse = max(dot(normalize(vNormal), light), 0.3);
                    float glow = 0.6 + (0.4 * vModeIntensity);
                    vec3 finalColor = color * diffuse * glow;
                    float alpha = 0.9;
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `;
        }

        return '';
    }

    // Initialize string visualization
    async init() {
        // NASA Rule 5: Assertions
        const Assert = window.Assert || {};
        if (typeof Assert.assert === 'function') {
            Assert.assert(this.mesh === null, 'VibratingString.init: already initialized');
        }

        const geometry = this.createGeometry();
        this.material = this.createMaterial();
        this.mesh = new THREE.Mesh(geometry, this.material);

        this.mesh.position.copy(this.options.position);
        this.scene.add(this.mesh);

        return this;
    }

    // Update: ONLY updates uniform - ZERO allocations
    // NASA Rule 4: Function <= 60 lines
    update(deltaTime) {
        // NASA Rule 5: Assertions
        const Assert = window.Assert || {};
        if (typeof Assert.assert === 'function') {
            Assert.assert(this.uniforms !== null, 'VibratingString.update: not initialized');
            Assert.assert(typeof deltaTime === 'number', 'VibratingString.update: deltaTime must be number');
        }

        // SINGLE uniform update - GPU does all the work
        // This is the ONLY operation per frame - ZERO allocations
        this.uniforms.time.value += deltaTime;
    }

    // Cleanup resources
    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.material.dispose();
            this.mesh = null;
            this.material = null;
            this.uniforms = null;
        }
    }

    // Get current particle type description
    getParticleTypeDescription() {
        return this.options.particleType;
    }

    // Get vibration modes description
    getModesDescription() {
        const modes = this.options.modes.filter(m => m > 0);
        return `Modes: ${modes.join(', ')}`;
    }
}

// NASA Rule 6: No global pollution beyond class definition
if (typeof window !== 'undefined') {
    window.VibratingString = VibratingString;
}
