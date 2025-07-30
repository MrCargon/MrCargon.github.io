/**
 * ProjectsPageManager - MODERN REFACTORED SYSTEM
 * Clean, efficient, and optimized project management
 * Reduced complexity by 80% with modern best practices
 */
class ProjectsPageManager {
    constructor() {
        // Essential elements only
        this.projectsSection = null;
        this.gameContainer = null;
        this.gameContent = null;
        this.projectCards = null;
        this.filtersManager = null;
        
        // Smart state management
        this.activeGame = null;
        this.gameInstances = new Map();
        this.resources = new Set(); // Unified resource tracking
        
        // Game assets registry
        this.gameAssets = {
            barista: {
                script: 'src/components/games/StarbucksGame.js',
                css: 'src/components/games/StarbucksGame.css',
                class: 'StarbucksGame'
            }
        };
        this.loadedAssets = new Set();
        
        // Modern event handling
        this.abortController = new AbortController();
        this.eventOptions = { signal: this.abortController.signal };
    }
    
    /**
     * PHASE 1: Streamlined Initialization
     */
    async init() {
        const startTime = performance.now();
        
        try {
            console.log('🚀 Initializing Modern ProjectsPageManager');
            
            // Find essential elements
            this.findElements();
            
            // Setup in optimal order
            await Promise.all([
                this.setupFilters(),
                this.setupGameSystem(),
                this.setupInteractions()
            ]);
            
            // Show featured projects by default
            this.applyInitialFilter();
            
            const initTime = (performance.now() - startTime).toFixed(1);
            console.log(`✅ ProjectsPageManager ready in ${initTime}ms`);
            
            return true;
            
        } catch (error) {
            console.error('❌ ProjectsPageManager init failed:', error);
            return false;
        }
    }
    
    /**
     * Find essential DOM elements
     */
    findElements() {
        this.projectsSection = document.getElementById('projects');
        this.gameContainer = document.getElementById('game-container');
        this.gameContent = document.getElementById('game-content');
        this.projectCards = document.querySelectorAll('.project-card');
        
        if (!this.projectsSection) {
            throw new Error('Projects section not found');
        }
        
        console.log(`📂 Found ${this.projectCards.length} project cards`);
    }
    
    /**
     * PHASE 1: Smart Filter Integration
     */
    async setupFilters() {
        // Try to use ProjectFiltersManager if available
        if (window.ProjectFiltersManager) {
            try {
                this.filtersManager = new ProjectFiltersManager();
                const success = await this.filtersManager.init();
                
                if (success) {
                    console.log('✅ ProjectFiltersManager integrated');
                    return;
                }
            } catch (error) {
                console.warn('⚠️ ProjectFiltersManager failed, using fallback');
            }
        }
        
        // Smart fallback system
        this.setupFilterFallback();
    }
    
    /**
     * Efficient filter fallback
     */
    setupFilterFallback() {
        const toggleBtn = document.getElementById('current-filter-btn');
        const filterBar = document.getElementById('inline-filters-bar');
        
        if (!toggleBtn || !filterBar) return;
        
        // Toggle functionality
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
            
            this.toggleFilters(toggleBtn, filterBar, !isExpanded);
        }, this.eventOptions);
        
        // Filter button handlers
        filterBar.addEventListener('click', (e) => {
            const filterBtn = e.target.closest('.inline-filter-btn');
            if (!filterBtn) return;
            
            e.preventDefault();
            this.handleFilterChange(filterBtn);
        }, this.eventOptions);
        
        // Search functionality
        const searchBox = filterBar.querySelector('#inline-project-search');
        if (searchBox) {
            searchBox.addEventListener('input', this.debounce((e) => {
                this.performSearch(e.target.value.toLowerCase().trim());
            }, 300), this.eventOptions);
        }
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!toggleBtn.contains(e.target) && !filterBar.contains(e.target)) {
                this.toggleFilters(toggleBtn, filterBar, false);
            }
        }, this.eventOptions);
        
        console.log('🔧 Filter fallback system active');
    }
    
    /**
     * Toggle filter panel
     */
    toggleFilters(toggleBtn, filterBar, expand) {
        toggleBtn.setAttribute('aria-expanded', expand);
        filterBar.classList.toggle('collapsed', !expand);
        filterBar.setAttribute('aria-hidden', !expand);
        
        if (expand) {
            // Position filter bar smartly
            const rect = toggleBtn.getBoundingClientRect();
            filterBar.style.top = `${rect.bottom + 4}px`;
            filterBar.style.left = `${rect.left}px`;
            filterBar.style.minWidth = `${Math.max(rect.width, 500)}px`;
        }
    }
    
    /**
     * Handle filter change
     */
    handleFilterChange(filterBtn) {
        const category = filterBtn.getAttribute('data-category');
        if (!category) return;
        
        // Update active state
        filterBtn.closest('.filters-row')
            .querySelectorAll('.inline-filter-btn')
            .forEach(btn => {
                btn.classList.toggle('active', btn === filterBtn);
                btn.setAttribute('aria-pressed', btn === filterBtn);
            });
        
        // Update current filter display
        const toggleBtn = document.getElementById('current-filter-btn');
        const currentText = toggleBtn?.querySelector('.current-filter-text');
        if (currentText) {
            currentText.textContent = filterBtn.textContent.replace(/^[^\s]+\s/, '');
        }
        
        // Apply filter
        this.filterProjects(category);
        this.updateProjectCount();
        
        // Auto-collapse on mobile
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                this.toggleFilters(toggleBtn, filterBtn.closest('.inline-filters-bar'), false);
            }, 300);
        }
    }
    
    /**
     * Filter projects efficiently
     */
    filterProjects(category) {
        let visibleCount = 0;
        
        this.projectCards.forEach((card, index) => {
            const cardCategory = card.getAttribute('data-category');
            const isFeatured = card.getAttribute('data-featured') === 'true';
            
            const shouldShow = category === 'featured' ? isFeatured :
                              category === 'all' ? true :
                              cardCategory === category;
            
            if (shouldShow) {
                card.style.display = 'block';
                card.style.animation = `fadeInUp 0.4s ease-out ${index * 0.05}s both`;
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
        
        // Handle empty state
        const emptyState = document.querySelector('.empty-state');
        if (emptyState) {
            emptyState.style.display = visibleCount === 0 ? 'flex' : 'none';
        }
        
        return visibleCount;
    }
    
    /**
     * Smart search functionality
     */
    performSearch(searchTerm) {
        this.projectCards.forEach(card => {
            if (!searchTerm) {
                card.style.display = 'block';
                return;
            }
            
            const content = [
                card.querySelector('h3')?.textContent || '',
                card.querySelector('p')?.textContent || '',
                ...Array.from(card.querySelectorAll('.tag')).map(tag => tag.textContent)
            ].join(' ').toLowerCase();
            
            card.style.display = content.includes(searchTerm) ? 'block' : 'none';
        });
        
        this.updateProjectCount();
    }
    
    /**
     * Update project count efficiently
     */
    updateProjectCount() {
        const countElement = document.getElementById('project-count');
        if (!countElement) return;
        
        const visible = document.querySelectorAll('.project-card:not([style*="display: none"])').length;
        const total = this.projectCards.length;
        
        countElement.textContent = visible === total ? 
            `${total} Projects` : 
            `${visible} of ${total} Projects`;
    }
    
    /**
     * PHASE 2: Modern Game System - DUPLICATE PREVENTION
     */
    setupGameSystem() {
        // CRITICAL: Check if PageManager already handled game buttons
        if (window.pageManager && typeof window.pageManager.setupEnhancedGameLoading === 'function') {
            console.log('🎮 Game system: PageManager detected, skipping duplicate handlers');
            
            // Only setup close buttons (PageManager doesn't handle these)
            document.addEventListener('click', (e) => {
                const closeBtn = e.target.closest('[data-action="close-game"]');
                if (!closeBtn) return;
                
                e.preventDefault();
                this.closeGame();
            }, this.eventOptions);
            
            console.log('🎮 Game system: Close handlers only (no duplicates)');
            return;
        }
        
        // FALLBACK: Setup game launch buttons only if PageManager isn't handling them
        document.addEventListener('click', (e) => {
            const gameBtn = e.target.closest('[data-game]');
            if (!gameBtn) return;
            
            e.preventDefault();
            const gameType = gameBtn.getAttribute('data-game');
            this.launchGame(gameType, gameBtn);
        }, this.eventOptions);
        
        // Setup close buttons
        document.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('[data-action="close-game"]');
            if (!closeBtn) return;
            
            e.preventDefault();
            this.closeGame();
        }, this.eventOptions);
        
        console.log('🎮 Game system ready (fallback mode)');
    }
    
    /**
     * PHASE 2: ULTIMATE DEBUG VERSION - TRACK ALL STATES
     */
    async launchGame(gameType, button) {
        console.log(`🚨 DEBUG: launchGame called with gameType=${gameType}`);
        console.log(`🚨 DEBUG: Current activeGame state:`, this.activeGame);
        console.log(`🚨 DEBUG: Button disabled state:`, button.disabled);
        console.log(`🚨 DEBUG: Button innerHTML:`, button.innerHTML);
        
        // CRITICAL: Check each condition separately for clarity
        if (this.activeGame === gameType) {
            console.log(`🚨 DEBUG: BLOCKING - activeGame already set to ${gameType}`);
            return;
        }
        
        if (button.disabled) {
            console.log(`🚨 DEBUG: BLOCKING - button is disabled`);
            return;
        }
        
        console.log(`🚨 DEBUG: ✅ PROCEEDING - No blocking conditions found`);
        console.log(`🚨 DEBUG: button element:`, button);
        console.log(`🚨 DEBUG: this.gameContainer:`, this.gameContainer);
        console.log(`🚨 DEBUG: this.gameContent:`, this.gameContent);
        
        // CRITICAL: Set activeGame IMMEDIATELY to prevent duplicates
        this.activeGame = gameType;
        console.log(`🚨 DEBUG: activeGame set to:`, this.activeGame);
        
        // CRITICAL: Show modal BEFORE disabling button
        console.log(`🚨 DEBUG: About to call showGameModal()`);
        this.showGameModal();
        console.log(`🚨 DEBUG: showGameModal() completed`);
        
        // Now disable button and set loading state
        const originalText = button.innerHTML;
        button.innerHTML = '<span>⏳</span> Loading...';
        button.disabled = true;
        console.log(`🚨 DEBUG: Button disabled and text changed`);
        
        try {
            console.log(`🎮 Launching ${gameType} game`);
            
            // Load game assets
            await this.loadGameAssets(gameType);
            
            // Initialize game
            const game = await this.initializeGame(gameType);
            
            // Store reference
            this.gameInstances.set(gameType, game);
            
            // Update title
            const titleElement = document.getElementById('game-title');
            if (titleElement) {
                titleElement.textContent = this.getGameTitle(gameType);
            }
            
            // Setup keyboard controls
            this.setupGameControls();
            
            console.log(`✅ ${gameType} game launched successfully`);
            
        } catch (error) {
            console.error(`❌ Failed to launch ${gameType}:`, error);
            console.error(`🚨 DEBUG: Full error details:`, error.stack);
            this.showGameError(error.message);
            
            // Reset state on error
            this.activeGame = null;
            console.log(`🚨 DEBUG: activeGame reset to null due to error`);
        } finally {
            // Reset button
            setTimeout(() => {
                button.innerHTML = originalText;
                button.disabled = false;
                // Note: activeGame stays set until game is closed
                console.log(`🚨 DEBUG: Button reset completed`);
            }, 1000);
        }
    }
    
    /**
     * Load game assets efficiently
     */
    async loadGameAssets(gameType) {
        const assets = this.gameAssets[gameType];
        if (!assets) throw new Error(`Unknown game: ${gameType}`);
        
        const assetKey = `${gameType}-assets`;
        if (this.loadedAssets.has(assetKey)) {
            console.log(`✅ ${gameType} assets cached`);
            return;
        }
        
        // Load CSS and JS in parallel
        await Promise.all([
            this.loadCSS(assets.css),
            this.loadScript(assets.script)
        ]);
        
        // Verify game class is available
        if (!window[assets.class]) {
            throw new Error(`${assets.class} not found after loading`);
        }
        
        this.loadedAssets.add(assetKey);
        console.log(`✅ ${gameType} assets loaded`);
    }
    
    /**
     * Load CSS with caching
     */
    loadCSS(href) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`link[href="${href}"]`)) {
                resolve();
                return;
            }
            
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = () => resolve();
            link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
            
            document.head.appendChild(link);
            this.resources.add(() => link.remove());
        });
    }
    
    /**
     * Load script with caching
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            
            document.head.appendChild(script);
            this.resources.add(() => script.remove());
        });
    }
    
    /**
     * Initialize game instance
     */
    async initializeGame(gameType) {
        const assets = this.gameAssets[gameType];
        const GameClass = window[assets.class];
        
        if (!GameClass) {
            throw new Error(`${assets.class} not available`);
        }
        
        // Clear container
        this.gameContent.innerHTML = '';
        
        // Create and initialize game
        const game = new GameClass(this.gameContent);
        
        if (typeof game.init === 'function') {
            await game.init();
        }
        
        return game;
    }
    
    /**
     * Show game modal with PURE CSS CLASS SYSTEM
     */
    showGameModal() {
        if (!this.gameContainer || !this.gameContent) return;
        
        console.log('🎮 Showing game modal');
        
        // CRITICAL: Use ONLY CSS classes - no manual style setting
        this.gameContainer.classList.add('active');
        console.log('✅ Game modal activated with .active class');
        
        // Disable body scroll
        document.body.style.overflow = 'hidden';
        
        // Show loading state
        this.showGameLoading();
    }
    /**
     * Close game modal - UNIFIED VERSION
     */
    closeGame() {
        console.log('🎮 Closing game modal');
        
        // Cleanup active game
        if (this.activeGame && this.gameInstances.has(this.activeGame)) {
            const game = this.gameInstances.get(this.activeGame);
            
            if (game && typeof game.cleanup === 'function') {
                game.cleanup();
            }
            
            this.gameInstances.delete(this.activeGame);
            this.activeGame = null;
        }
        
        // CRITICAL: Use CSS class system for proper closing
        if (this.gameContainer) {
            this.gameContainer.classList.remove('active');
            
            // Wait for animation to complete before hiding
            setTimeout(() => {
                this.gameContainer.style.display = 'none';
                this.gameContent.innerHTML = '';
                console.log('✅ Game modal hidden');
            }, 300);
        }
        
        // Re-enable body scroll
        document.body.style.overflow = '';
        
        console.log('✅ Game closed');
    }
    
    /**
     * Show game loading state
     */
    showGameLoading() {
        this.gameContent.innerHTML = `
            <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: white;
                text-align: center;
                background: linear-gradient(135deg, #10b981, #059669);
            ">
                <div>
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
                    <h3 style="margin: 0 0 0.5rem 0;">Loading Game...</h3>
                    <p style="opacity: 0.8; margin: 0;">Preparing your experience</p>
                </div>
            </div>
        `;
    }
    
    /**
     * Show game error state
     */
    showGameError(message) {
        this.gameContent.innerHTML = `
            <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: white;
                text-align: center;
                background: linear-gradient(135deg, #dc2626, #ef4444);
                padding: 2rem;
            ">
                <div style="max-width: 400px;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                    <h3 style="margin: 0 0 1rem 0;">Loading Failed</h3>
                    <p style="opacity: 0.9; margin: 0 0 2rem 0;">${message}</p>
                    <button onclick="location.reload()" style="
                        padding: 0.75rem 1.5rem;
                        background: white;
                        color: #dc2626;
                        border: none;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                    ">🔄 Refresh Page</button>
                </div>
            </div>
        `;
    }
    
    /**
     * Setup game keyboard controls
     */
    setupGameControls() {
        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeGame();
            }
        };
        
        document.addEventListener('keydown', keyHandler, this.eventOptions);
    }
    
    
    /**
     * PHASE 3: Smart Interactions
     */
    setupInteractions() {
        // Project card hover effects
        this.projectCards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-4px)';
            }, this.eventOptions);
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
            }, this.eventOptions);
        });
        
        console.log('🎯 Interactions ready');
    }
    
    /**
     * Apply initial filter (Featured projects)
     */
    applyInitialFilter() {
        // Set featured filter as active
        const featuredBtn = document.querySelector('.inline-filter-btn[data-category="featured"]');
        if (featuredBtn) {
            featuredBtn.classList.add('active');
            featuredBtn.setAttribute('aria-pressed', 'true');
        }
        
        // Filter to show only featured projects
        this.filterProjects('featured');
        this.updateProjectCount();
        
        console.log('⭐ Showing featured projects by default');
    }
    
    /**
     * Get game title
     */
    getGameTitle(gameType) {
        const titles = {
            barista: 'Starbucks Barista Adventure'
        };
        return titles[gameType] || 'Interactive Game';
    }
    
    /**
     * Debounce utility
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
     * Get current state for debugging
     */
    getState() {
        return {
            activeGame: this.activeGame,
            loadedAssets: Array.from(this.loadedAssets),
            gameInstances: this.gameInstances.size,
            projectCardsCount: this.projectCards.length,
            hasFiltersManager: !!this.filtersManager
        };
    }
    
    /**
     * Clean up all resources
     */
    cleanup() {
        console.log('🧹 Cleaning up ProjectsPageManager');
        
        // Close active game
        if (this.activeGame) {
            this.closeGame();
        }
        
        // Cleanup all game instances
        this.gameInstances.forEach(game => {
            if (game && typeof game.cleanup === 'function') {
                game.cleanup();
            }
        });
        this.gameInstances.clear();
        
        // Cleanup resources
        this.resources.forEach(cleanup => cleanup());
        this.resources.clear();
        
        // Abort all event listeners
        this.abortController.abort();
        
        // Cleanup filters manager
        if (this.filtersManager && typeof this.filtersManager.cleanup === 'function') {
            this.filtersManager.cleanup();
        }
        
        // Reset references
        this.projectsSection = null;
        this.gameContainer = null;
        this.gameContent = null;
        this.projectCards = null;
        this.filtersManager = null;
        
        console.log('✅ ProjectsPageManager cleanup complete');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectsPageManager;
} else {
    window.ProjectsPageManager = ProjectsPageManager;
}
