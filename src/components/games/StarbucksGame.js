/**
 * StarbucksGame.js - Barista trainer
 * Enhanced version with proper error handling and memory management
 * Optimized for GitHub Pages deployment and artifact compatibility
 */

class StarbucksGame {
    constructor(container) {
        this.container = container;
        this.gameState = {
            screen: 'welcome',
            playerName: '',
            playerLevel: 1,
            stars: 0,
            streak: 0,
            maxStreak: 0,
            badges: [],
            isInitialized: false
        };

        this.challengeState = {
            activeCategory: 'all',
            currentChallenge: null,
            answer: {},
            showResult: false,
            isCorrect: false,
            animation: ''
        };

        this.uiState = {
            showTip: false,
            selectedDrink: null,
            completedDrinks: {},
            isAnimating: false
        };

        // Game configuration
        this.config = {
            animationDuration: 300,
            autoAdvanceDelay: 3000,
            soundEnabled: true,
            useInMemoryStorage: true // Changed from localStorage for artifact compatibility
        };

        // In-memory storage instead of localStorage
        this.memoryStorage = {
            gameState: null,
            uiState: null
        };

        // Event handler references for proper cleanup
        this._boundHandlers = {
            click: null,
            input: null,
            keydown: null,
            globalKeydown: null
        };

        // Animation frame and timeout tracking for cleanup
        this._animationFrames = new Set();
        this._timeouts = new Set();
        this._intervals = new Set();

        // Initialize the game
        this.init();
    }

    /**
     * Initialize the game with enhanced error handling
     */
    async init() {
        try {
            console.log('🎮 Initializing Starbucks Barista Game');
            
            // Load saved progress from memory
            this.loadProgress();
            
            // Setup event handlers with proper binding
            this.setupEventHandlers();
            
            // Render initial screen
            this.render();
            
            // Mark as initialized
            this.gameState.isInitialized = true;
            
            console.log('✅ Starbucks Game initialized successfully');
            
        } catch (error) {
            console.error('❌ Game initialization failed:', error);
            this.showErrorScreen(error);
        }
    }

    /**
     * Setup event handlers with proper cleanup tracking
     */
    setupEventHandlers() {
        // Create bound handlers for proper cleanup
        this._boundHandlers.click = this.handleClick.bind(this);
        this._boundHandlers.input = this.handleInput.bind(this);
        this._boundHandlers.keydown = this.handleKeydown.bind(this);
        this._boundHandlers.globalKeydown = this.handleGlobalKeydown.bind(this);
        
        // Use event delegation for better performance
        this.container.addEventListener('click', this._boundHandlers.click);
        this.container.addEventListener('input', this._boundHandlers.input);
        this.container.addEventListener('keydown', this._boundHandlers.keydown);
        
        // Setup keyboard shortcuts
        document.addEventListener('keydown', this._boundHandlers.globalKeydown);
    }

    /**
     * Remove all event handlers for cleanup
     */
    removeEventHandlers() {
        if (this.container && this._boundHandlers.click) {
            this.container.removeEventListener('click', this._boundHandlers.click);
            this.container.removeEventListener('input', this._boundHandlers.input);
            this.container.removeEventListener('keydown', this._boundHandlers.keydown);
        }
        
        if (this._boundHandlers.globalKeydown) {
            document.removeEventListener('keydown', this._boundHandlers.globalKeydown);
        }
    }

    /**
     * Handle click events
     */
    handleClick(event) {
        const target = event.target;
        const action = target.getAttribute('data-action');
        
        if (!action) return;
        
        event.preventDefault();
        
        // Prevent actions during animations
        if (this.uiState.isAnimating) return;
        
        switch (action) {
            case 'start-game':
                this.startGame();
                break;
            case 'go-to-screen':
                this.goToScreen(target.getAttribute('data-screen'));
                break;
            case 'select-category':
                this.selectCategory(target.getAttribute('data-category'));
                break;
            case 'start-challenge':
                this.startChallenge(target.getAttribute('data-category'));
                break;
            case 'check-answer':
                this.checkAnswer();
                break;
            case 'next-challenge':
                this.generateChallenge();
                break;
            case 'select-drink':
                this.selectDrink(target.getAttribute('data-drink'));
                break;
            case 'practice-drink':
                this.practiceDrink();
                break;
            case 'toggle-tip':
                this.toggleTip();
                break;
            case 'reset-game':
                this.resetGame();
                break;
            case 'save-progress':
                this.saveProgress();
                break;
        }
    }

    /**
     * Handle input events
     */
    handleInput(event) {
        const target = event.target;
        const field = target.getAttribute('data-field');
        
        if (field && target.getAttribute('data-answer') !== null) {
            this.updateAnswer(field, target.value);
        }
        
        if (target.id === 'player-name') {
            this.gameState.playerName = target.value;
        }
    }

    /**
     * Handle keydown events
     */
    handleKeydown(event) {
        // Handle Enter key on buttons
        if (event.key === 'Enter' && event.target.tagName === 'BUTTON') {
            event.target.click();
        }
    }

    /**
     * Handle global keyboard shortcuts
     */
    handleGlobalKeydown(event) {
        // Only handle shortcuts when game is active
        if (!this.container.contains(document.activeElement)) return;
        
        if (event.key === 'Escape') {
            this.goToScreen('main');
        }
    }

    /**
     * Main render function
     */
    render() {
        if (!this.container) return;
        
        const screen = this.gameState.screen;
        let content = '';
        
        switch (screen) {
            case 'welcome':
                content = this.renderWelcomeScreen();
                break;
            case 'main':
                content = this.renderMainScreen();
                break;
            case 'categories':
                content = this.renderCategoriesScreen();
                break;
            case 'challenge':
                content = this.renderChallengeScreen();
                break;
            case 'recipes':
                content = this.renderRecipesScreen();
                break;
            case 'badges':
                content = this.renderBadgesScreen();
                break;
            default:
                content = this.renderErrorScreen();
        }
        
        // Update container with smooth transition
        this.updateContainerContent(content);
    }

    /**
     * Update container content with optimized animation
     */
    async updateContainerContent(content) {
        if (this.uiState.isAnimating) return;
        
        this.uiState.isAnimating = true;
        
        // Cancel any existing animations
        this.cancelAnimations();
        
        // Use requestAnimationFrame for better performance
        const animFrame = requestAnimationFrame(() => {
            // Fade out
            this.container.style.opacity = '0';
            this.container.style.transform = 'translateY(10px)';
            
            const timeout = setTimeout(() => {
                // Update content
                this.container.innerHTML = content;
                
                // Force reflow
                void this.container.offsetHeight;
                
                // Fade in
                this.container.style.opacity = '1';
                this.container.style.transform = 'translateY(0)';
                
                const innerTimeout = setTimeout(() => {
                    this.uiState.isAnimating = false;
                    this.manageFocus();
                    this._timeouts.delete(innerTimeout);
                }, this.config.animationDuration);
                
                this._timeouts.add(innerTimeout);
                this._timeouts.delete(timeout);
            }, this.config.animationDuration);
            
            this._timeouts.add(timeout);
            this._animationFrames.delete(animFrame);
        });
        
        this._animationFrames.add(animFrame);
    }

    /**
     * Cancel all animations and timeouts
     */
    cancelAnimations() {
        // Cancel animation frames
        this._animationFrames.forEach(id => cancelAnimationFrame(id));
        this._animationFrames.clear();
        
        // Clear timeouts
        this._timeouts.forEach(id => clearTimeout(id));
        this._timeouts.clear();
        
        // Clear intervals
        this._intervals.forEach(id => clearInterval(id));
        this._intervals.clear();
    }

    /**
     * Manage focus for accessibility
     */
    manageFocus() {
        const firstInput = this.container.querySelector('input');
        const firstButton = this.container.querySelector('button:not([disabled])');
        const focusTarget = firstInput || firstButton;
        
        if (focusTarget) {
            const timeout = setTimeout(() => {
                focusTarget.focus();
                this._timeouts.delete(timeout);
            }, 100);
            this._timeouts.add(timeout);
        }
    }

    /**
     * Game data - Recipes, badges, tips, etc.
     */
    getGameData() {
        return {
            // Recipe database with detailed information
            recipes: {
                hotDrinks: {
                    "Caffè Latte": {
                        icon: "☕",
                        color: "#E6C19C",
                        shots: { S: 1, T: 1, G: 2, V: 2 },
                        syrup: { S: 2, T: 3, G: 4, V: 5 },
                        funFact: "A latte is like a warm milk hug with coffee!",
                        description: "Espresso topped with steamed milk and a light layer of foam",
                        difficulty: "beginner"
                    },
                    "Cappuccino": {
                        icon: "☁️",
                        color: "#D8C4B6",
                        shots: { S: 1, T: 1, G: 2, V: 2 },
                        syrup: { S: 2, T: 3, G: 4, V: 5 },
                        funFact: "The foam on top is like a fluffy cloud for your coffee!",
                        description: "Espresso with steamed milk and lots of foam",
                        difficulty: "intermediate"
                    },
                    "Flat White": {
                        icon: "🥛",
                        color: "#F5F0DC",
                        shots: { S: 2, T: 2, G: 3, V: 3 },
                        syrup: { S: 2, T: 3, G: 4, V: 5 },
                        funFact: "This drink uses special ristretto shots that are extra strong!",
                        description: "Ristretto espresso with steamed whole milk and a thin layer of microfoam",
                        difficulty: "advanced"
                    },
                    "Caffè Americano": {
                        icon: "💧",
                        color: "#8B5A2B",
                        shots: { S: 1, T: 2, G: 3, V: 4 },
                        syrup: { S: 2, T: 3, G: 4, V: 5 },
                        funFact: "It's like a coffee swimming pool for espresso shots!",
                        description: "Espresso shots topped with hot water",
                        difficulty: "beginner"
                    }
                },
                icedDrinks: {
                    "Iced Caffè Latte": {
                        icon: "🧊",
                        color: "#BEB9B5",
                        shots: { T: 1, G: 2, V: 3 },
                        syrup: { T: 3, G: 4, V: 6 },
                        funFact: "The perfect coffee treat on a hot summer day!",
                        description: "Espresso, cold milk and ice cubes",
                        difficulty: "beginner"
                    },
                    "Iced Flat White": {
                        icon: "❄️",
                        color: "#E8E8E6",
                        shots: { T: 2, G: 3, V: 4 },
                        syrup: { T: 3, G: 4, V: 6 },
                        funFact: "The special ristretto shots give it an extra kick!",
                        description: "Ristretto espresso shots with cold whole milk over ice",
                        difficulty: "advanced"
                    },
                    "Iced Caffè Americano": {
                        icon: "🧊",
                        color: "#6F4E37",
                        shots: { T: 2, G: 3, V: 4 },
                        syrup: { T: 3, G: 4, V: 6 },
                        funFact: "Some people call it 'coffee on the rocks'!",
                        description: "Espresso shots topped with water and ice",
                        difficulty: "intermediate"
                    }
                },
                frappuccinos: {
                    "Coffee Frappuccino": {
                        icon: "🥤",
                        color: "#C4A484",
                        roast: { T: 2, G: 3, V: 4 },
                        frappBase: { T: 2, G: 3, V: 4 },
                        funFact: "It's like a coffee milkshake - but way cooler!",
                        description: "Coffee blended with milk, ice, and frappuccino base",
                        difficulty: "intermediate"
                    },
                    "Caramel Frappuccino": {
                        icon: "🍮",
                        color: "#C68E17",
                        roast: { T: 2, G: 3, V: 4 },
                        caramelSyrup: { T: 2, G: 3, V: 4 },
                        frappBase: { T: 2, G: 3, V: 4 },
                        funFact: "This drink wears a caramel crown on top!",
                        description: "Coffee with caramel syrup blended with milk, ice, topped with whipped cream and caramel drizzle",
                        difficulty: "advanced"
                    },
                    "Mocha Frappuccino": {
                        icon: "🍫",
                        color: "#6B4423",
                        roast: { T: 2, G: 3, V: 4 },
                        mochaSauce: { T: 2, G: 3, V: 4 },
                        frappBase: { T: 2, G: 3, V: 4 },
                        funFact: "It's like chocolate and coffee had a frozen party!",
                        description: "Coffee with mocha sauce blended with milk and ice, topped with whipped cream",
                        difficulty: "advanced"
                    }
                },
                refreshers: {
                    "Mango Dragonfruit": {
                        icon: "🐉",
                        color: "#FF77FF",
                        inclusion: { T: 1, G: 1, V: 1, TR: 2 },
                        funFact: "The pink color comes from real dragonfruit pieces!",
                        description: "Tropical-inspired with sweet mango and dragonfruit flavors, with real fruit pieces",
                        difficulty: "beginner"
                    },
                    "Strawberry Açaí": {
                        icon: "🍓",
                        color: "#FF2E2E",
                        inclusion: { T: 1, G: 1, V: 1, TR: 2 },
                        funFact: "This refreshing drink has real strawberry pieces inside!",
                        description: "Sweet strawberry flavors with real strawberry pieces",
                        difficulty: "beginner"
                    }
                }
            },

            // Badge system
            badgeTypes: [
                { id: "first_star", name: "First Star", icon: "⭐", description: "Earned your first star!", requirement: "stars >= 1" },
                { id: "hot_expert", name: "Hot Drink Expert", icon: "☕", description: "Mastered hot drink recipes", requirement: "category_complete_hotDrinks" },
                { id: "ice_master", name: "Ice Master", icon: "🧊", description: "Conquered all iced drink recipes", requirement: "category_complete_icedDrinks" },
                { id: "frapp_wizard", name: "Frappuccino Wizard", icon: "🥤", description: "Perfected all Frappuccino recipes", requirement: "category_complete_frappuccinos" },
                { id: "streak_5", name: "5-Streak", icon: "🔥", description: "5 correct answers in a row!", requirement: "streak >= 5" },
                { id: "streak_10", name: "10-Streak", icon: "🔥🔥", description: "10 correct answers in a row!", requirement: "streak >= 10" },
                { id: "level_5", name: "Level 5 Barista", icon: "🌟", description: "Reached level 5!", requirement: "level >= 5" },
                { id: "level_10", name: "Master Barista", icon: "👑", description: "Reached level 10!", requirement: "level >= 10" },
                { id: "perfectionist", name: "Perfectionist", icon: "💎", description: "100% accuracy on 20 drinks", requirement: "perfect_drinks >= 20" }
            ],

            // Barista tips for different levels
            baristaTips: [
                "Welcome to your barista adventure! Remember to have fun while learning!",
                "Did you know? 'Tall' is actually the smallest size for iced drinks!",
                "Grande means 'large' in Italian, but it's actually the middle size!",
                "Most hot drinks get 1 shot for Tall, 2 shots for Grande and Venti",
                "The syrup pumps increase by 1 for each size up you go",
                "Iced Venti drinks get more syrup (6 pumps) because the cup is bigger",
                "For refreshers, only Trenta size gets 2 scoops of fruit inclusions",
                "Frappuccinos always get whipped cream unless requested without",
                "Remember to shake refreshers 10 times for the perfect mix!",
                "You're becoming a star barista! Keep practicing those recipes!",
                "Pro tip: Ristretto shots are pulled shorter for a sweeter taste",
                "The grind size affects extraction time - finer for espresso!",
                "Steam milk to 150-160°F for the perfect temperature",
                "Latte art starts with properly textured microfoam",
                "You're now a certified coffee master! Time to teach others!"
            ],

            // Size information
            sizeInfo: {
                S: { name: "Short", oz: "8oz", description: "Tiny but mighty!" },
                T: { name: "Tall", oz: "12oz", description: "Not so tall after all!" },
                G: { name: "Grande", oz: "16oz", description: "Italian for 'big'" },
                V: { name: "Venti", oz: "20/24oz", description: "Italian for '20'" },
                TR: { name: "Trenta", oz: "30oz", description: "The giant cup!" }
            },

            // Category information
            categoryInfo: {
                hotDrinks: { name: 'Hot Espresso Drinks', icon: '☕', color: 'red', description: 'Lattes, Cappuccinos & more' },
                icedDrinks: { name: 'Iced Espresso Drinks', icon: '🧊', color: 'blue', description: 'Cool & refreshing coffee' },
                frappuccinos: { name: 'Frappuccinos', icon: '🥤', color: 'purple', description: 'Blended frozen treats' },
                refreshers: { name: 'Refreshers', icon: '🍓', color: 'pink', description: 'Fruity & refreshing' }
            }
        };
    }

    /**
     * Render welcome screen
     */
    renderWelcomeScreen() {
        return `
            <div class="game-screen welcome-screen">
                <div class="game-content">
                    <div class="welcome-header">
                        <h1 class="game-title">☕ Starbucks Barista Adventure ☕</h1>
                        <p class="game-subtitle">Become a master barista through fun challenges!</p>
                    </div>
                    
                    <div class="welcome-form">
                        <div class="barista-avatar">
                            <span class="avatar-icon">👨‍🍳</span>
                            <h2>Welcome, Future Barista!</h2>
                            <p>What's your barista name?</p>
                        </div>
                        
                        <div class="form-group">
                            <input
                                type="text"
                                id="player-name"
                                value="${this.escapeHtml(this.gameState.playerName)}"
                                placeholder="Enter your name"
                                class="name-input"
                                maxlength="20"
                                autocomplete="off"
                            />
                        </div>
                        
                        <button
                            data-action="start-game"
                            class="start-button ${this.gameState.playerName.trim() ? 'enabled' : 'disabled'}"
                            ${!this.gameState.playerName.trim() ? 'disabled' : ''}
                        >
                            Start My Adventure!
                        </button>
                    </div>
                    
                    <div class="welcome-features">
                        <div class="feature">
                            <span class="feature-icon">📚</span>
                            <span>Learn Recipes</span>
                        </div>
                        <div class="feature">
                            <span class="feature-icon">⭐</span>
                            <span>Earn Stars</span>
                        </div>
                        <div class="feature">
                            <span class="feature-icon">🏆</span>
                            <span>Collect Badges</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render main screen (hub)
     */
    renderMainScreen() {
        const data = this.getGameData();
        const currentTip = data.baristaTips[Math.min(this.gameState.playerLevel - 1, data.baristaTips.length - 1)];
        const baristaEmoji = this.getBaristaEmoji();
        
        return `
            <div class="game-screen main-screen">
                <div class="game-content">
                    <div class="main-header">
                        <div class="player-info">
                            <h1>Barista ${this.escapeHtml(this.gameState.playerName)}</h1>
                            <div class="player-stats">
                                <span class="level">Level ${this.gameState.playerLevel}</span>
                                <span class="stars">${this.gameState.stars} ⭐</span>
                                ${this.gameState.streak > 0 ? `<span class="streak">${this.gameState.streak} 🔥</span>` : ''}
                            </div>
                        </div>
                        
                        <div class="header-actions">
                            <button data-action="go-to-screen" data-screen="badges" class="badge-button">
                                🏆 ${this.gameState.badges.length}
                            </button>
                        </div>
                    </div>
                    
                    <div class="tip-section">
                        <div class="barista-tip">
                            <div class="barista-character">
                                <span class="barista-emoji">${baristaEmoji}</span>
                            </div>
                            <div class="tip-content">
                                <h3>Barista Tip:</h3>
                                <p>${currentTip}</p>
                            </div>
                        </div>
                        
                        ${this.gameState.streak >= 3 ? `
                            <div class="streak-indicator">
                                <div class="streak-content">
                                    <div class="streak-label">Streak</div>
                                    <div class="streak-number">${this.gameState.streak} 🔥</div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="main-actions">
                        <button data-action="start-challenge" data-category="all" class="action-button primary">
                            <span class="button-icon">🎯</span>
                            <span class="button-text">Random Challenge</span>
                            <span class="button-subtitle">Test your skills!</span>
                        </button>
                        
                        <button data-action="go-to-screen" data-screen="categories" class="action-button">
                            <span class="button-icon">📚</span>
                            <span class="button-text">Recipe Types</span>
                            <span class="button-subtitle">Choose a category</span>
                        </button>
                        
                        <button data-action="go-to-screen" data-screen="recipes" class="action-button">
                            <span class="button-icon">📖</span>
                            <span class="button-text">Recipe Book</span>
                            <span class="button-subtitle">Study the recipes</span>
                        </button>
                        
                        <button data-action="toggle-tip" class="action-button">
                            <span class="button-icon">💡</span>
                            <span class="button-text">Barista Tips</span>
                            <span class="button-subtitle">Helpful advice</span>
                        </button>
                    </div>
                    
                    ${this.uiState.showTip ? this.renderRandomTip() : ''}
                    
                    <div class="progress-info">
                        <p class="progress-text">
                            ${this.gameState.streak > 0 
                                ? `Current streak: ${this.gameState.streak} 🔥` 
                                : "Start a streak by getting answers right in a row!"
                            }
                        </p>
                        <p class="level-progress">
                            ${this.gameState.playerLevel < 15 
                                ? `${this.gameState.playerLevel * 5 - this.gameState.stars} more stars to level up!` 
                                : "You've reached max level! You're a true master barista!"
                            }
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render categories screen
     */
    renderCategoriesScreen() {
        const data = this.getGameData();
        const categories = Object.entries(data.categoryInfo);
        
        return `
            <div class="game-screen categories-screen">
                <div class="game-content">
                    <div class="screen-header">
                        <h2>Choose a Recipe Type</h2>
                        <div class="player-stats">
                            Level ${this.gameState.playerLevel} • ${this.gameState.stars} ⭐
                        </div>
                    </div>
                    
                    <div class="categories-grid">
                        ${categories.map(([id, info]) => `
                            <button data-action="start-challenge" data-category="${id}" class="category-card ${info.color}">
                                <span class="category-icon">${info.icon}</span>
                                <div class="category-info">
                                    <h3>${info.name}</h3>
                                    <p>${info.description}</p>
                                </div>
                                <div class="category-progress">
                                    ${this.getCategoryProgress(id)}
                                </div>
                            </button>
                        `).join('')}
                    </div>
                    
                    <div class="screen-actions">
                        <button data-action="go-to-screen" data-screen="main" class="back-button">
                            ← Back to Menu
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render challenge screen
     */
    renderChallengeScreen() {
        if (!this.challengeState.currentChallenge) {
            return this.renderErrorScreen('No challenge available');
        }
        
        const data = this.getGameData();
        const challenge = this.challengeState.currentChallenge;
        const drinkData = data.recipes[challenge.category][challenge.drink];
        const sizeInfo = data.sizeInfo[challenge.size];
        
        return `
            <div class="game-screen challenge-screen">
                <div class="game-content">
                    <div class="challenge-header">
                        <h2>Barista Challenge</h2>
                        <div class="challenge-stats">
                            <span class="streak">${this.gameState.streak} 🔥</span>
                            <span class="stars">${this.gameState.stars} ⭐</span>
                        </div>
                    </div>
                    
                    <div class="challenge-card ${this.challengeState.animation}">
                        <div class="drink-header">
                            <span class="drink-icon">${drinkData.icon}</span>
                            <div class="drink-info">
                                <h3>${challenge.drink}</h3>
                                <p class="size-info">${sizeInfo.name} (${sizeInfo.oz})</p>
                            </div>
                        </div>
                        
                        <div class="drink-description">
                            <p>${drinkData.description}</p>
                            ${!this.challengeState.showResult ? '<p class="challenge-prompt">What goes in this drink?</p>' : ''}
                        </div>
                        
                        <div class="recipe-inputs">
                            ${this.renderRecipeInputs(challenge.category, drinkData, challenge.size)}
                        </div>
                    </div>
                    
                    ${this.challengeState.showResult 
                        ? this.renderChallengeResult(drinkData, challenge)
                        : this.renderChallengeActions()
                    }
                    
                    <div class="challenge-navigation">
                        <button data-action="go-to-screen" data-screen="main" class="nav-button">
                            Main Menu
                        </button>
                        <button data-action="next-challenge" class="nav-button">
                            ${this.challengeState.showResult ? 'Next Challenge' : 'Skip'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render recipe inputs based on category
     */
    renderRecipeInputs(category, drinkData, size) {
        let inputs = '';
        
        if (category === 'hotDrinks' || category === 'icedDrinks') {
            if (drinkData.shots) {
                inputs += this.createInput('shots', 'Espresso Shots', '☕', 4);
            }
            if (drinkData.syrup) {
                inputs += this.createInput('syrup', 'Syrup Pumps', '🍯', 7);
            }
        } else if (category === 'frappuccinos') {
            if (drinkData.roast) {
                inputs += this.createInput('roast', 'Frapp Roast', '☕', 4);
            }
            if (drinkData.frappBase) {
                inputs += this.createInput('frappBase', 'Frapp Base', '🧪', 4);
            }
            if (drinkData.mochaSauce) {
                inputs += this.createInput('mochaSauce', 'Mocha Sauce', '🍫', 4);
            }
            if (drinkData.caramelSyrup) {
                inputs += this.createInput('caramelSyrup', 'Caramel Syrup', '🍮', 4);
            }
        } else if (category === 'refreshers') {
            if (drinkData.inclusion) {
                inputs += this.createInput('inclusion', 'Fruit Inclusion Scoops', '🍓', 2);
            }
        }
        
        return `<div class="inputs-grid">${inputs}</div>`;
    }

    /**
     * Create input field
     */
    createInput(field, label, icon, max) {
        const value = this.challengeState.answer[field] || '';
        const disabled = this.challengeState.showResult ? 'disabled' : '';
        
        return `
            <div class="input-group">
                <label class="input-label">
                    <span class="label-icon">${icon}</span>
                    ${label}:
                </label>
                <input
                    type="number"
                    min="1"
                    max="${max}"
                    value="${value}"
                    data-field="${field}"
                    data-answer="true"
                    class="recipe-input"
                    ${disabled}
                />
            </div>
        `;
    }

    /**
     * Render challenge result
     */
    renderChallengeResult(drinkData, challenge) {
        const isCorrect = this.challengeState.isCorrect;
        
        return `
            <div class="challenge-result ${isCorrect ? 'correct' : 'incorrect'}">
                <div class="result-header">
                    <span class="result-icon">${isCorrect ? '🎉' : '😢'}</span>
                    <div class="result-text">
                        <h3>${isCorrect ? 'Perfect Drink!' : 'Not Quite Right'}</h3>
                        <p>${isCorrect ? 'You nailed the recipe!' : 'Let\'s check the recipe...'}</p>
                    </div>
                </div>
                
                ${!isCorrect ? this.renderCorrectRecipe(drinkData, challenge) : ''}
                
                ${isCorrect ? `
                    <div class="fun-fact">
                        <p><strong>Fun Fact:</strong> ${drinkData.funFact}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render correct recipe
     */
    renderCorrectRecipe(drinkData, challenge) {
        const fields = ['shots', 'syrup', 'roast', 'frappBase', 'mochaSauce', 'caramelSyrup', 'inclusion'];
        const fieldLabels = {
            shots: 'Espresso Shots',
            syrup: 'Syrup Pumps',
            roast: 'Frapp Roast',
            frappBase: 'Frapp Base',
            mochaSauce: 'Mocha Sauce',
            caramelSyrup: 'Caramel Syrup',
            inclusion: 'Fruit Inclusion'
        };
        
        const correctValues = fields
            .filter(field => drinkData[field] && drinkData[field][challenge.size] !== undefined)
            .map(field => `<li>${fieldLabels[field]}: ${drinkData[field][challenge.size]}</li>`)
            .join('');
        
        return `
            <div class="correct-recipe">
                <h4>Correct Recipe:</h4>
                <ul>${correctValues}</ul>
            </div>
        `;
    }

    /**
     * Render challenge actions
     */
    renderChallengeActions() {
        return `
            <div class="challenge-actions">
                <button data-action="check-answer" class="check-button">
                    Make the Drink!
                </button>
            </div>
        `;
    }

    /**
     * Render badges screen
     */
    renderBadgesScreen() {
        const data = this.getGameData();
        
        return `
            <div class="game-screen badges-screen">
                <div class="game-content">
                    <div class="screen-header">
                        <h2>Your Badges</h2>
                        <div class="player-stats">
                            Level ${this.gameState.playerLevel} • ${this.gameState.stars} ⭐
                        </div>
                    </div>
                    
                    <div class="badges-summary">
                        <p>Collect badges by completing challenges and mastering recipes!</p>
                        <p class="badge-count">
                            <strong>${this.gameState.badges.length} / ${data.badgeTypes.length} Badges Earned</strong>
                        </p>
                    </div>
                    
                    <div class="badges-grid">
                        ${data.badgeTypes.map(badge => {
                            const earned = this.gameState.badges.includes(badge.id);
                            return `
                                <div class="badge-card ${earned ? 'earned' : 'locked'}">
                                    <div class="badge-icon">${badge.icon}</div>
                                    <div class="badge-info">
                                        <h3>${badge.name}</h3>
                                        <p>${badge.description}</p>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    
                    <div class="screen-actions">
                        <button data-action="go-to-screen" data-screen="main" class="back-button">
                            ← Back to Menu
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render recipes screen
     */
    renderRecipesScreen() {
        if (this.challengeState.activeCategory === 'all' || !this.challengeState.activeCategory) {
            return this.renderRecipeCategoriesScreen();
        } else if (!this.uiState.selectedDrink) {
            return this.renderRecipeDrinksScreen();
        } else {
            return this.renderRecipeDetailScreen();
        }
    }

    /**
     * Render recipe categories screen
     */
    renderRecipeCategoriesScreen() {
        const data = this.getGameData();
        const categories = Object.entries(data.categoryInfo);
        
        return `
            <div class="game-screen recipes-screen">
                <div class="game-content">
                    <div class="screen-header">
                        <h2>Recipe Book</h2>
                        <div class="player-stats">
                            Level ${this.gameState.playerLevel} • ${this.gameState.stars} ⭐
                        </div>
                    </div>
                    
                    <div class="recipe-intro">
                        <p>Select a drink type to study the recipes</p>
                    </div>
                    
                    <div class="recipe-categories">
                        ${categories.map(([id, info]) => `
                            <button data-action="select-category" data-category="${id}" class="recipe-category-card ${info.color}">
                                <span class="category-icon">${info.icon}</span>
                                <span class="category-name">${info.name}</span>
                            </button>
                        `).join('')}
                    </div>
                    
                    <div class="screen-actions">
                        <button data-action="go-to-screen" data-screen="main" class="back-button">
                            ← Back to Menu
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render drinks in selected category
     */
    renderRecipeDrinksScreen() {
        const data = this.getGameData();
        const category = this.challengeState.activeCategory;
        const categoryInfo = data.categoryInfo[category];
        const drinks = data.recipes[category];
        
        return `
            <div class="game-screen recipes-screen">
                <div class="game-content">
                    <div class="screen-header">
                        <h2>${categoryInfo.name} Recipes</h2>
                        <div class="player-stats">
                            Level ${this.gameState.playerLevel} • ${this.gameState.stars} ⭐
                        </div>
                    </div>
                    
                    <div class="drinks-grid">
                        ${Object.entries(drinks).map(([name, drink]) => {
                            const drinkKey = `${category}-${name}`;
                            const completed = this.uiState.completedDrinks[drinkKey] > 0;
                            
                            return `
                                <button data-action="select-drink" data-drink="${name}" 
                                    class="drink-card ${completed ? 'completed' : ''}">
                                    <span class="drink-icon">${drink.icon}</span>
                                    <h3>${name}</h3>
                                    <p>${drink.description}</p>
                                    ${completed ? '<span class="completed-badge">✓</span>' : ''}
                                </button>
                            `;
                        }).join('')}
                    </div>
                    
                    <div class="screen-actions">
                        <button data-action="select-category" data-category="all" class="back-button">
                            ← Back to Categories
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render recipe detail screen
     */
    renderRecipeDetailScreen() {
        const data = this.getGameData();
        const category = this.challengeState.activeCategory;
        const drinkName = this.uiState.selectedDrink;
        const drink = data.recipes[category][drinkName];
        
        if (!drink) {
            return this.renderErrorScreen('Recipe not found');
        }
        
        return `
            <div class="game-screen recipe-detail-screen">
                <div class="game-content">
                    <div class="screen-header">
                        <h2>${drinkName} Recipe</h2>
                    </div>
                    
                    <div class="recipe-detail-card">
                        <div class="recipe-header">
                            <span class="drink-icon-large">${drink.icon}</span>
                            <p class="drink-description">${drink.description}</p>
                        </div>
                        
                        <div class="recipe-sizes">
                            <h3>Recipe by Size:</h3>
                            ${this.renderRecipeTable(drink, category)}
                        </div>
                        
                        <div class="fun-fact-section">
                            <h3>Fun Fact!</h3>
                            <p>${drink.funFact}</p>
                        </div>
                    </div>
                    
                    <div class="screen-actions">
                        <button data-action="practice-drink" class="practice-button">
                            Practice This Drink
                        </button>
                        <button data-action="select-drink" data-drink="" class="back-button">
                            ← Back to Drinks
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render recipe table helper
     */
    renderRecipeTable(drink, category) {
        const sizes = this.getAvailableSizes(category);
        const data = this.getGameData();
        
        let table = '<table class="recipe-table"><thead><tr><th>Size</th>';
        
        // Add headers based on drink properties
        const fields = [];
        if (drink.shots) fields.push({ key: 'shots', label: 'Espresso Shots' });
        if (drink.syrup) fields.push({ key: 'syrup', label: 'Syrup Pumps' });
        if (drink.roast) fields.push({ key: 'roast', label: 'Frapp Roast' });
        if (drink.frappBase) fields.push({ key: 'frappBase', label: 'Frapp Base' });
        if (drink.mochaSauce) fields.push({ key: 'mochaSauce', label: 'Mocha Sauce' });
        if (drink.caramelSyrup) fields.push({ key: 'caramelSyrup', label: 'Caramel Syrup' });
        if (drink.inclusion) fields.push({ key: 'inclusion', label: 'Fruit Scoops' });
        
        fields.forEach(field => {
            table += `<th>${field.label}</th>`;
        });
        
        table += '</tr></thead><tbody>';
        
        // Add rows for each size
        sizes.forEach(size => {
            const sizeInfo = data.sizeInfo[size];
            table += `<tr><td>${sizeInfo.name}</td>`;
            
            fields.forEach(field => {
                const value = drink[field.key] && drink[field.key][size];
                table += `<td>${value !== undefined ? value : '-'}</td>`;
            });
            
            table += '</tr>';
        });
        
        table += '</tbody></table>';
        
        return table;
    }

    /**
     * Render error screen
     */
    renderErrorScreen(message = 'An error occurred') {
        return `
            <div class="game-screen error-screen">
                <div class="game-content">
                    <div class="error-content">
                        <span class="error-icon">⚠️</span>
                        <h2>Oops!</h2>
                        <p>${message}</p>
                        <button data-action="go-to-screen" data-screen="main" class="error-button">
                            Back to Menu
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Show error screen with specific error
     */
    showErrorScreen(error) {
        this.gameState.screen = 'error';
        this.render();
        console.error('Game error:', error);
    }

    // ===========================
    // GAME LOGIC METHODS
    // ===========================

    /**
     * Start the game
     */
    startGame() {
        if (!this.gameState.playerName.trim()) {
            this.showToast('Please enter your name first!');
            return;
        }
        
        this.goToScreen('main');
        this.saveProgress();
    }

    /**
     * Go to specific screen
     */
    goToScreen(screen) {
        this.gameState.screen = screen;
        
        // Reset some state when changing screens
        if (screen !== 'challenge') {
            this.challengeState.showResult = false;
            this.challengeState.animation = '';
        }
        
        if (screen !== 'recipes') {
            this.uiState.selectedDrink = null;
            this.challengeState.activeCategory = 'all';
        }
        
        this.render();
    }

    /**
     * Select category
     */
    selectCategory(category) {
        this.challengeState.activeCategory = category;
        this.render();
    }

    /**
     * Start challenge
     */
    startChallenge(category) {
        this.challengeState.activeCategory = category;
        this.generateChallenge();
        this.goToScreen('challenge');
    }

    /**
     * Generate random challenge
     */
    generateChallenge() {
        const data = this.getGameData();
        const recipes = data.recipes;
        
        // Choose category
        let categories = [];
        if (this.challengeState.activeCategory === 'all') {
            categories = Object.keys(recipes);
        } else {
            categories = [this.challengeState.activeCategory];
        }
        
        const randomCat = categories[Math.floor(Math.random() * categories.length)];
        const drinks = Object.keys(recipes[randomCat]);
        const randomDrink = drinks[Math.floor(Math.random() * drinks.length)];
        
        // Get available sizes
        const sizes = this.getAvailableSizes(randomCat);
        const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
        
        this.challengeState.currentChallenge = {
            category: randomCat,
            drink: randomDrink,
            size: randomSize
        };
        
        this.challengeState.answer = {};
        this.challengeState.showResult = false;
        this.challengeState.animation = '';
        
        this.render();
    }

    /**
     * Get available sizes for category
     */
    getAvailableSizes(category) {
        switch (category) {
            case 'hotDrinks': return ['S', 'T', 'G', 'V'];
            case 'refreshers': return ['T', 'G', 'V', 'TR'];
            default: return ['T', 'G', 'V'];
        }
    }

    /**
     * Update answer
     */
    updateAnswer(field, value) {
        this.challengeState.answer[field] = value;
    }

    /**
     * Check answer
     */
    checkAnswer() {
        if (!this.challengeState.currentChallenge) return;
        
        const data = this.getGameData();
        const challenge = this.challengeState.currentChallenge;
        const drinkData = data.recipes[challenge.category][challenge.drink];
        
        let correct = true;
        const fields = ['shots', 'syrup', 'roast', 'frappBase', 'mochaSauce', 'caramelSyrup', 'inclusion'];
        
        for (const field of fields) {
            if (drinkData[field]) {
                const expectedValue = drinkData[field][challenge.size];
                const userValue = parseInt(this.challengeState.answer[field]);
                
                if (expectedValue !== undefined && userValue !== expectedValue) {
                    correct = false;
                    break;
                }
            }
        }
        
        this.challengeState.isCorrect = correct;
        this.challengeState.showResult = true;
        this.challengeState.animation = correct ? 'correct' : 'wrong';
        
        if (correct) {
            this.handleCorrectAnswer(challenge);
        } else {
            this.handleWrongAnswer();
        }
        
        // Play sound effect
        this.playSound(correct ? 'correct' : 'wrong');
        
        this.render();
    }

    /**
     * Handle correct answer
     */
    handleCorrectAnswer(challenge) {
        // Update stars
        this.gameState.stars++;
        
        // Update streak
        this.gameState.streak++;
        if (this.gameState.streak > this.gameState.maxStreak) {
            this.gameState.maxStreak = this.gameState.streak;
        }
        
        // Update level
        const newLevel = Math.floor(this.gameState.stars / 5) + 1;
        if (newLevel > this.gameState.playerLevel) {
            this.gameState.playerLevel = newLevel;
            this.playSound('levelup');
        }
        
        // Update completed drinks
        const drinkKey = `${challenge.category}-${challenge.drink}`;
        this.uiState.completedDrinks[drinkKey] = (this.uiState.completedDrinks[drinkKey] || 0) + 1;
        
        // Check for new badges
        this.checkBadges();
        
        // Save progress
        this.saveProgress();
    }

    /**
     * Handle wrong answer
     */
    handleWrongAnswer() {
        this.gameState.streak = 0;
    }

    /**
     * Check for new badges
     */
    checkBadges() {
        const data = this.getGameData();
        const badges = data.badgeTypes;
        
        badges.forEach(badge => {
            if (!this.gameState.badges.includes(badge.id)) {
                if (this.checkBadgeRequirement(badge.requirement)) {
                    this.gameState.badges.push(badge.id);
                    this.showToast(`New badge earned: ${badge.name}!`);
                    this.playSound('badge');
                }
            }
        });
    }

    /**
     * Check badge requirement
     */
    checkBadgeRequirement(requirement) {
        if (requirement.includes('stars >=')) {
            const requiredStars = parseInt(requirement.split('>=')[1].trim());
            return this.gameState.stars >= requiredStars;
        }
        
        if (requirement.includes('streak >=')) {
            const requiredStreak = parseInt(requirement.split('>=')[1].trim());
            return this.gameState.streak >= requiredStreak;
        }
        
        if (requirement.includes('level >=')) {
            const requiredLevel = parseInt(requirement.split('>=')[1].trim());
            return this.gameState.playerLevel >= requiredLevel;
        }
        
        if (requirement.includes('category_complete_')) {
            const category = requirement.split('category_complete_')[1];
            return this.isCategoryComplete(category);
        }
        
        return false;
    }

    /**
     * Check if category is complete
     */
    isCategoryComplete(category) {
        const data = this.getGameData();
        const categoryDrinks = Object.keys(data.recipes[category] || {});
        
        return categoryDrinks.every(drink => {
            const drinkKey = `${category}-${drink}`;
            return this.uiState.completedDrinks[drinkKey] > 0;
        });
    }

    /**
     * Select drink handler
     */
    selectDrink(drinkName) {
        if (drinkName) {
            this.uiState.selectedDrink = drinkName;
        } else {
            this.uiState.selectedDrink = null;
        }
        this.render();
    }

    /**
     * Practice drink handler
     */
    practiceDrink() {
        if (this.uiState.selectedDrink && this.challengeState.activeCategory) {
            // Generate a specific challenge for this drink
            const sizes = this.getAvailableSizes(this.challengeState.activeCategory);
            const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
            
            this.challengeState.currentChallenge = {
                category: this.challengeState.activeCategory,
                drink: this.uiState.selectedDrink,
                size: randomSize
            };
            
            this.challengeState.answer = {};
            this.challengeState.showResult = false;
            this.challengeState.animation = '';
            
            this.goToScreen('challenge');
        }
    }

    /**
     * Toggle tip display
     */
    toggleTip() {
        this.uiState.showTip = !this.uiState.showTip;
        this.render();
    }

    /**
     * Render random tip
     */
    renderRandomTip() {
        const data = this.getGameData();
        const tips = data.baristaTips;
        const randomTip = tips[Math.floor(Math.random() * tips.length)];
        
        return `
            <div class="random-tip">
                <h3>Quick Tip!</h3>
                <p>${randomTip}</p>
            </div>
        `;
    }

    /**
     * Get barista emoji based on game state
     */
    getBaristaEmoji() {
        if (this.challengeState.isCorrect) return "😄";
        if (this.challengeState.showResult && !this.challengeState.isCorrect) return "😢";
        return "😊";
    }

    /**
     * Get category progress
     */
    getCategoryProgress(category) {
        const data = this.getGameData();
        const categoryDrinks = Object.keys(data.recipes[category] || {});
        const completedCount = categoryDrinks.filter(drink => {
            const drinkKey = `${category}-${drink}`;
            return this.uiState.completedDrinks[drinkKey] > 0;
        }).length;
        
        return `${completedCount}/${categoryDrinks.length} completed`;
    }

    /**
     * Reset game
     */
    resetGame() {
        if (confirm('Are you sure you want to reset your progress?')) {
            this.gameState = {
                screen: 'welcome',
                playerName: '',
                playerLevel: 1,
                stars: 0,
                streak: 0,
                maxStreak: 0,
                badges: [],
                isInitialized: true
            };
            
            this.challengeState = {
                activeCategory: 'all',
                currentChallenge: null,
                answer: {},
                showResult: false,
                isCorrect: false,
                animation: ''
            };
            
            this.uiState = {
                showTip: false,
                selectedDrink: null,
                completedDrinks: {},
                isAnimating: false
            };
            
            this.clearProgress();
            this.render();
        }
    }

    // ===========================
    // UTILITY METHODS
    // ===========================

    /**
     * Save progress to in-memory storage (artifact-compatible)
     */
    saveProgress() {
        if (!this.config.useInMemoryStorage) return;
        
        try {
            this.memoryStorage = {
                gameState: { ...this.gameState },
                uiState: {
                    completedDrinks: { ...this.uiState.completedDrinks }
                },
                timestamp: Date.now()
            };
            
            console.log('💾 Progress saved to memory');
            
            // Emit event for external storage if needed
            this.dispatchGameEvent('progress:saved', this.memoryStorage);
        } catch (error) {
            console.warn('⚠️ Failed to save progress:', error);
        }
    }

    /**
     * Load progress from in-memory storage
     */
    loadProgress() {
        if (!this.config.useInMemoryStorage) return;
        
        try {
            if (this.memoryStorage.gameState) {
                // Restore game state
                this.gameState = { 
                    ...this.gameState, 
                    ...this.memoryStorage.gameState,
                    isInitialized: false // Reset initialization flag
                };
                
                // Restore UI state
                if (this.memoryStorage.uiState) {
                    this.uiState.completedDrinks = {
                        ...this.memoryStorage.uiState.completedDrinks
                    };
                }
                
                console.log('📁 Progress loaded from memory');
            }
        } catch (error) {
            console.warn('⚠️ Failed to load progress:', error);
        }
    }

    /**
     * Clear saved progress
     */
    clearProgress() {
        try {
            this.memoryStorage = {
                gameState: null,
                uiState: null
            };
            console.log('🗑️ Progress cleared');
        } catch (error) {
            console.warn('⚠️ Failed to clear progress:', error);
        }
    }

    /**
     * Dispatch custom game events
     */
    dispatchGameEvent(eventName, detail = {}) {
        const event = new CustomEvent(`starbucksgame:${eventName}`, {
            detail,
            bubbles: true
        });
        this.container.dispatchEvent(event);
    }

    /**
     * Show toast notification (optimized)
     */
    showToast(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);
        
        // Remove any existing toasts
        const existingToasts = this.container.querySelectorAll('.game-toast');
        existingToasts.forEach(toast => toast.remove());
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `game-toast ${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        
        // Add to container
        this.container.appendChild(toast);
        
        // Auto remove after delay
        const timeout = setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(-10px)';
                
                const removeTimeout = setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                    this._timeouts.delete(removeTimeout);
                }, 300);
                
                this._timeouts.add(removeTimeout);
            }
            this._timeouts.delete(timeout);
        }, 3000);
        
        this._timeouts.add(timeout);
    }

    /**
     * Play sound effect with event dispatch
     */
    playSound(type) {
        if (!this.config.soundEnabled) return;
        
        // Placeholder for sound effects
        console.log(`🎵 Playing ${type} sound`);
        
        // Dispatch event for external sound handling
        this.dispatchGameEvent('sound:play', { type });
    }

    /**
     * HTML escape utility for security
     */
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Optimized delay utility using Promise
     */
    delay(ms) {
        return new Promise(resolve => {
            const timeout = setTimeout(() => {
                resolve();
                this._timeouts.delete(timeout);
            }, ms);
            this._timeouts.add(timeout);
        });
    }

    /**
     * Cleanup game resources
     */
    cleanup() {
        console.log('🧹 Cleaning up Starbucks Game');
        
        // Cancel all animations and timeouts
        this.cancelAnimations();
        
        // Remove event listeners
        this.removeEventHandlers();
        
        // Save final progress
        this.saveProgress();
        
        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // Dispatch cleanup event
        this.dispatchGameEvent('cleanup');
    }

    /**
     * Handle resize for responsiveness
     */
    handleResize() {
        // Debounce resize handling
        if (this._resizeTimeout) {
            clearTimeout(this._resizeTimeout);
            this._timeouts.delete(this._resizeTimeout);
        }
        
        this._resizeTimeout = setTimeout(() => {
            console.log('📱 Game handling resize');
            // Add any specific resize logic here
            this._timeouts.delete(this._resizeTimeout);
        }, 250);
        
        this._timeouts.add(this._resizeTimeout);
    }

    /**
     * Get game statistics for external access
     */
    getStats() {
        return {
            playerName: this.gameState.playerName,
            level: this.gameState.playerLevel,
            stars: this.gameState.stars,
            streak: this.gameState.streak,
            maxStreak: this.gameState.maxStreak,
            badges: this.gameState.badges.length,
            completedDrinks: Object.keys(this.uiState.completedDrinks).length,
            isActive: this.gameState.isInitialized
        };
    }

    /**
     * Pause game (for page visibility changes)
     */
    pause() {
        this.cancelAnimations();
        this.saveProgress();
        console.log('⏸️ Game paused');
    }

    /**
     * Resume game
     */
    resume() {
        console.log('▶️ Game resumed');
    }
}

// Export for use with module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StarbucksGame;
} else {
    window.StarbucksGame = StarbucksGame;
}

// Auto-initialize if container is available
document.addEventListener('DOMContentLoaded', () => {
    // This will be called by PageManager when loading the game
    console.log('📚 StarbucksGame class ready for initialization');
});