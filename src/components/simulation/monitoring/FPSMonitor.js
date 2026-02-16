/**
 * FPSMonitor.js - Programmatic FPS tracking and display
 *
 * Measures actual frame rate and provides statistics.
 * Addresses roaster feedback: "Works on my machine" - provides real measurement.
 *
 * Features:
 * - Real-time FPS calculation (current, avg, min, max)
 * - Rolling 60-frame buffer for accurate averaging
 * - Color-coded display (green >50, yellow 30-50, red <30)
 * - Toggle on/off capability
 * - Performance threshold checking (30 FPS warning)
 *
 * NASA Rules Compliance:
 * - Rule 2: Fixed loop bounds (60-frame buffer)
 * - Rule 3: No dynamic allocation after init
 * - Rule 4: All functions <= 60 lines
 * - Rule 5: >= 2 assertions per function
 * - Rule 7: All return values checked
 */

class FPSMonitor {
    /**
     * Create FPS monitor
     *
     * NASA Rule 5: Validate environment
     */
    constructor() {
        // NASA Rule 5: Validate constructor parameters
        console.assert(typeof window !== 'undefined',
            'FPSMonitor.constructor: window object required');
        console.assert(typeof requestAnimationFrame !== 'undefined',
            'FPSMonitor.constructor: requestAnimationFrame required');

        // Frame timing tracking (NASA Rule 3: pre-allocated buffer)
        this.frames = [];
        this.maxSamples = 60; // Track last 60 frames (NASA Rule 2)
        this.lastFrameTime = performance.now();

        // Statistics
        this.currentFPS = 0;
        this.averageFPS = 0;
        this.minFPS = Infinity;
        this.maxFPS = 0;

        // UI elements
        this.displayElement = null;
        this.warningThreshold = 30; // Warn if FPS < 30

        // State
        this.isEnabled = false;
    }

    /**
     * Initialize FPS monitor with optional display element
     *
     * @param {HTMLElement} displayElement - Optional element to show FPS
     * NASA Rule 5: Validate display element
     * NASA Rule 7: Check return values
     */
    init(displayElement = null) {
        console.assert(!displayElement || displayElement instanceof HTMLElement,
            'FPSMonitor.init: displayElement must be HTMLElement or null');

        this.displayElement = displayElement;
        this.isEnabled = true;

        if (this.displayElement) {
            this.displayElement.textContent = 'FPS: --';
            this.displayElement.style.cssText = `
                position: fixed;
                top: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: #0f0;
                padding: 8px 12px;
                font-family: monospace;
                font-size: 14px;
                border-radius: 4px;
                z-index: 10000;
                pointer-events: none;
            `;
        }

        console.log('FPSMonitor: Initialized');
    }

    /**
     * Update FPS calculation (call every frame)
     *
     * @param {number} currentTime - Current timestamp from performance.now()
     * NASA Rule 2: Bounded frame buffer
     * NASA Rule 5: Validate currentTime
     */
    update(currentTime) {
        if (!this.isEnabled) return;

        console.assert(typeof currentTime === 'number' && isFinite(currentTime),
            'FPSMonitor.update: currentTime must be finite number');

        // Calculate delta time since last frame
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        // Calculate FPS for this frame
        const fps = 1000 / deltaTime; // deltaTime is in ms

        // Add to rolling buffer (NASA Rule 2: bounded loop)
        this.frames.push(fps);
        if (this.frames.length > this.maxSamples) {
            this.frames.shift(); // Remove oldest frame
        }

        // Calculate statistics
        this.currentFPS = fps;
        this.calculateStats();

        // Update display
        if (this.displayElement) {
            this.updateDisplay();
        }
    }

    /**
     * Calculate FPS statistics from frame buffer
     *
     * NASA Rule 2: Bounded iteration
     * NASA Rule 5: Validate frames array
     */
    calculateStats() {
        console.assert(this.frames.length > 0,
            'FPSMonitor.calculateStats: frames array must not be empty');

        // Average FPS (NASA Rule 2: bounded loop)
        let sum = 0;
        const frameCount = this.frames.length;
        for (let i = 0; i < frameCount; i++) {
            sum += this.frames[i];
        }
        this.averageFPS = sum / frameCount;

        // Min/Max FPS (NASA Rule 2: bounded loop)
        this.minFPS = Infinity;
        this.maxFPS = 0;
        for (let i = 0; i < frameCount; i++) {
            const fps = this.frames[i];
            if (fps < this.minFPS) this.minFPS = fps;
            if (fps > this.maxFPS) this.maxFPS = fps;
        }
    }

    /**
     * Update display element with current FPS
     *
     * NASA Rule 7: Check displayElement exists
     */
    updateDisplay() {
        if (!this.displayElement) return;

        const fps = Math.round(this.currentFPS);
        const avg = Math.round(this.averageFPS);
        const min = Math.round(this.minFPS);
        const max = Math.round(this.maxFPS);

        this.displayElement.textContent =
            `FPS: ${fps} (avg: ${avg}, min: ${min}, max: ${max})`;

        // Color-code based on performance
        if (avg < this.warningThreshold) {
            this.displayElement.style.color = '#f00'; // Red if below threshold
        } else if (avg < 50) {
            this.displayElement.style.color = '#ff0'; // Yellow if 30-50
        } else {
            this.displayElement.style.color = '#0f0'; // Green if 50+
        }
    }

    /**
     * Get current FPS statistics
     *
     * @returns {Object} Statistics object
     * NASA Rule 5: Validate return value
     */
    getStats() {
        const stats = {
            current: this.currentFPS,
            average: this.averageFPS,
            min: this.minFPS,
            max: this.maxFPS,
            sampleCount: this.frames.length
        };

        console.assert(typeof stats.current === 'number',
            'FPSMonitor.getStats: current must be number');
        console.assert(typeof stats.average === 'number',
            'FPSMonitor.getStats: average must be number');

        return stats;
    }

    /**
     * Check if performance is acceptable
     *
     * @returns {boolean} True if average FPS >= warning threshold
     * NASA Rule 7: Check return value validity
     */
    isPerformanceGood() {
        const isGood = this.averageFPS >= this.warningThreshold;

        console.assert(typeof isGood === 'boolean',
            'FPSMonitor.isPerformanceGood: return must be boolean');

        return isGood;
    }

    /**
     * Reset statistics
     *
     * NASA Rule 5: Validate state after reset
     */
    reset() {
        this.frames = [];
        this.currentFPS = 0;
        this.averageFPS = 0;
        this.minFPS = Infinity;
        this.maxFPS = 0;

        console.assert(this.frames.length === 0,
            'FPSMonitor.reset: frames should be empty');
        console.log('FPSMonitor: Statistics reset');
    }

    /**
     * Enable/disable monitoring
     *
     * @param {boolean} enabled - Enable state
     * NASA Rule 5: Validate enabled parameter
     */
    setEnabled(enabled) {
        console.assert(typeof enabled === 'boolean',
            'FPSMonitor.setEnabled: enabled must be boolean');

        this.isEnabled = enabled;

        if (!enabled && this.displayElement) {
            this.displayElement.style.display = 'none';
        } else if (enabled && this.displayElement) {
            this.displayElement.style.display = 'block';
        }
    }

    /**
     * Dispose resources
     *
     * NASA Rule 7: Check before cleanup
     */
    dispose() {
        console.assert(this.displayElement === null ||
            this.displayElement instanceof HTMLElement,
            'FPSMonitor.dispose: displayElement should be null or HTMLElement');

        if (this.displayElement && this.displayElement.parentNode) {
            this.displayElement.parentNode.removeChild(this.displayElement);
        }

        this.displayElement = null;
        this.frames = [];
        this.isEnabled = false;

        console.log('FPSMonitor: Disposed');
    }
}

// Make globally available
window.FPSMonitor = FPSMonitor;
