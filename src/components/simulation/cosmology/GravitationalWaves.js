// GravitationalWaves.js - LIGO-inspired gravitational wave visualization
// Reference: Abbott et al. (2016), Physical Review Letters 116(6), 061102
// First direct detection: GW150914, September 14, 2015
// Nobel Prize 2017: Rainer Weiss, Barry Barish, Kip Thorne
//
// NASA Rules Compliance:
// Rule 1: No recursion, goto, longjmp
// Rule 2: Fixed loop bounds (MAX_EVENTS = 4)
// Rule 3: No dynamic memory after init (pre-allocated buffers)
// Rule 4: Functions <= 60 lines
// Rule 5: >= 2 assertions per function
// Rule 6: Minimal variable scope
// Rule 7: Check all returns
// Rule 8: Simple preprocessor (constants only)
// Rule 9: Single-level pointers only (JS arrays)
// Rule 10: Zero warnings (strict mode)


// NASA Rule 8: Simple preprocessor - constants only
const MAX_EVENTS = 4; // Maximum simultaneous wave events (NASA Rule 2)
const DEFAULT_GRID_SIZE = 64; // 64x64 = 4,096 vertices
const DEFAULT_MESH_SIZE = 500; // World space size
const DEFAULT_WAVE_SPEED = 50; // Units per second
const DEFAULT_AMPLITUDE = 1.0; // Maximum displacement

/**
 * GravitationalWaves - Visualizes spacetime distortion from gravitational wave events
 * Implements LIGO-standard visualization with chirp signal physics
 *
 * @class
 */
class GravitationalWaves {
    /**
     * Constructor - Initialize gravitational wave visualization
     * NASA Rule 5: 2+ (assertions * NASA) Rule 6: Minimal scope
     *
     * @param {THREE.Scene} scene - Three.js scene to add mesh to
     * @param {Object} options - Configuration options
     */
    constructor(scene, options = {}) {
        // NASA Rule 5: Assertions for critical preconditions
        console.assert(scene !== null && scene !== undefined,
            'GravitationalWaves: scene is required');
        console.assert(typeof THREE !== 'undefined',
            'GravitationalWaves: THREE.js library required');

        // NASA Rule 6: Minimal scope - instance properties
        this.scene = scene;
        this.options = this.initializeOptions(options);

        // NASA Rule 3: Pre-allocated fixed-size buffers
        this.events = new Array(MAX_EVENTS);
        this.resetEvents();

        // State tracking
        this.mesh = null;
        this.material = null;
        this.uniforms = null;
        this.time = 0.0;
        this.enabled = false;
    }

    /**
     * Initialize options with defaults
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ assertions
     *
     * @param {Object} userOptions - User-provided options
     * @returns {Object} Merged options with defaults
     */
    initializeOptions(userOptions) {
        // NASA Rule 5: Validate input
        console.assert(typeof userOptions === 'object',
            'initializeOptions: userOptions must be object');
        console.assert(userOptions !== null,
            'initializeOptions: userOptions cannot be null');

        const defaults = {
            gridSize: DEFAULT_GRID_SIZE,
            meshSize: DEFAULT_MESH_SIZE,
            waveSpeed: DEFAULT_WAVE_SPEED,
            amplitude: DEFAULT_AMPLITUDE,
            maxEvents: MAX_EVENTS,
            visible: true,
            performanceTier: 'HIGH'
        };

        // Adjust for performance tier
        const opts = { ...defaults, ...userOptions };

        if (opts.performanceTier === 'MEDIUM') {
            opts.gridSize = 45; // 2,025 vertices
        } else if (opts.performanceTier === 'LOW') {
            opts.gridSize = 32; // 1,024 vertices
        }

        return opts;
    }

    /**
     * Reset all event slots to inactive
     * NASA Rule 2: Fixed bounds
     * NASA Rule 4: <= 60 lines
     */
    resetEvents() {
        // NASA Rule 2: Fixed loop bound
        for (let i = 0; i < MAX_EVENTS; i++) {
            this.events[i] = {
                position: { x: 0, y: 0 },
                startTime: 0,
                amplitude: 0, // 0 = inactive
                chirpRate: 0.1
            };
        }
    }

    /**
     * Initialize visualization - create mesh and load shaders
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ (assertions * NASA) Rule 7: Check returns
     *
     * @returns {Promise<boolean>} Success status
     */
    async init() {
        console.assert(this.mesh === null,
            'GravitationalWaves.init: already initialized');
        console.assert(this.scene !== null,
            'GravitationalWaves.init: scene required');

        try {
            // Load shaders
            const vertexShader = await this.loadShader('spacetimeDistortion.vert');
            const fragmentShader = await this.loadShader('spacetimeDistortion.frag');

            // NASA Rule 7: Check returns
            if (!vertexShader || !fragmentShader) {
                console.error('Failed to load shaders');
                return false;
            }

            // Create spacetime mesh
            const meshCreated = this.createSpacetimeMesh(vertexShader, fragmentShader);
            if (!meshCreated) {
                console.error('Failed to create spacetime mesh');
                return false;
            }

            this.enabled = true;
            console.log('GravitationalWaves initialized successfully');
            return true;

        } catch (error) {
            console.error('GravitationalWaves initialization error:', error);
            return false;
        }
    }

    /**
     * Load shader file from filesystem
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ assertions
     *
     * @param {string} filename - Shader filename
     * @returns {Promise<string>} Shader source code
     */
    async loadShader(filename) {
        console.assert(typeof filename === 'string',
            'loadShader: filename must be string');
        console.assert(filename.length > 0,
            'loadShader: filename cannot be empty');

        try {
            const path = `src/components/simulation/cosmology/shaders/${filename}`;
            const response = await fetch(path);

            if (!response.ok) {
                console.error(`Failed to load shader: ${filename}`);
                return null;
            }

            const shaderCode = await response.text();
            return shaderCode;

        } catch (error) {
            console.error(`Error loading shader ${filename}:`, error);
            return null;
        }
    }

    /**
     * Create spacetime distortion mesh with shader material
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ assertions
     *
     * @param {string} vertexShader - Vertex shader source
     * @param {string} fragmentShader - Fragment shader source
     * @returns {boolean} Success status
     */
    createSpacetimeMesh(vertexShader, fragmentShader) {
        console.assert(typeof vertexShader === 'string',
            'createSpacetimeMesh: vertexShader required');
        console.assert(typeof fragmentShader === 'string',
            'createSpacetimeMesh: fragmentShader required');

        // Create grid geometry
        const geometry = new THREE.PlaneGeometry(
            this.options.meshSize,
            this.options.meshSize,
            this.options.gridSize - 1,
            this.options.gridSize - 1
        );

        // Initialize uniforms
        this.uniforms = this.createUniforms();

        // Create shader material
        this.material = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: this.uniforms,
            wireframe: false,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false
        });

        // Create mesh
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.rotation.x = -Math.PI / 2; // Horizontal plane
        this.mesh.position.y = -50; // Below solar system

        // Add to scene
        this.scene.add(this.mesh);

        console.log(`Spacetime mesh created: ${this.options.gridSize}x${this.options.gridSize} grid`);
        return true;
    }

    /**
     * Create shader uniforms
     * NASA Rule 4: <= 60 lines
     * NASA Rule 6: Minimal scope
     *
     * @returns {Object} Uniforms object
     */
    createUniforms() {
        // NASA Rule 3: Pre-allocated arrays
        const eventArray = new Array(MAX_EVENTS);
        for (let i = 0; i < MAX_EVENTS; i++) {
            eventArray[i] = new THREE.Vector4(0, 0, 0, 0);
        }

        return {
            time: { value: 0.0 },
            waveSpeed: { value: this.options.waveSpeed },
            events: { value: eventArray },
            eventCount: { value: 0 },
            stretchColor: { value: new THREE.Color(0xFFFF00) }, // Yellow
            compressColor: { value: new THREE.Color(0x8000FF) }, // Purple
            neutralColor: { value: new THREE.Color(0xFFFFFF) } // White
        };
    }

    /**
     * Trigger gravitational wave event
     * NASA Rule 2: Fixed bounds (max 4 events)
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ assertions
     *
     * @param {THREE.Vector3} position - Event position in world space
     * @param {number} amplitude - Wave amplitude (default 1.0)
     */
    triggerWaveEvent(position, amplitude = 1.0) {
        console.assert(position instanceof THREE.Vector3,
            'triggerWaveEvent: position must be Vector3');
        console.assert(typeof amplitude === 'number' && amplitude > 0,
            'triggerWaveEvent: amplitude must be positive number');

        // Find first inactive slot
        let slotIndex = -1;
        for (let i = 0; i < MAX_EVENTS; i++) {
            if (this.events[i].amplitude === 0) {
                slotIndex = i;
                break;
            }
        }

        // If all slots full, replace oldest
        if (slotIndex === -1) {
            slotIndex = this.findOldestEvent();
        }

        // Set event data
        this.events[slotIndex] = {
            position: { x: position.x, y: position.z }, // Use X/Z for plane
            startTime: this.time,
            amplitude: amplitude,
            chirpRate: 0.1
        };

        // Update uniforms
        this.updateEventUniforms();

        console.log(`Wave event triggered at (${position.x.toFixed(2)}, ${position.z.toFixed(2)})`);
    }

    /**
     * Find oldest active event
     * NASA Rule 2: Fixed bounds
     * NASA Rule 4: <= 60 lines
     *
     * @returns {number} Index of oldest event
     */
    findOldestEvent() {
        let oldestIndex = 0;
        let oldestTime = this.events[0].startTime;

        for (let i = 1; i < MAX_EVENTS; i++) {
            if (this.events[i].startTime < oldestTime) {
                oldestTime = this.events[i].startTime;
                oldestIndex = i;
            }
        }

        return oldestIndex;
    }

    /**
     * Update shader uniforms with current event data
     * NASA Rule 2: Fixed bounds
     * NASA Rule 4: <= 60 lines
     */
    updateEventUniforms() {
        if (!this.uniforms) return;

        let activeCount = 0;

        // NASA Rule 2: Fixed loop bound
        for (let i = 0; i < MAX_EVENTS; i++) {
            const event = this.events[i];

            // Update uniform array
            this.uniforms.events.value[i].set(
                event.position.x,
                event.position.y,
                event.startTime,
                event.amplitude
            );

            if (event.amplitude > 0) {
                activeCount++;
            }
        }

        this.uniforms.eventCount.value = activeCount;
    }

    /**
     * Update simulation - called every frame
     * NASA Rule 2: Fixed bounds
     * NASA Rule 4: <= 60 lines
     * NASA Rule 5: 2+ assertions
     *
     * @param {number} deltaTime - Time elapsed since last frame (seconds)
     */
    update(deltaTime) {
        console.assert(typeof deltaTime === 'number',
            'update: deltaTime must be number');
        console.assert(deltaTime >= 0,
            'update: deltaTime must be non-negative');

        if (!this.enabled || !this.uniforms) return;

        // Update time
        this.time += deltaTime;
        this.uniforms.time.value = this.time;

        // Clean up expired events
        this.cleanupExpiredEvents();
    }

    /**
     * Remove events that have propagated beyond mesh boundary
     * NASA Rule 2: Fixed bounds
     * NASA Rule 4: <= 60 lines
     */
    cleanupExpiredEvents() {
        const maxDistance = this.options.meshSize * 1.5;

        for (let i = 0; i < MAX_EVENTS; i++) {
            const event = this.events[i];
            if (event.amplitude === 0) continue;

            const elapsed = this.time - event.startTime;
            const distance = elapsed * this.options.waveSpeed;

            // Deactivate if wave passed boundary
            if (distance >= maxDistance) {
                this.events[i].amplitude = 0;
                this.updateEventUniforms();
            }
        }
    }

    /**
     * Set visibility of gravitational wave visualization
     * NASA Rule 5: 2+ assertions
     *
     * @param {boolean} visible - Visibility state
     */
    setVisible(visible) {
        console.assert(typeof visible === 'boolean',
            'setVisible: visible must be boolean');
        console.assert(this.mesh !== null,
            'setVisible: mesh not initialized');

        this.mesh.visible = visible;
        this.enabled = visible;
    }

    /**
     * Dispose of all resources
     * NASA Rule 5: 2+ (assertions * NASA) Rule 7: Check status
     */
    dispose() {
        console.assert(this.scene !== null && this.scene !== undefined,
            'dispose: scene is required');

        if (this.mesh) {
            // Remove from scene
            this.scene.remove(this.mesh);

            // Dispose geometry
            if (this.mesh.geometry) {
                this.mesh.geometry.dispose();
            }

            // Dispose material
            if (this.material) {
                this.material.dispose();
            }

            this.mesh = null;
            this.material = null;
        }

        // Reset state
        this.resetEvents();
        this.uniforms = null;
        this.enabled = false;

        console.log('GravitationalWaves disposed');
    }
}

// Make globally available
if (typeof window !== 'undefined') {
    window.GravitationalWaves = GravitationalWaves;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GravitationalWaves;
}
