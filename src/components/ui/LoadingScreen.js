// LoadingScreen.js - Enhanced with accessibility and animation performance
class LoadingScreen {
    constructor() {
        this.loadingScreen = document.getElementById('loading-screen');
        this.progressBar = document.getElementById('loading-progress');
        this.loadingText = document.getElementById('loading-text');
        this.animated = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        // Set initial ARIA attributes for accessibility
        if (this.loadingScreen) {
            this.loadingScreen.setAttribute('role', 'progressbar');
            this.loadingScreen.setAttribute('aria-valuemin', '0');
            this.loadingScreen.setAttribute('aria-valuemax', '100');
            this.loadingScreen.setAttribute('aria-valuenow', '0');
        }
    }

    show() {
        if (!this.loadingScreen) return;
        
        this.loadingScreen.style.display = 'flex';
        this.loadingScreen.classList.remove('fade-out');
        
        // Reset progress
        this.updateProgress(0);
    }

    hide() {
        if (!this.loadingScreen) return;
        
        if (this.animated) {
            this.loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                this.loadingScreen.style.display = 'none';
                // Reset for next use
                this.loadingScreen.classList.remove('fade-out');
            }, 500);
        } else {
            // Immediate hide for reduced motion preference
            this.loadingScreen.style.display = 'none';
        }
    }

    updateProgress(progress, message = null) {
        if (!this.loadingScreen) return;
        
        // Ensure progress is between 0-100
        const safeProgress = Math.max(0, Math.min(100, progress));
        
        // Update ARIA value
        this.loadingScreen.setAttribute('aria-valuenow', safeProgress);
        
        // Update visual progress
        if (this.progressBar) {
            // Use transform for better performance than width
            this.progressBar.style.transform = `scaleX(${safeProgress / 100})`;
            this.progressBar.style.transformOrigin = 'left';
        }
        
        // Update message if provided
        if (message && this.loadingText) {
            this.loadingText.textContent = message;
        }
    }

    setError(message) {
        if (!this.loadingText) return;
        
        this.loadingText.textContent = message;
        this.loadingText.classList.add('error');
        
        // Update ARIA roles for accessibility
        this.loadingScreen.setAttribute('role', 'alert');
        this.loadingScreen.setAttribute('aria-live', 'assertive');
        
        // Add retry button
        const retryButton = document.createElement('button');
        retryButton.textContent = 'Retry';
        retryButton.classList.add('retry-button');
        retryButton.addEventListener('click', () => window.location.reload());
        
        this.loadingScreen.appendChild(retryButton);
    }
}

// Make globally available
window.LoadingScreen = LoadingScreen;