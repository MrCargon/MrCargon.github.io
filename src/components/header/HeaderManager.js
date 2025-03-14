/**
 * HeaderManager - Manages the header component functionality
 * Handles mobile menu, scrolling effects, and active link management
 * 
 * @class
 * @version 1.1.0
 * @author MrCargo
 */
class HeaderManager {
    /**
     * Creates a new HeaderManager instance
     * @constructor
     */
    constructor() {
        // Core elements
        this.header = document.querySelector('.main-header');
        this.headerContent = document.querySelector('.header-content');
        this.mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        this.navContainer = document.querySelector('.nav-container');
        this.navLinks = document.querySelectorAll('.main-nav a');
        this.logoElement = document.querySelector('.logo');
        
        // Track current page
        this.currentPage = '';
        
        // Bound event handlers (for easier removal)
        this._boundHandleOutsideClick = this.handleOutsideClick.bind(this);
        this._boundHandleEscapeKey = this.handleEscapeKey.bind(this);
        this._boundHandleHashChange = this.handleHashChange.bind(this);
        this._boundHandleResize = this.handleResize.bind(this);
        
        // Initialize header functionality
        this.init();
    }
    
    /**
     * Initialize the HeaderManager
     * @public
     */
    init() {
        if (!this.header) {
            console.warn('HeaderManager: Header element not found');
            return; // Fail safely if elements don't exist
        }
        
        // Set initial states
        this.setInitialState();
        
        // Setup mobile menu toggle
        this.setupMobileMenu();
        
        // Setup scroll effects
        this.setupScrollEffects();
        
        // Setup resize handler for responsive adjustments
        this.setupResizeHandler();
        
        // Set initial page title based on URL or default active link
        this.setInitialPageTitle();
        
        // Listen for hash changes to update active link and logo text
        window.addEventListener('hashchange', this._boundHandleHashChange);
    }
    
    /**
     * Set the initial state of the header based on viewport width
     * @private
     */
    setInitialState() {
        const isMobile = window.innerWidth <= 835;
        
        // Set initial navigation container display
        if (this.navContainer) {
            this.navContainer.style.display = isMobile ? 'none' : 'flex';
        }
        
        // Make sure menu starts in closed state
        if (this.headerContent) {
            this.headerContent.classList.remove('menu-active');
        }
        
        if (this.mobileMenuToggle) {
            this.mobileMenuToggle.setAttribute('aria-expanded', 'false');
        }
    }
    
    /**
     * Clean up event listeners and resources
     * Should be called when the component is removed from DOM
     * @public
     */
    destroy() {
        // Remove event listeners
        document.removeEventListener('click', this._boundHandleOutsideClick);
        document.removeEventListener('keydown', this._boundHandleEscapeKey);
        window.removeEventListener('hashchange', this._boundHandleHashChange);
        
        // Remove ResizeObserver if it exists
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
        
        // Remove IntersectionObserver if it exists
        if (this._scrollObserver) {
            this._scrollObserver.disconnect();
        }
        
        // Remove window resize event if ResizeObserver fallback was used
        window.removeEventListener('resize', this._boundHandleResize);
    }
    
    /**
     * Handle URL hash changes
     * @private
     */
    handleHashChange() {
        const hash = window.location.hash;
        const pageName = hash ? hash.substring(1) : '';
        if (pageName) {
            this.updateActiveLink(pageName);
        }
    }
    
    /**
     * Set the initial page title based on URL hash or active link
     * @private
     */
    setInitialPageTitle() {
        // Try to get current page from URL hash
        const hash = window.location.hash;
        let pageName = hash ? hash.substring(1) : '';
        
        // If no hash in URL, check for active link
        if (!pageName) {
            const activeLink = document.querySelector('.nav-link.active');
            if (activeLink) {
                pageName = activeLink.getAttribute('href')?.substring(1) || '';
            }
        }
        
        // Update active link and page title
        if (pageName) {
            this.updateActiveLink(pageName);
        }
    }

    /**
     * Allow reinitialization of header elements after DOM changes
     * @public
     */
    reinitialize() {
        // Clean up existing event listeners
        this.destroy();
        
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
     * Setup mobile menu toggle functionality
     * @private
     */
    setupMobileMenu() {
        if (!this.mobileMenuToggle) {
            console.warn('HeaderManager: Mobile menu toggle element not found');
            return;
        }
        
        // Set initial ARIA states
        this.mobileMenuToggle.setAttribute('aria-expanded', 'false');
        this.mobileMenuToggle.setAttribute('aria-label', 'Menu closed');
        
        // Ensure proper initial state
        if (this.headerContent) {
            this.headerContent.classList.remove('menu-active');
        }
        
        this.mobileMenuToggle.addEventListener('click', () => {
            const isExpanded = this.mobileMenuToggle.getAttribute('aria-expanded') === 'true';
            
            // Toggle expanded state
            this.mobileMenuToggle.setAttribute('aria-expanded', !isExpanded);
            
            // Toggle menu active class
            if (this.headerContent) {
                this.headerContent.classList.toggle('menu-active');
            }
            
            // Set display property directly based on menu state
            if (this.navContainer) {
                this.navContainer.style.display = !isExpanded ? 'block' : 'none';
            }
            
            // Announce menu state for screen readers
            const menuState = !isExpanded ? 'opened' : 'closed';
            this.mobileMenuToggle.setAttribute('aria-label', `Menu ${menuState}`);
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', this._boundHandleOutsideClick);
        
        // Handle Escape key to close menu
        document.addEventListener('keydown', this._boundHandleEscapeKey);
    }
    
    /**
     * Handle clicks outside the header to close the mobile menu
     * @param {Event} event - Click event
     * @private
     */
    handleOutsideClick(event) {
        // Skip if menu is not open or if clicking inside the header
        if (
            !this.headerContent || 
            !this.header ||
            !this.headerContent.classList.contains('menu-active') ||
            this.header.contains(event.target)
        ) {
            return;
        }
        
        // Close the menu
        this.closeMobileMenu();
    }
    
    /**
     * Handle Escape key press to close the mobile menu
     * @param {KeyboardEvent} event - Keyboard event
     * @private
     */
    handleEscapeKey(event) {
        if (
            event.key === 'Escape' && 
            this.headerContent && 
            this.headerContent.classList.contains('menu-active')
        ) {
            this.closeMobileMenu();
            if (this.mobileMenuToggle) {
                this.mobileMenuToggle.focus(); // Return focus to toggle button
            }
        }
    }
    
    /**
     * Setup scroll effects for the header
     * @private
     */
    setupScrollEffects() {
        if (!this.header) return;
        
        // Use Intersection Observer for better performance
        try {
            this._scrollObserver = new IntersectionObserver(
                (entries) => {
                    const isScrolled = window.scrollY > 50;
                    this.header.classList.toggle('scrolled', isScrolled);
                },
                { threshold: 0, rootMargin: '-50px 0px 0px 0px' }
            );
            
            this._scrollObserver.observe(document.documentElement);
            
            // Initial check
            if (window.scrollY > 50) {
                this.header.classList.add('scrolled');
            }
        } catch (e) {
            // Fallback for browsers that don't support IntersectionObserver
            console.warn('HeaderManager: IntersectionObserver not supported, using scroll event fallback');
            
            const handleScroll = () => {
                if (this.header) {
                    const isScrolled = window.scrollY > 50;
                    this.header.classList.toggle('scrolled', isScrolled);
                }
            };
            
            window.addEventListener('scroll', handleScroll, { passive: true });
            handleScroll(); // Initial check
        }
    }
    
    /**
     * Setup resize handler for responsive adjustments
     * @private
     */
    setupResizeHandler() {
        // Store current width to detect actual dimension changes
        this._lastWidth = window.innerWidth;
        
        // Use ResizeObserver if available, fallback to window resize
        if (typeof ResizeObserver !== 'undefined') {
            try {
                this._resizeObserver = new ResizeObserver(entries => {
                    // Only process resize if width actually changed (avoid unnecessary work)
                    if (window.innerWidth !== this._lastWidth) {
                        this._lastWidth = window.innerWidth;
                        this._boundHandleResize();
                    }
                });
                this._resizeObserver.observe(document.documentElement);
            } catch (e) {
                this._setupResizeFallback();
            }
        } else {
            this._setupResizeFallback();
        }
        
        // Also handle orientation change events on mobile
        window.addEventListener('orientationchange', () => {
            // Slight delay to ensure dimensions have updated
            setTimeout(this._boundHandleResize, 100); 
        });
        
        // Initial call to set correct state
        this._boundHandleResize();
    }
    
    /**
     * Setup fallback for resize handling when ResizeObserver is not available
     * @private
     */
    _setupResizeFallback() {
        // Debounced resize handler
        let resizeTimer;
        const debouncedResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(this._boundHandleResize, 250);
        };
        
        window.addEventListener('resize', debouncedResize);
    }
    
    /**
     * Handle window resize events
     * @private
     */
    handleResize() {
        // Reset mobile menu on desktop view
        if (window.innerWidth > 836 && 
            this.headerContent && 
            this.headerContent.classList.contains('menu-active')) {
            this.closeMobileMenu();
        }
    }
    
    /**
     * Update active link in the navigation
     * @param {string} pageName - Current page name
     * @public
     */
    updateActiveLink(pageName) {
        if (!this.navLinks.length) return;
        
        // Store current page name
        this.currentPage = pageName;
        
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
        
        // Update the logo text with the current page name (for mobile view)
        if (this.logoElement) {
            this.logoElement.textContent = activeFound ? activePageName : 'MrCargo';
        }
        
        // Close mobile menu after navigation on mobile devices
        if (window.innerWidth <= 835) {
            this.closeMobileMenu();
        }
    }
    
    /**
     * Close mobile menu if open
     * @public
     */
    closeMobileMenu() {
        if (!this.mobileMenuToggle || !this.headerContent) return;
        
        // Set ARIA state
        this.mobileMenuToggle.setAttribute('aria-expanded', 'false');
        this.mobileMenuToggle.setAttribute('aria-label', 'Menu closed');
        
        // Remove active class
        this.headerContent.classList.remove('menu-active');
        
        // Hide navigation container in mobile view
        if (this.navContainer && window.innerWidth <= 835) {
            this.navContainer.style.display = 'none';
        }
    }
}

// Initialize the header manager when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create and store a global instance for easier access
    window.headerManager = new HeaderManager();
});

// Export HeaderManager to the global scope if used with ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeaderManager;
} else {
    window.HeaderManager = HeaderManager;
}