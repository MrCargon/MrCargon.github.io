// StringTheory.js - String Theory Visualization Manager
//
// CRITICAL DISCLAIMER: String theory is a theoretical framework that has
// NOT been experimentally verified. This visualization represents mathematical
// concepts, not observed physics.
//
// References:
// - Green, M. B., Schwarz, J. H., & Witten, E. (1987). Superstring Theory. Cambridge University Press.
// - Polchinski, J. (1998). String Theory. Cambridge University Press.
// - Witten, E. (1995). "String theory dynamics in various dimensions." Nuclear Physics B, 443(1-2), 85-126.

class StringTheory {
    constructor(scene, options = {}) {
        // NASA Rule 5: Assertions
        const Assert = window.Assert || {};
        if (typeof Assert.assert === 'function') {
            Assert.assert(scene !== null, 'StringTheory: scene required');
            Assert.assert(typeof THREE !== 'undefined', 'StringTheory: THREE.js required');
        }

        this.scene = scene;
        this.options = {
            // Performance tier settings (NASA Rule 2: Fixed bounds)
            performanceTier: options.performanceTier || 'HIGH',
            maxStrings: this.getMaxStringsForTier(options.performanceTier || 'HIGH'),
            stringLength: options.stringLength || 10,
            baseAmplitude: options.baseAmplitude || 2,
            baseFrequency: options.baseFrequency || 1.0,
            visible: options.visible !== false,
            showExtraDimensions: options.showExtraDimensions !== false
        };

        // State
        this.strings = []; // NASA Rule 2: Fixed max size based on tier
        this.extraDimensionsViz = null;
        this.enabled = false;
        this.disclaimerShown = false;

        // Particle type configurations
        // Different vibrational modes represent different particles
        this.particleTypes = [
            {
                name: 'electron',
                modes: [1], // Fundamental mode
                color: 0x00ffff, // Cyan
                frequency: 1.0,
                amplitude: 2.0,
                position: new THREE.Vector3(-15, 0, 0)
            },
            {
                name: 'up-quark',
                modes: [1, 2], // Two modes
                color: 0xff00ff, // Magenta
                frequency: 1.5,
                amplitude: 1.8,
                position: new THREE.Vector3(0, 0, 0)
            },
            {
                name: 'down-quark',
                modes: [1, 3], // Different harmonic
                color: 0xffff00, // Yellow
                frequency: 1.2,
                amplitude: 1.9,
                position: new THREE.Vector3(15, 0, 0)
            }
        ];
    }

    // Get max strings allowed for performance tier
    // NASA Rule 4: Function <= 60 lines
    getMaxStringsForTier(tier) {
        // NASA Rule 5: Validate tier
        const Assert = window.Assert || {};
        if (typeof Assert.assert === 'function') {
            Assert.assert(typeof tier === 'string', 'StringTheory.getMaxStringsForTier: tier must be string');
        }

        // NASA Rule 2: Fixed tier options
        const tierLimits = {
            'HIGH': 3,
            'MEDIUM': 2,
            'LOW': 1
        };

        return tierLimits[tier] || tierLimits['LOW'];
    }

    // Get disclaimer text
    static get DISCLAIMER() {
        return `
STRING THEORY DISCLAIMER

String theory is a theoretical framework that has NOT been experimentally verified.
This visualization represents mathematical concepts, not observed physics.

Key Points:
- String theory proposes fundamental particles are 1D vibrating strings
- Different vibrational modes correspond to different particles (theoretical)
- Requires 10-11 dimensions for mathematical consistency
- As of 2025, NO experimental confirmation exists
- This is frontier theoretical physics, not established science

This visualization is EDUCATIONAL about theoretical physics concepts.

References:
- Green, Schwarz, & Witten (1987). Superstring Theory.
- Polchinski (1998). String Theory.
- Witten (1995). Nuclear Physics B, 443(1-2), 85-126.

Do you wish to proceed with this theoretical visualization?
        `.trim();
    }

    // Show mandatory disclaimer modal
    // Returns Promise<boolean> - true if user accepts
    async showDisclaimer() {
        // NASA Rule 5: Assertions
        const Assert = window.Assert || {};
        if (typeof Assert.assert === 'function') {
            Assert.assert(!this.disclaimerShown, 'StringTheory.showDisclaimer: disclaimer already shown');
        }

        return new Promise((resolve) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                font-family: Arial, sans-serif;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: #1a1a2e;
                color: #ffffff;
                padding: 30px;
                border-radius: 10px;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 0 30px rgba(255, 255, 255, 0.1);
            `;

            modal.innerHTML = `
                <h2 style="color: #ffaa00; margin-top: 0;">⚠️ String Theory Disclaimer</h2>
                <div style="white-space: pre-wrap; line-height: 1.6; font-size: 14px;">
${StringTheory.DISCLAIMER}
                </div>
                <div style="margin-top: 30px; display: flex; gap: 15px; justify-content: flex-end;">
                    <button id="string-theory-accept" style="
                        background: #4CAF50;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 16px;
                    ">I Understand - Proceed</button>
                    <button id="string-theory-cancel" style="
                        background: #f44336;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 16px;
                    ">Cancel</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Event handlers
            document.getElementById('string-theory-accept').addEventListener('click', () => {
                this.disclaimerShown = true;
                document.body.removeChild(overlay);
                resolve(true);
            });

            document.getElementById('string-theory-cancel').addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve(false);
            });
        });
    }

    // Initialize string theory visualization
    // NASA Rule 4: Function <= 60 lines
    async init() {
        // NASA Rule 5: Assertions
        const Assert = window.Assert || {};
        if (typeof Assert.assert === 'function') {
            Assert.assert(this.strings.length === 0, 'StringTheory.init: already initialized');
        }

        // Show disclaimer if not shown yet
        if (!this.disclaimerShown) {
            const accepted = await this.showDisclaimer();
            if (!accepted) {
                console.log('StringTheory: User declined disclaimer');
                return this;
            }
        }

        // Create vibrating strings for each particle type
        const maxStrings = this.options.maxStrings;
        const particleTypesToShow = this.particleTypes.slice(0, maxStrings);

        // NASA Rule 2: Fixed loop bound
        for (let i = 0; i < particleTypesToShow.length; i++) {
            const config = particleTypesToShow[i];

            const string = new VibratingString(this.scene, {
                length: this.options.stringLength,
                amplitude: config.amplitude,
                frequency: config.frequency,
                modes: config.modes,
                color: config.color,
                segments: this.getSegmentsForTier(),
                position: config.position,
                particleType: config.name
            });

            await string.init();
            this.strings.push(string);
        }

        // Create extra dimensions visualization if enabled
        if (this.options.showExtraDimensions) {
            this.extraDimensionsViz = new ExtraDimensionsViz(this.scene, {
                size: 8,
                resolution: this.getExtraDimsResolutionForTier(),
                complexity: 5,
                visible: true
            });

            await this.extraDimensionsViz.init();
            // Position at center slightly below strings
            this.extraDimensionsViz.mesh.position.set(0, -15, 0);
        }

        this.enabled = true;
        console.log(`StringTheory: Initialized with ${this.strings.length} strings`);

        return this;
    }

    // Get string segments for current performance tier
    getSegmentsForTier() {
        const tierSegments = {
            'HIGH': 64,
            'MEDIUM': 32,
            'LOW': 16
        };
        return tierSegments[this.options.performanceTier] || tierSegments['LOW'];
    }

    // Get extra dimensions resolution for current tier
    getExtraDimsResolutionForTier() {
        const tierResolution = {
            'HIGH': 32,
            'MEDIUM': 24,
            'LOW': 16
        };
        return tierResolution[this.options.performanceTier] || tierResolution['LOW'];
    }

    // Update all strings - CRITICAL: ZERO allocations per frame
    // NASA Rule 4: Function <= 60 lines
    update(deltaTime) {
        // NASA Rule 5: Assertions
        const Assert = window.Assert || {};
        if (typeof Assert.assert === 'function') {
            Assert.assert(typeof deltaTime === 'number', 'StringTheory.update: deltaTime must be number');
        }

        if (!this.enabled) {
            return;
        }

        // NASA Rule 2: Fixed loop bound (max 3 strings)
        const maxIterations = this.strings.length;
        for (let i = 0; i < maxIterations; i++) {
            // CRITICAL: Each string.update() only modifies a single uniform
            // ZERO allocations occur here
            this.strings[i].update(deltaTime);
        }

        // Update extra dimensions visualization if present
        if (this.extraDimensionsViz) {
            this.extraDimensionsViz.update(deltaTime);
        }
    }

    // Set visibility of all components
    setEnabled(enabled) {
        this.enabled = enabled;

        // NASA Rule 2: Fixed loop bound
        for (let i = 0; i < this.strings.length; i++) {
            this.strings[i].mesh.visible = enabled;
        }

        if (this.extraDimensionsViz) {
            this.extraDimensionsViz.setVisible(enabled);
        }
    }

    // Get description of active strings
    getDescription() {
        if (this.strings.length === 0) {
            return 'No strings initialized';
        }

        const descriptions = [];
        // NASA Rule 2: Fixed loop bound
        for (let i = 0; i < this.strings.length; i++) {
            const string = this.strings[i];
            descriptions.push(`${string.getParticleTypeDescription()}: ${string.getModesDescription()}`);
        }

        return descriptions.join(' | ');
    }

    // Cleanup all resources
    dispose() {
        // NASA Rule 2: Fixed loop bound
        for (let i = 0; i < this.strings.length; i++) {
            this.strings[i].dispose();
        }
        this.strings = [];

        if (this.extraDimensionsViz) {
            this.extraDimensionsViz.dispose();
            this.extraDimensionsViz = null;
        }

        this.enabled = false;
    }
}

// NASA Rule 6: No global pollution beyond class definition
if (typeof window !== 'undefined') {
    window.StringTheory = StringTheory;
}
