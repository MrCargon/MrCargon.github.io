/**
 * HeaderManager - Manages the header component functionality
 * Handles mobile menu, scrolling effects, and active link management
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
        this.logoElement = document.querySelector('.logo');
        
        // Event handler bindings to ensure proper 'this' context
        this._handleDocumentClick = this._handleDocumentClick.bind(this);
        this._handleKeydown = this._handleKeydown.bind(this);
        this._handleScroll = this._handleScroll.bind(this);
        this._handleResize = this._handleResize.bind(this);
        this._handleHashChange = this._handleHashChange.bind(this);
        
        // State variables
        this.scrollTicking = false;
        this.resizeTimer = null;
        
        // Initialize header functionality
        this.init();
    }
    
    /**
     * Initialize the HeaderManager
     */
    init() {
        if (!this.header) return;
        
        // Setup mobile menu toggle
        this.setupMobileMenu();
        
        // Setup scroll effects
        this.setupScrollEffects();
        
        // Setup resize handler for responsive adjustments
        this.setupResizeHandler();
        
        // Set initial page title based on URL or default active link
        this.setInitialPageTitle();
        
        // Listen for hash changes to update active link and logo text
        window.addEventListener('hashchange', this._handleHashChange);
    }
    
    /**
     * Handle hash change events
     */
    _handleHashChange() {
        const hash = window.location.hash;
        const pageName = hash ? hash.substring(1) : '';
        if (pageName) {
            this.updateActiveLink(pageName);
        }
    }
    
    /**
     * Set the initial page title based on URL or active link
     */
    setInitialPageTitle() {
        // Try to get current page from URL hash
        const hash = window.location.hash;
        let pageName = hash ? hash.substring(1) : '';
        
        // If no hash in URL, check for active link
        if (!pageName) {
            const activeLink = document.querySelector('.nav-link.active');
            if (activeLink) {
                const href = activeLink.getAttribute('href');
                pageName = href ? href.substring(1) : '';
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
        // Remove existing event listeners to prevent duplicates
        this.removeEventListeners();
        
        // Re-select DOM elements in case they've changed
        this.header = document.querySelector('.main-header');
        this.headerContent = document.querySelector('.header-content');
        this.mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        this.navContainer = document.querySelector('.nav-container');
        this.navLinks = document.querySelectorAll('.main-nav a');
        this.logoElement = document.querySelector('.logo');
        
        // Re-initialize functionality
        this.init();
    }
    
    /**
     * Remove all event listeners
     */
    removeEventListeners() {
        document.removeEventListener('click', this._handleDocumentClick);
        document.removeEventListener('keydown', this._handleKeydown);
        window.removeEventListener('scroll', this._handleScroll);
        window.removeEventListener('resize', this._handleResize);
        window.removeEventListener('hashchange', this._handleHashChange);
        
        if (this.mobileMenuToggle) {
            this.mobileMenuToggle.removeEventListener('click', this._handleMobileMenuToggle);
        }
    }
    
    /**
     * Handle mobile menu toggle click
     * @param {Event} event - Click event
     */
    _handleMobileMenuToggle = (event) => {
        if (!this.mobileMenuToggle) return;
        
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
    }
    
    /**
     * Handle document click for closing menu when clicking outside
     * @param {Event} event - Click event
     */
    _handleDocumentClick(event) {
        // Skip if menu is not open or if clicking inside the header
        if (
            !this.headerContent.classList.contains('menu-active') ||
            this.header.contains(event.target)
        ) {
            return;
        }
        
        // Close the menu
        this.closeMobileMenu();
    }
    
    /**
     * Handle keydown events for accessibility
     * @param {KeyboardEvent} event - Keydown event
     */
    _handleKeydown(event) {
        if (
            event.key === 'Escape' && 
            this.headerContent.classList.contains('menu-active')
        ) {
            this.closeMobileMenu();
            this.mobileMenuToggle.focus(); // Return focus to toggle button
        }
    }
    
    /**
     * Throttled scroll handler
     */
    _handleScroll() {
        if (!this.scrollTicking) {
            window.requestAnimationFrame(() => {
                const currentScrollY = window.scrollY;
                
                // Add scrolled class when page is scrolled
                this.header.classList.toggle('scrolled', currentScrollY > 50);
                
                // Reset ticking state
                this.scrollTicking = false;
            });
            
            this.scrollTicking = true;
        }
    }
    
    /**
     * Debounced resize handler
     */
    _handleResize() {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
            // Reset mobile menu on desktop view
            if (window.innerWidth > 768 && this.headerContent.classList.contains('menu-active')) {
                this.closeMobileMenu();
            }
        }, 250);
    }
    
    /**
     * Setup mobile menu toggle functionality
     */
    setupMobileMenu() {
        if (!this.mobileMenuToggle) return;
        
        // Add click event listener to mobile menu toggle
        this.mobileMenuToggle.addEventListener('click', this._handleMobileMenuToggle);
        
        // Add document click listener to close menu when clicking outside
        document.addEventListener('click', this._handleDocumentClick);
        
        // Add keydown listener for Escape key
        document.addEventListener('keydown', this._handleKeydown);
    }
    
    /**
     * Setup scroll effects for the header
     */
    setupScrollEffects() {
        if (!this.header) return;
        
        // Add scroll event listener
        window.addEventListener('scroll', this._handleScroll);
        
        // Initial scroll check
        this._handleScroll();
    }
    
    /**
     * Setup resize handler for responsive adjustments
     */
    setupResizeHandler() {
        window.addEventListener('resize', this._handleResize);
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
            const href = link.getAttribute('href');
            const linkPageName = href ? href.substring(1) : '';
            const isActive = linkPageName === pageName;
            
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
        if (this.logoElement) {
            this.logoElement.textContent = activeFound ? activePageName : 'MrCargo';
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
    
    /**
     * Clean up resources when instance is no longer needed
     */
    destroy() {
        this.removeEventListeners();
        
        // Clear any timers
        clearTimeout(this.resizeTimer);
        
        // Reset references
        this.header = null;
        this.headerContent = null;
        this.mobileMenuToggle = null;
        this.navContainer = null;
        this.navLinks = null;
        this.logoElement = null;
    }
}

// Export HeaderManager to the global scope if used with ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeaderManager;
} else {
    window.HeaderManager = HeaderManager;
}