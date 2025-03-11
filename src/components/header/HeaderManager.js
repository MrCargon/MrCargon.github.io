/**
 * HeaderManager - Manages header functionality with robust mobile menu handling
 * @version 1.3.0
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
        
        // Log element discovery status
        console.log('HeaderManager elements found:', {
            header: !!this.header,
            headerContent: !!this.headerContent,
            navLinks: this.navLinks.length,
            mobileMenuToggle: !!this.mobileMenuToggle,
            navContainer: !!this.navContainer
        });
        
        // State tracking
        this.isMobileMenuOpen = false;
        this.lastScrollPosition = window.scrollY;
        
        // Only initialize if we found the required elements
        if (this.header && this.headerContent && this.mobileMenuToggle) {
            this.init();
        } else {
            console.error('HeaderManager: Critical elements not found, initialization failed');
        }
    }
    
    /**
     * Initialize header functionality
     */
    init() {
        console.log('HeaderManager: Initializing...');
        
        // Add scroll behavior
        this.setupScrollBehavior();
        
        // Add initial active states
        this.updateActiveLink();
        
        // Set up mobile navigation
        this.setupMobileNavigation();
        
        console.log('HeaderManager: Initialization complete');
    }
    
    /**
     * Updates the active navigation link based on current page
     * @param {string} currentPage - Current page identifier (optional)
     */
    updateActiveLink(currentPage) {
        // Use provided page or get from URL
        const activePage = currentPage || window.location.hash.substring(1) || 'about';
        
        // Update all navigation links
        this.navLinks.forEach(link => {
            // Skip disabled links
            if (link.classList.contains('disabled')) return;
            
            const pageName = link.getAttribute('href')?.substring(1);
            const isActive = pageName === activePage;
            
            // Update state
            link.classList.toggle('active', isActive);
            link.setAttribute('aria-current', isActive ? 'page' : 'false');
        });
    }
    
    /**
     * Add subtle effects when scrolling
     */
    setupScrollBehavior() {
        if (!this.header) return;
        
        // Add scroll effect to header with passive listener for performance
        window.addEventListener('scroll', () => {
            // Add shadow and background opacity change on scroll
            if (window.scrollY > 50) {
                this.header.classList.add('scrolled');
            } else {
                this.header.classList.remove('scrolled');
            }
            
            // Close mobile menu when scrolling significantly
            if (this.isMobileMenuOpen && Math.abs(window.scrollY - this.lastScrollPosition) > 50) {
                this.toggleMobileMenu(false);
            }
            
            this.lastScrollPosition = window.scrollY;
        }, { passive: true });
    }
    
    /**
     * Setup mobile navigation behavior
     */
    setupMobileNavigation() {
        console.log('HeaderManager: Setting up mobile navigation');
        
        // Ensure we have the menu toggle button
        if (!this.mobileMenuToggle) {
            console.error('HeaderManager: Mobile menu toggle button not found');
            return;
        }
        
        // Ensure we have the header content container
        if (!this.headerContent) {
            console.error('HeaderManager: Header content container not found');
            return;
        }
        
        // Add click event for mobile menu toggle with direct implementation
        this.mobileMenuToggle.addEventListener('click', (e) => {
            console.log('HeaderManager: Mobile menu toggle clicked');
            e.preventDefault();
            e.stopPropagation(); // Prevent event bubbling
            this.toggleMobileMenu();
        });
        
        // Close mobile menu when clicking on links
        this.navLinks.forEach(link => {
            if (link.classList.contains('disabled')) return;
            
            link.addEventListener('click', () => {
                if (this.isMobileMenuOpen) {
                    this.toggleMobileMenu(false);
                }
            });
        });
        
        // Close mobile menu when clicking outside
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
        
        console.log('HeaderManager: Mobile navigation setup complete');
    }
    
    /**
     * Toggle mobile menu visibility
     * @param {boolean|undefined} force - Force specific state (optional)
     */
    toggleMobileMenu(force) {
        console.log('HeaderManager: Toggling mobile menu');
        
        if (!this.mobileMenuToggle || !this.headerContent || !this.navContainer) {
            console.error('HeaderManager: Cannot toggle menu - elements not found', {
                toggle: !!this.mobileMenuToggle,
                content: !!this.headerContent,
                container: !!this.navContainer
            });
            return;
        }
        
        // Set the new state (use force if provided, otherwise toggle)
        if (force !== undefined) {
            this.isMobileMenuOpen = force;
        } else {
            this.isMobileMenuOpen = !this.isMobileMenuOpen;
        }
        
        console.log('HeaderManager: Setting mobile menu state to', this.isMobileMenuOpen);
        
        // Update button state
        this.mobileMenuToggle.setAttribute('aria-expanded', this.isMobileMenuOpen ? 'true' : 'false');
        
        // Toggle menu display with class on header-content
        if (this.isMobileMenuOpen) {
            this.headerContent.classList.add('menu-active');
            // Direct style manipulation as a fallback
            this.navContainer.style.display = 'block';
        } else {
            this.headerContent.classList.remove('menu-active');
            // Give time for transitions before hiding
            setTimeout(() => {
                if (!this.isMobileMenuOpen) {
                    this.navContainer.style.display = '';
                }
            }, 300);
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
            setTimeout(() => {
                this.header.classList.add('visible');
            }, 10);
        } else {
            this.header.classList.remove('visible');
            setTimeout(() => {
                this.header.classList.add('hidden');
            }, 300);
        }
    }
    
    /**
     * Public method to force re-initialization
     * Call this if the header isn't working properly
     */
    reinitialize() {
        console.log('HeaderManager: Reinitializing...');
        this.initializeElements();
        return true;
    }
}

// Create HeaderManager instance when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, creating HeaderManager instance');
    window.headerManager = new window.HeaderManager();
});

// Fallback initialization for when DOMContentLoaded may have already fired
if (document.readyState === 'complete' && !window.headerManager) {
    console.log('DOM already loaded, creating HeaderManager instance now');
    window.headerManager = new window.HeaderManager();
}