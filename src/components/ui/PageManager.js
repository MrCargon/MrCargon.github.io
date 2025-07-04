/**
 * PageManager - Single Page Application Navigation System
 * Optimized for GitHub Pages
 */
class PageManager {
    /**
     * Creates a new PageManager instance
     */
    constructor() {
        // Core properties
        this.contentContainer = document.getElementById('page-container');
        this.pageCache = new Map();
        this.gameCache = new Map();
        this.currentPage = null;
        this.isTransitioning = false;
        this.headerManager = null;
        this.performanceMonitor = null;

        // Configuration - page definitions
        this.pages = {
            main: {
                path: 'src/components/pages/mainPage.html',
                title: 'Home - Interactive Portfolio',
                init: () => this.initMainPage(),
                preload: true,
                requiresSpaceEnv: true
            },
            projects: {
                path: 'src/components/pages/projectsPage.html',
                title: 'Projects - Portfolio Showcase',
                init: () => this.initProjectsPage(),
                preload: true,
                requiresSpaceEnv: false
            },
            about: {
                path: 'src/components/pages/aboutPage.html',
                title: 'About - Professional Background',
                init: () => this.initAboutPage(),
                preload: false,
                requiresSpaceEnv: false
            },
            store: {
                path: 'src/components/pages/storePage.html',
                title: 'Store - Digital Products',
                init: () => this.initStorePage(),
                preload: false,
                requiresSpaceEnv: false
            },
            contact: {
                path: 'src/components/pages/contactPage.html',
                title: 'Contact - Get In Touch',
                init: () => this.initContactPage(),
                preload: false,
                requiresSpaceEnv: false
            }
        };

        // Game registry for dynamic loading
        this.games = {
            'barista-game': {
                name: 'Starbucks Barista Adventure',
                class: 'StarbucksGame',
                script: 'src/components/games/StarbucksGame.js',
                container: 'game-content',
                preload: false
            }
        };

        // Performance tracking
        this.performanceMetrics = {
            pageLoads: new Map(),
            componentLoads: new Map(),
            gameLoads: new Map(),
            errors: []
        };

        // Initialize the application
        this.init();
    }

    /**
     * Initialize the PageManager
     */
    async init() {
        try {
            console.log('🚀 Initializing PageManager...');
            
            // Set up performance monitoring
            this.initializePerformanceMonitoring();

            // Set up header management
            this.initializeHeaderManager();

            // Setup event handlers for navigation
            this.setupRouting();

            // Handle initial route based on URL hash
            await this.handleInitialRoute();

            // Preload important pages and components
            this.preloadResources();

            console.log('✅ PageManager initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize PageManager:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Initialize performance monitoring
     */
    initializePerformanceMonitoring() {
        // Only enable in development or with debug flag
        const isDevelopment = location.hostname === 'localhost' || 
                            location.hostname === '127.0.0.1' ||
                            location.search.includes('debug=true');

        if (isDevelopment && window.PerformanceMonitor) {
            this.performanceMonitor = new PerformanceMonitor();
            console.log('📊 Performance monitoring enabled');
        }
    }

    /**
     * Initialize HeaderManager if available
     */
    initializeHeaderManager() {
        if (window.HeaderManager) {
            try {
                this.headerManager = new HeaderManager();
                console.log('🎯 HeaderManager initialized');
            } catch (error) {
                console.warn('⚠️ HeaderManager initialization failed:', error);
            }
        }
    }

    /**
     * Set up event listeners for navigation and browser history
     */
    setupRouting() {
        // Use event delegation for all navigation clicks
        document.addEventListener('click', this.handleNavigationClick.bind(this));

        // Handle browser back/forward navigation
        window.addEventListener('popstate', this.handlePopState.bind(this));

        // Handle keyboard navigation accessibility
        document.addEventListener('keydown', this.handleKeyboardNavigation.bind(this));

        // Handle page visibility changes
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

        // Handle window resize for responsive adjustments
        window.addEventListener('resize', this.debounce(this.handleResize.bind(this), 250));
    }

    /**
     * Handle navigation click events with proper event delegation
     * @param {MouseEvent} event - Click event
     */
    handleNavigationClick(event) {
        const link = event.target.closest('.main-nav a, .nav-button, .project-btn[href]');
        if (!link) return;

        // Skip if it's an external link
        if (link.href && (link.href.startsWith('http') && !link.href.includes(location.hostname))) {
            return;
        }

        event.preventDefault();

        // Check if the link is disabled
        if (link.classList.contains('disabled')) {
            console.log('🚫 Navigation prevented: This feature is coming soon.');
            return;
        }

        // Handle different types of navigation
        const href = link.getAttribute('href');
        
        if (href.startsWith('#')) {
            const pageName = href.substring(1);
            if (this.pages[pageName]) {
                this.navigateToPage(pageName);
            } else {
                // Handle anchor links within page
                this.scrollToElement(href);
            }
        } else if (link.classList.contains('project-btn') && link.dataset.action) {
            this.handleProjectAction(link.dataset.action, link.dataset.target);
        }
    }

    /**
     * Handle project-specific actions
     */
    handleProjectAction(action, target) {
        switch (action) {
            case 'load-game':
                this.loadGame(target);
                break;
            case 'view-demo':
                this.viewDemo(target);
                break;
            default:
                console.warn('Unknown project action:', action);
        }
    }

    /**
     * Scroll to element with smooth animation
     */
    scrollToElement(selector) {
        const element = document.querySelector(selector);
        if (element) {
            element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
        }
    }

    /**
     * Handle browser history navigation events
     * @param {PopStateEvent} event - PopState event
     */
    handlePopState(event) {
        const pageName = event.state?.page || 'main';
        this.navigateToPage(pageName, false);
    }

    /**
     * Handle keyboard navigation for accessibility
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyboardNavigation(event) {
        // Handle escape key to close games/modals
        if (event.key === 'Escape') {
            this.handleEscapeKey();
            return;
        }

        // Only handle when focused on navigation links
        const focusedLink = document.activeElement;
        if (!focusedLink || !focusedLink.matches('.nav-link, .nav-button, .project-btn')) return;

        // Handle Enter or Space key
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            focusedLink.click();
        }
    }

    /**
     * Handle escape key presses
     */
    handleEscapeKey() {
        // Close any open games
        if (this.currentGame) {
            this.closeGame();
        }
        
        // Close any open modals or overlays
        const overlay = document.querySelector('.overlay, .modal, .game-container[style*="display: block"]');
        if (overlay) {
            this.closeOverlay(overlay);
        }
    }

    /**
     * Handle page visibility changes
     */
    handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden - pause animations, games, etc.
            this.pauseActiveContent();
        } else {
            // Page is visible - resume content
            this.resumeActiveContent();
        }
    }

    /**
     * Handle window resize events
     */
    handleResize() {
        // Update space environment if active
        if (window.spaceEnvironment?.handleResize) {
            window.spaceEnvironment.handleResize();
        }

        // Update any active games
        if (this.currentGame?.handleResize) {
            this.currentGame.handleResize();
        }
    }

    /**
     * Pause active content when page is hidden
     */
    pauseActiveContent() {
        // Pause space environment
        if (window.spaceEnvironment?.pause) {
            window.spaceEnvironment.pause();
        }

        // Pause active games
        if (this.currentGame?.pause) {
            this.currentGame.pause();
        }
    }

    /**
     * Resume active content when page becomes visible
     */
    resumeActiveContent() {
        // Resume space environment
        if (window.spaceEnvironment?.resume) {
            window.spaceEnvironment.resume();
        }

        // Resume active games
        if (this.currentGame?.resume) {
            this.currentGame.resume();
        }
    }

    /**
     * Handle initial routing when the page first loads
     */
    async handleInitialRoute() {
        try {
            // Initialize space background first if needed
            const spaceInitialized = await this.initializeSpaceBackground();
            
            // Get the initial page from URL hash or default to about
            const hash = window.location.hash.substring(1) || 'about';
            await this.navigateToPage(hash, false);

            console.log('🎯 Initial route handled successfully');
        } catch (error) {
            console.error('❌ Failed to handle initial route:', error);
            // Fallback to about page
            await this.navigateToPage('about', false);
        }
    }

    /**
     * Preload important resources for faster navigation
     */
    preloadResources() {
        // Use requestIdleCallback if available, or setTimeout as fallback
        const preloader = window.requestIdleCallback || setTimeout;

        preloader(() => {
            this.preloadPages();
            this.preloadGames();
        }, { timeout: 3000 });
    }

    /**
     * Preload pages for faster navigation
     */
    async preloadPages() {
        const currentPageName = this.currentPage || 'about';

        // Preload pages marked for preloading
        const pagesToPreload = Object.entries(this.pages)
            .filter(([name, config]) => config.preload && name !== currentPageName)
            .map(([name]) => name);

        console.log('📦 Preloading pages:', pagesToPreload);

        for (const pageName of pagesToPreload) {
            try {
                await this.prefetchPage(pageName);
            } catch (error) {
                console.debug(`Preload failed for ${pageName}:`, error);
            }
        }
    }

    /**
     * Preload games that are marked for preloading
     */
    async preloadGames() {
        const gamesToPreload = Object.entries(this.games)
            .filter(([, config]) => config.preload)
            .map(([id]) => id);

        for (const gameId of gamesToPreload) {
            try {
                await this.prefetchGame(gameId);
            } catch (error) {
                console.debug(`Game preload failed for ${gameId}:`, error);
            }
        }
    }

    /**
     * Prefetch a page in the background
     * @param {string} pageName - Page to prefetch
     */
    async prefetchPage(pageName) {
        if (this.pageCache.has(pageName)) return;

        try {
            const pageConfig = this.pages[pageName];
            const response = await fetch(pageConfig.path, { 
                priority: 'low', 
                cache: 'force-cache' 
            });

            if (!response.ok) return;

            const content = await response.text();
            this.pageCache.set(pageName, content);
            console.log(`📄 Page cached: ${pageName}`);
        } catch (error) {
            console.debug(`Page prefetch failed for ${pageName}:`, error);
        }
    }

    /**
     * Prefetch a game script
     */
    async prefetchGame(gameId) {
        if (this.gameCache.has(gameId)) return;

        try {
            const gameConfig = this.games[gameId];
            const response = await fetch(gameConfig.script, {
                priority: 'low',
                cache: 'force-cache'
            });

            if (!response.ok) return;

            const script = await response.text();
            this.gameCache.set(gameId, script);
            console.log(`🎮 Game cached: ${gameId}`);
        } catch (error) {
            console.debug(`Game prefetch failed for ${gameId}:`, error);
        }
    }

    /**
     * Load a JavaScript file asynchronously
     * @param {string} src - Script source URL
     * @returns {Promise} - Resolves when script is loaded
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if script is already loaded
            const existingScript = document.querySelector(`script[src="${src}"]`);
            if (existingScript) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = true;

            script.onload = () => {
                console.log(`📜 Script loaded: ${src}`);
                resolve();
            };
            script.onerror = () => {
                const error = new Error(`Failed to load ${src}`);
                console.error('❌ Script load failed:', error);
                reject(error);
            };

            document.head.appendChild(script);
        });
    }

    /**
     * Initialize the space background for the main page
     */
    async initializeSpaceBackground() {
        try {
            console.log("🌌 Starting space environment initialization");

            // Load Three.js and dependencies
            await Promise.all([
                this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'),
                this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js')
            ]);

            // Load utility files
            await Promise.all([
                this.loadScript('src/utils/ResourceLoader.js'),
                this.loadScript('src/utils/MemoryManager.js')
            ]);

            // Load celestial body classes
            await Promise.all([
                this.loadScript('src/components/simulation/solarsystem/Planets/Planet.js'),
                this.loadScript('src/components/simulation/solarsystem/Sun.js'),
                this.loadScript('src/components/simulation/solarsystem/Planets/Mercury.js'),
                this.loadScript('src/components/simulation/solarsystem/Planets/Venus.js'),
                this.loadScript('src/components/simulation/solarsystem/Planets/Earth.js'),
                this.loadScript('src/components/simulation/solarsystem/Planets/Mars.js'),
                this.loadScript('src/components/simulation/solarsystem/Planets/Jupiter.js'),
                this.loadScript('src/components/simulation/solarsystem/Planets/Saturn.js'),
                this.loadScript('src/components/simulation/solarsystem/Planets/Uranus.js'),
                this.loadScript('src/components/simulation/solarsystem/Planets/Neptune.js')
            ]);

            // Load environment features
            await Promise.all([
                this.loadScript('src/components/simulation/solarsystem/Galaxy.js'),
                this.loadScript('src/components/simulation/solarsystem/AsteroidBelt.js'),
                this.loadScript('src/components/simulation/solarsystem/HabitableZone.js')
            ]);

            // Load main controller classes
            await Promise.all([
                this.loadScript('src/components/simulation/solarsystem/SolarSystem.js'),
                this.loadScript('src/components/simulation/solarsystem/SpaceEnvironment.js')
            ]);

            // Create and initialize space environment
            if (!window.spaceEnvironment) {
                console.log("🔧 Creating new SpaceEnvironment instance");
                window.spaceEnvironment = new SpaceEnvironment();
                await window.spaceEnvironment.init();
                console.log("✅ SpaceEnvironment initialization complete");
                window.spaceEnvironment.show();
            }

            return true;
        } catch (error) {
            console.error("❌ Failed to initialize space environment:", error);
            return false;
        }
    }

    /**
     * Navigate to a specific page
     * @param {string} pageName - Name of the page to navigate to
     * @param {boolean} updateHistory - Whether to update browser history
     */
    async navigateToPage(pageName, updateHistory = true) {
        if (this.isTransitioning || !this.pages[pageName] || pageName === this.currentPage) {
            return;
        }

        const startTime = performance.now();
        this.isTransitioning = true;

        // Trigger navigation start event
        this.triggerEvent('navigation:start', { from: this.currentPage, to: pageName });

        // Update browser history if needed
        if (updateHistory) {
            window.history.pushState({ page: pageName }, '', `#${pageName}`);
        }

        try {
            // Start transition animation
            await this.startPageTransition();

            // Load and render page content
            await this.loadAndRenderPage(pageName);

            // Update UI state
            this.updateUIState(pageName);

            // Set page-specific body class and environment
            this.setPageBodyClass(pageName);

            // Complete transition animation
            await this.completePageTransition();

            // Record performance metrics
            const loadTime = performance.now() - startTime;
            this.recordPageLoad(pageName, loadTime);

            // Trigger navigation complete event
            this.triggerEvent('navigation:complete', { page: pageName, loadTime });

            console.log(`📄 Navigated to ${pageName} in ${loadTime.toFixed(2)}ms`);
        } catch (error) {
            console.error('❌ Navigation error:', error);
            this.handleNavigationError(error);
            this.triggerEvent('navigation:error', { page: pageName, error });
        } finally {
            this.isTransitioning = false;
        }
    }

    /**
     * Record page load performance
     */
    recordPageLoad(pageName, loadTime) {
        if (!this.performanceMetrics.pageLoads.has(pageName)) {
            this.performanceMetrics.pageLoads.set(pageName, []);
        }
        this.performanceMetrics.pageLoads.get(pageName).push(loadTime);

        // Keep only last 10 measurements
        const measurements = this.performanceMetrics.pageLoads.get(pageName);
        if (measurements.length > 10) {
            measurements.shift();
        }
    }

    /**
     * Trigger a custom event for extensibility
     * @param {string} name - Event name
     * @param {Object} detail - Event details
     */
    triggerEvent(name, detail = {}) {
        const event = new CustomEvent(`pagemanager:${name}`, { 
            detail,
            bubbles: true
        });

        if (this.contentContainer) {
            this.contentContainer.dispatchEvent(event);
        } else {
            document.dispatchEvent(event);
        }
    }

    /**
     * Set body class based on current page and manage space environment
     * @param {string} pageName - Current page name
     */
    setPageBodyClass(pageName) {
        // Remove all page-specific classes
        document.body.classList.forEach(className => {
            if (className.startsWith('page-')) {
                document.body.classList.remove(className);
            }
        });

        // Add current page class
        document.body.classList.add(`page-${pageName}`);

        // Handle space environment based on page requirements
        const pageConfig = this.pages[pageName];
        if (pageConfig.requiresSpaceEnv && window.spaceEnvironment) {
            // Full interaction for space-dependent pages
            window.spaceEnvironment.show(true);
            console.log("🌌 Space environment fully enabled");
        } else if (window.spaceEnvironment) {
            // Background only for other pages
            window.spaceEnvironment.show(false);
            console.log("🌌 Space environment as background");
        }
    }

    /**
     * Begin page transition animation
     */
    async startPageTransition() {
        if (!this.contentContainer) return;

        this.contentContainer.style.opacity = '0';
        this.contentContainer.style.transform = 'translateY(20px)';
        
        return new Promise(resolve => setTimeout(resolve, 300));
    }

    /**
     * Load page content and render it
     * @param {string} pageName - Page name to load
     */
    async loadAndRenderPage(pageName) {
        const pageConfig = this.pages[pageName];
        let content;

        // Check cache first
        if (this.pageCache.has(pageName)) {
            content = this.pageCache.get(pageName);
        } else {
            // Load page content
            try {
                const response = await fetch(pageConfig.path);
                if (!response.ok) {
                    throw new Error(`Failed to load ${pageName} page (${response.status})`);
                }
                content = await response.text();
                this.pageCache.set(pageName, content);
            } catch (error) {
                console.error(`Error loading page content for ${pageName}:`, error);
                throw error;
            }
        }

        // Cleanup previous page content
        this.cleanupCurrentPage();

        // Render content
        if (this.contentContainer) {
            this.contentContainer.innerHTML = content;

            // Initialize page-specific functionality
            if (pageConfig.init) {
                try {
                    await pageConfig.init();
                } catch (error) {
                    console.error(`Error initializing ${pageName} page:`, error);
                }
            }
        }
    }

    /**
     * Clean up resources from current page before loading new one
     */
    cleanupCurrentPage() {
        // Clean up any active games
        if (this.currentGame) {
            this.closeGame();
        }

        // Clean up data visualization charts
        if (window.charts?.length) {
            window.charts.forEach(chart => {
                if (chart?.destroy) chart.destroy();
            });
            window.charts = [];
        }

        // Clean up any running intervals or timeouts
        if (window.pageIntervals?.length) {
            window.pageIntervals.forEach(clearInterval);
            window.pageIntervals = [];
        }

        if (window.pageTimeouts?.length) {
            window.pageTimeouts.forEach(clearTimeout);
            window.pageTimeouts = [];
        }
    }

    /**
     * Update UI state after page navigation
     * @param {string} pageName - Current page name
     */
    updateUIState(pageName) {
        // Update header navigation
        if (this.headerManager?.updateActiveLink) {
            this.headerManager.updateActiveLink(pageName);
        } else {
            // Fallback to direct DOM manipulation
            document.querySelectorAll('.main-nav a').forEach(link => {
                const href = link.getAttribute('href')?.substring(1);
                const isActive = href === pageName;
                link.classList.toggle('active', isActive);
                link.setAttribute('aria-current', isActive ? 'page' : 'false');
            });
        }

        // Update document title
        document.title = this.pages[pageName].title;
        this.currentPage = pageName;
    }

    /**
     * Complete page transition animation
     */
    async completePageTransition() {
        if (!this.contentContainer) return;

        this.contentContainer.style.opacity = '1';
        this.contentContainer.style.transform = 'translateY(0)';
        
        return new Promise(resolve => setTimeout(resolve, 300));
    }

    /**
     * Handle navigation errors
     */
    handleNavigationError(error) {
        this.performanceMetrics.errors.push({
            type: 'navigation',
            error: error.message,
            timestamp: Date.now()
        });

        if (!this.contentContainer) return;

        this.contentContainer.innerHTML = `
            <div class="error-container" style="text-align: center; padding: 2rem; color: var(--text-color);">
                <h2 style="color: var(--primary-color); margin-bottom: 1rem;">⚠️ Navigation Error</h2>
                <p style="margin-bottom: 1.5rem;">Failed to load the requested page. Please try again.</p>
                <button onclick="window.location.reload()" 
                        class="retry-button" 
                        style="padding: 0.75rem 1.5rem; background: var(--primary-color); color: var(--bg-color); border: none; border-radius: 8px; cursor: pointer;">
                    🔄 Reload Page
                </button>
            </div>
        `;
    }

    /**
     * Handle initialization errors
     */
    handleInitializationError(error) {
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #1a1a1a; color: white; font-family: system-ui;">
                <div style="text-align: center; max-width: 500px; padding: 2rem;">
                    <h1 style="color: #ff6b6b; margin-bottom: 1rem;">🚨 Application Error</h1>
                    <p style="margin-bottom: 1.5rem; opacity: 0.8;">The application failed to initialize properly.</p>
                    <button onclick="window.location.reload()" 
                            style="padding: 0.75rem 1.5rem; background: #4ecdc4; color: #1a1a1a; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
                        Try Again
                    </button>
                </div>
            </div>
        `;
    }

    // =====================================
    // PAGE-SPECIFIC INITIALIZATION METHODS
    // =====================================

    /**
     * Initialize main page functionality
     */
    async initMainPage() {
        console.log('🏠 Initializing main page');

        // Ensure space environment is properly visible
        if (window.spaceEnvironment) {
            window.spaceEnvironment.show(true);
        }

        // Initialize planet selector if it exists
        const planetSelector = document.querySelector('.planet-selector');
        if (planetSelector) {
            this.initPlanetSelector();
        }

        // Initialize camera controls
        this.initCameraControls();
    }

    /**
     * Initialize projects page functionality
     */
    async initProjectsPage() {
        console.log('🚀 Initializing projects page');

        // Initialize the projects page utilities
        if (window.projectsPageUtils) {
            window.projectsPageUtils.initializeProjectsPage();
        }

        // Set up game loading integration
        this.setupGameLoading();

        // Set up project interactions
        this.setupProjectInteractions();
    }

    /**
     * Set up game loading for projects page
     */
    setupGameLoading() {
        // Override the global loadBaristaGame function
        window.loadBaristaGame = (button) => {
            this.loadGame('barista-game', button);
        };

        window.closeGame = () => {
            this.closeGame();
        };
    }

    /**
     * Load and initialize a game
     * @param {string} gameId - Game identifier
     * @param {HTMLElement} triggerButton - Button that triggered the load
     */
    async loadGame(gameId, triggerButton = null) {
        if (!this.games[gameId]) {
            console.error(`Game not found: ${gameId}`);
            return;
        }

        const gameConfig = this.games[gameId];
        const startTime = performance.now();

        try {
            // Update trigger button state
            if (triggerButton) {
                triggerButton.innerHTML = '<span>⏳</span> Loading...';
                triggerButton.disabled = true;
            }

            // Show game container
            const gameContainer = document.getElementById('game-container');
            const gameContent = document.getElementById('game-content');
            const gameTitle = document.getElementById('game-title');

            if (!gameContainer || !gameContent) {
                throw new Error('Game container not found');
            }

            gameContainer.style.display = 'block';
            gameTitle.textContent = gameConfig.name;

            // Load game script if not already loaded
            if (!window[gameConfig.class]) {
                await this.loadScript(gameConfig.script);
            }

            // Create game instance
            const GameClass = window[gameConfig.class];
            if (!GameClass) {
                throw new Error(`Game class ${gameConfig.class} not found`);
            }

            this.currentGame = new GameClass(gameContent);
            await this.currentGame.init();

            // Record performance
            const loadTime = performance.now() - startTime;
            this.recordGameLoad(gameId, loadTime);

            // Update trigger button
            if (triggerButton) {
                triggerButton.innerHTML = '<span>🎮</span> Game Loaded';
                triggerButton.disabled = false;
            }

            // Scroll to game
            gameContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

            console.log(`🎮 Game loaded: ${gameId} in ${loadTime.toFixed(2)}ms`);

        } catch (error) {
            console.error(`❌ Failed to load game ${gameId}:`, error);
            
            if (triggerButton) {
                triggerButton.innerHTML = '<span>❌</span> Load Failed';
                triggerButton.disabled = false;
            }

            this.handleGameLoadError(gameId, error);
        }
    }

    /**
     * Record game load performance
     */
    recordGameLoad(gameId, loadTime) {
        if (!this.performanceMetrics.gameLoads.has(gameId)) {
            this.performanceMetrics.gameLoads.set(gameId, []);
        }
        this.performanceMetrics.gameLoads.get(gameId).push(loadTime);
    }

    /**
     * Handle game load errors
     */
    handleGameLoadError(gameId, error) {
        const gameContent = document.getElementById('game-content');
        if (gameContent) {
            gameContent.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 2rem;">
                    <div>
                        <div style="font-size: 3rem; margin-bottom: 1rem;">😕</div>
                        <h3 style="margin-bottom: 1rem; color: #333;">Game Load Failed</h3>
                        <p style="margin-bottom: 1.5rem; color: #666;">Unable to load ${this.games[gameId]?.name || gameId}</p>
                        <button onclick="window.pageManager.loadGame('${gameId}')" 
                                style="padding: 0.75rem 1.5rem; background: #4ecdc4; color: white; border: none; border-radius: 8px; cursor: pointer;">
                            🔄 Try Again
                        </button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Close the currently active game
     */
    closeGame() {
        if (this.currentGame) {
            try {
                if (this.currentGame.destroy) {
                    this.currentGame.destroy();
                }
                this.currentGame = null;
            } catch (error) {
                console.warn('Error destroying game:', error);
            }
        }

        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.style.display = 'none';
            
            // Clear game content
            const gameContent = document.getElementById('game-content');
            if (gameContent) {
                gameContent.innerHTML = '';
            }

            // Scroll back to projects
            const projectsSection = document.getElementById('projects');
            if (projectsSection) {
                projectsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    /**
     * Initialize other page types
     */
    async initAboutPage() {
        console.log('👨‍💻 Initializing about page');
    }

    async initStorePage() {
        console.log('🏪 Initializing store page');
        // Add store-specific functionality here
    }

    async initContactPage() {
        console.log('📧 Initializing contact page');
        // Add contact form functionality here
    }

    // =====================================
    // UTILITY METHODS
    // =====================================

    /**
     * Debounce function to limit frequent executions
     * @param {Function} func - Function to debounce
     * @param {number} wait - Debounce delay in milliseconds
     * @returns {Function} - Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Get performance metrics report
     */
    getPerformanceReport() {
        return {
            pageLoads: Object.fromEntries(this.performanceMetrics.pageLoads),
            gameLoads: Object.fromEntries(this.performanceMetrics.gameLoads),
            errors: this.performanceMetrics.errors,
            cacheStatus: {
                pages: this.pageCache.size,
                games: this.gameCache.size
            }
        };
    }

    // Additional methods for planet selector, camera controls, etc.
    // (These would be the same as in your original code)
    initPlanetSelector() {
        // Your existing planet selector code
    }

    initCameraControls() {
        // Your existing camera controls code
    }

    setupProjectInteractions() {
        // Additional project-specific interactions
    }
}

// Export PageManager to the global scope
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PageManager;
} else {
    window.PageManager = PageManager;
}