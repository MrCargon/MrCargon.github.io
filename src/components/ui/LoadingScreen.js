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
            retryButton.addEventListener('click', () => window.location.reload());
            
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
            retryButton.removeEventListener('click', () => window.location.reload());
            retryButton.remove();
        }
    }
    
    /**
     * Clean up resources when the loading screen is no longer needed
     */
    destroy() {
        // Remove event listeners
        if (this.motionMediaQuery) {
            this.motionMediaQuery.removeEventListener('change', this.motionChangeHandler);
        }
    }
}

// Make globally available
window.LoadingScreen = LoadingScreen;