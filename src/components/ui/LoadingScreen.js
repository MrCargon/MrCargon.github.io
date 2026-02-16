// LoadingScreen.js
class LoadingScreen {
    constructor() {
        // DOM element references
        this.loadingScreen = document.getElementById('loading-screen');
        this.progressBar = document.getElementById('loading-progress');
        this.loadingText = document.getElementById('loading-text');

        // Check for reduced motion preference
        this.animated = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Listen for changes in motion preference
        this.motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.motionChangeHandler = (e) => {
            this.animated = !e.matches;
        };
        this.motionMediaQuery.addEventListener('change', this.motionChangeHandler);

        // Loading phases for detailed progress tracking
        this.phases = {
            components: { weight: 20, complete: false, label: 'Loading components...' },
            threeJS: { weight: 15, complete: false, label: 'Initializing 3D engine...' },
            scene: { weight: 25, complete: false, label: 'Creating solar system...' },
            textures: { weight: 30, complete: false, label: 'Loading planet textures...' },
            finalize: { weight: 10, complete: false, label: 'Finalizing...' }
        };

        // Memory tracking for debugging/monitoring
        this.memoryMetrics = {
            startHeap: null,
            peakHeap: null,
            texturesLoaded: 0,
            geometriesCreated: 0
        };

        // Store retry handler reference for proper cleanup (created once)
        this._retryClickHandler = () => window.location.reload();

        // Initialize loading screen if it exists
        this.initialize();
    }
    
    /**
     * Initialize loading screen with appropriate ARIA attributes
     */
    initialize() {
        if (!this.loadingScreen) {
            console.warn('Loading screen element not found');
            return;
        }
        
        // Set initial ARIA attributes for accessibility
        this.loadingScreen.setAttribute('aria-busy', 'true');
        
        // Remove redundant role attributes as we already have a progress bar
        // with appropriate roles for screen readers
        if (this.progressBar) {
            this.progressBar.setAttribute('aria-valuemin', '0');
            this.progressBar.setAttribute('aria-valuemax', '100');
            this.progressBar.setAttribute('aria-valuenow', '0');
        }
    }
    
    /**
     * Show the loading screen
     */
    show() {
        if (!this.loadingScreen) return;
        
        // Clear any previous error states
        this.clearError();
        
        // Display the loading screen
        this.loadingScreen.style.display = 'flex';
        this.loadingScreen.classList.remove('fade-out');
        
        // Set appropriate ARIA attributes
        this.loadingScreen.setAttribute('aria-busy', 'true');
        this.loadingScreen.setAttribute('aria-hidden', 'false');
        
        // Reset progress
        this.updateProgress(0);
    }
    
    /**
     * Hide the loading screen with appropriate transition
     */
    hide() {
        if (!this.loadingScreen) return;
        
        // Update ARIA attributes
        this.loadingScreen.setAttribute('aria-busy', 'false');
        
        if (this.animated) {
            // Use animation for standard preferences
            this.loadingScreen.classList.add('fade-out');
            
            // Use requestAnimationFrame for better performance
            requestAnimationFrame(() => {
                setTimeout(() => {
                    this.loadingScreen.style.display = 'none';
                    this.loadingScreen.setAttribute('aria-hidden', 'true');
                    // Reset for next use
                    this.loadingScreen.classList.remove('fade-out');
                }, 500); // Match CSS transition duration
            });
        } else {
            // Immediate hide for reduced motion preference
            this.loadingScreen.style.display = 'none';
            this.loadingScreen.setAttribute('aria-hidden', 'true');
        }
    }
    
    /**
     * Update the loading progress
     * @param {number} progress - Progress value (0-100)
     * @param {string|null} message - Optional status message
     */
    updateProgress(progress, message = null) {
        if (!this.loadingScreen) return;
        
        // Ensure progress is between 0-100
        const safeProgress = Math.max(0, Math.min(100, progress));
        
        // Update visual progress using requestAnimationFrame for better performance
        requestAnimationFrame(() => {
            // Update progress bar
            if (this.progressBar) {
                // Use transform for better performance than width
                this.progressBar.style.transform = `scaleX(${safeProgress / 100})`;
                this.progressBar.style.transformOrigin = 'left';
                this.progressBar.setAttribute('aria-valuenow', safeProgress);
            }
            
            // Update message if provided
            if (message && this.loadingText) {
                this.loadingText.textContent = message;
            }
        });
    }
    
    /**
     * Display an error message and retry button
     * @param {string} message - Error message to display
     */
    setError(message) {
        if (!this.loadingScreen || !this.loadingText) return;

        // Clear any previous error UI
        this.clearError();

        // Update text and styling
        this.loadingText.textContent = message || 'An error occurred while loading';
        this.loadingText.classList.add('error');

        // Update ARIA roles for accessibility
        this.loadingScreen.setAttribute('role', 'alert');
        this.loadingScreen.setAttribute('aria-live', 'assertive');

        // Add retry button if it doesn't exist
        if (!document.querySelector('.retry-button')) {
            const retryButton = document.createElement('button');
            retryButton.textContent = 'Retry';
            retryButton.classList.add('retry-button');
            retryButton.setAttribute('aria-label', 'Retry loading the page');

            // Add click event listener
            retryButton.addEventListener('click', this._retryClickHandler);

            // Append to loading screen
            this.loadingScreen.appendChild(retryButton);
        }
    }
    
    /**
     * Clear error state and UI elements
     */
    clearError() {
        if (!this.loadingScreen || !this.loadingText) return;

        // Reset text styling
        this.loadingText.classList.remove('error');

        // Reset ARIA roles
        this.loadingScreen.removeAttribute('role');
        this.loadingScreen.setAttribute('aria-live', 'polite');

        // Remove retry button if it exists
        const retryButton = document.querySelector('.retry-button');
        if (retryButton) {
            retryButton.removeEventListener('click', this._retryClickHandler);
            retryButton.remove();
        }
    }
    
    /**
     * Mark a loading phase as complete and update progress
     * @param {string} phaseName - Name of the phase (components, threeJS, scene, textures, finalize)
     */
    completePhase(phaseName) {
        if (!this.phases[phaseName]) {
            console.warn(`Unknown loading phase: ${phaseName}`);
            return;
        }

        this.phases[phaseName].complete = true;
        this.updatePhaseProgress();
    }

    /**
     * Calculate and update progress based on completed phases
     */
    updatePhaseProgress() {
        let totalProgress = 0;

        Object.values(this.phases).forEach(phase => {
            if (phase.complete) {
                totalProgress += phase.weight;
            }
        });

        // Find current phase for message
        let currentPhase = null;
        for (const [name, phase] of Object.entries(this.phases)) {
            if (!phase.complete) {
                currentPhase = phase;
                break;
            }
        }

        const message = currentPhase?.label || 'Complete!';
        this.updateProgress(totalProgress, message);
    }

    /**
     * Start memory tracking at the beginning of load
     */
    startMemoryTracking() {
        if (performance.memory) {
            this.memoryMetrics.startHeap = performance.memory.usedJSHeapSize;
            this.memoryMetrics.peakHeap = this.memoryMetrics.startHeap;
        }
    }

    /**
     * Update memory metrics (call periodically during loading)
     */
    updateMemoryMetrics() {
        if (performance.memory) {
            const currentHeap = performance.memory.usedJSHeapSize;
            if (currentHeap > this.memoryMetrics.peakHeap) {
                this.memoryMetrics.peakHeap = currentHeap;
            }
        }
    }

    /**
     * Track texture loading for memory monitoring
     */
    trackTextureLoaded() {
        this.memoryMetrics.texturesLoaded++;
        this.updateMemoryMetrics();
    }

    /**
     * Track geometry creation for memory monitoring
     */
    trackGeometryCreated() {
        this.memoryMetrics.geometriesCreated++;
        this.updateMemoryMetrics();
    }

    /**
     * Get memory report for debugging
     * @returns {Object} Memory usage statistics
     */
    getMemoryReport() {
        const report = {
            startHeapMB: this.memoryMetrics.startHeap ?
                (this.memoryMetrics.startHeap / 1024 / 1024).toFixed(2) : 'N/A',
            peakHeapMB: this.memoryMetrics.peakHeap ?
                (this.memoryMetrics.peakHeap / 1024 / 1024).toFixed(2) : 'N/A',
            heapGrowthMB: (this.memoryMetrics.startHeap && this.memoryMetrics.peakHeap) ?
                ((this.memoryMetrics.peakHeap - this.memoryMetrics.startHeap) / 1024 / 1024).toFixed(2) : 'N/A',
            texturesLoaded: this.memoryMetrics.texturesLoaded,
            geometriesCreated: this.memoryMetrics.geometriesCreated
        };

        console.log('📊 Memory Report:', report);
        return report;
    }

    /**
     * Reset phases for new loading session
     */
    resetPhases() {
        Object.values(this.phases).forEach(phase => {
            phase.complete = false;
        });
        this.memoryMetrics = {
            startHeap: null,
            peakHeap: null,
            texturesLoaded: 0,
            geometriesCreated: 0
        };
    }

    /**
     * Clean up resources when the loading screen is no longer needed
     */
    destroy() {
        // Clean up any existing retry buttons first
        this.clearError();

        // Remove event listeners
        if (this.motionMediaQuery) {
            this.motionMediaQuery.removeEventListener('change', this.motionChangeHandler);
        }
    }
}

// Make globally available
window.LoadingScreen = LoadingScreen;