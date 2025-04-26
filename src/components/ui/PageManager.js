/**
 * PageManager - Single Page Application (SPA) navigation system
 * Optimized for GitHub Pages deployment with progressive enhancement
 */
class PageManager {
    /**
     * Creates a new PageManager instance
     */
    constructor() {
        // Core properties
        this.contentContainer = document.getElementById('page-container');
        this.pageCache = new Map();
        this.currentPage = null;
        this.isTransitioning = false;
        this.headerManager = null;
        
        // Configuration - page definitions
        this.pages = {
            main: {
                path: 'src/components/pages/mainPage.html',
                title: 'Home',
                init: () => this.initMainPage()
            },
            projects: {
                path: 'src/components/pages/projectsPage.html',
                title: 'Projects',
                init: () => this.initProjectsPage()
            },
            about: {
                path: 'src/components/pages/aboutPage.html',
                title: 'About',
                init: () => this.initAboutPage()
            },
            store: {
                path: 'src/components/pages/storePage.html',
                title: 'Store',
                init: () => this.initStorePage()
            },
            contact: {
                path: 'src/components/pages/contactPage.html',
                title: 'Contact',
                init: () => this.initContactPage()
            }
        };
        
        // Initialize the application
        this.init();
    }
    
    /**
     * Initialize the PageManager
     */
    init() {
        // Set up header management
        this.initializeHeaderManager();
        
        // Setup event handlers for navigation
        this.setupRouting();
        
        // Handle initial route based on URL hash
        this.handleInitialRoute();
        
        // Preload other pages for faster navigation
        this.preloadPages();
    }

    /**
     * Initialize HeaderManager if available
     */
    initializeHeaderManager() {
        // Check if HeaderManager class is available
        if (window.HeaderManager) {
            this.headerManager = new HeaderManager();
            console.log('HeaderManager initialized');
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
    }
    
    /**
     * Handle navigation click events with proper event delegation
     * @param {MouseEvent} event - Click event
     */
    handleNavigationClick(event) {
        const link = event.target.closest('.main-nav a');
        if (!link) return;
        
        event.preventDefault();
        
        // Check if the link is disabled
        if (link.classList.contains('disabled')) {
            console.log('Navigation prevented: This feature is coming soon.');
            return;
        }
        
        const pageName = link.getAttribute('href').substring(1);
        this.navigateToPage(pageName);
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
        // Only handle when focused on navigation links
        const focusedLink = document.activeElement;
        if (!focusedLink || !focusedLink.classList.contains('nav-link')) return;
        
        // Handle Enter or Space key
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            
            // Check if the link is disabled
            if (focusedLink.classList.contains('disabled')) return;
            
            const pageName = focusedLink.getAttribute('href').substring(1);
            this.navigateToPage(pageName);
        }
    }

    /**
     * Handle initial routing when the page first loads
     */
    async handleInitialRoute() {
        // Initialize space background first
        await this.initializeSpaceBackground();
        // Get the initial page from URL hash or default to about
        const hash = window.location.hash.substring(1) || 'about';
        await this.navigateToPage(hash, false);
    }

    /**
     * Preload pages for faster navigation
     */
    preloadPages() {
        // Use requestIdleCallback if available, or setTimeout as fallback
        const preloader = window.requestIdleCallback || setTimeout;
        
        preloader(() => {
            // Get current page to avoid preloading it
            const currentPageName = this.currentPage || 'about';
            
            // Preload all other pages with low priority
            Object.keys(this.pages).forEach(pageName => {
                if (pageName !== currentPageName) {
                    this.prefetchPage(pageName);
                }
            });
        }, { timeout: 2000 });
    }
    
    /**
     * Prefetch a page in the background
     * @param {string} pageName - Page to prefetch
     */
    async prefetchPage(pageName) {
        // Skip if already cached
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
        } catch (error) {
            // Silently fail on prefetch - it's just an optimization
            console.debug(`Background prefetch failed for ${pageName}:`, error);
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
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            
            document.head.appendChild(script);
        });
    }

    /**
     * Initialize the space background for the main page
     * Lazily loads Three.js and the SpaceEnvironment script
     */
    async initializeSpaceBackground() {
        try {
            console.log("Starting space environment initialization");
            
            // Load Three.js
            await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js');
            
            // Load OrbitControls
            await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
            
            // Load utility files
            await this.loadScript('src/utils/ResourceLoader.js');
            await this.loadScript('src/utils/MemoryManager.js');
            
            // Load celestial body classes
            await this.loadScript('src/components/simulation/solarsystem/Planets/Planet.js');
            await this.loadScript('src/components/simulation/solarsystem/Sun.js');
            await this.loadScript('src/components/simulation/solarsystem/Planets/Mercury.js');
            await this.loadScript('src/components/simulation/solarsystem/Planets/Venus.js');
            await this.loadScript('src/components/simulation/solarsystem/Planets/Earth.js');
            await this.loadScript('src/components/simulation/solarsystem/Planets/Mars.js');
            await this.loadScript('src/components/simulation/solarsystem/Planets/Jupiter.js');
            await this.loadScript('src/components/simulation/solarsystem/Planets/Saturn.js');
            await this.loadScript('src/components/simulation/solarsystem/Planets/Uranus.js');
            await this.loadScript('src/components/simulation/solarsystem/Planets/Neptune.js');
            
            // Load environment features
            await this.loadScript('src/components/simulation/solarsystem/Galaxy.js');
            await this.loadScript('src/components/simulation/solarsystem/AsteroidBelt.js');
            await this.loadScript('src/components/simulation/solarsystem/HabitableZone.js');
            
            // Load main controller classes 
            await this.loadScript('src/components/simulation/solarsystem/SolarSystem.js');
            await this.loadScript('src/components/simulation/solarsystem/SpaceEnvironment.js');
            
            // Create and initialize space environment
            if (!window.spaceEnvironment) {
                console.log("Creating new SpaceEnvironment instance");
                window.spaceEnvironment = new SpaceEnvironment();
                await window.spaceEnvironment.init();
                console.log("SpaceEnvironment initialization complete");
                
                // Show immediately
                window.spaceEnvironment.show();
            }
            
            return true;
        } catch (error) {
            console.error("Failed to initialize space environment:", error);
            console.error(error.stack);
            return false;
        }
    }

    /**
     * Navigate to a specific page
     * @param {string} pageName - Name of the page to navigate to
     * @param {boolean} updateHistory - Whether to update browser history
     */
    async navigateToPage(pageName, updateHistory = true) {
        // Skip if already transitioning, invalid page, or same page
        if (this.isTransitioning || !this.pages[pageName] || pageName === this.currentPage) {
            return;
        }
    
        this.isTransitioning = true;
        
        // Trigger navigation start event for potential analytics
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
    
            // Update UI state - navigation and document title
            this.updateUIState(pageName);
            
            // Set page-specific body class
            this.setPageBodyClass(pageName);
    
            // Complete transition animation
            await this.completePageTransition();
            
            // Trigger navigation complete event
            this.triggerEvent('navigation:complete', { page: pageName });
        } catch (error) {
            console.error('Navigation error:', error);
            this.handleNavigationError();
            
            // Trigger navigation error event
            this.triggerEvent('navigation:error', { page: pageName, error });
        } finally {
            this.isTransitioning = false;
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
        
        this.contentContainer?.dispatchEvent(event);
    }

    /**
     * Set body class based on current page
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
        
        // Space environment visibility handling
        if (pageName === 'main') {
            // On main page, show and enable interaction with space environment
            this.initializeSpaceBackground().then(success => {
                if (success && window.spaceEnvironment) {
                    // Make fully visible and interactive
                    window.spaceEnvironment.show(true);
                    console.log("Space environment fully enabled for main page");
                }
            });
        } else if (window.spaceEnvironment) {
            // On other pages, show as background but disable interaction
            window.spaceEnvironment.show(false); // Show but make non-interactive
            console.log("Space environment visible as background only");
        }
    }

    /**
     * Make the space background visible
     */
    enhanceSpaceBackground() {
        console.log("Enhancing space background");
        
        if (window.spaceEnvironment?.initialized) {
            // Show the environment
            window.spaceEnvironment.show();
            
            // Fix z-index for main content to ensure it's above the background
            const contentContainer = document.getElementById('content');
            if (contentContainer) {
                contentContainer.style.position = 'relative';
                contentContainer.style.zIndex = '1';
                console.log("Set content container z-index to 1");
            }
            
            // Ensure header is visible over background
            const headerContainer = document.getElementById('header-container');
            if (headerContainer) {
                headerContainer.style.position = 'relative';
                headerContainer.style.zIndex = '2';
            }
            
            // Ensure page container is visible
            const pageContainer = document.getElementById('page-container'); 
            if (pageContainer) {
                pageContainer.style.position = 'relative';
                pageContainer.style.zIndex = '1';
            }
            
            // Ensure footer is visible
            const footerContainer = document.getElementById('footer-container');
            if (footerContainer) {
                footerContainer.style.position = 'relative';
                footerContainer.style.zIndex = '2';
            }
            
            // Force a rerender
            if (typeof window.spaceEnvironment.handleResize === 'function') {
                window.spaceEnvironment.handleResize();
            }
            
            // Pre-select first planet after a brief delay
            setTimeout(() => {
                const firstPlanetBtn = document.querySelector('.planet-btn');
                if (firstPlanetBtn) {
                    firstPlanetBtn.click();
                    console.log("First planet selected");
                }
            }, 500);
        } else {
            console.warn("SpaceEnvironment not properly initialized");
            // Try to initialize it again
            this.initializeSpaceBackground().then(success => {
                if (success) {
                    console.log("Space environment initialized on retry");
                    this.enhanceSpaceBackground(); // Try again
                }
            });
        }
    }

    /**
     * Begin page transition animation
     */
    async startPageTransition() {
        if (!this.contentContainer) return Promise.resolve();
        
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

        // Cleanup previous page content (remove event listeners, etc.)
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
        // This is a placeholder for more specific cleanup
        // In a larger app, you would remove event listeners, stop animations, etc.
        
        // Example: Clean up any data visualization charts
        if (window.charts && window.charts.length) {
            window.charts.forEach(chart => {
                if (chart && typeof chart.destroy === 'function') {
                    chart.destroy();
                }
            });
            window.charts = [];
        }
    }

    /**
     * Update UI state after page navigation
     * @param {string} pageName - Current page name
     */
    updateUIState(pageName) {
        // Update header navigation if HeaderManager exists
        if (this.headerManager && typeof this.headerManager.updateActiveLink === 'function') {
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
        document.title = `${this.pages[pageName].title} - MrCargo Portfolio`;
        
        this.currentPage = pageName;
    }

    /**
     * Complete page transition animation
     */
    async completePageTransition() {
        if (!this.contentContainer) return Promise.resolve();
        
        this.contentContainer.style.opacity = '1';
        this.contentContainer.style.transform = 'translateY(0)';
        return new Promise(resolve => setTimeout(resolve, 300));
    }

    /**
     * Handle navigation errors
     */
    handleNavigationError() {
        if (!this.contentContainer) return;
        
        this.contentContainer.innerHTML = `
            <div class="error-container">
                <h2>Navigation Error</h2>
                <p>Failed to load the requested page. Please try again.</p>
                <button onclick="window.location.reload()" class="retry-button">Reload Page</button>
            </div>
        `;
    }

    // ----------------
    // Page-specific initialization methods
    // ----------------

    /**
     * Initialize main page functionality
     */
    async initMainPage() {
        console.log('Initializing main page');
        
        // Make sure space environment is visible
        this.enhanceSpaceBackground();
        
        // Initialize planet selector if it exists
        const planetSelector = document.querySelector('.planet-selector');
        if (planetSelector) {
            this.initPlanetSelector();
        }
    }

    /**
     * Initialize planet selector functionality
     */
    initPlanetSelector() {
        const selector = document.querySelector('.planet-selector');
        const leftBtn = document.querySelector('.scroll-indicator.left');
        const rightBtn = document.querySelector('.scroll-indicator.right');
        
        if (!selector || !leftBtn || !rightBtn) return;
        
        // Scroll left/right buttons
        leftBtn.addEventListener('click', () => {
            selector.scrollBy({ left: -200, behavior: 'smooth' });
        });
        
        rightBtn.addEventListener('click', () => {
            selector.scrollBy({ left: 200, behavior: 'smooth' });
        });
        
        // Use debounced scroll handler for better performance
        const updateScrollButtons = this.debounce(() => {
            leftBtn.style.opacity = selector.scrollLeft > 0 ? '1' : '0.3';
            rightBtn.style.opacity = 
                selector.scrollLeft < selector.scrollWidth - selector.clientWidth - 10 ? '1' : '0.3';
        }, 50);
        
        // Set up event listeners
        selector.addEventListener('scroll', updateScrollButtons);
        window.addEventListener('resize', updateScrollButtons);
        
        // Initial update
        updateScrollButtons();
        
        // Planet selection functionality
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
                
                // Update planet info
                const planetName = button.getAttribute('data-planet');
                this.updatePlanetInfo(planetName);
                
                // Update progress indicator position (new functionality)
                if (progressIndicator) {
                    const totalPlanets = planetButtons.length;
                    const segmentWidth = 100 / totalPlanets;
                    
                    progressIndicator.style.width = segmentWidth + '%';
                    progressIndicator.style.left = (segmentWidth * index) + '%';
                }
            });
        });
        
        // Toggle planet details (new functionality)
        const toggleInfoBtn = document.querySelector('.toggle-info-btn');
        const planetDetails = document.querySelector('.planet-details');
        
        if (toggleInfoBtn && planetDetails) {
            toggleInfoBtn.addEventListener('click', function() {
                this.classList.toggle('collapsed');
                planetDetails.classList.toggle('collapsed');
                
                // Update aria attributes for accessibility
                const isCollapsed = planetDetails.classList.contains('collapsed');
                this.setAttribute('aria-expanded', !isCollapsed);
                
                // Change the icon text based on state
                const iconSpan = this.querySelector('.icon');
                if (iconSpan) {
                    iconSpan.textContent = isCollapsed ? '↑' : '↓';
                }
            });
            
            // Set initial state
            toggleInfoBtn.setAttribute('aria-expanded', 'true');
        }
        
        // Select the first planet by default
        if (planetButtons.length > 0) {
            planetButtons[0].click();
        }
    }
    
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
     * Update planet information panel with selected planet data
     * @param {string} planetName - Name of the selected planet
     */
    updatePlanetInfo(planetName) {
        // Planet data
        const planetData = {
            Sun: {
                description: "The star at the center of our Solar System.",
                diameter: "1,392,700 km",
                distance: "0 km",
                orbitalPeriod: "N/A"
            },
            Mercury: {
                description: "The smallest and innermost planet in the Solar System.",
                diameter: "4,880 km",
                distance: "57.9 million km",
                orbitalPeriod: "88 days"
            },
            Venus: {
                description: "The second planet from the Sun with a thick toxic atmosphere.",
                diameter: "12,104 km",
                distance: "108.2 million km",
                orbitalPeriod: "225 days"
            },
            Earth: {
                description: "Our home planet, the only known celestial body to harbor life.",
                diameter: "12,742 km",
                distance: "149.6 million km",
                orbitalPeriod: "365.25 days"
            },
            Mars: {
                description: "The Red Planet, known for its iron oxide surface.",
                diameter: "6,779 km",
                distance: "227.9 million km",
                orbitalPeriod: "687 days"
            },
            Jupiter: {
                description: "The largest planet in our Solar System, a gas giant.",
                diameter: "139,820 km",
                distance: "778.5 million km",
                orbitalPeriod: "11.86 years"
            },
            Saturn: {
                description: "Known for its prominent ring system composed of ice and rock particles.",
                diameter: "116,460 km",
                distance: "1.4 billion km",
                orbitalPeriod: "29.46 years"
            },
            Uranus: {
                description: "An ice giant with a tilted rotation axis of 97.8 degrees.",
                diameter: "50,724 km",
                distance: "2.9 billion km",
                orbitalPeriod: "84.01 years"
            },
            Neptune: {
                description: "The windiest planet in our Solar System, with winds up to 2,100 km/h.",
                diameter: "49,244 km",
                distance: "4.5 billion km",
                orbitalPeriod: "164.8 years"
            }
        };
        
        const planet = planetData[planetName];
        if (!planet) return;
        
        // Update planet info panel elements if they exist
        const nameEl = document.getElementById('planet-name');
        const descEl = document.getElementById('planet-description');
        const diameterEl = document.getElementById('planet-diameter');
        const distanceEl = document.getElementById('planet-distance');
        const orbitalEl = document.getElementById('planet-orbital-period');
        
        if (nameEl) nameEl.textContent = planetName;
        if (descEl) descEl.textContent = planet.description;
        if (diameterEl) diameterEl.textContent = planet.diameter;
        if (distanceEl) distanceEl.textContent = planet.distance;
        if (orbitalEl) orbitalEl.textContent = planet.orbitalPeriod;
    }

    /**
     * Initialize projects page functionality
     */
    async initProjectsPage() {
        console.log('Initializing projects page');
        
        // Project navigation
        const projectNavButtons = document.querySelectorAll('.side-nav .nav-button');
        projectNavButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Update active state
                projectNavButtons.forEach(btn => {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-current', 'false');
                });
                
                button.classList.add('active');
                button.setAttribute('aria-current', 'true');
                
                // Scroll to target project
                const targetId = button.getAttribute('href');
                const targetProject = document.querySelector(targetId);
                
                if (targetProject) {
                    targetProject.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    
                    // Add highlight effect
                    targetProject.classList.add('highlight');
                    setTimeout(() => targetProject.classList.remove('highlight'), 1000);
                }
            });
        });

        // Project cards interaction using event delegation
        const projectContainer = document.querySelector('.projects-container');
        if (projectContainer) {
            projectContainer.addEventListener('click', (e) => {
                const card = e.target.closest('.project-card');
                if (card) {
                    console.log(`Project clicked: ${card.id}`);
                    // Here you would show project details or open a modal
                }
            });
            
            // Keyboard accessibility
            projectContainer.addEventListener('keydown', (e) => {
                const card = e.target.closest('.project-card');
                if (card && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    card.click();
                }
            });
        }
    }

    /**
     * Initialize about page functionality
     */
    async initAboutPage() {
        console.log('Initializing about page');
        // No specific initialization needed
    }

    /**
     * Initialize store page functionality
     */
    async initStorePage() {
        console.log('Initializing store page');
        
        // Product filtering using event delegation
        const filterContainer = document.querySelector('.filter-container');
        if (!filterContainer) return;
        
        filterContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.filter-btn');
            if (!button) return;
            
            // Update active state
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            button.classList.add('active');
            
            // Filter products by category
            const category = button.getAttribute('data-category');
            this.filterProducts(category);
        });
        
        // Filter all products by default
        const allButton = document.querySelector('.filter-btn[data-category="all"]');
        if (allButton) allButton.click();
    }
    
    /**
     * Filter products by category
     * @param {string} category - Category to filter by
     */
    filterProducts(category) {
        const products = document.querySelectorAll('.product-card');
        
        products.forEach(product => {
            const display = (category === 'all' || product.getAttribute('data-category') === category) 
                ? 'block' : 'none';
            product.style.display = display;
        });
    }

    /**
     * Initialize contact page with form validation
     */
    async initContactPage() {
        console.log('Initializing contact page');
        
        // Add form validation if contact form exists
        const contactForm = document.getElementById('contact-form');
        if (!contactForm) return;
        
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Validate and submit form
            if (this.validateContactForm(contactForm)) {
                // Show success message
                const submitButton = contactForm.querySelector('.submit-button');
                if (submitButton) {
                    submitButton.innerHTML = '<span>Message Sent!</span>';
                    submitButton.classList.add('success');
                    
                    setTimeout(() => {
                        submitButton.innerHTML = '<span>Send Message</span>';
                        submitButton.classList.remove('success');
                    }, 3000);
                }
                
                contactForm.reset();
            }
        });
        
        // Input validation using event delegation
        contactForm.addEventListener('blur', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                this.validateInput(e.target);
            }
        }, true);
        
        // Clear errors on input
        contactForm.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                const errorElement = document.getElementById(`${e.target.id}-error`);
                if (errorElement) errorElement.textContent = '';
            }
        });
    }
    
    /**
     * Validate contact form
     * @param {HTMLFormElement} form - The contact form element
     * @returns {boolean} - Whether the form is valid
     */
    validateContactForm(form) {
        const nameInput = form.querySelector('#name');
        const emailInput = form.querySelector('#email');
        const messageInput = form.querySelector('#message');
        
        let isValid = true;
        
        if (nameInput && !this.validateInput(nameInput)) isValid = false;
        if (emailInput && !this.validateInput(emailInput)) isValid = false;
        if (messageInput && !this.validateInput(messageInput)) isValid = false;
        
        return isValid;
    }
    
    /**
     * Validate a form input
     * @param {HTMLInputElement|HTMLTextAreaElement} input - Input element to validate
     * @returns {boolean} - Whether the input is valid
     */
    validateInput(input) {
        const errorElement = document.getElementById(`${input.id}-error`);
        
        // Reset error
        if (errorElement) errorElement.textContent = '';
        
        // Check required
        if (input.hasAttribute('required') && !input.value.trim()) {
            if (errorElement) errorElement.textContent = 'This field is required';
            return false;
        }
        
        // Check email format
        if (input.type === 'email' && input.value.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input.value.trim())) {
                if (errorElement) errorElement.textContent = 'Please enter a valid email address';
                return false;
            }
        }
        
        return true;
    }
}

// Export PageManager to the global scope if used with ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PageManager;
} else {
    window.PageManager = PageManager;
}