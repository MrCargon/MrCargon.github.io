/**
 * ComponentLoader - Handles dynamic loading of HTML components
 * Optimized for GitHub Pages deployment with better error handling and performance
 * @version 1.2.0
 */
class ComponentLoader {
    /**
     * Load a component HTML into a container element
     * @param {string} url - URL of the component HTML file
     * @param {string} containerId - ID of the container element
     * @param {number} retries - Number of retry attempts (default: 3)
     * @returns {Promise<boolean>} - Whether loading was successful
     * @public
     */
    static async loadComponent(url, containerId, retries = 3) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container with ID "${containerId}" not found`);
            return false;
        }
        
        // Show loading indicator in container
        ComponentLoader.showLoadingIndicator(container);
        
        let attempt = 0;
        let lastError = null;

        while (attempt < retries) {
            try {
                const response = await fetch(url, {
                    cache: 'force-cache', // Use cached response if available
                    headers: { 'X-Requested-With': 'XMLHttpRequest' } // For better server recognition
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const html = await response.text();
                
                // Set the content with proper error handling
                try {
                    container.innerHTML = html;
                    
                    // Initialize any component-specific functionality
                    if (containerId === 'header-container') {
                        ComponentLoader.initializeHeader();
                    }
                    
                    return true;
                } catch (innerError) {
                    console.error(`Error setting HTML for ${containerId}:`, innerError);
                    throw innerError;
                }
            } catch (error) {
                console.warn(`Attempt ${attempt + 1} failed for ${url}:`, error);
                lastError = error;
                attempt++;
                
                // Show retry progress
                ComponentLoader.updateLoadingIndicator(container, `Retry ${attempt}/${retries}`);
                
                // Exponential backoff for retries with jitter to prevent thundering herd
                const baseDelay = 500 * Math.pow(2, attempt);
                const jitter = Math.random() * 300;
                await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
            }
        }
        
        // All retries failed
        console.error(`All ${retries} attempts failed for ${url}:`, lastError);
        
        // Show error message after all retries fail
        container.innerHTML = `
            <div class="error-container">
                <p>Failed to load content. <button onclick="ComponentLoader.loadComponent('${url}', '${containerId}')">Retry</button></p>
                <p class="error-details">${lastError?.message || 'Unknown error'}</p>
            </div>
        `;
        
        return false;
    }
    
    /**
     * Show loading indicator in container
     * @param {HTMLElement} container - Container element
     * @private
     */
    static showLoadingIndicator(container) {
        container.innerHTML = `
            <div class="component-loading">
                <div class="loading-spinner"></div>
            </div>
        `;
    }
    
    /**
     * Update loading indicator with status message
     * @param {HTMLElement} container - Container element
     * @param {string} message - Status message
     * @private
     */
    static updateLoadingIndicator(container, message) {
        const loadingElement = container.querySelector('.component-loading');
        if (loadingElement) {
            loadingElement.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-message">${message}</div>
            `;
        }
    }

    /**
     * Update loading progress indicator
     * @param {number} progress - Progress percentage (0-100)
     * @public
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
     * @private
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
    
    /**
     * Preload components to improve perceived performance
     * @param {Array<{url: string, priority: string}>} components - Components to preload
     * @public
     */
    static preloadComponents(components) {
        if (!window.requestIdleCallback) {
            // Fallback for browsers without requestIdleCallback
            setTimeout(() => this._preloadComponentsBatch(components), 1000);
            return;
        }
        
        // Use idle time to preload components
        window.requestIdleCallback(
            (deadline) => {
                this._preloadComponentsWithDeadline(components, deadline);
            },
            { timeout: 2000 }
        );
    }
    
    /**
     * Internal method to preload components with deadline
     * @param {Array<{url: string, priority: string}>} components - Components to preload
     * @param {IdleDeadline} deadline - Idle deadline object
     * @private
     */
    static _preloadComponentsWithDeadline(components, deadline) {
        let index = 0;
        
        const processNextComponent = () => {
            // Stop if we've processed all components
            if (index >= components.length) return;
            
            // Check if we still have time remaining in this idle period
            if (deadline.timeRemaining() > 0 || deadline.didTimeout) {
                const component = components[index++];
                
                // Create link preload hint for high priority items
                if (component.priority === 'high') {
                    const linkElement = document.createElement('link');
                    linkElement.rel = 'preload';
                    linkElement.href = component.url;
                    linkElement.as = 'fetch';
                    document.head.appendChild(linkElement);
                } else {
                    // For lower priority, just prime the browser cache
                    fetch(component.url, {
                        method: 'GET',
                        cache: 'force-cache',
                        priority: 'low',
                        mode: 'cors',
                        credentials: 'same-origin'
                    }).catch(() => {}); // Ignore errors for preloading
                }
                
                // Process next component if we still have time
                if (deadline.timeRemaining() > 0 || deadline.didTimeout) {
                    processNextComponent();
                } else {
                    // Schedule the rest for the next idle time
                    window.requestIdleCallback(
                        newDeadline => this._preloadComponentsWithDeadline(
                            components.slice(index),
                            newDeadline
                        )
                    );
                }
            } else {
                // Schedule the rest for the next idle time
                window.requestIdleCallback(
                    newDeadline => this._preloadComponentsWithDeadline(
                        components.slice(index),
                        newDeadline
                    )
                );
            }
        };
        
        processNextComponent();
    }
    
    /**
     * Internal method to preload components in batches
     * (Fallback for browsers without requestIdleCallback)
     * @param {Array<{url: string, priority: string}>} components - Components to preload
     * @private
     */
    static _preloadComponentsBatch(components) {
        const batchSize = 2; // Process 2 components at a time
        const totalBatches = Math.ceil(components.length / batchSize);
        
        const processBatch = (batchIndex) => {
            if (batchIndex >= totalBatches) return;
            
            const start = batchIndex * batchSize;
            const end = Math.min(start + batchSize, components.length);
            
            for (let i = start; i < end; i++) {
                fetch(components[i].url, {
                    method: 'GET',
                    cache: 'force-cache',
                    priority: 'low',
                    mode: 'cors',
                    credentials: 'same-origin'
                }).catch(() => {}); // Ignore errors for preloading
            }
            
            // Schedule next batch with delay
            setTimeout(() => processBatch(batchIndex + 1), 300);
        };
        
        processBatch(0);
    }
}

/**
 * LoadingScreen class to manage application loading state
 */
class LoadingScreen {
    /**
     * Create a new LoadingScreen instance
     */
    constructor() {
        this.loadingElement = document.getElementById('loading-screen');
        this.progressBar = document.getElementById('loading-progress');
        this.progressText = document.getElementById('loading-text');
        this.errorContainer = document.getElementById('loading-error');
        
        if (!this.loadingElement) {
            this._createLoadingScreen();
        }
    }
    
    /**
     * Create loading screen elements if they don't exist
     * @private
     */
    _createLoadingScreen() {
        // Create loading screen element
        this.loadingElement = document.createElement('div');
        this.loadingElement.id = 'loading-screen';
        this.loadingElement.className = 'loading-screen active';
        
        // Create inner content
        this.loadingElement.innerHTML = `
            <div class="loading-content">
                <div class="logo-container">
                    <span class="logo">MrCargo</span>
                </div>
                <div class="loading-indicator">
                    <div id="loading-progress" class="loading-progress"></div>
                </div>
                <div id="loading-text" class="loading-text">Loading...</div>
                <div id="loading-error" class="loading-error"></div>
            </div>
        `;
        
        // Get references to inner elements
        this.progressBar = this.loadingElement.querySelector('#loading-progress');
        this.progressText = this.loadingElement.querySelector('#loading-text');
        this.errorContainer = this.loadingElement.querySelector('#loading-error');
        
        // Add to document
        document.body.appendChild(this.loadingElement);
    }
    
    /**
     * Update loading progress
     * @param {number} progress - Progress percentage (0-100)
     * @public
     */
    updateProgress(progress) {
        if (!this.progressBar) return;
        
        // Ensure progress is between 0 and 100
        const clampedProgress = Math.max(0, Math.min(100, progress));
        
        // Apply transformation
        this.progressBar.style.transform = `scaleX(${clampedProgress / 100})`;
        
        // Update text if provided
        if (this.progressText) {
            this.progressText.textContent = `Loading... ${Math.round(clampedProgress)}%`;
        }
        
        // When complete, show "Preparing..." message
        if (clampedProgress >= 100 && this.progressText) {
            this.progressText.textContent = 'Preparing...';
        }
    }
    
    /**
     * Hide the loading screen
     * @public
     */
    hide() {
        if (!this.loadingElement) return;
        
        // Add class for transition
        this.loadingElement.classList.add('fade-out');
        
        // Remove from DOM after transition
        setTimeout(() => {
            this.loadingElement.remove();
        }, 500);
    }
    
    /**
     * Show an error message in the loading screen
     * @param {string} message - Error message to display
     * @public
     */
    setError(message) {
        if (!this.errorContainer) return;
        
        this.errorContainer.innerHTML = `
            <div class="error-message">${message}</div>
            <button class="retry-button" onclick="window.location.reload()">Reload</button>
        `;
        
        this.errorContainer.style.display = 'block';
        
        if (this.progressText) {
            this.progressText.style.display = 'none';
        }
        
        if (this.progressBar) {
            this.progressBar.style.backgroundColor = '#ff3c3c';
        }
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
    
    // Preload additional components
    ComponentLoader.preloadComponents([
        { url: 'src/components/pages/aboutPage.html', priority: 'high' },
        { url: 'src/components/pages/projectsPage.html', priority: 'low' },
        { url: 'src/components/pages/contactPage.html', priority: 'low' },
        { url: 'src/components/pages/storePage.html', priority: 'low' }
    ]);
    
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
                
                // Log initialization completion
                console.info('Application initialized successfully');
                
                // Register service worker if available
                if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
                    navigator.serviceWorker.register('/service-worker.js')
                        .then(reg => console.info('Service worker registered'))
                        .catch(err => console.warn('Service worker registration failed:', err));
                }
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
        pageReady: 0,
        memoryUsage: {}
    };
    
    document.addEventListener('DOMContentLoaded', () => {
        window.perf.domLoaded = performance.now();
    });
    
    window.addEventListener('load', () => {
        window.perf.pageReady = performance.now();
        
        // Get memory usage if available
        if (performance.memory) {
            window.perf.memoryUsage = {
                jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB',
                totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
                usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB'
            };
        }
        
        console.log(`Performance metrics:
            - DOM Content Loaded: ${window.perf.domLoaded.toFixed(2)}ms
            - Components Loaded: ${window.perf.componentsLoaded?.toFixed(2) || 'N/A'}ms
            - Page Fully Loaded: ${window.perf.pageReady.toFixed(2)}ms
            - Total Load Time: ${(window.perf.pageReady - performance.timing.navigationStart).toFixed(2)}ms
            - Memory Usage: ${JSON.stringify(window.perf.memoryUsage, null, 2)}
        `);
    });
}