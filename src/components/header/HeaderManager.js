/**
 * HeaderManager - Manages the header component functionality
 * Handles mobile menu, scrolling effects, and active link management
 * @version 1.0.0
 */
class HeaderManager {
    /**
     * Creates a new HeaderManager instance
     */
    constructor() {
        // Core elements
        this.header = document.querySelector('.main-header');
        this.headerContent = document.querySelector('.header-content');
        this.mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        this.navContainer = document.querySelector('.nav-container');
        this.navLinks = document.querySelectorAll('.main-nav a');
        
        // Initialize header functionality
        this.init();
    }
    
    /**
     * Initialize the HeaderManager
     */
    init() {
        // Setup mobile menu toggle
        this.setupMobileMenu();
        
        // Setup scroll effects
        this.setupScrollEffects();
        
        // Setup resize handler for responsive adjustments
        this.setupResizeHandler();
        
        // Set initial page title based on URL or default active link
        this.setInitialPageTitle();
        
        // Listen for hash changes to update active link and logo text
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash;
            const pageName = hash ? hash.substring(1) : '';
            if (pageName) {
                this.updateActiveLink(pageName);
            }
        });
    }
    
    setInitialPageTitle() {
        // Try to get current page from URL hash
        const hash = window.location.hash;
        let pageName = hash ? hash.substring(1) : '';
        
        // If no hash in URL, check for active link
        if (!pageName) {
            const activeLink = document.querySelector('.nav-link.active');
            if (activeLink) {
                pageName = activeLink.getAttribute('href')?.substring(1);
            }
        }
        
        // Update active link and page title
        if (pageName) {
            this.updateActiveLink(pageName);
        }
    }

    /**
     * Allow reinitialization of header elements after DOM changes
     */
    reinitialize() {
        // Re-select DOM elements in case they've changed
        this.header = document.querySelector('.main-header');
        this.headerContent = document.querySelector('.header-content');
        this.mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        this.navContainer = document.querySelector('.nav-container');
        this.navLinks = document.querySelectorAll('.main-nav a');
        
        // Re-initialize functionality
        this.init();
    }
    
    /**
     * Setup mobile menu toggle functionality
     */
    setupMobileMenu() {
        if (!this.mobileMenuToggle) return;
        
        this.mobileMenuToggle.addEventListener('click', () => {
            const isExpanded = this.mobileMenuToggle.getAttribute('aria-expanded') === 'true';
            
            // Toggle expanded state
            this.mobileMenuToggle.setAttribute('aria-expanded', !isExpanded);
            
            // Toggle menu active class
            this.headerContent.classList.toggle('menu-active');
            
            // Toggle visibility class on nav container
            if (this.navContainer) {
                this.navContainer.classList.toggle('nav-visible');
            }
            
            // Announce menu state for screen readers
            const menuState = !isExpanded ? 'opened' : 'closed';
            this.mobileMenuToggle.setAttribute('aria-label', `Menu ${menuState}`);
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (event) => {
            // Skip if menu is not open or if clicking inside the header
            if (
                !this.headerContent.classList.contains('menu-active') ||
                this.header.contains(event.target)
            ) {
                return;
            }
            
            // Close the menu
            this.mobileMenuToggle.setAttribute('aria-expanded', 'false');
            this.headerContent.classList.remove('menu-active');
            if (this.navContainer) {
                this.navContainer.classList.remove('nav-visible');
            }
        });
        
        // Handle Escape key to close menu
        document.addEventListener('keydown', (event) => {
            if (
                event.key === 'Escape' && 
                this.headerContent.classList.contains('menu-active')
            ) {
                this.mobileMenuToggle.setAttribute('aria-expanded', 'false');
                this.headerContent.classList.remove('menu-active');
                if (this.navContainer) {
                    this.navContainer.classList.remove('nav-visible');
                }
                this.mobileMenuToggle.focus(); // Return focus to toggle button
            }
        });
    }
    
    /**
     * Setup scroll effects for the header
     */
    setupScrollEffects() {
        if (!this.header) return;
        
        // Debounced scroll handler using requestAnimationFrame for performance
        let ticking = false;
        let lastScrollY = window.scrollY;
        
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const currentScrollY = window.scrollY;
                    
                    // Add scrolled class when page is scrolled
                    this.header.classList.toggle('scrolled', currentScrollY > 50);
                    
                    // Reset ticking state
                    ticking = false;
                    lastScrollY = currentScrollY;
                });
                
                ticking = true;
            }
        });
    }
    
    /**
     * Setup resize handler for responsive adjustments
     */
    setupResizeHandler() {
        // Debounced resize handler
        let resizeTimer;
        
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                // Reset mobile menu on desktop view
                if (window.innerWidth > 768 && this.headerContent.classList.contains('menu-active')) {
                    this.mobileMenuToggle.setAttribute('aria-expanded', 'false');
                    this.headerContent.classList.remove('menu-active');
                    if (this.navContainer) {
                        this.navContainer.classList.remove('nav-visible');
                    }
                }
            }, 250);
        });
    }
    
    /**
     * Update active link in the navigation
     * @param {string} pageName - Current page name
     */
    updateActiveLink(pageName) {
        if (!this.navLinks.length) return;
        
        let activePageName = 'MrCargo'; // Default
        let activeFound = false;
        
        this.navLinks.forEach(link => {
            const href = link.getAttribute('href')?.substring(1);
            const isActive = href === pageName;
            
            // Skip disabled links
            if (link.classList.contains('disabled')) return;
            
            // Update active state
            link.classList.toggle('active', isActive);
            link.setAttribute('aria-current', isActive ? 'page' : 'false');
            
            // Get the page name from the active link
            if (isActive) {
                activeFound = true;
                // Get the text content of the span inside the link (just the page name, not the badges)
                const spanText = link.querySelector('span:first-child');
                if (spanText) {
                    activePageName = spanText.textContent.trim();
                }
            }
        });
        
        // Update the logo text with the current page name
        const logoElement = document.querySelector('.logo');
        if (logoElement) {
            logoElement.textContent = activeFound ? activePageName : 'MrCargo';
        }
        
        // Close mobile menu after navigation on mobile devices
        if (window.innerWidth <= 768) {
            this.closeMobileMenu();
        }
    }
    
    /**
     * Close mobile menu if open
     */
    closeMobileMenu() {
        if (
            this.mobileMenuToggle && 
            this.headerContent.classList.contains('menu-active')
        ) {
            this.mobileMenuToggle.setAttribute('aria-expanded', 'false');
            this.headerContent.classList.remove('menu-active');
            if (this.navContainer) {
                this.navContainer.classList.remove('nav-visible');
            }
        }
    }
}

// Export HeaderManager to the global scope if used with ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeaderManager;
} else {
    window.HeaderManager = HeaderManager;
}