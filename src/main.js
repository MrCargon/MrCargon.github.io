/**
 * ComponentLoader - Handles dynamic loading of HTML components
 * Optimized for GitHub Pages deployment with better error handling and performance
 */
class ComponentLoader {
    // Initialize static cache
    static componentCache = new Map();
    
    /**
     * Load a component HTML into a container element
     * @param {string} url - URL of the component HTML file
     * @param {string} containerId - ID of the container element
     * @param {number} retries - Number of retry attempts (default: 3)
     * @returns {Promise<boolean>} - Whether loading was successful
     */
    static async loadComponent(url, containerId, retries = 3) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container with ID "${containerId}" not found`);
            return false;
        }
        
        // Check for cached component
        const cachedComponent = this.componentCache.get(url);
        if (cachedComponent) {
            container.innerHTML = cachedComponent;
            this.initializeComponent(containerId);
            return true;
        }
        
        let attempt = 0;
        const backoffFactor = 1.5; // Exponential backoff multiplier

        while (attempt < retries) {
            try {
                // Show loading state
                container.classList.add('component-loading');
                
                const response = await fetch(url, {
                    cache: 'no-cache', // Ensure fresh content during development
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const html = await response.text();
                
                // Cache the component
                this.componentCache.set(url, html);
                
                // Safely insert the HTML
                container.innerHTML = html;
                
                // Initialize any component-specific functionality
                this.initializeComponent(containerId);
                
                // Remove loading state
                container.classList.remove('component-loading');
                
                return true;
            } catch (error) {
                console.error(`Attempt ${attempt + 1} failed for ${url}:`, error);
                attempt++;
                
                // Show error message after all retries fail
                if (attempt === retries) {
                    container.innerHTML = `
                        <div class="error-container">
                            <p>Failed to load content. <button class="retry-button" data-url="${url}" data-container="${containerId}">Retry</button></p>
                        </div>
                    `;
                    
                    // Set up retry button event handler
                    const retryButton = container.querySelector('.retry-button');
                    if (retryButton) {
                        retryButton.addEventListener('click', this.handleRetry.bind(this));
                    }
                    
                    return false;
                }
                
                // Exponential backoff for retries
                await new Promise(resolve => setTimeout(resolve, 
                    500 * Math.pow(backoffFactor, attempt)));
            }
        }
    }

    /**
     * Handle retry button click
     * @param {Event} event - Click event
     */
    static handleRetry(event) {
        const button = event.currentTarget;
        const url = button.dataset.url;
        const containerId = button.dataset.container;
        
        if (url && containerId) {
            // Remove the error container
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = '<div class="loading-indicator">Retrying...</div>';
            }
            
            // Try loading the component again
            this.loadComponent(url, containerId).catch(error => {
                console.error('Retry failed:', error);
            });
        }
    }

    /**
     * Initialize component-specific functionality based on the container ID
     * @param {string} containerId - ID of the component container
     */
    static initializeComponent(containerId) {
        // Handle specific component initializations
        switch(containerId) {
            case 'header-container':
                this.initializeHeader();
                break;
            case 'page-container':
                // Specific initialization for the page container if needed
                break;
            case 'footer-container':
                // Specific initialization for the footer if needed
                break;
        }
        
        // Dispatch event for performance monitoring
        window.dispatchEvent(new CustomEvent('component:loaded', { 
            detail: { 
                component: containerId,
                loadTime: performance.now()
            } 
        }));
    }

    /**
     * Update loading progress indicator
     * @param {number} progress - Progress percentage (0-100)
     */
    static updateLoadingProgress(progress) {
        const loadingScreen = window.loadingScreen;
        if (loadingScreen?.updateProgress) {
            loadingScreen.updateProgress(progress);
        } else {
            // Fallback if loadingScreen instance isn't available
            const progressBar = document.getElementById('loading-progress');
            if (progressBar) {
                progressBar.style.transform = `scaleX(${progress / 100})`;
                progressBar.style.transformOrigin = 'left';
            }
        }
    }
    
    /**
     * Initialize header-specific functionality
     * This centralizes header logic that was previously scattered
     */
    static initializeHeader() {
        // Apply active state to current page in navigation
        const currentPage = window.location.hash.substring(1) || 'about';
        const navLinks = document.querySelectorAll('.main-nav a');
        
        navLinks.forEach(link => {
            const pageName = link.getAttribute('href')?.substring(1);
            const isActive = pageName === currentPage;
            
            // Skip disabled links
            if (link.classList.contains('disabled')) return;
            
            // Set active state
            link.classList.toggle('active', isActive);
            link.setAttribute('aria-current', isActive ? 'page' : 'false');
            
            // Add accessibility improvements
            if (link.classList.contains('disabled')) {
                link.setAttribute('aria-disabled', 'true');
                link.tabIndex = -1;
            }
        });
    }
}

/**
 * Initialize application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    // Performance timer start
    const startTime = performance.now();
    
    // Create loading screen instance
    window.loadingScreen = new LoadingScreen();
    
    // Define components to load
    const components = [
        { url: 'src/components/header/header.html', id: 'header-container' },
        { url: 'src/components/pages/mainPage.html', id: 'page-container' },
        { url: 'src/components/footer/footer.html', id: 'footer-container' }
    ];
    
    let loadedCount = 0;
    
    // Load components with progress tracking
    Promise.all(
        components.map(comp => 
            ComponentLoader.loadComponent(comp.url, comp.id)
                .then(success => {
                    loadedCount++;
                    const progress = (loadedCount / components.length) * 100;
                    ComponentLoader.updateLoadingProgress(progress);
                    return success;
                })
        )
    ).then(results => {
        // Record components loaded time
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            window.perf = window.perf || {};
            window.perf.componentsLoaded = performance.now() - startTime;
        }
        
        // Check if all components loaded successfully
        const allLoaded = results.every(result => result === true);
        
        if (allLoaded) {
            // Initialize PageManager after components are loaded
            window.pageManager = new PageManager();
            
            // Hide loading screen with smooth transition
            setTimeout(() => {
                window.loadingScreen?.hide();
                document.getElementById('content')?.classList.remove('hidden');
            }, 300);
        } else {
            throw new Error('Some components failed to load');
        }
    }).catch(error => {
        console.error('Failed to initialize application:', error);
        window.loadingScreen?.setError('Failed to load application. Please refresh or try again later.');
    });
});

/**
 * Add performance monitoring in development mode
 */
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    // Initialize performance object
    window.perf = {
        domLoaded: 0,
        componentsLoaded: 0,
        pageReady: 0
    };
    
    document.addEventListener('DOMContentLoaded', () => {
        window.perf.domLoaded = performance.now();
    });
    
    window.addEventListener('load', () => {
        window.perf.pageReady = performance.now();
        
        console.log(`Performance metrics:
            - DOM Content Loaded: ${window.perf.domLoaded.toFixed(2)}ms
            - Components Loaded: ${window.perf.componentsLoaded?.toFixed(2) || 'N/A'}ms
            - Page Fully Loaded: ${window.perf.pageReady.toFixed(2)}ms
            - Total Load Time: ${(window.perf.pageReady - performance.timing.navigationStart).toFixed(2)}ms
        `);
    });
}

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            pageLoads: {},
            componentLoads: {},
            renderTimes: []
        };
        
        this.isActive = location.hostname === 'localhost' || 
                        location.hostname === '127.0.0.1' ||
                        location.search.includes('debug=true');
        
        // Only monitor in development or with debug flag
        if (this.isActive) {
            this.setupMonitoring();
        }
    }
    
    setupMonitoring() {
        // Set navigationStartTime for page load tracking
        window.navigationStartTime = performance.now();
        
        // Monitor page navigation
        window.addEventListener('pagemanager:navigation:complete', e => {
            this.recordPageLoad(e.detail.page);
        });
        
        // Monitor component loads
        window.addEventListener('component:loaded', e => {
            this.recordComponentLoad(e.detail.component, e.detail.loadTime);
        });
        
        // Setup FPS monitoring for 3D content
        this.setupFpsMonitoring();
        
        console.log('Performance monitoring active');
    }
    
    recordPageLoad(pageName) {
        if (!this.isActive) return;
        
        const loadTime = performance.now() - (window.navigationStartTime || 0);
        
        if (!this.metrics.pageLoads[pageName]) {
            this.metrics.pageLoads[pageName] = [];
        }
        
        this.metrics.pageLoads[pageName].push(loadTime);
        
        console.log(`Page ${pageName} loaded in ${loadTime.toFixed(2)}ms`);
    }
    
    // Missing method implementation - Add this!
    recordComponentLoad(componentName, loadTime) {
        if (!this.isActive) return;
        
        if (!this.metrics.componentLoads[componentName]) {
            this.metrics.componentLoads[componentName] = [];
        }
        
        this.metrics.componentLoads[componentName].push(loadTime);
        
        // Only log if significant
        if (loadTime > 500) {
            console.debug(`Component ${componentName} loaded in ${loadTime.toFixed(2)}ms`);
        }
    }
    
    setupFpsMonitoring() {
        // Skip if we're not in an environment with requestAnimationFrame
        if (typeof requestAnimationFrame !== 'function') return;
        
        this.fpsHistory = [];
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        
        // Check if we have a solar system environment to monitor
        const checkForEnvironment = () => {
            if (window.spaceEnvironment?.initialized) {
                // We found an active environment, start monitoring
                this.startFpsMonitoring();
            } else {
                // Check again later
                setTimeout(checkForEnvironment, 1000);
            }
        };
        
        checkForEnvironment();
    }
    
    startFpsMonitoring() {
        // Create a monitoring loop
        const monitorFrame = () => {
            this.frameCount++;
            const now = performance.now();
            const elapsed = now - this.lastFrameTime;
            
            // Calculate FPS every second
            if (elapsed >= 1000) {
                const fps = Math.round((this.frameCount * 1000) / elapsed);
                
                // Store in history (keep last 60 readings - 1 minute)
                this.fpsHistory.push(fps);
                if (this.fpsHistory.length > 60) {
                    this.fpsHistory.shift();
                }
                
                // Reset counters
                this.frameCount = 0;
                this.lastFrameTime = now;
                
                // Log if significant change or every 10 seconds
                if (this.fpsHistory.length % 10 === 0 || 
                    (this.fpsHistory.length > 1 && 
                     Math.abs(fps - this.fpsHistory[this.fpsHistory.length - 2]) > 5)) {
                    console.debug(`Current FPS: ${fps}`);
                }
                
                // Dispatch event for other parts of the app
                window.dispatchEvent(new CustomEvent('fps-update', { detail: { fps } }));
            }
            
            // Continue monitoring if still active
            if (this.isActive && window.spaceEnvironment?.initialized) {
                requestAnimationFrame(monitorFrame);
            }
        };
        
        // Start the monitoring loop
        requestAnimationFrame(monitorFrame);
    }

    // Add missing methods referenced in getReport()
    calculateAverageLoadTimes() {
        const result = {};
        
        Object.entries(this.metrics.pageLoads).forEach(([page, times]) => {
            if (times.length === 0) return;
            
            const sum = times.reduce((acc, time) => acc + time, 0);
            result[page] = sum / times.length;
        });
        
        return result;
    }
    
    identifySlowestComponents() {
        const components = [];
        
        Object.entries(this.metrics.componentLoads).forEach(([component, times]) => {
            if (times.length === 0) return;
            
            const sum = times.reduce((acc, time) => acc + time, 0);
            const average = sum / times.length;
            
            components.push({
                name: component,
                averageLoadTime: average,
                maxLoadTime: Math.max(...times)
            });
        });
        
        // Sort from slowest to fastest
        return components.sort((a, b) => b.averageLoadTime - a.averageLoadTime);
    }
    
    calculateFpsStats() {
        if (!this.fpsHistory || this.fpsHistory.length === 0) {
            return { average: 0, min: 0, max: 0, stable: true };
        }
        
        const sum = this.fpsHistory.reduce((acc, fps) => acc + fps, 0);
        const average = sum / this.fpsHistory.length;
        const min = Math.min(...this.fpsHistory);
        const max = Math.max(...this.fpsHistory);
        
        // Calculate stability - less than 10% variation is considered stable
        const stable = (max - min) / average < 0.1;
        
        return { average, min, max, stable };
    }
    
    generateRecommendations() {
        const recommendations = [];
        const fpsStats = this.calculateFpsStats();
        
        // Check for FPS issues
        if (fpsStats.average < 30) {
            recommendations.push({
                severity: 'high',
                issue: 'Low frame rate',
                suggestion: 'Consider reducing scene complexity, implement level-of-detail, or optimize render loop.'
            });
        }
        
        // Check for slow components
        const slowComponents = this.identifySlowestComponents().filter(c => c.averageLoadTime > 500);
        if (slowComponents.length > 0) {
            recommendations.push({
                severity: 'medium',
                issue: `Slow component loading: ${slowComponents.map(c => c.name).join(', ')}`,
                suggestion: 'Consider code splitting, lazy loading, or optimizing component initialization.'
            });
        }
        
        return recommendations;
    }

    getReport() {
        if (!this.isActive) return null;
        
        // Generate comprehensive performance report
        return {
            averagePageLoadTimes: this.calculateAverageLoadTimes(),
            slowestComponents: this.identifySlowestComponents(),
            fpsStats: this.calculateFpsStats(),
            recommendations: this.generateRecommendations()
        };
    }
}

// Initialize performance monitoring
window.perfMonitor = new PerformanceMonitor();