/**
 * Enhanced Projects Page Manager
 * Optimized for performance and game integration
 */
class ProjectsPageManager {
    constructor() {
        this.projectContainer = null;
        this.gameContainer = null;
        this.currentGame = null;
        this.projects = new Map();
        this.isInitialized = false;
        
        // Performance tracking
        this.performanceMetrics = {
            gameLoadTimes: {},
            interactionCount: 0
        };
        
        // Game configurations
        this.gameConfigs = {
            barista: {
                title: "Starbucks Barista Adventure",
                component: "StarbucksGame",
                preload: true,
                category: "educational"
            }
        };
        
        this.init();
    }

    /**
     * Initialize the projects page manager
     */
    async init() {
        if (this.isInitialized) return;
        
        try {
            // Cache DOM elements
            this.cacheElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize projects data
            this.initializeProjectsData();
            
            // Setup game integration
            this.setupGameIntegration();
            
            // Setup accessibility features
            this.setupAccessibility();
            
            this.isInitialized = true;
            console.log('Projects page manager initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize projects page manager:', error);
        }
    }

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        this.projectContainer = document.querySelector('.projects-content');
        this.gameContainer = document.getElementById('game-container');
        this.gameContent = document.getElementById('game-content');
        this.gameTitle = document.getElementById('game-title');
        this.closeGameBtn = document.getElementById('close-game');
        this.navButtons = document.querySelectorAll('.nav-button');
        this.projectCards = document.querySelectorAll('.project-card');
        this.projectActions = document.querySelectorAll('.project-action');
    }

    /**
     * Setup event listeners with performance optimization
     */
    setupEventListeners() {
        // Use event delegation for better performance
        if (this.projectContainer) {
            this.projectContainer.addEventListener('click', this.handleProjectClick.bind(this));
            this.projectContainer.addEventListener('keydown', this.handleKeyboardNavigation.bind(this));
        }
        
        // Game controls
        if (this.closeGameBtn) {
            this.closeGameBtn.addEventListener('click', this.closeGame.bind(this));
        }
        
        if (this.gameContainer) {
            this.gameContainer.addEventListener('click', (e) => {
                if (e.target === this.gameContainer) {
                    this.closeGame();
                }
            });
        }
        
        // Escape key to close game
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isGameOpen()) {
                this.closeGame();
            }
        });
        
        // Navigation buttons
        this.navButtons.forEach(btn => {
            btn.addEventListener('click', this.handleNavigation.bind(this));
        });
        
        // Window resize handler (debounced)
        window.addEventListener('resize', this.debounce(this.handleResize.bind(this), 250));
    }

    /**
     * Handle project interactions
     */
    async handleProjectClick(event) {
        const action = event.target.closest('[data-action]');
        if (!action) return;
        
        event.preventDefault();
        this.performanceMetrics.interactionCount++;
        
        const actionType = action.dataset.action;
        const projectId = action.dataset.project;
        const gameId = action.dataset.game;
        
        // Add loading state
        action.classList.add('loading');
        
        try {
            switch (actionType) {
                case 'play-game':
                    await this.launchGame(gameId);
                    break;
                case 'view-details':
                    await this.showProjectDetails(projectId);
                    break;
                case 'launch-demo':
                    await this.launchDemo(projectId);
                    break;
                case 'try-demo':
                    await this.tryDemo(projectId);
                    break;
                case 'view-demo':
                    await this.viewDemo(projectId);
                    break;
                default:
                    console.warn(`Unknown action: ${actionType}`);
            }
        } catch (error) {
            console.error(`Error handling action ${actionType}:`, error);
            this.showErrorMessage(`Failed to ${actionType.replace('-', ' ')}. Please try again.`);
        } finally {
            action.classList.remove('loading');
        }
    }

    /**
     * Launch a game in the game container
     */
    async launchGame(gameId) {
        if (!gameId || !this.gameConfigs[gameId]) {
            throw new Error(`Invalid game ID: ${gameId}`);
        }
        
        const startTime = performance.now();
        const gameConfig = this.gameConfigs[gameId];
        
        try {
            // Update game title
            if (this.gameTitle) {
                this.gameTitle.textContent = gameConfig.title;
            }
            
            // Show loading state
            this.showGameLoading();
            
            // Show game container
            this.showGameContainer();
            
            // Load and initialize the game
            await this.loadGameComponent(gameId);
            
            // Track performance
            const loadTime = performance.now() - startTime;
            this.performanceMetrics.gameLoadTimes[gameId] = loadTime;
            
            console.log(`Game ${gameId} loaded in ${loadTime.toFixed(2)}ms`);
            
        } catch (error) {
            this.hideGameContainer();
            throw error;
        }
    }

    /**
     * Load game component dynamically
     */
    async loadGameComponent(gameId) {
        const gameConfig = this.gameConfigs[gameId];
        
        if (gameId === 'barista') {
            // Load the React Starbucks game
            await this.loadBaristaGame();
        } else {
            throw new Error(`Game component not found: ${gameConfig.component}`);
        }
    }

    /**
     * Load the Barista game (React component integration)
     */
    async loadBaristaGame() {
        if (!this.gameContent) return;
        
        // Clear previous content
        this.gameContent.innerHTML = '';
        
        // Create container for React component
        const gameDiv = document.createElement('div');
        gameDiv.id = 'barista-game-root';
        gameDiv.style.width = '100%';
        gameDiv.style.height = '100%';
        this.gameContent.appendChild(gameDiv);
        
        // Check if React and the game component are available
        if (typeof React !== 'undefined' && typeof ReactDOM !== 'undefined') {
            // If React is available, we can render the component
            try {
                // Load the game component
                const StarbucksGameModule = await import('./games/StarbucksGame.js');
                const StarbucksGame = StarbucksGameModule.default;
                
                // Render the React component
                ReactDOM.render(React.createElement(StarbucksGame), gameDiv);
                
            } catch (error) {
                console.warn('React component loading failed, falling back to HTML version');
                this.loadBaristaGameHTML();
            }
        } else {
            // Fallback to HTML/JS version
            this.loadBaristaGameHTML();
        }
    }

    /**
     * Fallback HTML version of the Barista game
     */
    loadBaristaGameHTML() {
        if (!this.gameContent) return;
        
        this.gameContent.innerHTML = `
            <div class="barista-game-container">
                <div class="game-screen welcome-screen active">
                    <div class="game-header">
                        <h1>☕ Starbucks Barista Adventure ☕</h1>
                        <p>Become a master barista through fun challenges!</p>
                    </div>
                    
                    <div class="game-form">
                        <div class="barista-avatar">👨‍🍳</div>
                        <h2>Welcome, Future Barista!</h2>
                        <p>What's your barista name?</p>
                        
                        <input type="text" id="player-name" placeholder="Enter your name" class="name-input">
                        <button id="start-game" class="start-btn" disabled>Start My Adventure!</button>
                    </div>
                    
                    <div class="game-info">
                        <p>Learn recipes • Earn stars • Collect badges</p>
                        <p>Become the ultimate Starbucks barista!</p>
                    </div>
                </div>
                
                <div class="game-screen main-screen">
                    <div class="player-info">
                        <div class="player-stats">
                            <h2 id="player-title">Barista</h2>
                            <div class="stats">
                                <span class="level">Level <span id="player-level">1</span></span>
                                <span class="stars"><span id="player-stars">0</span> ⭐</span>
                            </div>
                        </div>
                        <button class="badges-btn" id="badges-btn">🏆 <span id="badge-count">0</span></button>
                    </div>
                    
                    <div class="barista-tip">
                        <div class="barista-character">😊</div>
                        <div class="tip-content">
                            <h3>Barista Tip:</h3>
                            <p id="current-tip">Welcome to your barista adventure! Remember to have fun while learning!</p>
                        </div>
                    </div>
                    
                    <div class="game-options">
                        <button class="option-btn random-challenge" data-category="all">
                            <span class="icon">🎯</span>
                            <span class="title">Random Challenge</span>
                            <span class="subtitle">Test your skills!</span>
                        </button>
                        
                        <button class="option-btn recipe-types">
                            <span class="icon">📚</span>
                            <span class="title">Recipe Types</span>
                            <span class="subtitle">Choose a category</span>
                        </button>
                        
                        <button class="option-btn recipe-book">
                            <span class="icon">📖</span>
                            <span class="title">Recipe Book</span>
                            <span class="subtitle">Study the recipes</span>
                        </button>
                        
                        <button class="option-btn barista-tips">
                            <span class="icon">💡</span>
                            <span class="title">Barista Tips</span>
                            <span class="subtitle">Helpful advice</span>
                        </button>
                    </div>
                    
                    <div class="progress-info">
                        <p class="streak-info">Start a streak by getting answers right in a row!</p>
                        <p class="level-info"><span id="stars-needed">5</span> more stars to level up!</p>
                    </div>
                </div>
            </div>
        `;
        
        // Initialize the HTML game
        this.initializeBaristaGameHTML();
    }

    /**
     * Initialize the HTML version of the barista game
     */
    initializeBaristaGameHTML() {
        const nameInput = document.getElementById('player-name');
        const startBtn = document.getElementById('start-game');
        const gameScreens = document.querySelectorAll('.game-screen');
        
        if (nameInput && startBtn) {
            nameInput.addEventListener('input', (e) => {
                startBtn.disabled = !e.target.value.trim();
            });
            
            startBtn.addEventListener('click', () => {
                const playerName = nameInput.value.trim();
                if (playerName) {
                    document.getElementById('player-title').textContent = `Barista ${playerName}`;
                    this.switchGameScreen('main-screen');
                }
            });
        }
        
        // Game option handlers
        const optionButtons = document.querySelectorAll('.option-btn');
        optionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const btnClass = btn.className;
                if (btnClass.includes('random-challenge')) {
                    this.showMessage('🎯 Random Challenge selected! Feature coming soon...');
                } else if (btnClass.includes('recipe-types')) {
                    this.showMessage('📚 Recipe Types selected! Feature coming soon...');
                } else if (btnClass.includes('recipe-book')) {
                    this.showMessage('📖 Recipe Book selected! Feature coming soon...');
                } else if (btnClass.includes('barista-tips')) {
                    this.showMessage('💡 Here\'s a tip: Practice makes perfect!');
                }
            });
        });
    }

    /**
     * Switch between game screens
     */
    switchGameScreen(screenClass) {
        const screens = document.querySelectorAll('.game-screen');
        screens.forEach(screen => {
            screen.classList.remove('active');
            if (screen.classList.contains(screenClass)) {
                screen.classList.add('active');
            }
        });
    }

    /**
     * Show a temporary message
     */
    showMessage(message, duration = 3000) {
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = 'game-message';
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            z-index: 10000;
            font-weight: 600;
            text-align: center;
            max-width: 300px;
        `;
        
        document.body.appendChild(messageEl);
        
        // Remove after duration
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, duration);
    }

    /**
     * Show game loading state
     */
    showGameLoading() {
        if (!this.gameContent) return;
        
        this.gameContent.innerHTML = `
            <div class="game-loading">
                <div class="loading-spinner"></div>
                <h3>Loading Game...</h3>
                <p>Please wait while we prepare your barista adventure!</p>
            </div>
        `;
    }

    /**
     * Show game container
     */
    showGameContainer() {
        if (this.gameContainer) {
            this.gameContainer.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
    }

    /**
     * Hide game container
     */
    hideGameContainer() {
        if (this.gameContainer) {
            this.gameContainer.classList.remove('active');
            document.body.style.overflow = ''; // Restore scrolling
        }
    }

    /**
     * Close the currently open game
     */
    closeGame() {
        this.hideGameContainer();
        
        // Clean up game content
        if (this.gameContent) {
            this.gameContent.innerHTML = '';
        }
        
        this.currentGame = null;
        
        // Focus back to the trigger button for accessibility
        const activeProjectCard = document.querySelector('.project-card.featured');
        if (activeProjectCard) {
            activeProjectCard.focus();
        }
    }

    /**
     * Check if a game is currently open
     */
    isGameOpen() {
        return this.gameContainer && this.gameContainer.classList.contains('active');
    }

    /**
     * Handle navigation between projects
     */
    handleNavigation(event) {
        event.preventDefault();
        
        const button = event.currentTarget;
        const targetId = button.getAttribute('href');
        
        // Update active state
        this.navButtons.forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-current', 'false');
        });
        
        button.classList.add('active');
        button.setAttribute('aria-current', 'true');
        
        // Scroll to target project
        if (targetId) {
            const targetProject = document.querySelector(targetId);
            if (targetProject) {
                targetProject.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
                
                // Add highlight effect
                this.highlightProject(targetProject);
            }
        }
    }

    /**
     * Highlight a project card
     */
    highlightProject(projectCard) {
        projectCard.classList.add('highlighted');
        setTimeout(() => {
            projectCard.classList.remove('highlighted');
        }, 2000);
    }

    /**
     * Show project details (placeholder)
     */
    async showProjectDetails(projectId) {
        console.log(`Showing details for project: ${projectId}`);
        
        // This would typically load project details
        // For now, just show a message
        this.showMessage(`📖 Project details for ${projectId} coming soon!`);
    }

    /**
     * Launch demo (placeholder)
     */
    async launchDemo(projectId) {
        console.log(`Launching demo for project: ${projectId}`);
        this.showMessage(`🚀 Demo for ${projectId} launching soon!`);
    }

    /**
     * Try demo (placeholder)
     */
    async tryDemo(projectId) {
        console.log(`Trying demo for project: ${projectId}`);
        this.showMessage(`🤖 Demo for ${projectId} coming soon!`);
    }

    /**
     * View demo (placeholder)
     */
    async viewDemo(projectId) {
        console.log(`Viewing demo for project: ${projectId}`);
        this.showMessage(`📱 Demo for ${projectId} coming soon!`);
    }

    /**
     * Handle keyboard navigation
     */
    handleKeyboardNavigation(event) {
        const focusedElement = document.activeElement;
        
        if (event.key === 'Enter' || event.key === ' ') {
            if (focusedElement.classList.contains('project-card')) {
                event.preventDefault();
                const playButton = focusedElement.querySelector('[data-action="play-game"]') ||
                                   focusedElement.querySelector('.project-action.primary');
                if (playButton) {
                    playButton.click();
                }
            }
        }
    }

    /**
     * Setup accessibility features
     */
    setupAccessibility() {
        // Add ARIA labels and roles
        this.projectCards.forEach((card, index) => {
            if (!card.getAttribute('role')) {
                card.setAttribute('role', 'article');
            }
            
            if (!card.getAttribute('aria-label')) {
                const title = card.querySelector('h3')?.textContent || `Project ${index + 1}`;
                card.setAttribute('aria-label', title);
            }
        });
        
        // Add keyboard support indicators
        const keyboardHint = document.createElement('div');
        keyboardHint.className = 'keyboard-hint';
        keyboardHint.innerHTML = 'Use Tab to navigate, Enter to interact';
        keyboardHint.style.cssText = `
            position: absolute;
            top: -100px;
            left: 0;
            background: #000;
            color: #fff;
            padding: 0.5rem;
            border-radius: 4px;
            font-size: 0.8rem;
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
        `;
        
        document.body.appendChild(keyboardHint);
        
        // Show hint on keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                keyboardHint.style.opacity = '1';
                setTimeout(() => {
                    keyboardHint.style.opacity = '0';
                }, 2000);
            }
        });
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Adjust game container if open
        if (this.isGameOpen()) {
            // Game container responsive adjustments would go here
        }
    }

    /**
     * Initialize projects data
     */
    initializeProjectsData() {
        this.projects.set('barista-game', {
            title: 'Starbucks Barista Adventure',
            category: 'interactive',
            status: 'completed',
            technologies: ['React', 'Interactive', 'Educational'],
            description: 'An interactive educational game where you learn to make Starbucks drinks through fun challenges.'
        });
        
        // Add other projects...
    }

    /**
     * Setup game integration
     */
    setupGameIntegration() {
        // Preload game assets if needed
        if (this.gameConfigs.barista.preload) {
            // Preload barista game resources
            console.log('Preloading barista game resources...');
        }
    }

    /**
     * Show error message
     */
    showErrorMessage(message) {
        console.error(message);
        this.showMessage(`❌ ${message}`, 4000);
    }

    /**
     * Utility: Debounce function
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
     * Get performance report
     */
    getPerformanceReport() {
        return {
            gameLoadTimes: this.performanceMetrics.gameLoadTimes,
            interactionCount: this.performanceMetrics.interactionCount,
            isInitialized: this.isInitialized
        };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Remove event listeners
        this.projectContainer?.removeEventListener('click', this.handleProjectClick);
        this.closeGameBtn?.removeEventListener('click', this.closeGame);
        
        // Clear game content
        if (this.gameContent) {
            this.gameContent.innerHTML = '';
        }
        
        // Reset state
        this.isInitialized = false;
        this.currentGame = null;
        
        console.log('Projects page manager destroyed');
    }
}

// Enhanced PageManager integration
class PageManager {
    constructor() {
        this.contentContainer = document.getElementById('page-container');
        this.pageCache = new Map();
        this.currentPage = null;
        this.isTransitioning = false;
        this.headerManager = null;
        this.projectsManager = null; // Add projects manager

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

        this.init();
    }

    // ... existing PageManager methods ...

    /**
     * Enhanced projects page initialization
     */
    async initProjectsPage() {
        console.log('Initializing enhanced projects page');
        
        // Cleanup previous projects manager if exists
        if (this.projectsManager) {
            this.projectsManager.destroy();
        }
        
        // Initialize new projects manager
        this.projectsManager = new ProjectsPageManager();
        
        // Wait for initialization to complete
        await new Promise(resolve => {
            const checkInit = () => {
                if (this.projectsManager.isInitialized) {
                    resolve();
                } else {
                    setTimeout(checkInit, 50);
                }
            };
            checkInit();
        });
        
        console.log('Enhanced projects page initialized successfully');
    }

    // ... rest of existing PageManager methods ...
}

// CSS for the HTML game version
const gameStyles = `
    .barista-game-container {
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        overflow-y: auto;
    }
    
    .game-screen {
        display: none;
        padding: 2rem;
        height: 100%;
        flex-direction: column;
        justify-content: center;
    }
    
    .game-screen.active {
        display: flex;
    }
    
    .game-header {
        text-align: center;
        margin-bottom: 2rem;
    }
    
    .game-header h1 {
        font-size: 1.8rem;
        margin-bottom: 0.5rem;
    }
    
    .game-form {
        background: rgba(255, 255, 255, 0.1);
        padding: 2rem;
        border-radius: 1rem;
        text-align: center;
        margin-bottom: 2rem;
    }
    
    .barista-avatar {
        font-size: 4rem;
        margin-bottom: 1rem;
    }
    
    .name-input {
        width: 100%;
        padding: 0.75rem;
        border: none;
        border-radius: 2rem;
        text-align: center;
        margin: 1rem 0;
        font-size: 1rem;
    }
    
    .start-btn {
        width: 100%;
        padding: 0.75rem;
        background: #10b981;
        color: white;
        border: none;
        border-radius: 2rem;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.3s;
    }
    
    .start-btn:hover:not(:disabled) {
        background: #059669;
    }
    
    .start-btn:disabled {
        background: #6b7280;
        cursor: not-allowed;
    }
    
    .game-info {
        text-align: center;
        font-size: 0.9rem;
        opacity: 0.8;
    }
    
    .player-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }
    
    .player-stats {
        display: flex;
        flex-direction: column;
    }
    
    .stats {
        display: flex;
        gap: 1rem;
        font-size: 0.9rem;
        opacity: 0.9;
    }
    
    .badges-btn {
        background: #f59e0b;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 2rem;
        cursor: pointer;
        font-weight: 600;
    }
    
    .barista-tip {
        background: rgba(255, 255, 255, 0.1);
        padding: 1rem;
        border-radius: 1rem;
        margin-bottom: 2rem;
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    
    .barista-character {
        font-size: 3rem;
    }
    
    .tip-content h3 {
        margin-bottom: 0.5rem;
        font-size: 1.1rem;
    }
    
    .tip-content p {
        margin: 0;
        font-size: 0.9rem;
        opacity: 0.9;
    }
    
    .game-options {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
        margin-bottom: 2rem;
    }
    
    .option-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        padding: 1rem;
        border-radius: 1rem;
        color: white;
        cursor: pointer;
        transition: all 0.3s;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
    }
    
    .option-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: translateY(-2px);
    }
    
    .option-btn .icon {
        font-size: 2rem;
        margin-bottom: 0.5rem;
    }
    
    .option-btn .title {
        font-weight: 600;
        margin-bottom: 0.25rem;
    }
    
    .option-btn .subtitle {
        font-size: 0.8rem;
        opacity: 0.8;
    }
    
    .progress-info {
        text-align: center;
        font-size: 0.9rem;
        opacity: 0.8;
    }
    
    .game-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        text-align: center;
    }
    
    .loading-spinner {
        width: 3rem;
        height: 3rem;
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-top: 3px solid #fff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;

// Inject game styles
const styleElement = document.createElement('style');
styleElement.textContent = gameStyles;
document.head.appendChild(styleElement);

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // PageManager will be initialized by the main app
    });
} else {
    // DOM already loaded
    console.log('Projects page JavaScript loaded');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProjectsPageManager, PageManager };
} else {
    window.ProjectsPageManager = ProjectsPageManager;
}