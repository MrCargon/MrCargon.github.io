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
        
        this.navLinks.forEach(link => {
            const href = link.getAttribute('href')?.substring(1);
            const isActive = href === pageName;
            
            // Skip disabled links
            if (link.classList.contains('disabled')) return;
            
            link.classList.toggle('active', isActive);
            link.setAttribute('aria-current', isActive ? 'page' : 'false');
        });
        
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