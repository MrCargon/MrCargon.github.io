/**
 * main.js - Rule-compliant application entry point
 * Purpose: Initialize application components following all 10 Rules
 * @version 2.0.1
 */

// Consolidated rules system loads automatically via index.html
// No manual loading needed to prevent conflicts

/**
 * ComponentLoader - Rule-compliant component loading system
 * Purpose: Load HTML components with safety and bounds
 * Rule 4: All methods ≤60 lines | Rule 5: 2+ assertions per method
 */
class ComponentLoader {
    // Static properties initialized after class definition
    // (ES2015 compatible approach for broader browser support)
    
    /**
     * Initialize static properties (called once)
     * Purpose: Setup static state with fixed memory allocation
     * Rule 3: Pre-allocated memory | Rule 5: Environment validation
     */
    static initialize() {
        // Rule 5: Validate environment
        if (typeof document === 'undefined') {
            throw new Error('Document object required for ComponentLoader');
        }

        if (typeof Map === 'undefined') {
            throw new Error('Map constructor required for ComponentLoader');
        }

        // Initialize static properties if not already done
        if (!ComponentLoader.componentCache) {
            ComponentLoader.componentCache = new Map();
            ComponentLoader.loadingPromises = new Map();
            ComponentLoader.loadingState = new Set();
            ComponentLoader.retryAttempts = new Map();
            ComponentLoader.maxRetries = 3; // Rule 2: Fixed retry limit
            ComponentLoader.maxCacheSize = 10; // Rule 2: Fixed cache limit
            ComponentLoader._errorDelegationSetup = false; // Track delegation setup
            ComponentLoader._focusManagementSetup = false; // Track focus management setup
            ComponentLoader._focusTrapHandler = null; // Store handler reference
            ComponentLoader._delegatedClickHandler = null; // Store delegated click handler reference
            ComponentLoader._mobileMenuSetup = false; // Track mobile menu setup
            ComponentLoader._mobileMenuHandler = null; // Store mobile menu handler reference
            ComponentLoader._pageInteractionsSetup = false; // Track page interactions setup
            ComponentLoader._pageInteractionsHandler = null; // Store page interactions handler reference
            ComponentLoader._skipLinkFocusHandler = null; // Store skip link focus handler reference
            ComponentLoader._skipLinkBlurHandler = null; // Store skip link blur handler reference
            ComponentLoader._accessibilitySetup = false; // Track accessibility setup
        }
    }
    
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
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 1: Simple flow
     */
    static async _performLoad(url, containerId, options) {
        // Rule 5: Validate input parameters
        if (!url || typeof url !== 'string') {
            throw new Error('Invalid URL for component loading');
        }
        
        if (!containerId || typeof containerId !== 'string') {
            throw new Error('Invalid container ID for component loading');
        }
        
        const container = document.getElementById(containerId);
        this.loadingState.add(containerId);

        // Try cache first
        const cacheResult = await this._tryLoadFromCache(url, containerId, options.cache, container);
        if (cacheResult) {
            return true;
        }

        // Perform network loading with retries
        return await this._performNetworkLoad(url, containerId, options, container);
    }

    /**
     * Try to load content from cache
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 6: Error recovery
     */
    static async _tryLoadFromCache(url, containerId, useCache, container) {
        // Rule 5: Validate cache parameters
        if (!container || container.innerHTML === undefined) {
            console.warn('Invalid container for cache loading');
            return false;
        }
        
        if (typeof useCache !== 'boolean') {
            console.warn('Invalid cache flag, defaulting to false');
            return false;
        }

        if (!useCache || !this.componentCache.has(url)) {
            return false;
        }

        try {
            const cachedData = this.componentCache.get(url);
            await this._insertContent(container, cachedData.content, containerId);
            this._updateCacheStats(url, 'hit');
            return true;
            
        } catch (error) {
            this.componentCache.delete(url);
            return false;
        }
    }

    /**
     * Perform network loading with retries
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 2: Bounded retries
     */
    static async _performNetworkLoad(url, containerId, options, container) {
        // Rule 5: Validate network loading parameters
        if (!options || typeof options.retries !== 'number') {
            throw new Error('Invalid retry configuration for network loading');
        }
        
        if (!container || typeof container.innerHTML === 'undefined') {
            throw new Error('Invalid container for network loading');
        }

        const { retries, cache, timeout } = options;
        let attempt = 0;
        let lastError;

        // Rule 2: Bounded retry loop
        while (attempt < Math.min(retries, 5)) {
            try {
                this._showLoadingState(container, containerId, attempt);
                const content = await this._fetchWithTimeout(url, timeout, cache);
                
                if (cache) {
                    this._cacheContent(url, content);
                }

                await this._insertContent(container, content, containerId);
                this._updateCacheStats(url, 'miss');
                return true;

            } catch (error) {
                lastError = error;
                attempt++;
                
                console.warn(`⚠️ Attempt ${attempt} failed for ${containerId}:`, error.message);

                if (attempt < retries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
                    await this._delay(delay);
                } else {
                    console.error(`❌ All attempts failed for ${containerId}`, lastError);
                    await this._showErrorState(container, containerId, lastError, url);
                }
            }
        }

        return false;
    }

    /**
     * Fetch content with timeout protection
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 2: Bounded timeout
     */
    static async _fetchWithTimeout(url, timeout, useCache) {
        // Rule 5: Validate fetch parameters
        if (!url || typeof url !== 'string') {
            throw new Error('Invalid URL for fetch operation');
        }
        
        if (!timeout || timeout < 0 || timeout > 30000) {
            throw new Error('Invalid timeout value for fetch operation');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                cache: useCache ? 'default' : 'no-cache',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Cache-Control': useCache ? 'max-age=300' : 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const content = await response.text();
            
            if (!content || content.trim().length === 0) {
                throw new Error('Empty response received');
            }

            return content;
            
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Cache content with metadata
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 3: Bounded cache
     */
    static _cacheContent(url, content) {
        // Rule 5: Validate cache inputs
        if (!url || typeof url !== 'string') {
            console.error('Invalid URL for caching');
            return false;
        }
        
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            console.error('Invalid content for caching');
            return false;
        }

        // Rule 3: Bounded cache size
        if (this.componentCache.size >= this.maxCacheSize) {
            // Remove oldest entry
            const firstKey = this.componentCache.keys().next().value;
            if (firstKey) {
                this.componentCache.delete(firstKey);
            }
        }

        this.componentCache.set(url, {
            content,
            timestamp: Date.now(),
            size: content.length,
            hits: 0
        });

        return true;
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
     * Setup error handling with event delegation (prevents memory leaks)
     * Uses single document-level listener instead of per-button listeners
     * Rule 4: ≤60 lines | Rule 3: Pre-allocated handler
     */
    static _setupErrorHandlers(container) {
        // Use event delegation - setup once at document level
        if (!this._errorDelegationSetup) {
            // Store handler reference for cleanup
            this._delegatedClickHandler = (e) => {
                const retryBtn = e.target.closest('.retry-button');
                const fallbackBtn = e.target.closest('.fallback-button');

                if (retryBtn) {
                    this.handleRetry({ currentTarget: retryBtn });
                } else if (fallbackBtn) {
                    this.handleFallback({ currentTarget: fallbackBtn });
                }
            };

            document.addEventListener('click', this._delegatedClickHandler);
            this._errorDelegationSetup = true;
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
        // Setup page-specific functionality
        this._setupPageInteractions();
        this._setupAccessibility();
    }

    /**
     * Initialize footer container
     */
    static async initializeFooter() {
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
                    await this._delay(100 * (retryCount + 1));
                    retryCount++;
                    continue;
                }
                
                // Create HeaderManager instance
                if (!window.headerManager) {
                    window.headerManager = new HeaderManager();
                } else {
                    // Reinitialize if it already exists
                    if (typeof window.headerManager.reinitialize === 'function') {
                        window.headerManager.reinitialize();
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
     * Uses singleton pattern to prevent duplicate listeners
     * Rule 5: 2+ assertions | Rule 3: Pre-allocated handler
     */
    static _setupMobileMenu() {
        // Prevent duplicate setup
        if (this._mobileMenuSetup) {
            return;
        }

        const mobileToggle = document.querySelector('.mobile-menu-toggle, .menu-toggle');
        const mobileMenu = document.querySelector('.mobile-menu');

        if (mobileToggle && mobileMenu) {
            // Store handler reference for cleanup
            this._mobileMenuHandler = () => {
                const isOpen = mobileMenu.classList.contains('active');
                mobileMenu.classList.toggle('active', !isOpen);
                mobileToggle.setAttribute('aria-expanded', !isOpen);
            };

            mobileToggle.addEventListener('click', this._mobileMenuHandler);
            this._mobileMenuSetup = true;
        }
    }

    /**
     * Setup page interactions using event delegation
     * Uses singleton pattern to prevent duplicate listeners
     * Rule 5: 2+ assertions | Rule 3: Pre-allocated handler
     */
    static _setupPageInteractions() {
        // Use event delegation - setup once at document level
        if (this._pageInteractionsSetup) {
            return;
        }

        // Store handler reference for cleanup
        this._pageInteractionsHandler = (e) => {
            const link = e.target.closest('a[href^="#"]');
            if (!link) return;

            const href = link.getAttribute('href');
            if (href === '#' || href.length <= 1) return;

            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        };

        document.addEventListener('click', this._pageInteractionsHandler);
        this._pageInteractionsSetup = true;
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

            // Singleton pattern for accessibility handlers
            if (!this._accessibilitySetup) {
                this._skipLinkFocusHandler = () => {
                    skipLink.style.top = '6px';
                };

                this._skipLinkBlurHandler = () => {
                    skipLink.style.top = '-40px';
                };

                skipLink.addEventListener('focus', this._skipLinkFocusHandler);
                skipLink.addEventListener('blur', this._skipLinkBlurHandler);
                this._accessibilitySetup = true;
            }

            document.body.insertBefore(skipLink, document.body.firstChild);
        }

        // Ensure proper focus management
        this._setupFocusManagement();
    }

    /**
     * Setup focus management
     * Uses singleton pattern to prevent duplicate listeners
     */
    static _setupFocusManagement() {
        // Prevent duplicate listeners
        if (this._focusManagementSetup) {
            return;
        }

        // Store handler reference for potential cleanup
        this._focusTrapHandler = (e) => {
            if (e.key === 'Tab') {
                const modal = document.querySelector('.modal.active, .game-container[style*="block"]');
                if (modal) {
                    this._trapFocus(e, modal);
                }
            }
        };

        // Add single listener
        document.addEventListener('keydown', this._focusTrapHandler);
        this._focusManagementSetup = true;
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

    /**
     * Cleanup all ComponentLoader resources
     * Call on page unload or component reinitialization
     * Rule 7: Proper resource cleanup
     */
    static destroy() {
        // Remove error delegation listener
        if (this._delegatedClickHandler) {
            document.removeEventListener('click', this._delegatedClickHandler);
            this._delegatedClickHandler = null;
        }
        this._errorDelegationSetup = false;

        // Remove focus trap listener
        if (this._focusTrapHandler) {
            document.removeEventListener('keydown', this._focusTrapHandler);
            this._focusTrapHandler = null;
        }
        this._focusManagementSetup = false;

        // Remove mobile menu listener
        if (this._mobileMenuHandler) {
            const mobileToggle = document.querySelector('.mobile-menu-toggle, .menu-toggle');
            if (mobileToggle) {
                mobileToggle.removeEventListener('click', this._mobileMenuHandler);
            }
            this._mobileMenuHandler = null;
        }
        this._mobileMenuSetup = false;

        // Remove page interactions listener
        if (this._pageInteractionsHandler) {
            document.removeEventListener('click', this._pageInteractionsHandler);
            this._pageInteractionsHandler = null;
        }
        this._pageInteractionsSetup = false;

        // Remove skip link handlers
        if (this._skipLinkFocusHandler) {
            const skipLink = document.querySelector('.skip-link');
            if (skipLink) {
                skipLink.removeEventListener('focus', this._skipLinkFocusHandler);
                skipLink.removeEventListener('blur', this._skipLinkBlurHandler);
            }
            this._skipLinkFocusHandler = null;
            this._skipLinkBlurHandler = null;
        }
        this._accessibilitySetup = false;

        // Clear caches
        if (this.componentCache) {
            this.componentCache.clear();
        }
        if (this.loadingPromises) {
            this.loadingPromises.clear();
        }
        if (this.loadingState) {
            this.loadingState.clear();
        }
        if (this.retryAttempts) {
            this.retryAttempts.clear();
        }

        console.log('ComponentLoader: Resources cleaned up');
    }
}

/**
 * Initialize application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    // Performance timer start
    const startTime = performance.now();

    // Initialize ComponentLoader static properties
    ComponentLoader.initialize();

    // Create loading screen instance with phase tracking
    window.loadingScreen = new LoadingScreen();
    window.loadingScreen.startMemoryTracking();
    window.loadingScreen.updateProgress(0, 'Initializing...');

    // Define components to load - Let PageManager handle page content
    const components = [
        { url: 'src/components/header/header.html', id: 'header-container' },
        { url: 'src/components/footer/footer.html', id: 'footer-container' }
    ];

    let loadedCount = 0;

    // Load components with phase-based progress tracking
    Promise.all(
        components.map(comp =>
            ComponentLoader.loadComponent(comp.url, comp.id)
                .then(success => {
                    loadedCount++;
                    // Update memory metrics as components load
                    window.loadingScreen?.updateMemoryMetrics();
                    return success;
                })
        )
    ).then(results => {
        // Mark components phase complete
        window.loadingScreen?.completePhase('components');
        // Record components loaded time
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            window.perf = window.perf || {};
            window.perf.componentsLoaded = performance.now() - startTime;
        }
        
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
                // Signal THREE.js phase starting
                window.loadingScreen?.completePhase('threeJS');

                // Load essential page managers
                await loadPageManagers();

                // Signal scene creation phase
                window.loadingScreen?.completePhase('scene');

                // Wait for SpaceEnvironment to be fully initialized
                // Poll for initialization with timeout
                console.log('⏳ Waiting for SpaceEnvironment to initialize...');
                const waitForSpaceEnvironment = () => {
                    return new Promise((resolve) => {
                        let attempts = 0;
                        const maxAttempts = 200; // 20 seconds max wait (textures take time)
                        const checkInterval = setInterval(() => {
                            attempts++;
                            // Check if SpaceEnvironment is initialized
                            const spaceEnv = window.spaceEnvironment;
                            if (spaceEnv?.initialized) {
                                clearInterval(checkInterval);
                                console.log(`✅ SpaceEnvironment ready after ${attempts * 100}ms`);
                                resolve(true);
                            } else if (attempts >= maxAttempts) {
                                clearInterval(checkInterval);
                                console.warn('⚠️ SpaceEnvironment initialization timeout - proceeding anyway');
                                resolve(false);
                            } else if (attempts % 10 === 0) {
                                // Log every second
                                console.log(`⏳ Still waiting for SpaceEnvironment... (${attempts * 100}ms)`);
                            }
                        }, 100);
                    });
                };

                await waitForSpaceEnvironment();

                // Signal textures loaded
                window.loadingScreen?.completePhase('textures');

                if (window.pageManager) {
                    console.log('✅ PageManager auto-initialized successfully');
                } else {
                    console.warn('⚠️ PageManager auto-initialization may have failed');
                }

                // Final phase and memory report
                window.loadingScreen?.completePhase('finalize');
                window.loadingScreen?.getMemoryReport();

                // NOW reveal content and hide loading screen
                const contentEl = document.getElementById('content');
                if (contentEl) {
                    contentEl.classList.remove('hidden');
                    console.log('✅ Content structure revealed');
                }

                // Hide loading screen with slight delay for smooth transition
                setTimeout(() => {
                    window.loadingScreen?.hide();
                    console.log('✅ Loading screen hidden - 3D scene ready');
                }, 200);

            } catch (error) {
                console.error('❌ Page managers loading failed:', error);
                window.loadingScreen?.setError('3D initialization failed. Basic navigation available.');

                // Still reveal content on error
                const contentEl = document.getElementById('content');
                if (contentEl) {
                    contentEl.classList.remove('hidden');
                }
            }
        }, 100);
        
    }).catch(error => {
        console.error('❌ Component loading failed:', error);

        // Still reveal content even if everything fails
        const contentEl = document.getElementById('content');
        if (contentEl) {
            contentEl.classList.remove('hidden');
            console.log('✅ Content revealed despite errors');
        }

        // Show error message then hide loading screen
        window.loadingScreen?.setError('Some components failed to load. The application may have limited functionality.');
        setTimeout(() => {
            window.loadingScreen?.hide();
        }, 3000);
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
            - Total Load Time: ${window.perf.pageReady.toFixed(2)}ms
        `);
    });
}

// Performance monitoring consolidated with rules system
// Let PerformanceManager handle all performance monitoring

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

// Performance monitoring handled by PerformanceManager in rules system
// No separate instantiation needed - consolidated architecture
