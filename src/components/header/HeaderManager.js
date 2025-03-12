/**
 * HeaderManager - Manages header functionality with robust mobile menu handling
 */
class HeaderManager {
    /**
     * Initialize HeaderManager and set up event listeners
     */
    constructor() {
        // Wait for DOM to be fully ready before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeElements());
        } else {
            this.initializeElements();
        }
    }
    
    /**
     * Initialize DOM elements - separated for better timing control
     */
    initializeElements() {
        // Core elements
        this.header = document.querySelector('.main-header');
        this.headerContent = document.querySelector('.header-content');
        this.navLinks = document.querySelectorAll('.main-nav a');
        this.mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        this.navContainer = document.querySelector('.nav-container');
        
        // Check if elements are found
        const elementsFound = {
            header: !!this.header,
            headerContent: !!this.headerContent,
            navLinks: this.navLinks.length,
            mobileMenuToggle: !!this.mobileMenuToggle,
            navContainer: !!this.navContainer
        };
        
        // Log element discovery status in development mode
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('HeaderManager elements found:', elementsFound);
        }
        
        // State tracking
        this.isMobileMenuOpen = false;
        this.lastScrollPosition = window.scrollY;
        this.scrollThreshold = 50;
        this.mobileMenuCloseDelay = 200;
        
        // Only initialize if we found the required elements
        if (this.header && this.headerContent && this.mobileMenuToggle) {
            this.init();
            return true;
        } else {
            console.warn('HeaderManager: Not all elements found, initialization delayed');
            return false;
        }
    }
    
    /**
     * Initialize header functionality
     */
    init() {
        // Add scroll behavior with throttling
        this._setupScrollBehavior();
        
        // Add initial active states
        this.updateActiveLink();
        
        // Set up mobile navigation
        this._setupMobileNavigation();
        
        // Listen for hash changes to update active link
        window.addEventListener('hashchange', () => this.updateActiveLink(), { passive: true });
    }
    
    /**
     * Updates the active navigation link based on current page
     * @param {string} currentPage - Current page identifier (optional)
     */
    updateActiveLink(currentPage) {
        // Use provided page or get from URL
        const activePage = currentPage || window.location.hash.substring(1) || 'about';
        
        // Update all navigation links - use for...of for better performance with NodeList
        for (const link of this.navLinks) {
            // Skip disabled links
            if (link.classList.contains('disabled')) continue;
            
            const pageName = link.getAttribute('href')?.substring(1);
            const isActive = pageName === activePage;
            
            // Update state - keep DOM changes minimal
            if (isActive && !link.classList.contains('active')) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
            } else if (!isActive && link.classList.contains('active')) {
                link.classList.remove('active');
                link.setAttribute('aria-current', 'false');
            }
        }
    }
    
    /**
     * Add subtle effects when scrolling - with performance optimization
     * @private
     */
    _setupScrollBehavior() {
        if (!this.header) return;
        
        // Use requestAnimationFrame for better performance
        let ticking = false;
        
        const handleScroll = () => {
            // Add shadow and background opacity change on scroll
            const isScrolled = window.scrollY > this.scrollThreshold;
            this.header.classList.toggle('scrolled', isScrolled);
            
            // Close mobile menu when scrolling significantly
            if (this.isMobileMenuOpen && 
                Math.abs(window.scrollY - this.lastScrollPosition) > this.scrollThreshold) {
                this.toggleMobileMenu(false);
            }
            
            this.lastScrollPosition = window.scrollY;
            ticking = false;
        };
        
        // Add scroll effect to header with throttled listener for performance
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(handleScroll);
                ticking = true;
            }
        }, { passive: true });
    }
    
    /**
     * Setup mobile navigation behavior
     * @private
     */
    _setupMobileNavigation() {
        // Ensure we have all required elements
        if (!this.mobileMenuToggle || !this.headerContent || !this.navContainer) {
            console.error('HeaderManager: Missing elements for mobile navigation');
            return;
        }
        
        // Add click event for mobile menu toggle with direct implementation
        this.mobileMenuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent event bubbling
            this.toggleMobileMenu();
        });
        
        // Use event delegation for nav links to improve performance
        const navLinksContainer = document.querySelector('.main-nav ul');
        if (navLinksContainer) {
            navLinksContainer.addEventListener('click', (e) => {
                const link = e.target.closest('.nav-link');
                if (link && !link.classList.contains('disabled') && this.isMobileMenuOpen) {
                    this.toggleMobileMenu(false);
                }
            });
        }
        
        // Close mobile menu when clicking outside - use document once
        document.addEventListener('click', (event) => {
            if (this.isMobileMenuOpen && 
                !event.target.closest('.nav-container') && 
                !event.target.closest('.mobile-menu-toggle')) {
                this.toggleMobileMenu(false);
            }
        });
        
        // Add escape key handler
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isMobileMenuOpen) {
                this.toggleMobileMenu(false);
            }
        });
    }
    
    /**
     * Toggle mobile menu visibility with improved animation handling
     * @param {boolean|undefined} force - Force specific state (optional)
     */
    toggleMobileMenu(force) {
        if (!this.mobileMenuToggle || !this.headerContent || !this.navContainer) {
            console.error('HeaderManager: Cannot toggle menu - elements not found');
            return;
        }
        
        // Set the new state (use force if provided, otherwise toggle)
        if (force !== undefined) {
            if (this.isMobileMenuOpen === force) return; // No change needed
            this.isMobileMenuOpen = force;
        } else {
            this.isMobileMenuOpen = !this.isMobileMenuOpen;
        }
        
        // Update button state
        this.mobileMenuToggle.setAttribute('aria-expanded', String(this.isMobileMenuOpen));
        
        // Toggle menu display with classes
        if (this.isMobileMenuOpen) {
            // Show immediately
            this.headerContent.classList.add('menu-active');
            this.navContainer.style.display = 'block';
            
            // Force repaint to ensure animation applies
            this.navContainer.offsetHeight;
            
            // Apply animation class
            this.navContainer.classList.add('nav-visible');
        } else {
            // Start hiding animation
            this.headerContent.classList.remove('menu-active');
            this.navContainer.classList.remove('nav-visible');
            
            // Remove from DOM flow after animation completes
            clearTimeout(this._menuCloseTimeout);
            this._menuCloseTimeout = setTimeout(() => {
                if (!this.isMobileMenuOpen) {
                    this.navContainer.style.display = '';
                }
            }, this.mobileMenuCloseDelay);
        }
    }
    
    /**
     * Show/hide header based on parameter
     * @param {boolean} show - Whether to show or hide the header
     */
    toggleVisibility(show) {
        if (!this.header) return;
        
        if (show) {
            this.header.classList.remove('hidden');
            // Force repaint to ensure animation applies
            this.header.offsetHeight;
            this.header.classList.add('visible');
        } else {
            this.header.classList.remove('visible');
            clearTimeout(this._headerHideTimeout);
            this._headerHideTimeout = setTimeout(() => {
                this.header.classList.add('hidden');
            }, this.mobileMenuCloseDelay);
        }
    }
    
    /**
     * Public method to force re-initialization
     * Call this if the header isn't working properly
     */
    reinitialize() {
        // Clean up any existing timeouts
        clearTimeout(this._menuCloseTimeout);
        clearTimeout(this._headerHideTimeout);
        
        // Try to find elements again
        const initialized = this.initializeElements();
        
        // If still not initialized, set up retry
        if (!initialized) {
            console.log('HeaderManager: Scheduling retry...');
            // Try again after a short delay
            setTimeout(() => this.reinitialize(), 250);
        } else {
            console.log('HeaderManager: Successfully reinitialized');
        }
        
        return initialized;
    }
}

// Create HeaderManager instance when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.headerManager = new HeaderManager();
});

// Fallback initialization for when DOMContentLoaded may have already fired
if (document.readyState === 'complete' && !window.headerManager) {
    window.headerManager = new HeaderManager();
}