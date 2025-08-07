/**
 * ComponentLoader - Optimized component loading system
 * Enhanced with better error handling, caching, and memory management
 * Version 2.3 - Production Ready
 */
class ComponentLoader {
    // Enhanced static cache with metadata
    static componentCache = new Map();
    static loadingPromises = new Map(); // Prevent duplicate loads
    static loadingState = new Set(); // Track currently loading components
    static retryAttempts = new Map(); // Track retry attempts
    static maxRetries = 3;
    
    /**
     * Load a component HTML into a container element with enhanced error handling
     * @param {string} url - URL of the component HTML file
     * @param {string} containerId - ID of the container element
     * @param {Object} options - Loading options
     * @returns {Promise<boolean>} - Whether loading was successful
     */
    static async loadComponent(url, containerId, options = {}) {
        const {
            retries = this.maxRetries,
            cache = true,
            timeout = 10000,
            priority = 'normal'
        } = options;

        // Validate inputs
        if (!url || !containerId) {
            console.error('❌ Invalid parameters for loadComponent');
            return false;
        }

        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`❌ Container "${containerId}" not found`);
            return false;
        }

        // Check if already loading to prevent duplicates
        const loadingKey = `${url}:${containerId}`;
        if (this.loadingPromises.has(loadingKey)) {
            console.log(`⏳ Already loading ${containerId}, waiting...`);
            return await this.loadingPromises.get(loadingKey);
        }

        // Create loading promise
        const loadingPromise = this._performLoad(url, containerId, {
            retries, cache, timeout, priority
        });
        
        this.loadingPromises.set(loadingKey, loadingPromise);
        
        try {
            const result = await loadingPromise;
            return result;
        } finally {
            // Clean up loading state
            this.loadingPromises.delete(loadingKey);
            this.loadingState.delete(containerId);
        }
    }

    /**
     * Internal method to perform the actual loading
     */
    static async _performLoad(url, containerId, options) {
        const { retries, cache, timeout, priority } = options;
        const container = document.getElementById(containerId);
        
        this.loadingState.add(containerId);

        // Check cache first
        if (cache && this.componentCache.has(url)) {
            const cachedData = this.componentCache.get(url);
            console.log(`📋 Using cached content for ${containerId}`);
            
            try {
                await this._insertContent(container, cachedData.content, containerId);
                this._updateCacheStats(url, 'hit');
                return true;
            } catch (error) {
                console.warn(`⚠️ Cache content invalid for ${url}, reloading...`);
                this.componentCache.delete(url);
            }
        }

        // Perform loading with retries
        let attempt = 0;
        let lastError;

        while (attempt < retries) {
            try {
                console.log(`📥 Loading ${containerId} (attempt ${attempt + 1}/${retries})`);
                
                // Show loading state
                this._showLoadingState(container, containerId, attempt);

                // Fetch with timeout and priority
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(url, {
                    signal: controller.signal,
                    cache: cache ? 'default' : 'no-cache',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Cache-Control': cache ? 'max-age=300' : 'no-cache'
                    }
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const content = await response.text();
                
                // Validate content
                if (!content || content.trim().length === 0) {
                    throw new Error('Empty response received');
                }

                // Cache the component with metadata
                if (cache) {
                    this.componentCache.set(url, {
                        content,
                        timestamp: Date.now(),
                        size: content.length,
                        hits: 0
                    });
                }

                // Insert content and initialize
                await this._insertContent(container, content, containerId);

                console.log(`✅ Successfully loaded ${containerId}`);
                this._updateCacheStats(url, 'miss');
                return true;

            } catch (error) {
                lastError = error;
                attempt++;
                
                console.warn(`⚠️ Attempt ${attempt} failed for ${containerId}:`, error.message);

                if (attempt < retries) {
                    // Exponential backoff with jitter
                    const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
                    await this._delay(delay);
                } else {
                    // Final attempt failed
                    console.error(`❌ All attempts failed for ${containerId}`, lastError);
                    await this._showErrorState(container, containerId, lastError, url);
                }
            }
        }

        return false;
    }

    /**
     * Insert content with proper error handling and initialization
     */
    static async _insertContent(container, content, containerId) {
        try {
            // Safely insert HTML
            container.innerHTML = content;

            // Initialize component functionality
            await this.initializeComponent(containerId);

            // Remove loading state
            container.classList.remove('component-loading', 'component-error');
            container.removeAttribute('aria-busy');

        } catch (error) {
            console.error(`❌ Failed to insert content for ${containerId}:`, error);
            throw error;
        }
    }

    /**
     * Show enhanced loading state
     */
    static _showLoadingState(container, containerId, attempt = 0) {
        container.classList.add('component-loading');
        container.setAttribute('aria-busy', 'true');
        
        const loadingMessage = attempt > 0 
            ? `Retrying ${containerId}... (${attempt + 1})`
            : `Loading ${containerId}...`;

        container.innerHTML = `
            <div class="loading-container" role="status" aria-live="polite">
                <div class="loading-spinner" aria-hidden="true"></div>
                <p>${loadingMessage}</p>
            </div>
        `;
    }

    /**
     * Show enhanced error state with retry functionality
     */
    static async _showErrorState(container, containerId, error, url) {
        container.classList.add('component-error');
        container.classList.remove('component-loading');
        container.removeAttribute('aria-busy');

        const retryCount = this.retryAttempts.get(url) || 0;
        
        container.innerHTML = `
            <div class="error-container" role="alert">
                <div class="error-icon" aria-hidden="true">⚠️</div>
                <h3>Failed to load ${containerId}</h3>
                <p class="error-message">${error.message}</p>
                <div class="error-actions">
                    <button class="retry-button" 
                            data-url="${url}" 
                            data-container="${containerId}"
                            aria-label="Retry loading ${containerId}">
                        🔄 Retry
                    </button>
                    <button class="fallback-button" 
                            data-container="${containerId}"
                            aria-label="Load fallback content">
                        📄 Load Fallback
                    </button>
                </div>
                <details class="error-details">
                    <summary>Technical Details</summary>
                    <pre>${error.stack || error.message}</pre>
                </details>
            </div>
        `;

        // Setup error action handlers
        this._setupErrorHandlers(container);
    }

    /**
     * Setup error handling buttons
     */
    static _setupErrorHandlers(container) {
        const retryButton = container.querySelector('.retry-button');
        const fallbackButton = container.querySelector('.fallback-button');

        if (retryButton) {
            retryButton.addEventListener('click', this.handleRetry.bind(this));
        }

        if (fallbackButton) {
            fallbackButton.addEventListener('click', this.handleFallback.bind(this));
        }
    }

    /**
     * Enhanced retry handler
     */
    static async handleRetry(event) {
        const button = event.currentTarget;
        const url = button.dataset.url;
        const containerId = button.dataset.container;
        
        if (!url || !containerId) return;

        // Update retry count
        const currentRetries = this.retryAttempts.get(url) || 0;
        this.retryAttempts.set(url, currentRetries + 1);

        // Disable button during retry
        button.disabled = true;
        button.textContent = '⏳ Retrying...';

        try {
            // Clear cache and retry
            this.componentCache.delete(url);
            const success = await this.loadComponent(url, containerId, { 
                retries: 2,
                cache: false 
            });

            if (success) {
                this.retryAttempts.delete(url);
            }
        } catch (error) {
            console.error('Retry failed:', error);
        } finally {
            button.disabled = false;
            button.textContent = '🔄 Retry';
        }
    }

    /**
     * Handle fallback content loading
     */
    static async handleFallback(event) {
        const button = event.currentTarget;
        const containerId = button.dataset.container;
        const container = document.getElementById(containerId);
        
        if (!container) return;

        const fallbackContent = this._getFallbackContent(containerId);
        
        try {
            await this._insertContent(container, fallbackContent, containerId);
            console.log(`📄 Loaded fallback content for ${containerId}`);
        } catch (error) {
            console.error('Fallback loading failed:', error);
        }
    }

    /**
     * Get fallback content for components
     */
    static _getFallbackContent(containerId) {
        const fallbacks = {
            'header-container': `
                <header class="fallback-header">
                    <nav class="main-nav">
                        <a href="#about">About</a>
                        <a href="#projects">Projects</a>
                        <a href="#contact">Contact</a>
                    </nav>
                </header>
            `,
            'page-container': `
                <div class="fallback-content">
                    <h2>Content Unavailable</h2>
                    <p>Unable to load page content. Please refresh the page.</p>
                </div>
            `,
            'footer-container': `
                <footer class="fallback-footer">
                    <p>&copy; 2025 Portfolio</p>
                </footer>
            `
        };

        return fallbacks[containerId] || `
            <div class="fallback-content">
                <p>Content temporarily unavailable</p>
            </div>
        `;
    }

    /**
     * Enhanced component initialization with error handling
     */
    static async initializeComponent(containerId) {
        try {
            console.log(`🔧 Initializing component: ${containerId}`);

            // Component-specific initialization
            switch(containerId) {
                case 'header-container':
                    await this.initializeHeader();
                    break;
                case 'page-container':
                    await this.initializePage();
                    break;
                case 'footer-container':
                    await this.initializeFooter();
                    break;
            }
            
            // Dispatch initialization event
            this._dispatchEvent('component:initialized', { 
                component: containerId,
                timestamp: Date.now(),
                loadTime: performance.now()
            });

        } catch (error) {
            console.error(`❌ Component initialization failed for ${containerId}:`, error);
            throw error;
        }
    }

    /**
     * Enhanced header initialization
     */
    static async initializeHeader() {
        console.log('📋 Initializing header component');
        
        try {
            // Set active navigation state
            this._updateNavigationState();
            
            // Initialize HeaderManager with retries
            await this._initializeHeaderManager();
            
            // Setup mobile menu if present
            this._setupMobileMenu();
            
        } catch (error) {
            console.error('❌ Header initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize page container
     */
    static async initializePage() {
        console.log('📄 Initializing page container');
        
        // Setup page-specific functionality
        this._setupPageInteractions();
        this._setupAccessibility();
    }

    /**
     * Initialize footer container
     */
    static async initializeFooter() {
        console.log('👣 Initializing footer container');
        
        // Setup footer functionality
        this._setupFooterLinks();
    }

    /**
     * Update navigation active state
     */
    static _updateNavigationState() {
        const currentPage = window.location.hash.substring(1) || 'about';
        const navLinks = document.querySelectorAll('.main-nav a, .nav-button');
        
        navLinks.forEach(link => {
            const pageName = link.getAttribute('href')?.substring(1);
            const isActive = pageName === currentPage;
            
            // Skip disabled links
            if (link.classList.contains('disabled')) {
                link.setAttribute('aria-disabled', 'true');
                link.tabIndex = -1;
                return;
            }
            
            // Set active state
            link.classList.toggle('active', isActive);
            link.setAttribute('aria-current', isActive ? 'page' : 'false');
        });
    }

    /**
     * Initialize HeaderManager with proper error handling and retry logic
     */
    static async _initializeHeaderManager() {
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                // Check if HeaderManager is available
                if (typeof HeaderManager === 'undefined') {
                    if (retryCount === 0) {
                        console.log('⏳ Waiting for HeaderManager...');
                    }
                    await this._delay(100 * (retryCount + 1));
                    retryCount++;
                    continue;
                }
                
                // Create HeaderManager instance
                if (!window.headerManager) {
                    window.headerManager = new HeaderManager();
                    console.log('✅ HeaderManager initialized successfully');
                } else {
                    // Reinitialize if it already exists
                    if (typeof window.headerManager.reinitialize === 'function') {
                        window.headerManager.reinitialize();
                        console.log('🔄 HeaderManager reinitialized');
                    }
                }
                return;
                
            } catch (error) {
                console.warn(`❌ HeaderManager init attempt ${retryCount + 1} failed:`, error);
                retryCount++;
                
                if (retryCount >= maxRetries) {
                    console.error('❌ HeaderManager initialization failed after all retries');
                    return;
                }
                
                await this._delay(500 * retryCount);
            }
        }
    }

    /**
     * Setup mobile menu functionality
     */
    static _setupMobileMenu() {
        const mobileToggle = document.querySelector('.mobile-menu-toggle, .menu-toggle');
        const mobileMenu = document.querySelector('.mobile-menu');
        
        if (mobileToggle && mobileMenu) {
            mobileToggle.addEventListener('click', () => {
                const isOpen = mobileMenu.classList.contains('active');
                mobileMenu.classList.toggle('active', !isOpen);
                mobileToggle.setAttribute('aria-expanded', !isOpen);
            });
        }
    }

    /**
     * Setup page interactions
     */
    static _setupPageInteractions() {
        // Add smooth scrolling for internal links
        const internalLinks = document.querySelectorAll('a[href^="#"]');
        internalLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href === '#' || href.length <= 1) return;
                
                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }

    /**
     * Setup accessibility improvements
     */
    static _setupAccessibility() {
        // Add skip links if not present
        if (!document.querySelector('.skip-link')) {
            const skipLink = document.createElement('a');
            skipLink.href = '#main-content';
            skipLink.className = 'skip-link';
            skipLink.textContent = 'Skip to main content';
            skipLink.style.cssText = `
                position: absolute;
                top: -40px;
                left: 6px;
                background: #000;
                color: #fff;
                padding: 8px;
                text-decoration: none;
                z-index: 1000;
                transition: top 0.3s;
            `;
            
            skipLink.addEventListener('focus', () => {
                skipLink.style.top = '6px';
            });
            
            skipLink.addEventListener('blur', () => {
                skipLink.style.top = '-40px';
            });
            
            document.body.insertBefore(skipLink, document.body.firstChild);
        }
        
        // Ensure proper focus management
        this._setupFocusManagement();
    }

    /**
     * Setup focus management
     */
    static _setupFocusManagement() {
        // Trap focus in modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                const modal = document.querySelector('.modal.active, .game-container[style*="block"]');
                if (modal) {
                    this._trapFocus(e, modal);
                }
            }
        });
    }

    /**
     * Trap focus within element
     */
    static _trapFocus(event, element) {
        const focusableElements = element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    }

    /**
     * Setup footer functionality
     */
    static _setupFooterLinks() {
        const footerLinks = document.querySelectorAll('footer a[href^="http"]');
        footerLinks.forEach(link => {
            // Add external link indicators
            if (!link.querySelector('.external-indicator')) {
                const indicator = document.createElement('span');
                indicator.className = 'external-indicator';
                indicator.textContent = ' ↗';
                indicator.setAttribute('aria-label', '(opens in new tab)');
                link.appendChild(indicator);
            }
            
            // Ensure external links open in new tab
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });
    }

    /**
     * Update cache statistics
     */
    static _updateCacheStats(url, type) {
        if (this.componentCache.has(url)) {
            const cacheData = this.componentCache.get(url);
            if (type === 'hit') {
                cacheData.hits++;
            }
        }
    }

    /**
     * Utility delay function
     */
    static _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Dispatch custom events
     */
    static _dispatchEvent(eventName, data) {
        const event = new CustomEvent(eventName, { 
            detail: data,
            bubbles: true
        });
        window.dispatchEvent(event);
    }

    /**
     * Update loading progress indicator
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
     * Get cache statistics for debugging
     */
    static getCacheStats() {
        const stats = {
            totalCached: this.componentCache.size,
            totalSize: 0,
            items: []
        };

        this.componentCache.forEach((data, url) => {
            stats.totalSize += data.size;
            stats.items.push({
                url,
                size: data.size,
                hits: data.hits,
                age: Date.now() - data.timestamp
            });
        });

        return stats;
    }

    /**
     * Clear cache (for debugging/maintenance)
     */
    static clearCache() {
        this.componentCache.clear();
        this.loadingPromises.clear();
        this.retryAttempts.clear();
        console.log('🗑️ Component cache cleared');
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
    
    // Define components to load - Let PageManager handle page content
    const components = [
        { url: 'src/components/header/header.html', id: 'header-container' },
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
        
        // ALWAYS reveal content structure first - graceful approach
        const contentEl = document.getElementById('content');
        if (contentEl) {
            contentEl.classList.remove('hidden');
            console.log('✅ Content structure revealed');
        }
        
        // Hide loading screen after reasonable time
        setTimeout(() => {
            window.loadingScreen?.hide();
        }, 300);
        
        // Log component loading results
        const successCount = results.filter(result => result === true).length;
        const totalCount = results.length;
        
        if (successCount === totalCount) {
            console.log('✅ All components loaded successfully');
        } else {
            console.warn(`⚠️ ${successCount}/${totalCount} components loaded successfully`);
        }
        
        // Load page-specific managers - PageManager will auto-initialize itself
        setTimeout(async () => {
            try {
                // Load essential page managers
                await loadPageManagers();
                
                // PageManager auto-initializes itself, so we don't need to create it here
                // Just wait a moment for it to initialize
                setTimeout(() => {
                    if (window.pageManager) {
                        console.log('✅ PageManager auto-initialized successfully');
                    } else {
                        console.warn('⚠️ PageManager auto-initialization may have failed');
                    }
                }, 100);
                
            } catch (error) {
                console.error('❌ Page managers loading failed:', error);
            }
        }, 300);
        
    }).catch(error => {
        console.error('❌ Component loading failed:', error);
        
        // Still reveal content even if everything fails
        const contentEl = document.getElementById('content');
        if (contentEl) {
            contentEl.classList.remove('hidden');
            console.log('✅ Content revealed despite errors');
        }
        
        // Hide loading screen and show error
        setTimeout(() => {
            window.loadingScreen?.setError('Some components failed to load. The application may have limited functionality.');
        }, 1000);
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

/**
 * Load essential page managers
 */
async function loadPageManagers() {
    const managers = [
        'src/components/pages/ProjectsPageManager.js',
        'src/components/pages/ProjectFiltersManager.js'
    ];
    
    for (const managerPath of managers) {
        try {
            // Check if already loaded
            if (document.querySelector(`script[src="${managerPath}"]`)) {
                continue;
            }
            
            await loadScript(managerPath);
            console.log(`✅ Loaded: ${managerPath}`);
        } catch (error) {
            console.warn(`⚠️ Failed to load ${managerPath}:`, error);
        }
    }
}

/**
 * Load script with promise
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

// Initialize performance monitoring
window.perfMonitor = new PerformanceMonitor();
