/**
 * Enhanced PageManager
 * Optimized for GitHub Pages
 */
class PageManager {
    /**
     * Creates a new PageManager instance with enhanced capabilities
     */
    constructor() {
        // Core properties
        this.contentContainer = document.getElementById('page-container');
        this.pageCache = new Map();
        this.componentCache = new Map();
        this.currentPage = null;
        this.previousPage = null;
        this.isTransitioning = false;
        this.headerManager = null;
        this.performanceMonitor = null;
        
        // State management
        this.appState = {
            initialized: false,
            navigationHistory: [],
            activeFeatures: new Set(),
            errorCount: 0,
            lastActivity: Date.now()
        };

        // Enhanced configuration with authentication
        this.config = {
            enableSpaceEnvironment: true,
            enablePerformanceMonitoring: true,
            enablePreloading: true,
            enableAnalytics: false,
            transitionDuration: 300,
            preloadDelay: 2000,
            maxCacheSize: 10,
            errorRetryLimit: 3
        };

        // Page definitions with enhanced metadata
        this.pages = {
            main: {
                path: 'src/components/pages/mainPage.html',
                title: 'Home - Interactive Portfolio',
                description: 'Explore an interactive 3D solar system and portfolio showcase',
                init: () => this.initMainPage(),
                cleanup: () => this.cleanupMainPage(),
                preload: true,
                requires3D: true,
                analytics: 'page_main'
            },
            projects: {
                path: 'src/components/pages/projectsPage.html',
                title: 'Projects - Interactive Showcase',
                description: 'Browse interactive projects, games, and web applications',
                init: () => this.initProjectsPage(),
                cleanup: () => this.cleanupProjectsPage(),
                preload: true,
                requiresJS: true,
                analytics: 'page_projects'
            },
            about: {
                path: 'src/components/pages/aboutPage.html',
                title: 'About - Developer Profile',
                description: 'Learn about my background, skills, and experience',
                init: () => this.initAboutPage(),
                cleanup: () => this.cleanupAboutPage(),
                preload: false,
                analytics: 'page_about'
            },
            store: {
                path: 'src/components/pages/storePage.html',
                title: 'Store - Digital Products',
                description: 'Browse and purchase digital products and services',
                init: () => this.initStorePage(),
                cleanup: () => this.cleanupStorePage(),
                preload: false,
                analytics: 'page_store'
            },
            contact: {
                path: 'src/components/pages/contactPage.html',
                title: 'Contact - Get In Touch',
                description: 'Contact form and professional information',
                init: () => this.initContactPage(),
                cleanup: () => this.cleanupContactPage(),
                preload: false,
                requiresValidation: true,
                analytics: 'page_contact'
            }
        };

        // Event listeners registry for cleanup
        this.eventListeners = new Map();
        this.activeIntervals = new Set();
        this.activeTimeouts = new Set();

        // Initialize the application
        this.init();
    }

    /**
     * Initialize the PageManager with comprehensive setup
     */
    async init() {
        try {
            console.log('🚀 Initializing Enhanced PageManager v2.0.0');
            
            // Validate environment and dependencies
            if (!this.validateEnvironment()) {
                throw new Error('Environment validation failed');
            }

            // Initialize core systems
            await this.initializeCoreComponents();
            
            // Setup routing and event handling
            this.setupAdvancedRouting();
            
            // Initialize performance monitoring
            if (this.config.enablePerformanceMonitoring) {
                this.initializePerformanceMonitoring();
            }
            
            // Handle initial route
            await this.handleInitialRoute();
            
            // Start preloading if enabled
            if (this.config.enablePreloading) {
                this.schedulePreloading();
            }
            
            // Mark as initialized
            this.appState.initialized = true;
            this.triggerEvent('pagemanager:initialized', { timestamp: Date.now() });
            
            console.log('✅ PageManager initialization complete');
            
        } catch (error) {
            console.error('❌ PageManager initialization failed:', error);
            this.handleCriticalError(error);
        }
    }

    /**
     * Validate environment and required dependencies
     */
    validateEnvironment() {
        const requiredElements = ['page-container'];
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length > 0) {
            console.error('Missing required elements:', missingElements);
            return false;
        }

        // Check for modern browser features
        const requiredFeatures = [
            'fetch',
            'Promise',
            'Map',
            'Set',
            'requestAnimationFrame',
            'addEventListener'
        ];
        
        const missingFeatures = requiredFeatures.filter(feature => 
            typeof window[feature] === 'undefined'
        );
        
        if (missingFeatures.length > 0) {
            console.error('Missing required browser features:', missingFeatures);
            return false;
        }

        return true;
    }

    /**
     * Initialize core components and managers
     */
    async initializeCoreComponents() {
        // Initialize HeaderManager if available
        if (window.HeaderManager) {
            try {
                this.headerManager = new HeaderManager();
                console.log('✅ HeaderManager initialized');
            } catch (error) {
                console.warn('⚠️ HeaderManager initialization failed:', error);
            }
        }

        // Initialize SpaceEnvironment if enabled and available
        if (this.config.enableSpaceEnvironment) {
            await this.initializeSpaceEnvironment();
        }

        // Setup error boundaries
        this.setupErrorBoundaries();

        // Initialize cache management
        this.initializeCacheManagement();
    }

    /**
     * Setup advanced routing with enhanced features
     */
    setupAdvancedRouting() {
        // Enhanced navigation click handler with authentication
        this.addEventListener(document, 'click', this.createAuthenticatedHandler(
            this.handleNavigationClick.bind(this)
        ));

        // Browser history navigation
        this.addEventListener(window, 'popstate', this.createAuthenticatedHandler(
            this.handlePopState.bind(this)
        ));

        // Enhanced keyboard navigation
        this.addEventListener(document, 'keydown', this.createAuthenticatedHandler(
            this.handleKeyboardNavigation.bind(this)
        ));

        // Visibility change handler for performance optimization
        this.addEventListener(document, 'visibilitychange', () => {
            if (document.hidden) {
                this.pauseActiveFeatures();
            } else {
                this.resumeActiveFeatures();
                this.appState.lastActivity = Date.now();
            }
        });

        // Page unload cleanup
        this.addEventListener(window, 'beforeunload', () => {
            this.cleanup();
        });
    }

    /**
     * Create authenticated event handler with validation
     */
    createAuthenticatedHandler(handler) {
        return (event) => {
            try {
                // Validate event and context
                if (!event || typeof handler !== 'function') {
                    throw new Error('Invalid handler or event');
                }

                // Rate limiting check
                if (this.isRateLimited()) {
                    console.warn('⚠️ Rate limit exceeded, ignoring event');
                    return;
                }

                // Execute handler with error boundary
                return handler(event);
                
            } catch (error) {
                console.error('Event handler error:', error);
                this.appState.errorCount++;
                
                // Auto-recovery if error count is manageable
                if (this.appState.errorCount < this.config.errorRetryLimit) {
                    this.scheduleRecovery();
                }
            }
        };
    }

    /**
     * Enhanced navigation click handler with comprehensive validation
     */
    handleNavigationClick(event) {
        const link = event.target.closest('.main-nav a, .nav-button, .project-btn[data-page]');
        if (!link) return;

        event.preventDefault();

        // Validate link and extract page information
        const pageName = this.extractPageName(link);
        if (!pageName || !this.pages[pageName]) {
            console.warn('Invalid page name:', pageName);
            return;
        }

        // Check if link is disabled
        if (link.classList.contains('disabled') || link.hasAttribute('disabled')) {
            this.showNotification('This feature is coming soon!', 'info');
            return;
        }

        // Special handling for project-specific navigation
        if (link.classList.contains('project-btn')) {
            this.handleProjectNavigation(link, pageName);
            return;
        }

        // Standard page navigation
        this.navigateToPage(pageName, true, {
            trigger: 'click',
            element: link.className
        });
    }

    /**
     * Extract page name from navigation element
     */
    extractPageName(element) {
        // Check data-page attribute first
        if (element.hasAttribute('data-page')) {
            return element.getAttribute('data-page');
        }

        // Check href attribute
        const href = element.getAttribute('href');
        if (href && href.startsWith('#')) {
            return href.substring(1);
        }

        // Check for project-specific navigation
        if (element.closest('.project-card')) {
            return 'projects';
        }

        return null;
    }

    /**
     * Handle project-specific navigation with enhanced features
     */
    handleProjectNavigation(element, pageName) {
        const projectCard = element.closest('.project-card');
        const projectId = projectCard ? projectCard.id : null;

        if (projectId === 'barista-game') {
            this.loadInteractiveProject('barista-game', element);
        } else {
            this.navigateToPage(pageName, true, {
                trigger: 'project',
                projectId: projectId
            });
        }
    }

    /**
     * Load interactive project with proper authentication
     */
    async loadInteractiveProject(projectId, triggerElement) {
        try {
            console.log(`🎮 Loading interactive project: ${projectId}`);

            // Update trigger element state
            const originalContent = triggerElement.innerHTML;
            triggerElement.innerHTML = '<span>⏳</span> Loading...';
            triggerElement.disabled = true;

            // Navigate to projects page if not already there
            if (this.currentPage !== 'projects') {
                await this.navigateToPage('projects');
            }

            // Load the specific project
            await this.loadProjectComponent(projectId);

            // Show success state
            triggerElement.innerHTML = '<span>✅</span> Loaded';
            
            // Reset after delay
            setTimeout(() => {
                triggerElement.innerHTML = originalContent;
                triggerElement.disabled = false;
            }, 2000);

        } catch (error) {
            console.error(`Failed to load project ${projectId}:`, error);
            
            // Show error state
            triggerElement.innerHTML = '<span>❌</span> Error';
            triggerElement.disabled = false;
            
            // Reset after delay
            setTimeout(() => {
                triggerElement.innerHTML = originalContent;
            }, 3000);
        }
    }

    /**
     * Load project component with proper integration
     */
    async loadProjectComponent(projectId) {
        // For now, this is a placeholder for the StarbucksGame integration
        // Will be implemented when we integrate the React component
        
        const gameContainer = document.getElementById('game-container');
        const gameContent = document.getElementById('game-content');
        
        if (!gameContainer || !gameContent) {
            throw new Error('Game container elements not found');
        }

        // Show the game container
        gameContainer.style.display = 'block';
        gameContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Placeholder implementation - will be replaced with actual React component
        return new Promise((resolve) => {
            setTimeout(() => {
                gameContent.innerHTML = this.createProjectPlaceholder(projectId);
                resolve();
            }, 1000);
        });
    }

    /**
     * Create project placeholder (temporary until React integration)
     */
    createProjectPlaceholder(projectId) {
        const projectData = {
            'barista-game': {
                title: 'Starbucks Barista Adventure',
                icon: '☕',
                description: 'Interactive coffee-making game ready for integration!'
            }
        };

        const project = projectData[projectId] || projectData['barista-game'];

        return `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; 
                        background: linear-gradient(135deg, #10b981, #059669); color: white; 
                        text-align: center; padding: 2rem; border-radius: 12px;">
                <div>
                    <div style="font-size: 4rem; margin-bottom: 1rem; animation: bounce 2s infinite;">${project.icon}</div>
                    <h3 style="font-size: 1.8rem; margin-bottom: 1rem; font-weight: 600;">${project.title}</h3>
                    <p style="margin-bottom: 2rem; opacity: 0.9; font-size: 1.1rem;">${project.description}</p>
                    <div style="background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; 
                                border-left: 4px solid #22c55e; margin: 1rem 0;">
                        <p style="font-size: 0.9rem; opacity: 0.8;">
                            🚀 React component integration point ready<br>
                            🎯 Game state management prepared<br>
                            ⚡ Performance optimized container
                        </p>
                    </div>
                    <button onclick="window.pageManager.closeProject()" 
                            style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); 
                                   padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem;
                                   transition: all 0.3s ease;"
                            onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                            onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                        Close Preview
                    </button>
                </div>
            </div>
            <style>
                @keyframes bounce {
                    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-10px); }
                    60% { transform: translateY(-5px); }
                }
            </style>
        `;
    }

    /**
     * Close interactive project
     */
    closeProject() {
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.style.display = 'none';
            
            // Scroll back to projects
            document.getElementById('projects')?.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }
    }

    /**
     * Enhanced page navigation with comprehensive state management
     */
    async navigateToPage(pageName, updateHistory = true, metadata = {}) {
        // Validation checks
        if (this.isTransitioning || !this.pages[pageName] || pageName === this.currentPage) {
            return false;
        }

        // Check if page requires special conditions
        const pageConfig = this.pages[pageName];
        if (!this.validatePageAccess(pageConfig)) {
            return false;
        }

        this.isTransitioning = true;
        const startTime = performance.now();

        try {
            // Store previous page for potential rollback
            this.previousPage = this.currentPage;

            // Update app state
            this.appState.navigationHistory.push({
                page: pageName,
                timestamp: Date.now(),
                metadata: metadata
            });

            // Trigger navigation events
            this.triggerEvent('navigation:start', { 
                from: this.currentPage, 
                to: pageName,
                metadata: metadata
            });

            // Update browser history
            if (updateHistory) {
                this.updateBrowserHistory(pageName);
            }

            // Start page transition
            await this.executePageTransition(pageName);

            // Track performance
            const loadTime = performance.now() - startTime;
            this.trackPagePerformance(pageName, loadTime);

            // Trigger completion event
            this.triggerEvent('navigation:complete', { 
                page: pageName,
                loadTime: loadTime
            });

            return true;

        } catch (error) {
            console.error('Navigation error:', error);
            await this.handleNavigationError(error, pageName);
            return false;
        } finally {
            this.isTransitioning = false;
        }
    }

    /**
     * Validate page access requirements
     */
    validatePageAccess(pageConfig) {
        // Check if 3D features are required but not available
        if (pageConfig.requires3D && !this.is3DSupported()) {
            this.showNotification('3D features not supported in this browser', 'warning');
            return false;
        }

        // Check if page requires JavaScript features
        if (pageConfig.requiresJS && !this.isJavaScriptEnabled()) {
            this.showNotification('JavaScript required for this page', 'warning');
            return false;
        }

        return true;
    }

    /**
     * Execute page transition with enhanced error handling
     */
    async executePageTransition(pageName) {
        const pageConfig = this.pages[pageName];

        // Start transition animation
        await this.startPageTransition();

        // Cleanup previous page
        await this.cleanupCurrentPage();

        // Load and render new page
        await this.loadAndRenderPage(pageName);

        // Update UI state
        this.updateUIState(pageName);

        // Set page-specific configurations
        this.configurePageEnvironment(pageName);

        // Complete transition animation
        await this.completePageTransition();
    }

    /**
     * Enhanced page loading with caching and validation
     */
    async loadAndRenderPage(pageName) {
        const pageConfig = this.pages[pageName];
        let content;

        try {
            // Check cache first
            if (this.pageCache.has(pageName)) {
                content = this.pageCache.get(pageName);
                console.log(`📋 Loading ${pageName} from cache`);
            } else {
                // Load from server with retry logic
                content = await this.loadPageWithRetry(pageConfig.path, 3);
                
                // Validate content
                if (!this.validatePageContent(content)) {
                    throw new Error('Invalid page content received');
                }

                // Cache the content
                this.cachePageContent(pageName, content);
            }

            // Render content safely
            await this.renderPageContent(content);

            // Initialize page-specific functionality
            if (pageConfig.init) {
                await this.executePageInitialization(pageConfig.init, pageName);
            }

        } catch (error) {
            console.error(`Failed to load page ${pageName}:`, error);
            throw error;
        }
    }

    /**
     * Load page with retry logic
     */
    async loadPageWithRetry(path, maxRetries) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 Loading ${path} (attempt ${attempt}/${maxRetries})`);
                
                const response = await fetch(path, {
                    cache: attempt === 1 ? 'default' : 'no-cache',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const content = await response.text();
                console.log(`✅ Successfully loaded ${path}`);
                return content;

            } catch (error) {
                lastError = error;
                console.warn(`⚠️ Attempt ${attempt} failed:`, error.message);

                // Wait before retry (exponential backoff)
                if (attempt < maxRetries) {
                    await this.delay(Math.pow(2, attempt) * 500);
                }
            }
        }

        throw lastError;
    }

    /**
     * Validate page content
     */
    validatePageContent(content) {
        if (!content || typeof content !== 'string') {
            return false;
        }

        // Check for minimum viable content
        const hasValidHtml = content.includes('<') && content.includes('>');
        const isNotEmpty = content.trim().length > 50;

        return hasValidHtml && isNotEmpty;
    }

    /**
     * Cache page content with size management
     */
    cachePageContent(pageName, content) {
        // Manage cache size
        if (this.pageCache.size >= this.config.maxCacheSize) {
            const oldestEntry = this.pageCache.keys().next().value;
            this.pageCache.delete(oldestEntry);
            console.log(`🗑️ Removed ${oldestEntry} from cache (size limit)`);
        }

        this.pageCache.set(pageName, content);
        console.log(`💾 Cached ${pageName} (${Math.round(content.length / 1024)}KB)`);
    }

    /**
     * Safely render page content
     */
    async renderPageContent(content) {
        if (!this.contentContainer) {
            throw new Error('Content container not found');
        }

        // Create a document fragment for safe HTML parsing
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;

        // Sanitize any potentially dangerous content
        this.sanitizeContent(tempDiv);

        // Replace content
        this.contentContainer.innerHTML = tempDiv.innerHTML;

        // Process any embedded scripts safely
        await this.processEmbeddedScripts();
    }

    /**
     * Sanitize content for security
     */
    sanitizeContent(element) {
        // Remove any script tags that aren't from our allowed sources
        const scripts = element.querySelectorAll('script');
        scripts.forEach(script => {
            const src = script.getAttribute('src');
            if (src && !this.isAllowedScriptSource(src)) {
                script.remove();
                console.warn('🔒 Removed external script:', src);
            }
        });

        // Remove any onclick handlers and similar
        const allElements = element.querySelectorAll('*');
        allElements.forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
            });
        });
    }

    /**
     * Check if script source is allowed
     */
    isAllowedScriptSource(src) {
        const allowedDomains = [
            'cdnjs.cloudflare.com',
            'cdn.jsdelivr.net',
            location.origin
        ];

        return allowedDomains.some(domain => src.includes(domain));
    }

    /**
     * Execute page initialization with error boundary
     */
    async executePageInitialization(initFunction, pageName) {
        try {
            console.log(`⚙️ Initializing ${pageName} page`);
            await initFunction();
            console.log(`✅ ${pageName} page initialization complete`);
        } catch (error) {
            console.error(`❌ ${pageName} page initialization failed:`, error);
            throw error;
        }
    }

    /**
     * Enhanced cleanup with comprehensive resource management
     */
    async cleanupCurrentPage() {
        if (!this.currentPage) return;

        const pageConfig = this.pages[this.currentPage];
        
        try {
            // Execute page-specific cleanup
            if (pageConfig?.cleanup) {
                await pageConfig.cleanup();
            }

            // General cleanup
            this.cleanupEventListeners();
            this.cleanupTimers();
            this.cleanupDOMObservers();

            console.log(`🧹 Cleaned up ${this.currentPage} page`);

        } catch (error) {
            console.error(`Cleanup error for ${this.currentPage}:`, error);
        }
    }

    /**
     * Performance monitoring and tracking
     */
    initializePerformanceMonitoring() {
        if (!window.PerformanceObserver) {
            console.warn('Performance monitoring not supported');
            return;
        }

        try {
            // Monitor navigation timing
            this.performanceMonitor = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    if (entry.entryType === 'navigation') {
                        this.trackNavigationPerformance(entry);
                    }
                });
            });

            this.performanceMonitor.observe({ entryTypes: ['navigation', 'measure'] });
            console.log('📊 Performance monitoring enabled');

        } catch (error) {
            console.warn('Performance monitoring setup failed:', error);
        }
    }

    /**
     * Track page performance metrics
     */
    trackPagePerformance(pageName, loadTime) {
        const perfData = {
            page: pageName,
            loadTime: Math.round(loadTime),
            timestamp: Date.now(),
            userAgent: navigator.userAgent.substring(0, 50),
            connectionType: navigator.connection?.effectiveType || 'unknown'
        };

        // Store locally for debugging
        if (this.isDevelopment()) {
            console.log('📊 Page Performance:', perfData);
        }

        // Could send to analytics service here
        this.triggerEvent('performance:page-load', perfData);
    }

    // =====================================
    // PAGE-SPECIFIC INITIALIZATION METHODS
    // =====================================

    /**
     * Initialize main page with enhanced 3D environment
     */
    async initMainPage() {
        console.log('🏠 Initializing main page');

        try {
            // Initialize space environment
            if (this.config.enableSpaceEnvironment) {
                await this.enhanceSpaceBackground();
            }

            // Initialize planet selector if available
            const planetSelector = document.querySelector('.planet-selector');
            if (planetSelector) {
                this.initializePlanetSelector();
            }

            // Setup camera controls
            this.initializeCameraControls();

            this.appState.activeFeatures.add('spaceEnvironment');

        } catch (error) {
            console.error('Main page initialization failed:', error);
        }
    }

    /**
     * Initialize enhanced projects page
     */
    async initProjectsPage() {
        console.log('🚀 Initializing enhanced projects page');

        try {
            // Initialize projects page utilities if available
            if (window.projectsPageUtils) {
                window.projectsPageUtils.initializeProjectsPage();
            }

            // Setup project navigation with enhanced features
            this.setupProjectNavigation();
            
            // Initialize project filters and search
            this.setupProjectFiltersAndSearch();
            
            // Setup project card interactions
            this.setupProjectCardInteractions();

            // Initialize any embedded project components
            await this.initializeEmbeddedProjects();

            this.appState.activeFeatures.add('projectsPage');

        } catch (error) {
            console.error('Projects page initialization failed:', error);
        }
    }

    /**
     * Setup enhanced project navigation
     */
    setupProjectNavigation() {
        const navButtons = document.querySelectorAll('.side-nav .nav-button');
        
        navButtons.forEach(button => {
            this.addEventListener(button, 'click', (e) => {
                e.preventDefault();
                
                // Update active states
                navButtons.forEach(btn => {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-current', 'false');
                });
                
                button.classList.add('active');
                button.setAttribute('aria-current', 'true');
                
                // Enhanced scroll to target
                const targetId = button.getAttribute('href');
                const targetProject = document.querySelector(targetId);
                
                if (targetProject) {
                    this.smoothScrollToElement(targetProject, {
                        behavior: 'smooth',
                        block: 'center',
                        highlight: true
                    });
                }
            });
        });
    }

    /**
     * Setup project filters and search with debouncing
     */
    setupProjectFiltersAndSearch() {
        // Filter buttons
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(button => {
            this.addEventListener(button, 'click', () => {
                const category = button.getAttribute('data-category');
                this.filterProjects(category);
                
                // Update button states
                filterButtons.forEach(btn => {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-pressed', 'false');
                });
                button.classList.add('active');
                button.setAttribute('aria-pressed', 'true');
            });
        });

        // Search functionality with debouncing
        const searchBox = document.getElementById('project-search');
        if (searchBox) {
            this.addEventListener(searchBox, 'input', 
                this.debounce((e) => this.searchProjects(e.target.value), 300)
            );
        }
    }

    /**
     * Filter projects with animation
     */
    filterProjects(category) {
        const projectCards = document.querySelectorAll('.project-card');
        let visibleCount = 0;

        projectCards.forEach((card, index) => {
            const cardCategory = card.getAttribute('data-category');
            const shouldShow = category === 'all' || cardCategory === category;

            if (shouldShow) {
                card.style.display = 'block';
                card.style.animationDelay = `${index * 0.1}s`;
                card.style.animation = 'fadeInUp 0.6s ease-out';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        // Update project count
        this.updateProjectCount(visibleCount);
        
        // Handle empty state
        this.toggleEmptyState(visibleCount === 0);
    }

    /**
     * Search projects with highlighting
     */
    searchProjects(searchTerm) {
        const projectCards = document.querySelectorAll('.project-card');
        const term = searchTerm.toLowerCase();
        let visibleCount = 0;

        projectCards.forEach(card => {
            const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
            const description = card.querySelector('p')?.textContent.toLowerCase() || '';
            const tags = Array.from(card.querySelectorAll('.tag'))
                .map(tag => tag.textContent.toLowerCase())
                .join(' ');

            const matches = title.includes(term) || 
                          description.includes(term) || 
                          tags.includes(term);

            if (matches || term === '') {
                card.style.display = 'block';
                visibleCount++;
                
                // Highlight search terms
                if (term) {
                    this.highlightSearchTerm(card, term);
                }
            } else {
                card.style.display = 'none';
            }
        });

        this.updateProjectCount(visibleCount);
        this.toggleEmptyState(visibleCount === 0);
    }

    /**
     * Initialize space environment with proper error handling
     */
    async initializeSpaceEnvironment() {
        if (!this.config.enableSpaceEnvironment) return;

        try {
            console.log("🌌 Initializing space environment");

            // Load required scripts in proper order
            const scripts = [
                'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
                'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
                'src/utils/ResourceLoader.js',
                'src/utils/MemoryManager.js',
                'src/components/simulation/solarsystem/Planets/Planet.js',
                'src/components/simulation/solarsystem/Sun.js',
                // ... additional scripts as needed
            ];

            for (const scriptSrc of scripts) {
                await this.loadScript(scriptSrc);
            }

            // Initialize space environment
            if (!window.spaceEnvironment && window.SpaceEnvironment) {
                window.spaceEnvironment = new SpaceEnvironment();
                await window.spaceEnvironment.init();
                console.log("✅ SpaceEnvironment initialized");
            }

            return true;

        } catch (error) {
            console.error("❌ Space environment initialization failed:", error);
            return false;
        }
    }

    /**
     * Load script with Promise and caching
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
                reject(new Error(`Failed to load ${src}`));
            };

            document.head.appendChild(script);
        });
    }

    /**
     * Utility methods
     */
    
    // Event listener management
    addEventListener(element, event, handler) {
        if (!this.eventListeners.has(element)) {
            this.eventListeners.set(element, []);
        }
        
        this.eventListeners.get(element).push({ event, handler });
        element.addEventListener(event, handler);
    }

    // Cleanup event listeners
    cleanupEventListeners() {
        this.eventListeners.forEach((listeners, element) => {
            listeners.forEach(({ event, handler }) => {
                element.removeEventListener(event, handler);
            });
        });
        this.eventListeners.clear();
    }

    // Debounce utility
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

    // Delay utility
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Smooth scroll with options
    smoothScrollToElement(element, options = {}) {
        element.scrollIntoView({
            behavior: options.behavior || 'smooth',
            block: options.block || 'start'
        });

        if (options.highlight) {
            element.classList.add('highlight');
            setTimeout(() => element.classList.remove('highlight'), 2000);
        }
    }

    // Show notification system
    showNotification(message, type = 'info') {
        console.log(`📢 ${type.toUpperCase()}: ${message}`);
        
        // Could implement actual notification UI here
        // For now, just trigger an event
        this.triggerEvent('notification', { message, type });
    }

    // Development environment check
    isDevelopment() {
        return location.hostname === 'localhost' || 
               location.hostname === '127.0.0.1' ||
               location.search.includes('debug=true');
    }

    // Browser feature detection
    is3DSupported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && 
                     canvas.getContext('webgl'));
        } catch (e) {
            return false;
        }
    }

    isJavaScriptEnabled() {
        return true; // If this runs, JS is enabled
    }

    // Rate limiting
    isRateLimited() {
        const now = Date.now();
        const timeSinceLastActivity = now - this.appState.lastActivity;
        
        if (timeSinceLastActivity < 50) { // 50ms rate limit
            return true;
        }
        
        this.appState.lastActivity = now;
        return false;
    }

    // Trigger custom events
    triggerEvent(name, detail = {}) {
        const event = new CustomEvent(`pagemanager:${name}`, {
            detail: { ...detail, timestamp: Date.now() },
            bubbles: true
        });
        
        (this.contentContainer || document).dispatchEvent(event);
    }

    // Global cleanup
    cleanup() {
        console.log('🧹 Performing global cleanup');
        
        this.cleanupEventListeners();
        this.cleanupTimers();
        
        if (this.performanceMonitor) {
            this.performanceMonitor.disconnect();
        }
        
        // Clear caches
        this.pageCache.clear();
        this.componentCache.clear();
    }

    // Placeholder methods for future implementation
    cleanupMainPage() { /* Will be implemented */ }
    cleanupProjectsPage() { /* Will be implemented */ }
    cleanupAboutPage() { /* Will be implemented */ }
    cleanupStorePage() { /* Will be implemented */ }
    cleanupContactPage() { /* Will be implemented */ }
    
    initAboutPage() { console.log('📋 About page initialized'); }
    initStorePage() { console.log('🛒 Store page initialized'); }
    initContactPage() { console.log('📧 Contact page initialized'); }
    
    cleanupTimers() { /* Timer cleanup */ }
    cleanupDOMObservers() { /* Observer cleanup */ }
    setupErrorBoundaries() { /* Error boundary setup */ }
    initializeCacheManagement() { /* Cache management */ }
    // ... additional placeholder methods
}

// Export for global use
if (typeof window !== 'undefined') {
    window.PageManager = PageManager;
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.pageManager) {
            window.pageManager = new PageManager();
        }
    });
} else {
    // DOM already loaded
    if (!window.pageManager) {
        window.pageManager = new PageManager();
    }
}