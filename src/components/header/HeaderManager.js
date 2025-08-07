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
        this.siteBranding = document.querySelector('.site-branding');
        
        // New control elements
        this.goldenRulesBtn = document.querySelector('#golden-rules-toggle');
        this.gameBtn = document.querySelector('#starbucks-game-btn');
        this.rulesStatus = document.querySelector('#rules-status');
        
        // Store original logo text
        this.originalLogoText = 'MrCargo';
        
        // Event handler bindings to ensure proper 'this' context
        this._handleDocumentClick = this._handleDocumentClick.bind(this);
        this._handleKeydown = this._handleKeydown.bind(this);
        this._handleScroll = this._handleScroll.bind(this);
        this._handleResize = this._handleResize.bind(this);
        this._handleHashChange = this._handleHashChange.bind(this);
        
        // State variables
        this.scrollTicking = false;
        this.resizeTimer = null;
        this.currentPageName = '';
        
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
        
        // Setup new control buttons
        this.setupControlButtons();
        
        // Set initial page title based on URL or default active link
        this.setInitialPageTitle();
        
        // Listen for hash changes to update active link and logo text
        window.addEventListener('hashchange', this._handleHashChange);
        
        // Initialize Golden Rules status
        this.updateGoldenRulesStatus();
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
        this.siteBranding = document.querySelector('.site-branding');
        
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
            this.mobileMenuToggle.removeEventListener('click', this.handleMobileMenuToggle.bind(this));
        }
    }
    
    /**
     * Handle mobile menu toggle click
     * @param {Event} event - Click event
     */
    handleMobileMenuToggle(event) {
        console.log('Mobile menu toggle clicked'); // Debug log
        
        if (!this.mobileMenuToggle || !this.headerContent) {
            console.warn('Mobile menu elements not found');
            return;
        }
        
        event.preventDefault();
        event.stopPropagation();
        
        const isExpanded = this.mobileMenuToggle.getAttribute('aria-expanded') === 'true';
        
        console.log('Current expanded state:', isExpanded); // Debug log
        
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
        
        console.log('Menu toggled to:', menuState); // Debug log
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
            // Reset mobile menu on desktop view - FIXED BREAKPOINT
            if (window.innerWidth > 835 && this.headerContent.classList.contains('menu-active')) {
                this.closeMobileMenu();
            }
            
            // Update logo text based on screen width (for mobile only) - FIXED BREAKPOINT
            if (window.innerWidth <= 835 && this.logoElement) {
                this.updateMobileLogoText();
            }
        }, 250);
    }
    
    /**
     * Update the logo text for mobile view only
     */
    updateMobileLogoText() {
        if (!this.logoElement) return;
        
        if (this.currentPageName) {
            this.logoElement.textContent = this.currentPageName;
        } else {
            this.logoElement.textContent = this.originalLogoText;
        }
    }
    
    /**
     * Setup mobile menu toggle functionality
     */
    setupMobileMenu() {
        if (!this.mobileMenuToggle) return;
        
        console.log('Setting up mobile menu toggle'); // Debug log
        
        // Add click event listener to mobile menu toggle
        this.mobileMenuToggle.addEventListener('click', this.handleMobileMenuToggle.bind(this));
        
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
        
        // Initial update for mobile logo text if we're on mobile
        if (window.innerWidth <= 835 && this.logoElement) {
            this.updateMobileLogoText();
        }
    }
    
    /**
     * Update active link in the navigation
     * @param {string} pageName - Current page name
     */
    updateActiveLink(pageName) {
        if (!this.navLinks.length) return;
        
        let activePageName = ''; // Will store the active page name
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
        
        // Store current page name for reference
        this.currentPageName = activeFound ? activePageName : '';
        
        // Update logo text only if on mobile
        if (window.innerWidth <= 835 && this.logoElement) {
            this.updateMobileLogoText();
        }
        
        // Close mobile menu after navigation on mobile devices
        if (window.innerWidth <= 835) {
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
     * Setup control buttons functionality
     */
    setupControlButtons() {
        // Golden Rules button
        if (this.goldenRulesBtn) {
            this.goldenRulesBtn.addEventListener('click', this.handleGoldenRulesToggle.bind(this));
        }
        
        // Game launch button
        if (this.gameBtn) {
            this.gameBtn.addEventListener('click', this.handleGameLaunch.bind(this));
        }
    }
    
    /**
     * Handle Golden Rules toggle
     */
    handleGoldenRulesToggle() {
        console.log('🛡️ Golden Rules button clicked');
        
        // Check if Golden Rules system exists
        if (window.GoldenRulesEnforcer || window.RulesEnforcer) {
            try {
                // Toggle the rules enforcement
                const enforcer = window.GoldenRulesEnforcer || window.RulesEnforcer;
                if (enforcer && typeof enforcer.toggleLearningMode === 'function') {
                    enforcer.toggleLearningMode();
                } else if (enforcer && typeof enforcer.toggle === 'function') {
                    enforcer.toggle();
                }
                
                // Update status display
                this.updateGoldenRulesStatus();
                
                // Show notification
                this.showToast('Golden Rules learning mode toggled!');
            } catch (error) {
                console.error('Error toggling Golden Rules:', error);
                this.updateGoldenRulesStatus('error');
                this.showToast('Failed to toggle Golden Rules', 'error');
            }
        } else {
            // Rules system not loaded yet
            console.log('📚 Golden Rules system not loaded yet, attempting to initialize...');
            this.showToast('Initializing Golden Rules system...', 'info');
            this.updateGoldenRulesStatus('loading');
            
            // Try to trigger Golden Rules initialization
            if (window.initializeGoldenRules && typeof window.initializeGoldenRules === 'function') {
                window.initializeGoldenRules();
                setTimeout(() => this.updateGoldenRulesStatus(), 1000);
            }
        }
    }
    
    /**
     * Handle game launch
     */
    handleGameLaunch() {
        console.log('☕ Launching Starbucks Game');
        this.showToast('Loading Starbucks Barista Game...', 'info');
        
        // Create game modal
        this.createGameModal();
    }
    
    /**
     * Create and show game modal
     */
    createGameModal() {
        // Remove any existing modal
        const existingModal = document.querySelector('#game-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal backdrop
        const modalBackdrop = document.createElement('div');
        modalBackdrop.className = 'modal-backdrop active';
        modalBackdrop.id = 'game-modal-backdrop';
        
        // Create modal container
        const modalContainer = document.createElement('div');
        modalContainer.className = 'modal-container game-modal active';
        modalContainer.id = 'game-modal';
        
        // Create modal header
        const modalHeader = document.createElement('div');
        modalHeader.className = 'game-modal-header';
        modalHeader.innerHTML = `
            <div class="modal-title">
                <span class="game-icon">☕</span>
                <h2>Starbucks Barista Training</h2>
            </div>
            <div class="modal-controls">
                <button id="minimize-game" class="control-btn" title="Minimize Game">
                    <span>—</span>
                </button>
                <button id="close-game" class="control-btn close-btn" title="Close Game">
                    <span>×</span>
                </button>
            </div>
        `;
        
        // Create modal content container
        const modalContent = document.createElement('div');
        modalContent.className = 'game-modal-content';
        modalContent.id = 'starbucks-game-container';
        
        // Assemble modal
        modalContainer.appendChild(modalHeader);
        modalContainer.appendChild(modalContent);
        
        // Add to page
        document.body.appendChild(modalBackdrop);
        document.body.appendChild(modalContainer);
        
        // Setup modal controls
        this.setupGameModalControls(modalContainer, modalBackdrop);
        
        // Initialize game
        this.initializeStarbucksGame(modalContent);
    }
    
    /**
     * Setup game modal controls
     */
    setupGameModalControls(modalContainer, modalBackdrop) {
        const closeBtn = modalContainer.querySelector('#close-game');
        const minimizeBtn = modalContainer.querySelector('#minimize-game');
        
        // Close button
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeGameModal();
            });
        }
        
        // Minimize button (hide modal but keep game running)
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
                modalContainer.classList.remove('active');
                modalBackdrop.classList.remove('active');
                this.showToast('Game minimized - click Game button to restore');
            });
        }
        
        // Close on backdrop click
        modalBackdrop.addEventListener('click', (e) => {
            if (e.target === modalBackdrop) {
                this.closeGameModal();
            }
        });
        
        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeGameModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }
    
    /**
     * Initialize Starbucks Game in modal
     */
    async initializeStarbucksGame(container) {
        try {
            // Check if game class is available
            if (!window.StarbucksGame) {
                throw new Error('StarbucksGame class not loaded');
            }
            
            // Create and initialize game instance
            this.gameInstance = new window.StarbucksGame(container);
            await this.gameInstance.init();
            
            console.log('✅ Starbucks Game initialized in modal');
            this.showToast('Game loaded successfully!', 'success');
            
        } catch (error) {
            console.error('❌ Failed to initialize game:', error);
            container.innerHTML = `
                <div class="game-error">
                    <h3>⚠️ Game Loading Error</h3>
                    <p>Failed to load the Starbucks Barista Game.</p>
                    <p class="error-details">${error.message}</p>
                    <button onclick="window.headerManager.closeGameModal()" class="retry-btn">
                        Close and Try Again
                    </button>
                </div>
            `;
            this.showToast('Failed to load game', 'error');
        }
    }
    
    /**
     * Close game modal
     */
    closeGameModal() {
        const modal = document.querySelector('#game-modal');
        const backdrop = document.querySelector('#game-modal-backdrop');
        
        if (modal) {
            modal.classList.remove('active');
        }
        if (backdrop) {
            backdrop.classList.remove('active');
        }
        
        // Clean up game instance
        if (this.gameInstance && typeof this.gameInstance.cleanup === 'function') {
            this.gameInstance.cleanup();
            this.gameInstance = null;
        }
        
        // Remove modal elements after animation
        setTimeout(() => {
            if (modal) modal.remove();
            if (backdrop) backdrop.remove();
        }, 300);
        
        console.log('🎮 Game modal closed');
    }
    
    /**
     * Update Golden Rules status indicator
     */
    updateGoldenRulesStatus(status = null) {
        if (!this.rulesStatus) return;
        
        let statusText = 'Learning';
        let statusClass = '';
        
        if (status === 'error') {
            statusText = 'Error';
            statusClass = 'error';
        } else if (status === 'loading') {
            statusText = 'Loading';
            statusClass = '';
        } else if (status === 'active') {
            statusText = 'Active';
            statusClass = 'active';
        } else {
            // Try to detect current status
            if (window.GoldenRulesEnforcer || window.RulesEnforcer) {
                statusText = 'Active';
                statusClass = 'active';
            } else {
                statusText = 'Learning';
                statusClass = '';
            }
        }
        
        this.rulesStatus.textContent = statusText;
        this.rulesStatus.className = `rules-status ${statusClass}`;
    }
    
    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        // Remove existing toasts
        const existingToasts = document.querySelectorAll('.header-toast');
        existingToasts.forEach(toast => toast.remove());
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast header-toast ${type} show`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        
        // Add to toast container or create one
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        toastContainer.appendChild(toast);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
        
        console.log(`📢 Toast: ${message}`);
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
        this.siteBranding = null;
    }
}

// Export HeaderManager to the global scope if used with ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeaderManager;
} else {
    window.HeaderManager = HeaderManager;
}
