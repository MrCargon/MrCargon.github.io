/**
 * Enhanced PageManager - Single Page Application
 * Optimized for GitHub pages
 */
class PageManager {
    /**
     * Create a new PageManager instance
     */
    constructor() {
        // Core properties
        this.contentContainer = document.getElementById('page-container');
        this.pageCache = new Map();
        this.currentPage = null;
        this.isTransitioning = false;
        this.headerManager = null;
        
        // Performance tracking
        this.performanceMetrics = new Map();
        this.startTime = performance.now();
        
        // Game integration
        this.gameInstances = new Map();
        this.activeGame = null;
        
        // Enhanced configuration with metadata
        this.pages = {
            main: {
                path: 'src/components/pages/mainPage.html',
                title: 'Home - Interactive Space Experience',
                description: 'Explore an interactive 3D solar system',
                keywords: 'space, solar system, 3d, interactive',
                init: () => this.initMainPage(),
                cleanup: () => this.cleanupMainPage(),
                preload: true,
                priority: 'high'
            },
            about: {
                path: 'src/components/pages/aboutPage.html',
                title: 'About - Developer Profile',
                description: 'Learn about my background and skills',
                keywords: 'developer, skills, experience, biography',
                init: () => this.initAboutPage(),
                cleanup: () => this.cleanupAboutPage(),
                preload: true,
                priority: 'high'
            },
            projects: {
                path: 'src/components/pages/projectsPage.html',
                title: 'Projects - Portfolio & Games',
                description: 'Explore my interactive projects and games',
                keywords: 'projects, games, portfolio, interactive, development',
                init: () => this.initProjectsPage(),
                cleanup: () => this.cleanupProjectsPage(),
                preload: true,
                priority: 'high'
            },
            store: {
                path: 'src/components/pages/storePage.html',
                title: 'Store - Digital Products',
                description: 'Browse digital products and services',
                keywords: 'store, products, services, digital',
                init: () => this.initStorePage(),
                cleanup: () => this.cleanupStorePage(),
                preload: false,
                priority: 'medium'
            },
            contact: {
                path: 'src/components/pages/contactPage.html',
                title: 'Contact - Get In Touch',
                description: 'Contact me for projects and collaborations',
                keywords: 'contact, email, collaboration, hire',
                init: () => this.initContactPage(),
                cleanup: () => this.cleanupContactPage(),
                preload: false,
                priority: 'medium'
            }
        };

        // Error handling
        this.errorCount = 0;
        this.maxErrors = 5;
        
        // Initialize
        this.init();
    }

    /**
     * Initialize the PageManager with enhanced error handling
     */
    async init() {
        try {
            console.log('🚀 Initializing Enhanced PageManager v2.0');
            
            // Setup core systems
            await this.initializeCore();
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // Initialize header if available
            this.initializeHeaderManager();
            
            // Handle initial route
            await this.handleInitialRoute();
            
            // Start preloading
            this.startPreloading();
            
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            console.log('✅ PageManager initialization complete');
            
        } catch (error) {
            console.error('❌ PageManager initialization failed:', error);
            this.handleCriticalError(error);
        }
    }

    /**
     * Initialize core systems
     */
    async initializeCore() {
        // Verify required elements
        if (!this.contentContainer) {
            throw new Error('Required page-container element not found');
        }
        
        // Setup page state
        this.currentPage = null;
        this.isTransitioning = false;
        
        // Initialize space environment if needed
        if (this.shouldInitializeSpaceEnvironment()) {
            await this.initializeSpaceBackground();
        }
        
        return true;
    }

    /**
     * Check if space environment should be initialized
     */
    shouldInitializeSpaceEnvironment() {
        return !window.spaceEnvironment?.initialized && 
               typeof window.SpaceEnvironment !== 'undefined';
    }

    /**
     * Setup comprehensive event handlers
     */
    setupEventHandlers() {
        // Navigation event delegation
        document.addEventListener('click', this.handleNavigationClick.bind(this));
        
        // Browser history
        window.addEventListener('popstate', this.handlePopState.bind(this));
        
        // Keyboard navigation
        document.addEventListener('keydown', this.handleKeyboardNavigation.bind(this));
        
        // Page visibility for performance
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        
        // Window resize for responsive updates
        window.addEventListener('resize', this.debounce(this.handleResize.bind(this), 250));
        
        // Unload cleanup
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
        
        // Error handling
        window.addEventListener('error', this.handleGlobalError.bind(this));
        window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    }

    /**
     * Handle navigation clicks with enhanced logic
     */
    handleNavigationClick(event) {
        const link = event.target.closest('.main-nav a, .nav-button, [data-navigate]');
        if (!link) return;

        event.preventDefault();

        // Check if disabled
        if (link.classList.contains('disabled') || link.hasAttribute('disabled')) {
            this.showToast('This feature is coming soon!', 'info');
            return;
        }

        // Get page name from various sources
        const pageName = this.extractPageName(link);
        if (pageName) {
            this.navigateToPage(pageName);
        }
    }

    /**
     * Extract page name from link element
     */
    extractPageName(link) {
        return link.getAttribute('data-navigate') || 
               link.getAttribute('href')?.substring(1) || 
               link.getAttribute('data-page');
    }

    /**
     * Handle browser history navigation
     */
    handlePopState(event) {
        const pageName = event.state?.page || this.getDefaultPage();
        this.navigateToPage(pageName, false);
    }

    /**
     * Get default page based on current hash or fallback
     */
    getDefaultPage() {
        const hash = window.location.hash.substring(1);
        return this.pages[hash] ? hash : 'about';
    }

    /**
     * Handle keyboard navigation for accessibility
     */
    handleKeyboardNavigation(event) {
        const focusedElement = document.activeElement;
        
        // Handle navigation shortcuts
        if (event.ctrlKey || event.metaKey) {
            switch(event.key) {
                case '1': 
                    event.preventDefault();
                    this.navigateToPage('main');
                    break;
                case '2':
                    event.preventDefault();
                    this.navigateToPage('about');
                    break;
                case '3':
                    event.preventDefault();
                    this.navigateToPage('projects');
                    break;
            }
        }
        
        // Handle Enter/Space on navigation elements
        if (event.key === 'Enter' || event.key === ' ') {
            if (focusedElement?.classList.contains('nav-link') || 
                focusedElement?.hasAttribute('data-navigate')) {
                event.preventDefault();
                focusedElement.click();
            }
        }
    }

    /**
     * Handle page visibility changes for performance
     */
    handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden - pause animations, reduce updates
            this.pauseActiveAnimations();
        } else {
            // Page is visible - resume animations
            this.resumeActiveAnimations();
        }
    }

    /**
     * Handle window resize events
     */
    handleResize() {
        // Update space environment if available
        if (window.spaceEnvironment?.handleResize) {
            window.spaceEnvironment.handleResize();
        }
        
        // Update any active games
        if (this.activeGame?.handleResize) {
            this.activeGame.handleResize();
        }
        
        // Dispatch custom resize event
        this.dispatchEvent('resize', { 
            width: window.innerWidth, 
            height: window.innerHeight 
        });
    }

    /**
     * Handle before unload for cleanup
     */
    handleBeforeUnload() {
        this.cleanup();
    }

    /**
     * Handle global errors
     */
    handleGlobalError(event) {
        console.error('Global error caught:', event.error);
        this.errorCount++;
        
        if (this.errorCount > this.maxErrors) {
            this.handleCriticalError(new Error('Too many errors occurred'));
        }
    }

    /**
     * Handle unhandled promise rejections
     */
    handleUnhandledRejection(event) {
        console.error('Unhandled promise rejection:', event.reason);
        this.errorCount++;
    }

    /**
     * Initialize header manager
     */
    initializeHeaderManager() {
        if (window.HeaderManager) {
            try {
                this.headerManager = new HeaderManager();
                console.log('📋 HeaderManager initialized');
            } catch (error) {
                console.warn('⚠️ HeaderManager initialization failed:', error);
            }
        }
    }

    /**
     * Handle initial route with enhanced logic
     */
    async handleInitialRoute() {
        try {
            // Show loading state
            this.showLoadingState('Initializing application...');
            
            // Initialize space background first if needed
            if (this.shouldInitializeSpaceEnvironment()) {
                this.updateLoadingState('Loading space environment...');
                await this.initializeSpaceBackground();
            }
            
            // Get initial page
            const initialPage = this.getDefaultPage();
            
            this.updateLoadingState(`Loading ${this.pages[initialPage]?.title || initialPage}...`);
            
            // Navigate to initial page
            await this.navigateToPage(initialPage, false);
            
            // Hide loading state
            this.hideLoadingState();
            
        } catch (error) {
            console.error('❌ Initial route handling failed:', error);
            this.handleNavigationError(error);
        }
    }

    /**
     * Enhanced navigation with performance tracking
     */
    async navigateToPage(pageName, updateHistory = true) {
        // Validation
        if (this.isTransitioning || !this.pages[pageName] || pageName === this.currentPage) {
            return false;
        }

        const startTime = performance.now();
        this.isTransitioning = true;

        try {
            console.log(`🧭 Navigating to: ${pageName}`);
            
            // Dispatch navigation start event
            this.dispatchEvent('navigation:start', { 
                from: this.currentPage, 
                to: pageName 
            });

            // Update browser history
            if (updateHistory) {
                this.updateBrowserHistory(pageName);
            }

            // Start transition
            await this.startPageTransition();

            // Load and render page
            await this.loadAndRenderPage(pageName);

            // Update UI state
            this.updateUIState(pageName);

            // Set page body class
            this.setPageBodyClass(pageName);

            // Complete transition
            await this.completePageTransition();

            // Record performance
            const loadTime = performance.now() - startTime;
            this.recordPerformance(pageName, loadTime);

            // Dispatch navigation complete event
            this.dispatchEvent('navigation:complete', { 
                page: pageName, 
                loadTime 
            });

            console.log(`✅ Navigation to ${pageName} completed in ${loadTime.toFixed(2)}ms`);
            return true;

        } catch (error) {
            console.error(`❌ Navigation to ${pageName} failed:`, error);
            this.handleNavigationError(error);
            return false;
        } finally {
            this.isTransitioning = false;
        }
    }

    /**
     * Update browser history and meta tags
     */
    updateBrowserHistory(pageName) {
        const pageConfig = this.pages[pageName];
        
        // Update history
        window.history.pushState({ page: pageName }, '', `#${pageName}`);
        
        // Update document title and meta tags
        document.title = pageConfig.title;
        this.updateMetaTags(pageConfig);
    }

    /**
     * Update meta tags for SEO
     */
    updateMetaTags(pageConfig) {
        // Update description
        this.updateMetaTag('description', pageConfig.description);
        
        // Update keywords
        this.updateMetaTag('keywords', pageConfig.keywords);
        
        // Update Open Graph tags
        this.updateMetaTag('og:title', pageConfig.title, 'property');
        this.updateMetaTag('og:description', pageConfig.description, 'property');
    }

    /**
     * Update individual meta tag
     */
    updateMetaTag(name, content, attribute = 'name') {
        if (!content) return;
        
        let meta = document.querySelector(`meta[${attribute}="${name}"]`);
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute(attribute, name);
            document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
    }

    /**
     * Enhanced page loading with caching and error handling
     */
    async loadAndRenderPage(pageName) {
        const pageConfig = this.pages[pageName];
        let content;

        try {
            // Check cache first
            if (this.pageCache.has(pageName)) {
                content = this.pageCache.get(pageName);
                console.log(`📋 Using cached content for ${pageName}`);
            } else {
                console.log(`📥 Loading content for ${pageName}`);
                content = await this.fetchPageContent(pageConfig.path);
                this.pageCache.set(pageName, content);
            }

            // Cleanup previous page
            await this.cleanupCurrentPage();

            // Render content
            this.renderPageContent(content);

            // Initialize page-specific functionality
            if (pageConfig.init) {
                await pageConfig.init();
            }

        } catch (error) {
            console.error(`❌ Failed to load page ${pageName}:`, error);
            throw error;
        }
    }

    /**
     * Fetch page content with retries
     */
    async fetchPageContent(path, retries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await fetch(path, {
                    cache: 'default',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return await response.text();

            } catch (error) {
                lastError = error;
                console.warn(`⚠️ Fetch attempt ${attempt} failed:`, error);
                
                if (attempt < retries) {
                    // Exponential backoff
                    await this.delay(Math.pow(2, attempt) * 500);
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Render page content safely
     */
    renderPageContent(content) {
        if (this.contentContainer) {
            // Sanitize content if needed (basic check)
            const sanitizedContent = this.sanitizeHTML(content);
            this.contentContainer.innerHTML = sanitizedContent;
        }
    }

    /**
     * Basic HTML sanitization (extend as needed)
     */
    sanitizeHTML(html) {
        // Basic sanitization - remove script tags
        return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }

    /**
     * Enhanced cleanup with memory management
     */
    async cleanupCurrentPage() {
        const currentPageConfig = this.pages[this.currentPage];
        
        if (currentPageConfig?.cleanup) {
            try {
                await currentPageConfig.cleanup();
            } catch (error) {
                console.warn(`⚠️ Cleanup failed for ${this.currentPage}:`, error);
            }
        }

        // Clean up games
        this.cleanupActiveGames();
        
        // Remove event listeners
        this.removePageEventListeners();
    }

    /**
     * Update UI state with enhanced header management
     */
    updateUIState(pageName) {
        // Update header navigation
        if (this.headerManager?.updateActiveLink) {
            this.headerManager.updateActiveLink(pageName);
        } else {
            this.updateNavigationState(pageName);
        }

        this.currentPage = pageName;
    }

    /**
     * Fallback navigation state update
     */
    updateNavigationState(pageName) {
        document.querySelectorAll('.main-nav a, .nav-button').forEach(link => {
            const linkPage = this.extractPageName(link);
            const isActive = linkPage === pageName;
            
            link.classList.toggle('active', isActive);
            link.setAttribute('aria-current', isActive ? 'page' : 'false');
        });
    }

    /**
     * Set page-specific body class and handle space environment
     */
    setPageBodyClass(pageName) {
        // Remove existing page classes
        document.body.classList.forEach(className => {
            if (className.startsWith('page-')) {
                document.body.classList.remove(className);
            }
        });

        // Add current page class
        document.body.classList.add(`page-${pageName}`);

        // Handle space environment visibility
        this.handleSpaceEnvironmentVisibility(pageName);
    }

    /**
     * Handle space environment visibility based on current page
     */
    handleSpaceEnvironmentVisibility(pageName) {
        if (!window.spaceEnvironment) return;

        if (pageName === 'main') {
            // Fully interactive on main page
            window.spaceEnvironment.show(true);
            console.log('🌌 Space environment: fully interactive');
        } else {
            // Background only on other pages
            window.spaceEnvironment.show(false);
            console.log('🌌 Space environment: background mode');
        }
    }

    /**
     * Enhanced space background initialization
     */
    async initializeSpaceBackground() {
        try {
            console.log('🌌 Initializing space environment...');

            // Load required scripts in order
            const scripts = [
                'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
                'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
                'src/utils/ResourceLoader.js',
                'src/utils/MemoryManager.js',
                'src/components/simulation/solarsystem/Planets/Planet.js',
                'src/components/simulation/solarsystem/Sun.js',
                'src/components/simulation/solarsystem/Planets/Mercury.js',
                'src/components/simulation/solarsystem/Planets/Venus.js',
                'src/components/simulation/solarsystem/Planets/Earth.js',
                'src/components/simulation/solarsystem/Planets/Mars.js',
                'src/components/simulation/solarsystem/Planets/Jupiter.js',
                'src/components/simulation/solarsystem/Planets/Saturn.js',
                'src/components/simulation/solarsystem/Planets/Uranus.js',
                'src/components/simulation/solarsystem/Planets/Neptune.js',
                'src/components/simulation/solarsystem/Galaxy.js',
                'src/components/simulation/solarsystem/AsteroidBelt.js',
                'src/components/simulation/solarsystem/HabitableZone.js',
                'src/components/simulation/solarsystem/SolarSystem.js',
                'src/components/simulation/solarsystem/SpaceEnvironment.js'
            ];

            await this.loadScriptsSequentially(scripts);

            // Initialize space environment
            if (window.SpaceEnvironment && !window.spaceEnvironment) {
                window.spaceEnvironment = new SpaceEnvironment();
                await window.spaceEnvironment.init();
                console.log('✅ Space environment initialized successfully');
            }

            return true;

        } catch (error) {
            console.error('❌ Space environment initialization failed:', error);
            return false;
        }
    }

    /**
     * Load scripts sequentially to avoid dependency issues
     */
    async loadScriptsSequentially(scripts) {
        for (const src of scripts) {
            try {
                await this.loadScript(src);
            } catch (error) {
                console.warn(`⚠️ Failed to load script: ${src}`, error);
                // Continue loading other scripts
            }
        }
    }

    /**
     * Enhanced script loader with caching
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.crossOrigin = 'anonymous';

            script.onload = () => {
                console.log(`✅ Loaded: ${src}`);
                resolve();
            };
            
            script.onerror = () => {
                console.error(`❌ Failed to load: ${src}`);
                reject(new Error(`Failed to load script: ${src}`));
            };

            document.head.appendChild(script);
        });
    }

    /**
     * Enhanced preloading system
     */
    startPreloading() {
        if (window.requestIdleCallback) {
            window.requestIdleCallback(() => this.preloadPages(), { timeout: 5000 });
        } else {
            setTimeout(() => this.preloadPages(), 2000);
        }
    }

    /**
     * Preload pages based on priority
     */
    async preloadPages() {
        const highPriorityPages = Object.entries(this.pages)
            .filter(([name, config]) => config.preload && config.priority === 'high' && name !== this.currentPage)
            .map(([name]) => name);

        for (const pageName of highPriorityPages) {
            try {
                await this.prefetchPage(pageName);
            } catch (error) {
                console.warn(`⚠️ Failed to preload ${pageName}:`, error);
            }
        }
    }

    /**
     * Prefetch a page in the background
     */
    async prefetchPage(pageName) {
        if (this.pageCache.has(pageName)) return;

        const pageConfig = this.pages[pageName];
        try {
            const content = await this.fetchPageContent(pageConfig.path);
            this.pageCache.set(pageName, content);
            console.log(`📋 Preloaded: ${pageName}`);
        } catch (error) {
            console.warn(`⚠️ Preload failed for ${pageName}:`, error);
        }
    }

    // ===========================
    // PAGE-SPECIFIC INITIALIZERS
    // ===========================

    /**
     * Initialize main page with space environment
     */
    async initMainPage() {
        console.log('🏠 Initializing main page');

        try {
            // Ensure space environment is ready
            if (!window.spaceEnvironment?.initialized) {
                await this.initializeSpaceBackground();
            }

            // Show space environment
            if (window.spaceEnvironment) {
                window.spaceEnvironment.show(true);
            }

            // Initialize planet selector
            this.initializePlanetSelector();

            // Initialize camera controls
            this.initializeCameraControls();

        } catch (error) {
            console.error('❌ Main page initialization failed:', error);
        }
    }

    /**
     * Initialize planet selector functionality
     */
    initializePlanetSelector() {
        const selector = document.querySelector('.planet-selector');
        if (!selector) return;

        // Scroll controls
        const leftBtn = document.querySelector('.scroll-indicator.left');
        const rightBtn = document.querySelector('.scroll-indicator.right');

        if (leftBtn && rightBtn) {
            leftBtn.addEventListener('click', () => {
                selector.scrollBy({ left: -200, behavior: 'smooth' });
            });

            rightBtn.addEventListener('click', () => {
                selector.scrollBy({ left: 200, behavior: 'smooth' });
            });

            // Update scroll button visibility
            const updateScrollButtons = this.debounce(() => {
                leftBtn.style.opacity = selector.scrollLeft > 0 ? '1' : '0.3';
                rightBtn.style.opacity = 
                    selector.scrollLeft < selector.scrollWidth - selector.clientWidth - 10 ? '1' : '0.3';
            }, 50);

            selector.addEventListener('scroll', updateScrollButtons);
            window.addEventListener('resize', updateScrollButtons);
            updateScrollButtons();
        }

        // Planet selection
        this.setupPlanetSelection();
    }

    /**
     * Setup planet selection functionality
     */
    setupPlanetSelection() {
        const planetButtons = document.querySelectorAll('.planet-btn');
        const progressIndicator = document.querySelector('.progress-indicator');

        planetButtons.forEach((button, index) => {
            button.addEventListener('click', () => {
                // Update active state
                planetButtons.forEach(btn => {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-selected', 'false');
                });

                button.classList.add('active');
                button.setAttribute('aria-selected', 'true');

                // Update progress indicator
                if (progressIndicator) {
                    const segmentWidth = 100 / planetButtons.length;
                    progressIndicator.style.width = segmentWidth + '%';
                    progressIndicator.style.left = (segmentWidth * index) + '%';
                }

                // Focus camera on planet
                const planetName = button.getAttribute('data-planet');
                this.focusOnPlanet(planetName);
            });
        });

        // Select first planet by default
        if (planetButtons.length > 0) {
            setTimeout(() => planetButtons[0].click(), 500);
        }
    }

    /**
     * Focus camera on selected planet
     */
    focusOnPlanet(planetName) {
        if (window.spaceEnvironment?.focusOnPlanet) {
            window.spaceEnvironment.focusOnPlanet(planetName);
            console.log(`🎯 Focusing on ${planetName}`);
        }
    }

    /**
     * Initialize camera controls
     */
    initializeCameraControls() {
        const controls = {
            'reset-camera': () => window.spaceEnvironment?.resetCamera(),
            'toggle-rotation': () => window.spaceEnvironment?.solarSystem?.toggleAnimation(),
            'toggle-orbit': () => window.spaceEnvironment?.solarSystem?.toggleOrbits(),
            'toggle-orbit-mode': () => this.toggleOrbitMode(),
            'toggle-follow-rotation': () => this.toggleFollowRotation()
        };

        Object.entries(controls).forEach(([id, handler]) => {
            const button = document.getElementById(id);
            if (button && handler) {
                button.addEventListener('click', handler);
            }
        });
    }

    /**
     * Initialize projects page with enhanced functionality
     */
    async initProjectsPage() {
        console.log('📂 Initializing projects page');

        try {
            // Use existing projects page utilities if available
            if (window.projectsPageUtils?.initializeProjectsPage) {
                window.projectsPageUtils.initializeProjectsPage();
            } else {
                // Fallback initialization
                this.setupBasicProjectsPage();
            }

            // Setup game loading functionality
            this.setupGameLoading();

        } catch (error) {
            console.error('❌ Projects page initialization failed:', error);
        }
    }

    /**
     * Setup basic projects page functionality
     */
    setupBasicProjectsPage() {
        // Project navigation
        const navButtons = document.querySelectorAll('.side-nav .nav-button');
        navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleProjectNavigation(button);
            });
        });

        // Project filters
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.handleProjectFilter(button);
            });
        });
    }

    /**
     * Setup game loading functionality
     */
    setupGameLoading() {
        // Find game load buttons
        const gameButtons = document.querySelectorAll('[onclick*="loadBaristaGame"], .project-btn[data-game]');
        
        gameButtons.forEach(button => {
            // Remove inline onclick if present
            button.removeAttribute('onclick');
            
            // Add proper event listener
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.loadGame('barista', button);
            });
        });
    }

    /**
     * Load and display a game
     */
    async loadGame(gameType, button) {
        try {
            console.log(`🎮 Loading ${gameType} game`);
            
            // Update button state
            const originalHTML = button.innerHTML;
            button.innerHTML = '<span>⏳</span> Loading...';
            button.disabled = true;

            // Show game container
            const gameContainer = document.getElementById('game-container');
            const gameContent = document.getElementById('game-content');
            
            if (gameContainer && gameContent) {
                gameContainer.style.display = 'block';
                
                // Update title
                const gameTitle = document.getElementById('game-title');
                if (gameTitle) {
                    gameTitle.textContent = this.getGameTitle(gameType);
                }

                // Load game content
                await this.loadGameContent(gameType, gameContent);

                // Scroll to game
                gameContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

                // Update button
                button.innerHTML = '<span>🎮</span> Game Loaded';
                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.disabled = false;
                }, 2000);

                // Set active game
                this.activeGame = gameType;
            }

        } catch (error) {
            console.error(`❌ Failed to load ${gameType} game:`, error);
            this.showToast('Failed to load game. Please try again.', 'error');
            
            // Reset button
            button.innerHTML = originalHTML;
            button.disabled = false;
        }
    }

    /**
     * Load game content based on type
     */
    async loadGameContent(gameType, container) {
        switch (gameType) {
            case 'barista':
                return this.loadBaristaGame(container);
            default:
                throw new Error(`Unknown game type: ${gameType}`);
        }
    }

    /**
     * Load Barista Game (placeholder for now)
     */
    async loadBaristaGame(container) {
    // Create game instance
    const game = new StarbucksGame(container);
    
    // Store reference for cleanup
    this.activeGame = game;
    
    return game;
}

    /**
     * Get game title by type
     */
    getGameTitle(gameType) {
        const titles = {
            barista: 'Starbucks Barista Adventure',
            // Add more games here
        };
        return titles[gameType] || 'Interactive Game';
    }

    /**
     * Initialize about page
     */
    async initAboutPage() {
        console.log('👤 Initializing about page');
        // About page specific initialization
    }

    /**
     * Initialize store page
     */
    async initStorePage() {
        console.log('🛒 Initializing store page');
        // Store page specific initialization
    }

    /**
     * Initialize contact page
     */
    async initContactPage() {
        console.log('📧 Initializing contact page');
        
        const contactForm = document.getElementById('contact-form');
        if (contactForm) {
            this.setupContactForm(contactForm);
        }
    }

    /**
     * Setup contact form with validation
     */
    setupContactForm(form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleContactSubmit(form);
        });

        // Real-time validation
        const inputs = form.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateInput(input));
            input.addEventListener('input', () => this.clearInputError(input));
        });
    }

    // ===========================
    // CLEANUP METHODS
    // ===========================

    /**
     * Cleanup main page
     */
    cleanupMainPage() {
        // Cleanup planet selector events
        // Events are automatically cleaned up when DOM is replaced
    }

    /**
     * Cleanup projects page
     */
    cleanupProjectsPage() {
        this.cleanupActiveGames();
    }

    /**
     * Cleanup about page
     */
    cleanupAboutPage() {
        // About page cleanup
    }

    /**
     * Cleanup store page
     */
    cleanupStorePage() {
        // Store page cleanup
    }

    /**
     * Cleanup contact page
     */
    cleanupContactPage() {
        // Contact page cleanup
    }

    /**
     * Cleanup active games
     */
    cleanupActiveGames() {
        if (this.activeGame) {
            console.log(`🎮 Cleaning up active game: ${this.activeGame}`);
            
            // Hide game container
            const gameContainer = document.getElementById('game-container');
            if (gameContainer) {
                gameContainer.style.display = 'none';
                
                // Clear content to free memory
                const gameContent = document.getElementById('game-content');
                if (gameContent) {
                    gameContent.innerHTML = '';
                }
            }
            
            this.activeGame = null;
        }
    }

    /**
     * Remove page-specific event listeners
     */
    removePageEventListeners() {
        // Most events are cleaned up automatically when DOM is replaced
        // Add specific cleanup here if needed
    }

    // ===========================
    // UTILITY METHODS
    // ===========================

    /**
     * Transition methods
     */
    async startPageTransition() {
        if (this.contentContainer) {
            this.contentContainer.style.opacity = '0';
            this.contentContainer.style.transform = 'translateY(20px)';
            await this.delay(300);
        }
    }

    async completePageTransition() {
        if (this.contentContainer) {
            this.contentContainer.style.opacity = '1';
            this.contentContainer.style.transform = 'translateY(0)';
            await this.delay(300);
        }
    }

    /**
     * Performance tracking
     */
    recordPerformance(pageName, loadTime) {
        if (!this.performanceMetrics.has(pageName)) {
            this.performanceMetrics.set(pageName, []);
        }
        this.performanceMetrics.get(pageName).push(loadTime);
    }

    /**
     * Performance monitoring setup
     */
    setupPerformanceMonitoring() {
        if (this.isDevelopment()) {
            // Log performance metrics periodically
            setInterval(() => {
                this.logPerformanceMetrics();
            }, 30000); // Every 30 seconds
        }
    }

    /**
     * Log performance metrics
     */
    logPerformanceMetrics() {
        console.group('📊 Performance Metrics');
        this.performanceMetrics.forEach((times, page) => {
            const avg = times.reduce((a, b) => a + b, 0) / times.length;
            console.log(`${page}: ${avg.toFixed(2)}ms avg (${times.length} loads)`);
        });
        console.groupEnd();
    }

    /**
     * Loading states
     */
    showLoadingState(message = 'Loading...') {
        if (window.loadingScreen?.show) {
            window.loadingScreen.show(message);
        }
    }

    updateLoadingState(message) {
        if (window.loadingScreen?.updateMessage) {
            window.loadingScreen.updateMessage(message);
        }
    }

    hideLoadingState() {
        if (window.loadingScreen?.hide) {
            window.loadingScreen.hide();
        }
    }

    /**
     * Toast notifications
     */
    showToast(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);
        // Implement toast UI if needed
    }

    /**
     * Animation control
     */
    pauseActiveAnimations() {
        if (window.spaceEnvironment?.pause) {
            window.spaceEnvironment.pause();
        }
    }

    resumeActiveAnimations() {
        if (window.spaceEnvironment?.resume) {
            window.spaceEnvironment.resume();
        }
    }

    /**
     * Event dispatcher
     */
    dispatchEvent(name, detail = {}) {
        const event = new CustomEvent(`pagemanager:${name}`, { 
            detail, 
            bubbles: true 
        });
        (this.contentContainer || document).dispatchEvent(event);
    }

    /**
     * Error handling
     */
    handleNavigationError(error) {
        console.error('❌ Navigation error:', error);
        this.showToast('Navigation failed. Please try again.', 'error');
        
        if (this.contentContainer) {
            this.contentContainer.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #ef4444;">
                    <h2>⚠️ Navigation Error</h2>
                    <p>Failed to load the requested page.</p>
                    <button onclick="window.location.reload()" style="padding: 0.5rem 1rem; margin-top: 1rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Reload Page
                    </button>
                </div>
            `;
        }
    }

    handleCriticalError(error) {
        console.error('💥 Critical error:', error);
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #1f2937; color: white; text-align: center; padding: 2rem;">
                <div>
                    <h1 style="color: #ef4444; margin-bottom: 1rem;">💥 Critical Error</h1>
                    <p style="margin-bottom: 2rem;">The application encountered a critical error and needs to be reloaded.</p>
                    <button onclick="window.location.reload()" style="padding: 0.75rem 1.5rem; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem;">
                        Reload Application
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Utility functions
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

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

    isDevelopment() {
        return location.hostname === 'localhost' || 
               location.hostname === '127.0.0.1' || 
               location.search.includes('debug=true');
    }

    /**
     * Cleanup all resources
     */
    cleanup() {
        console.log('🧹 Cleaning up PageManager');
        
        // Clear caches
        this.pageCache.clear();
        this.performanceMetrics.clear();
        
        // Cleanup games
        this.cleanupActiveGames();
        
        // Cleanup space environment
        if (window.spaceEnvironment?.cleanup) {
            window.spaceEnvironment.cleanup();
        }
    }
}

// Auto-initialize when DOM is ready (if not already done)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.pageManager) {
            window.pageManager = new PageManager();
        }
    });
} else if (!window.pageManager) {
    window.pageManager = new PageManager();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PageManager;
} else {
    window.PageManager = PageManager;
}