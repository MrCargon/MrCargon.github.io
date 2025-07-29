/**
 * ProjectsPageManager - Manages the projects page functionality
 * Handles project navigation, game loading, and integration with PageManager
 * Extracts functionality from inline scripts for better maintainability
 */
class ProjectsPageManager {
    /**
     * Create a new ProjectsPageManager instance
     */
    constructor() {
        // Core elements
        this.projectsSection = null;
        this.gameContainer = null;
        this.gameContent = null;
        this.navButtons = null;
        this.projectCards = null;
        
        // Managers
        this.filtersManager = null;
        
        // State
        this.activeGame = null;
        this.gameInstances = new Map();
        this.gameAssets = {
            'barista': {
                script: 'src/components/games/StarbucksGame.js',
                css: 'src/components/games/StarbucksGame.css',
                className: 'StarbucksGame'
            }
        };
        this.gameScriptsLoaded = new Set();
        
        // Event handlers bound to this context
        this.handleProjectNavigation = this.handleProjectNavigation.bind(this);
        this.handleGameLoad = this.handleGameLoad.bind(this);
        this.handleCloseGame = this.handleCloseGame.bind(this);
        this.handleProjectCardClick = this.handleProjectCardClick.bind(this);
        
        // Resource tracking for cleanup
        this.eventListeners = [];
        this.timeouts = new Set();
        this.intervals = new Set();
    }
    
    /**
     * Initialize the projects page manager
     */
    async init() {
        try {
            console.log('📂 Initializing ProjectsPageManager');
            
            // Find DOM elements
            this.findElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize filters manager
            await this.initializeFiltersManager();
            
            // Setup project navigation
            this.setupProjectNavigation();
            
            // Setup game loading
            this.setupGameLoading();
            
            // Setup project interactions
            this.setupProjectInteractions();
            
            // Show featured projects by default
            this.showFeaturedProjectsOnly();
            
            console.log('✅ ProjectsPageManager initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ ProjectsPageManager initialization failed:', error);
            return false;
        }
    }
    
    /**
     * Find required DOM elements
     */
    findElements() {
        this.projectsSection = document.getElementById('projects');
        this.gameContainer = document.getElementById('game-container');
        this.gameContent = document.getElementById('game-content');
        this.navButtons = document.querySelectorAll('.side-nav .nav-button');
        this.projectCards = document.querySelectorAll('.project-card');
        
        if (!this.projectsSection) {
            throw new Error('Projects section not found');
        }
        
        console.log(`📂 Found ${this.navButtons.length} nav buttons, ${this.projectCards.length} project cards`);
    }
    
    /**
     * Setup event listeners with proper tracking
     */
    setupEventListeners() {
        // Game close buttons
        const closeButtons = document.querySelectorAll('[data-action="close-game"]');
        closeButtons.forEach(button => {
            this.addEventListener(button, 'click', this.handleCloseGame);
        });
        
        // Project navigation
        this.navButtons.forEach(button => {
            this.addEventListener(button, 'click', this.handleProjectNavigation);
        });
        
        // Game load buttons
        const gameButtons = document.querySelectorAll('[data-game], .project-btn[onclick*="Game"]');
        gameButtons.forEach(button => {
            // Remove any existing onclick handlers
            button.removeAttribute('onclick');
            this.addEventListener(button, 'click', this.handleGameLoad);
        });
        
        // Project card interactions
        this.projectCards.forEach(card => {
            this.addEventListener(card, 'click', this.handleProjectCardClick);
            this.addEventListener(card, 'keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.handleProjectCardClick({ currentTarget: card });
                }
            });
        });
    }
    
    /**
     * Enhanced addEventListener with tracking for cleanup
     */
    addEventListener(element, event, handler, options = {}) {
        element.addEventListener(event, handler, options);
        this.eventListeners.push({ element, event, handler, options });
    }
    
    /**
     * Initialize filters manager
     */
    async initializeFiltersManager() {
        if (window.ProjectFiltersManager) {
            this.filtersManager = new ProjectFiltersManager();
            const success = await this.filtersManager.init();
            
            if (!success) {
                console.warn('⚠️ Failed to initialize ProjectFiltersManager, using fallback');
                this.setupFallbackFilterToggle();
            }
        } else {
            console.warn('⚠️ ProjectFiltersManager not available, using fallback');
            this.setupFallbackFilterToggle();
        }
    }
    
    /**
     * Setup fallback filter toggle functionality
     */
    setupFallbackFilterToggle() {
        console.log('🔧 Setting up fallback filter toggle functionality');
        
        const toggleBtn = document.querySelector('.filters-toggle-btn');
        const filtersPanel = document.getElementById('projects-filters-panel');
        
        if (!toggleBtn || !filtersPanel) {
            console.warn('⚠️ Filter toggle elements not found');
            return;
        }
        
        // Add click event listener to toggle button
        this.addEventListener(toggleBtn, 'click', (e) => {
            e.preventDefault();
            console.log('🔽 Filter toggle clicked');
            
            const isCollapsed = toggleBtn.classList.contains('collapsed');
            const icon = toggleBtn.querySelector('.filters-icon');
            
            if (isCollapsed) {
                // Expand the panel
                toggleBtn.classList.remove('collapsed');
                toggleBtn.setAttribute('aria-expanded', 'true');
                filtersPanel.classList.remove('collapsed');
                filtersPanel.setAttribute('aria-hidden', 'false');
                if (icon) icon.textContent = '🔼';
                
                console.log('📂 Filter panel expanded');
            } else {
                // Collapse the panel
                toggleBtn.classList.add('collapsed');
                toggleBtn.setAttribute('aria-expanded', 'false');
                filtersPanel.classList.add('collapsed');
                filtersPanel.setAttribute('aria-hidden', 'true');
                if (icon) icon.textContent = '🔽';
                
                console.log('📁 Filter panel collapsed');
            }
        });
        
        // Set up filter buttons functionality
        const filterButtons = filtersPanel.querySelectorAll('.filter-btn');
        filterButtons.forEach(button => {
            this.addEventListener(button, 'click', () => {
                const category = button.getAttribute('data-category');
                console.log(`🎯 Filter clicked: ${category}`);
                
                // Update active filter
                filterButtons.forEach(btn => {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-pressed', 'false');
                });
                
                button.classList.add('active');
                button.setAttribute('aria-pressed', 'true');
                
                // Filter projects
                this.filterProjects(category);
                this.updateProjectCount();
            });
        });
        
        // Set up search box functionality
        const searchBox = filtersPanel.querySelector('#project-search');
        if (searchBox) {
            let searchTimeout;
            
            this.addEventListener(searchBox, 'input', () => {
                clearTimeout(searchTimeout);
                const searchTerm = searchBox.value.toLowerCase().trim();
                
                searchTimeout = this.createTimeout(() => {
                    this.performSearch(searchTerm);
                }, 300);
            });
        }
        
        console.log('✅ Fallback filter toggle functionality set up');
    }
    
    /**
     * Filter projects by category
     */
    filterProjects(category) {
        let visibleCount = 0;
        
        this.projectCards.forEach((card, index) => {
            const cardCategory = card.getAttribute('data-category');
            const isFeatured = card.getAttribute('data-featured') === 'true';
            
            let shouldShow = false;
            
            if (category === 'featured') {
                shouldShow = isFeatured;
            } else if (category === 'all') {
                shouldShow = true;
            } else {
                shouldShow = cardCategory === category;
            }
            
            if (shouldShow) {
                card.style.display = 'block';
                card.style.animation = `fadeInUp 0.6s ease-out ${index * 0.1}s both`;
                visibleCount++;
            } else {
                card.style.animation = 'fadeOut 0.3s ease-out';
                this.createTimeout(() => {
                    if (card.style.animation && card.style.animation.includes('fadeOut')) {
                        card.style.display = 'none';
                    }
                }, 300);
            }
        });
        
        console.log(`🎯 Filtered to show ${visibleCount} projects with category: ${category}`);
    }
    
    /**
     * Perform search with highlighting
     */
    performSearch(searchTerm) {
        let visibleCount = 0;
        
        this.projectCards.forEach(card => {
            const title = card.querySelector('h3').textContent.toLowerCase();
            const description = card.querySelector('p').textContent.toLowerCase();
            const tags = Array.from(card.querySelectorAll('.tag'))
                .map(tag => tag.textContent.toLowerCase())
                .join(' ');
            
            const shouldShow = !searchTerm || 
                              title.includes(searchTerm) || 
                              description.includes(searchTerm) || 
                              tags.includes(searchTerm);
            
            if (shouldShow) {
                card.style.display = 'block';
                card.style.animation = 'fadeInUp 0.4s ease-out';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
        
        this.updateProjectCount();
        
        console.log(`🔍 Search for "${searchTerm}" found ${visibleCount} results`);
    }
    
    /**
     * Update project count display
     */
    updateProjectCount() {
        const projectCount = document.getElementById('project-count');
        if (!projectCount) return;
        
        const visibleProjects = document.querySelectorAll('.project-card:not([style*="display: none"])').length;
        const totalProjects = this.projectCards.length;
        
        const countText = visibleProjects === totalProjects 
            ? `${totalProjects} Projects` 
            : `${visibleProjects} of ${totalProjects} Projects`;
        
        // Animate count change
        projectCount.style.transition = 'opacity 0.2s ease';
        projectCount.style.opacity = '0.5';
        
        this.createTimeout(() => {
            projectCount.textContent = countText;
            projectCount.style.opacity = '1';
        }, 100);
    }
    
    /**
     * Setup project navigation
     */
    setupProjectNavigation() {
        this.navButtons.forEach((button, index) => {
            // Add keyboard navigation
            this.addEventListener(button, 'keydown', (e) => {
                if (e.key === 'ArrowDown' && this.navButtons[index + 1]) {
                    e.preventDefault();
                    this.navButtons[index + 1].focus();
                } else if (e.key === 'ArrowUp' && this.navButtons[index - 1]) {
                    e.preventDefault();
                    this.navButtons[index - 1].focus();
                }
            });
        });
        
        console.log('📂 Project navigation setup complete');
    }
    
    /**
     * Handle project navigation click
     */
    handleProjectNavigation(e) {
        e.preventDefault();
        
        const button = e.currentTarget;
        
        // Update active state
        this.navButtons.forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-current', 'false');
        });
        
        button.classList.add('active');
        button.setAttribute('aria-current', 'true');
        
        // Scroll to target project
        const targetId = button.getAttribute('href');
        const targetProject = document.querySelector(targetId);
        
        if (targetProject) {
            targetProject.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'nearest'
            });
            
            // Enhanced highlight effect
            targetProject.classList.add('highlight');
            this.createTimeout(() => {
                targetProject.classList.remove('highlight');
            }, 2000);
            
            // Focus for accessibility
            this.createTimeout(() => targetProject.focus(), 600);
        }
        
        console.log(`📂 Navigated to: ${targetId}`);
    }
    
    /**
     * Setup game loading functionality
     */
    setupGameLoading() {
        console.log('🎮 Setting up game loading functionality');
    }
    
    /**
     * Handle game load button click
     */
    async handleGameLoad(e) {
        e.preventDefault();
        
        const button = e.currentTarget;
        
        // Prevent multiple clicks
        if (button.disabled) return;
        
        const gameType = button.getAttribute('data-game') || 'barista';
        
        try {
            await this.loadGame(gameType, button);
        } catch (error) {
            console.error(`❌ Failed to load ${gameType} game:`, error);
            this.showToast('Failed to load game. Please try again.', 'error');
        }
    }
    
    /**
     * Load a game with enhanced error handling
     */
    async loadGame(gameType, button) {
        console.log(`🎮 Loading ${gameType} game`);
        
        // Update button state
        const originalHTML = button.innerHTML;
        button.innerHTML = '<span>⏳</span> Loading...';
        button.disabled = true;
        
        try {
            // Validate game container
            if (!this.gameContainer || !this.gameContent) {
                throw new Error('Game container elements not found');
            }
            
            // Show game container
            this.gameContainer.style.display = 'block';
            
            // Update title
            const gameTitle = document.getElementById('game-title');
            if (gameTitle) {
                gameTitle.textContent = this.getGameTitle(gameType);
            }
            
            // Load specific game
            let game;
            switch (gameType) {
                case 'barista':
                    game = await this.loadBaristaGame();
                    break;
                default:
                    throw new Error(`Unknown game type: ${gameType}`);
            }
            
            // Scroll to game
            this.gameContainer.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
            
            // Update button
            button.innerHTML = '<span>🎮</span> Game Loaded';
            this.createTimeout(() => {
                button.innerHTML = originalHTML;
                button.disabled = false;
            }, 2000);
            
            // Focus on game container for accessibility
            this.gameContainer.focus();
            
            console.log(`✅ ${gameType} game loaded successfully`);
            
        } catch (error) {
            console.error(`❌ Failed to load ${gameType} game:`, error);
            
            // Reset button
            button.innerHTML = originalHTML;
            button.disabled = false;
            
            throw error;
        }
    }
    
    /**
     * Load Barista Game specifically
     */
    async loadBaristaGame() {
        console.log('🎮 Loading Starbucks Barista Game...');
        
        // Show loading state
        this.showGameLoadingState();
        
        // Load game assets
        await this.loadGameAssets('barista');
        
        // Small delay for better UX
        await this.delay(800);
        
        // Check if game class is available
        if (typeof StarbucksGame === 'undefined') {
            throw new Error('StarbucksGame class not found after loading assets');
        }
        
        // Clear container
        this.gameContent.innerHTML = '';
        
        // Create game instance
        const game = new StarbucksGame(this.gameContent);
        
        // Store reference for cleanup
        this.gameInstances.set('barista', game);
        this.activeGame = 'barista';
        
        // Setup game event listeners
        this.setupGameEventListeners(game);
        
        return game;
    }
    
    /**
     * Load game assets (script and CSS)
     */
    async loadGameAssets(gameType) {
        const assets = this.gameAssets[gameType];
        if (!assets) {
            throw new Error(`Unknown game type: ${gameType}`);
        }
        
        const assetKey = `${gameType}-assets`;
        if (this.gameScriptsLoaded.has(assetKey)) {
            return true;
        }
        
        try {
            console.log(`🎮 Loading ${gameType} game assets...`);
            
            // Load CSS first
            await this.loadGameCSS(assets.css);
            
            // Load JavaScript
            await this.loadScript(assets.script);
            
            // Mark as loaded
            this.gameScriptsLoaded.add(assetKey);
            
            console.log(`✅ ${gameType} game assets loaded successfully`);
            return true;
            
        } catch (error) {
            console.error(`❌ Failed to load ${gameType} game assets:`, error);
            throw error;
        }
    }
    
    /**
     * Load game CSS
     */
    loadGameCSS(cssPath) {
        return new Promise((resolve, reject) => {
            // Check if CSS is already loaded
            if (document.querySelector(`link[href="${cssPath}"]`)) {
                resolve();
                return;
            }
            
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssPath;
            link.onload = () => {
                console.log(`✅ Game CSS loaded: ${cssPath}`);
                resolve();
            };
            link.onerror = () => {
                console.error(`❌ Failed to load game CSS: ${cssPath}`);
                reject(new Error(`Failed to load CSS: ${cssPath}`));
            };
            
            document.head.appendChild(link);
        });
    }
    
    /**
     * Load JavaScript file
     */
    loadScript(scriptPath) {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (document.querySelector(`script[src="${scriptPath}"]`)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = scriptPath;
            script.async = true;
            script.onload = () => {
                console.log(`✅ Script loaded: ${scriptPath}`);
                resolve();
            };
            script.onerror = () => {
                console.error(`❌ Failed to load script: ${scriptPath}`);
                reject(new Error(`Failed to load script: ${scriptPath}`));
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * Show game loading state
     */
    showGameLoadingState() {
        if (!this.gameContent) return;
        
        this.gameContent.innerHTML = `
            <div class="game-loading-state">
                <div class="loading-content">
                    <div class="loading-spinner">⏳</div>
                    <h3>Loading Barista Game...</h3>
                    <p>Preparing your coffee adventure!</p>
                    <div class="loading-progress">
                        <div class="progress-bar"></div>
                    </div>
                </div>
            </div>
            <style>
                .game-loading-state {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: white;
                    text-align: center;
                    padding: 2rem;
                }
                .loading-content h3 {
                    font-size: 1.5rem;
                    margin: 1rem 0 0.5rem 0;
                }
                .loading-content p {
                    opacity: 0.8;
                    margin-bottom: 2rem;
                }
                .loading-spinner {
                    font-size: 3rem;
                    animation: spin 1s linear infinite;
                }
                .loading-progress {
                    width: 200px;
                    height: 4px;
                    background: rgba(255,255,255,0.3);
                    border-radius: 2px;
                    overflow: hidden;
                    margin: 0 auto;
                }
                .progress-bar {
                    width: 0%;
                    height: 100%;
                    background: white;
                    border-radius: 2px;
                    animation: loadProgress 2s ease-out forwards;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes loadProgress {
                    0% { width: 0%; }
                    50% { width: 70%; }
                    100% { width: 100%; }
                }
            </style>
        `;
    }
    
    /**
     * Setup game event listeners
     */
    setupGameEventListeners(game) {
        if (game && typeof game.addEventListener === 'function') {
            const exitHandler = () => this.closeGame();
            const errorHandler = (event) => {
                console.error('Game error:', event.detail);
                this.showToast('Game error occurred', 'error');
            };
            
            game.addEventListener('game:exit', exitHandler);
            game.addEventListener('game:error', errorHandler);
            
            // Store handlers for cleanup
            game._projectsPageHandlers = { exitHandler, errorHandler };
        }
    }
    
    /**
     * Handle close game
     */
    handleCloseGame(e) {
        e.preventDefault();
        this.closeGame();
    }
    
    /**
     * Close active game
     */
    closeGame() {
        if (this.activeGame && this.gameInstances.has(this.activeGame)) {
            const game = this.gameInstances.get(this.activeGame);
            
            try {
                // Remove event listeners if they exist
                if (game._projectsPageHandlers) {
                    const { exitHandler, errorHandler } = game._projectsPageHandlers;
                    game.removeEventListener('game:exit', exitHandler);
                    game.removeEventListener('game:error', errorHandler);
                    delete game._projectsPageHandlers;
                }
                
                // Cleanup game instance
                if (game && typeof game.cleanup === 'function') {
                    game.cleanup();
                }
                
                // Remove from instances
                this.gameInstances.delete(this.activeGame);
                
                console.log(`✅ Closed ${this.activeGame} game`);
                
            } catch (error) {
                console.warn(`⚠️ Error closing ${this.activeGame} game:`, error);
            }
            
            this.activeGame = null;
        }
        
        // Hide game container
        if (this.gameContainer) {
            this.gameContainer.style.display = 'none';
            
            // Clear content
            if (this.gameContent) {
                this.gameContent.innerHTML = '';
            }
        }
        
        // Scroll back to projects
        if (this.projectsSection) {
            this.projectsSection.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }
        
        console.log('🎮 Game closed');
    }
    
    /**
     * Handle project card click
     */
    handleProjectCardClick(e) {
        const card = e.currentTarget;
        
        // Skip if clicking on buttons or links
        if (e.target.closest('.project-btn') || e.target.closest('a')) {
            return;
        }
        
        // Add click feedback
        card.style.transform = 'scale(0.98)';
        card.style.transition = 'transform 0.1s ease';
        
        this.createTimeout(() => {
            card.style.transform = '';
            card.style.transition = '';
        }, 150);
    }
    
    /**
     * Setup project interactions
     */
    setupProjectInteractions() {
        this.projectCards.forEach(card => {
            // Hover effects
            this.addEventListener(card, 'mouseenter', () => {
                card.style.transform = 'translateY(-4px) scale(1.01)';
            });
            
            this.addEventListener(card, 'mouseleave', () => {
                card.style.transform = '';
            });
        });
        
        console.log('📂 Project interactions setup complete');
    }
    
    /**
     * Show only featured projects by default
     */
    showFeaturedProjectsOnly() {
        const featuredProjects = document.querySelectorAll('.project-card[data-featured="true"]');
        
        console.log(`🌟 Showing ${featuredProjects.length} featured projects`);
        
        // This will be handled by the FiltersManager
        if (this.filtersManager) {
            // The FiltersManager will handle the initial featured filter
            return;
        }
        
        // Fallback if FiltersManager is not available
        this.projectCards.forEach((card, index) => {
            const isFeatured = card.getAttribute('data-featured') === 'true';
            
            if (isFeatured) {
                card.style.display = 'block';
                card.style.animation = `fadeInUp 0.6s ease-out ${index * 0.2}s both`;
            } else {
                card.style.display = 'none';
            }
        });
    }
    
    /**
     * Get game title by type
     */
    getGameTitle(gameType) {
        const titles = {
            barista: 'Starbucks Barista Adventure'
        };
        return titles[gameType] || 'Interactive Game';
    }
    
    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `projects-toast ${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 1rem;
            right: 1rem;
            padding: 0.75rem 1rem;
            background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(toast);
        
        // Auto remove
        this.createTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOut 0.3s ease-out';
                this.createTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        }, 3000);
    }
    
    /**
     * Create tracked timeout
     */
    createTimeout(callback, delay) {
        const id = setTimeout(() => {
            this.timeouts.delete(id);
            callback();
        }, delay);
        this.timeouts.add(id);
        return id;
    }
    
    /**
     * Create tracked interval
     */
    createInterval(callback, delay) {
        const id = setInterval(callback, delay);
        this.intervals.add(id);
        return id;
    }
    
    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => {
            this.createTimeout(resolve, ms);
        });
    }
    
    /**
     * Get current state for debugging
     */
    getState() {
        return {
            activeGame: this.activeGame,
            gameInstances: this.gameInstances.size,
            gameScriptsLoaded: Array.from(this.gameScriptsLoaded),
            eventListenersCount: this.eventListeners.length,
            timeoutsCount: this.timeouts.size,
            intervalsCount: this.intervals.size,
            filtersManagerState: this.filtersManager?.getState()
        };
    }
    
    /**
     * Clean up resources
     */
    cleanup() {
        console.log('🧹 Cleaning up ProjectsPageManager');
        
        // Close any active games
        if (this.activeGame) {
            this.closeGame();
        }
        
        // Clean up all game instances
        this.gameInstances.forEach((game, gameType) => {
            try {
                if (game._projectsPageHandlers) {
                    const { exitHandler, errorHandler } = game._projectsPageHandlers;
                    game.removeEventListener('game:exit', exitHandler);
                    game.removeEventListener('game:error', errorHandler);
                    delete game._projectsPageHandlers;
                }
                
                if (game && typeof game.cleanup === 'function') {
                    game.cleanup();
                }
            } catch (error) {
                console.warn(`⚠️ Error cleaning up ${gameType} game:`, error);
            }
        });
        this.gameInstances.clear();
        
        // Clear timeouts and intervals
        this.timeouts.forEach(id => clearTimeout(id));
        this.timeouts.clear();
        
        this.intervals.forEach(id => clearInterval(id));
        this.intervals.clear();
        
        // Remove event listeners
        this.eventListeners.forEach(({ element, event, handler, options }) => {
            try {
                element.removeEventListener(event, handler, options);
            } catch (error) {
                console.warn('⚠️ Error removing event listener:', error);
            }
        });
        this.eventListeners = [];
        
        // Cleanup filters manager
        if (this.filtersManager) {
            this.filtersManager.cleanup();
            this.filtersManager = null;
        }
        
        // Reset references
        this.projectsSection = null;
        this.gameContainer = null;
        this.gameContent = null;
        this.navButtons = null;
        this.projectCards = null;
        
        console.log('✅ ProjectsPageManager cleanup complete');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectsPageManager;
} else {
    window.ProjectsPageManager = ProjectsPageManager;
}
