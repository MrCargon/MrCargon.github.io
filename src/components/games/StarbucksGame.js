/**
 * Interactive Barista
 */

class StarbucksGame {
    constructor(container) {
        if (!container) {
            throw new Error('Game container is required');
        }
        
        this.container = container;
        this.gameId = `starbucks-game-${Date.now()}`;
        
        // Game state
        this.state = {
            screen: 'welcome',
            playerName: '',
            playerLevel: 1,
            stars: 0,
            streak: 0,
            maxStreak: 0,
            badges: [],
            activeCategory: 'all',
            currentChallenge: null,
            answer: {},
            showResult: false,
            isCorrect: false,
            animation: '',
            completedDrinks: {},
            showTip: false,
            selectedDrink: null
        };
        
        // Game configuration
        this.config = {
            animations: true,
            sounds: true,
            difficulty: 'normal'
        };
        
        // Event listeners storage for cleanup
        this.eventListeners = [];
        this.timeouts = [];
        this.intervals = [];
        
        // Recipe database
        this.recipes = {
            hotDrinks: {
                "Caffè Latte": {
                    icon: "☕",
                    color: "#E6C19C",
                    shots: { S: 1, T: 1, G: 2, V: 2 },
                    syrup: { S: 2, T: 3, G: 4, V: 5 },
                    funFact: "A latte is like a warm milk hug with coffee!",
                    description: "Espresso topped with steamed milk and a light layer of foam"
                },
                "Cappuccino": {
                    icon: "☁️",
                    color: "#D8C4B6",
                    shots: { S: 1, T: 1, G: 2, V: 2 },
                    syrup: { S: 2, T: 3, G: 4, V: 5 },
                    funFact: "The foam on top is like a fluffy cloud for your coffee!",
                    description: "Espresso with steamed milk and lots of foam"
                },
                "Flat White": {
                    icon: "🥛",
                    color: "#F5F0DC",
                    shots: { S: 2, T: 2, G: 3, V: 3 },
                    syrup: { S: 2, T: 3, G: 4, V: 5 },
                    funFact: "This drink uses special ristretto shots that are extra strong!",
                    description: "Ristretto espresso with steamed whole milk and a thin layer of microfoam"
                },
                "Caffè Americano": {
                    icon: "💧",
                    color: "#8B5A2B",
                    shots: { S: 1, T: 2, G: 3, V: 4 },
                    syrup: { S: 2, T: 3, G: 4, V: 5 },
                    funFact: "It's like a coffee swimming pool for espresso shots!",
                    description: "Espresso shots topped with hot water"
                }
            },
            icedDrinks: {
                "Iced Caffè Latte": {
                    icon: "🧊",
                    color: "#BEB9B5",
                    shots: { T: 1, G: 2, V: 3 },
                    syrup: { T: 3, G: 4, V: 6 },
                    funFact: "The perfect coffee treat on a hot summer day!",
                    description: "Espresso, cold milk and ice cubes"
                },
                "Iced Flat White": {
                    icon: "❄️",
                    color: "#E8E8E6",
                    shots: { T: 2, G: 3, V: 4 },
                    syrup: { T: 3, G: 4, V: 6 },
                    funFact: "The special ristretto shots give it an extra kick!",
                    description: "Ristretto espresso shots with cold whole milk over ice"
                },
                "Iced Caffè Americano": {
                    icon: "🧊",
                    color: "#6F4E37",
                    shots: { T: 2, G: 3, V: 4 },
                    syrup: { T: 3, G: 4, V: 6 },
                    funFact: "Some people call it 'coffee on the rocks'!",
                    description: "Espresso shots topped with water and ice"
                }
            },
            frappuccinos: {
                "Coffee Frappuccino": {
                    icon: "🥤",
                    color: "#C4A484",
                    roast: { T: 2, G: 3, V: 4 },
                    frappBase: { T: 2, G: 3, V: 4 },
                    funFact: "It's like a coffee milkshake - but way cooler!",
                    description: "Coffee blended with milk, ice, and frappuccino base"
                },
                "Caramel Frappuccino": {
                    icon: "🍮",
                    color: "#C68E17",
                    roast: { T: 2, G: 3, V: 4 },
                    caramelSyrup: { T: 2, G: 3, V: 4 },
                    frappBase: { T: 2, G: 3, V: 4 },
                    funFact: "This drink wears a caramel crown on top!",
                    description: "Coffee with caramel syrup blended with milk, ice, topped with whipped cream and caramel drizzle"
                },
                "Mocha Frappuccino": {
                    icon: "🍫",
                    color: "#6B4423",
                    roast: { T: 2, G: 3, V: 4 },
                    mochaSauce: { T: 2, G: 3, V: 4 },
                    frappBase: { T: 2, G: 3, V: 4 },
                    funFact: "It's like chocolate and coffee had a frozen party!",
                    description: "Coffee with mocha sauce blended with milk and ice, topped with whipped cream"
                }
            },
            refreshers: {
                "Mango Dragonfruit": {
                    icon: "🐉",
                    color: "#FF77FF",
                    inclusion: { T: 1, G: 1, V: 1, TR: 2 },
                    funFact: "The pink color comes from real dragonfruit pieces!",
                    description: "Tropical-inspired with sweet mango and dragonfruit flavors, with real fruit pieces"
                },
                "Strawberry Açaí": {
                    icon: "🍓",
                    color: "#FF2E2E",
                    inclusion: { T: 1, G: 1, V: 1, TR: 2 },
                    funFact: "This refreshing drink has real strawberry pieces inside!",
                    description: "Sweet strawberry flavors with real strawberry pieces"
                }
            }
        };
        
        // Game constants
        this.baristaTips = [
            "Welcome to your barista adventure! Remember to have fun while learning!",
            "Did you know? 'Tall' is actually the smallest size for iced drinks!",
            "Grande means 'large' in Italian, but it's actually the middle size!",
            "Most hot drinks get 1 shot for Tall, 2 shots for Grande and Venti",
            "The syrup pumps increase by 1 for each size up you go",
            "Iced Venti drinks get more syrup (6 pumps) because the cup is bigger",
            "For refreshers, only Trenta size gets 2 scoops of fruit inclusions",
            "Frappuccinos always get whipped cream unless requested without",
            "Remember to shake refreshers 10 times for the perfect mix!",
            "You're becoming a star barista! Keep practicing those recipes!"
        ];
        
        this.sizeInfo = {
            S: { name: "Short", oz: "8oz", description: "Tiny but mighty!" },
            T: { name: "Tall", oz: "12oz", description: "Not so tall after all!" },
            G: { name: "Grande", oz: "16oz", description: "Italian for 'big'" },
            V: { name: "Venti", oz: "20/24oz", description: "Italian for '20'" },
            TR: { name: "Trenta", oz: "30oz", description: "The giant cup!" }
        };
        
        this.badgeTypes = [
            { id: "first_star", name: "First Star", icon: "⭐", description: "Earned your first star!" },
            { id: "hot_expert", name: "Hot Drink Expert", icon: "☕", description: "Mastered hot drink recipes" },
            { id: "ice_master", name: "Ice Master", icon: "🧊", description: "Conquered all iced drink recipes" },
            { id: "frapp_wizard", name: "Frappuccino Wizard", icon: "🥤", description: "Perfected all Frappuccino recipes" },
            { id: "streak_5", name: "5-Streak", icon: "🔥", description: "5 correct answers in a row!" },
            { id: "level_5", name: "Level 5 Barista", icon: "🌟", description: "Reached level 5!" }
        ];
        
        // Initialize game
        this.init();
    }
    
    /**
     * Initialize the game
     */
    async init() {
        try {
            console.log('🎮 Initializing Starbucks Barista Game');
            
            // Setup container
            this.setupContainer();
            
            // Load saved game state if available
            this.loadGameState();
            
            // Render initial screen
            this.render();
            
            // Setup global event listeners
            this.setupEventListeners();
            
            console.log('✅ Starbucks Game initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Starbucks Game:', error);
            this.showError('Failed to initialize game. Please refresh and try again.');
        }
    }
    
    /**
     * Setup game container
     */
    setupContainer() {
        this.container.className = 'starbucks-game-container';
        this.container.innerHTML = ''; // Clear any existing content
        
        // Add game-specific styles
        this.injectStyles();
    }
    
    /**
     * Inject game-specific CSS styles
     */
    injectStyles() {
        const styleId = `${this.gameId}-styles`;
        
        // Remove existing styles
        const existingStyles = document.getElementById(styleId);
        if (existingStyles) {
            existingStyles.remove();
        }
        
        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            .starbucks-game-container {
                width: 100%;
                height: 100%;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                overflow: hidden;
                position: relative;
                background: #f8fafc;
            }
            
            .game-screen {
                width: 100%;
                height: 100%;
                padding: 1.5rem;
                box-sizing: border-box;
                overflow-y: auto;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .game-panel {
                max-width: 600px;
                width: 100%;
                max-height: 100%;
                overflow-y: auto;
                border-radius: 1rem;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
                text-align: center;
                color: white;
                position: relative;
            }
            
            .game-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
                padding: 0 0.5rem;
            }
            
            .game-title {
                font-size: 1.25rem;
                font-weight: 700;
                margin: 0;
            }
            
            .game-stats {
                font-size: 0.875rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .game-content {
                padding: 1.5rem;
            }
            
            .game-button {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 0.75rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 0.875rem;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                text-decoration: none;
                box-sizing: border-box;
            }
            
            .game-button:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }
            
            .game-button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            
            .game-button.primary {
                background: #10b981;
                color: white;
            }
            
            .game-button.secondary {
                background: rgba(255, 255, 255, 0.2);
                color: white;
            }
            
            .game-button.danger {
                background: #ef4444;
                color: white;
            }
            
            .game-input {
                width: 100%;
                padding: 0.75rem;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 0.75rem;
                background: rgba(255, 255, 255, 0.1);
                color: white;
                font-size: 1rem;
                text-align: center;
                box-sizing: border-box;
            }
            
            .game-input::placeholder {
                color: rgba(255, 255, 255, 0.7);
            }
            
            .game-input:focus {
                outline: none;
                border-color: rgba(255, 255, 255, 0.8);
                background: rgba(255, 255, 255, 0.2);
            }
            
            .game-grid {
                display: grid;
                gap: 1rem;
                margin: 1rem 0;
            }
            
            .game-grid.cols-2 {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .game-grid.cols-1 {
                grid-template-columns: 1fr;
            }
            
            .game-card {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 0.75rem;
                padding: 1rem;
                transition: all 0.3s ease;
                cursor: pointer;
                border: 2px solid transparent;
            }
            
            .game-card:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-2px);
            }
            
            .game-card.active {
                border-color: rgba(255, 255, 255, 0.5);
                background: rgba(255, 255, 255, 0.2);
            }
            
            .game-info-panel {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 0.75rem;
                padding: 1rem;
                margin: 1rem 0;
                backdrop-filter: blur(10px);
            }
            
            .game-tags {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
                justify-content: center;
                margin: 1rem 0;
            }
            
            .game-tag {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                padding: 0.25rem 0.75rem;
                border-radius: 1rem;
                font-size: 0.75rem;
                font-weight: 500;
            }
            
            .game-progress {
                width: 100%;
                height: 0.5rem;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 0.25rem;
                overflow: hidden;
                margin: 1rem 0;
            }
            
            .game-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #10b981, #34d399);
                border-radius: 0.25rem;
                transition: width 0.3s ease;
            }
            
            .game-animation-success {
                animation: successPulse 0.6s ease-out;
            }
            
            .game-animation-error {
                animation: errorShake 0.5s ease-out;
            }
            
            @keyframes successPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            @keyframes errorShake {
                0% { transform: translateX(0); }
                25% { transform: translateX(-10px); }
                75% { transform: translateX(10px); }
                100% { transform: translateX(0); }
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .game-fade-in {
                animation: fadeIn 0.5s ease-out;
            }
            
            /* Responsive design */
            @media (max-width: 768px) {
                .game-screen {
                    padding: 1rem;
                }
                
                .game-panel {
                    border-radius: 0.5rem;
                }
                
                .game-content {
                    padding: 1rem;
                }
                
                .game-grid.cols-2 {
                    grid-template-columns: 1fr;
                    gap: 0.75rem;
                }
                
                .game-button {
                    padding: 0.625rem 1.25rem;
                    font-size: 0.8rem;
                }
            }
            
            /* Accessibility */
            @media (prefers-reduced-motion: reduce) {
                .game-button, .game-card, .game-info-panel {
                    transition: none;
                }
                
                .game-animation-success, .game-animation-error, .game-fade-in {
                    animation: none;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    /**
     * Setup global event listeners
     */
    setupEventListeners() {
        // Handle resize events
        const resizeHandler = () => this.handleResize();
        window.addEventListener('resize', resizeHandler);
        this.eventListeners.push(['resize', resizeHandler]);
        
        // Handle visibility change
        const visibilityHandler = () => this.handleVisibilityChange();
        document.addEventListener('visibilitychange', visibilityHandler);
        this.eventListeners.push(['visibilitychange', visibilityHandler]);
    }
    
    /**
     * Handle window resize
     */
    handleResize() {
        // Adjust game layout if needed
        this.render();
    }
    
    /**
     * Handle visibility change
     */
    handleVisibilityChange() {
        if (document.hidden) {
            // Pause any active animations or timers
            this.pauseGame();
        } else {
            // Resume game
            this.resumeGame();
        }
    }
    
    /**
     * Pause game
     */
    pauseGame() {
        // Clear any active timers
        this.timeouts.forEach(timeout => clearTimeout(timeout));
        this.intervals.forEach(interval => clearInterval(interval));
    }
    
    /**
     * Resume game
     */
    resumeGame() {
        // Resume game logic if needed
    }
    
    /**
     * Load saved game state from localStorage
     */
    loadGameState() {
        try {
            const savedState = localStorage.getItem('starbucks-game-state');
            if (savedState) {
                const parsedState = JSON.parse(savedState);
                // Only load certain properties to maintain game integrity
                this.state = {
                    ...this.state,
                    playerName: parsedState.playerName || '',
                    playerLevel: Math.min(parsedState.playerLevel || 1, 10),
                    stars: Math.min(parsedState.stars || 0, 100),
                    maxStreak: parsedState.maxStreak || 0,
                    badges: Array.isArray(parsedState.badges) ? parsedState.badges : [],
                    completedDrinks: parsedState.completedDrinks || {}
                };
                
                console.log('📁 Game state loaded from storage');
            }
        } catch (error) {
            console.warn('⚠️ Failed to load game state:', error);
        }
    }
    
    /**
     * Save game state to localStorage
     */
    saveGameState() {
        try {
            const stateToSave = {
                playerName: this.state.playerName,
                playerLevel: this.state.playerLevel,
                stars: this.state.stars,
                maxStreak: this.state.maxStreak,
                badges: this.state.badges,
                completedDrinks: this.state.completedDrinks
            };
            
            localStorage.setItem('starbucks-game-state', JSON.stringify(stateToSave));
            console.log('💾 Game state saved');
        } catch (error) {
            console.warn('⚠️ Failed to save game state:', error);
        }
    }
    
    /**
     * Update game state
     */
    setState(updates) {
        this.state = { ...this.state, ...updates };
        this.saveGameState();
        this.render();
    }
    
    /**
     * Main render method
     */
    render() {
        let content;
        
        switch (this.state.screen) {
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
                content = this.renderWelcomeScreen();
        }
        
        this.container.innerHTML = content;
        this.bindEventListeners();
    }
    
    /**
     * Render welcome screen
     */
    renderWelcomeScreen() {
        return `
            <div class="game-screen">
                <div class="game-panel game-fade-in" style="background: linear-gradient(135deg, #064e3b, #059669);">
                    <div class="game-content">
                        <h1 style="font-size: 2rem; font-weight: 800; margin-bottom: 1rem;">
                            ☕ Starbucks Barista Adventure ☕
                        </h1>
                        <p style="font-size: 1.125rem; margin-bottom: 2rem; opacity: 0.9;">
                            Become a master barista through fun challenges!
                        </p>
                        
                        <div class="game-info-panel" style="margin-bottom: 2rem;">
                            <div style="font-size: 4rem; margin-bottom: 1rem;">👨‍🍳</div>
                            <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">
                                Welcome, Future Barista!
                            </h2>
                            <p style="margin-bottom: 1rem;">What's your barista name?</p>
                            
                            <input 
                                type="text" 
                                id="player-name-input"
                                class="game-input"
                                placeholder="Enter your name"
                                value="${this.state.playerName}"
                                maxlength="20"
                                style="margin-bottom: 1rem;"
                            />
                            
                            <button 
                                id="start-game-btn"
                                class="game-button primary"
                                style="width: 100%; padding: 1rem; font-size: 1.125rem;"
                                ${!this.state.playerName.trim() ? 'disabled' : ''}
                            >
                                Start My Adventure!
                            </button>
                        </div>
                        
                        <div style="font-size: 0.875rem; opacity: 0.7;">
                            <p>Learn recipes • Earn stars • Collect badges</p>
                            <p>Become the ultimate Starbucks barista!</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render main screen
     */
    renderMainScreen() {
        const currentTip = this.baristaTips[Math.min(this.state.playerLevel - 1, this.baristaTips.length - 1)];
        const baristaEmoji = this.state.isCorrect ? "😄" : (this.state.showResult && !this.state.isCorrect) ? "😢" : "😊";
        
        return `
            <div class="game-screen">
                <div class="game-panel game-fade-in" style="background: linear-gradient(135deg, #047857, #10b981);">
                    <div class="game-content">
                        <div class="game-header">
                            <div>
                                <h1 class="game-title">Barista ${this.state.playerName}</h1>
                                <div class="game-stats">Level ${this.state.playerLevel} • ${this.state.stars} ⭐</div>
                            </div>
                            
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="font-size: 0.875rem;">${this.state.badges.length} badges</span>
                                <button id="badges-btn" class="game-button" style="width: 2.5rem; height: 2.5rem; padding: 0; border-radius: 50%; background: #f59e0b;">
                                    🏆
                                </button>
                            </div>
                        </div>
                        
                        <div class="game-info-panel" style="position: relative; overflow: hidden;">
                            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                                <div style="font-size: 4rem;">${baristaEmoji}</div>
                                <div style="text-align: left;">
                                    <h2 style="font-size: 1.125rem; font-weight: 700; margin-bottom: 0.5rem;">Barista Tip:</h2>
                                    <p style="font-size: 0.875rem; margin: 0;">${currentTip}</p>
                                </div>
                            </div>
                            
                            ${this.state.streak >= 3 ? `
                                <div style="position: absolute; bottom: -0.75rem; right: -0.75rem; background: #f97316; width: 6rem; height: 6rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; transform: rotate(12deg);">
                                    <div style="text-align: center;">
                                        <div style="font-size: 0.75rem;">Streak</div>
                                        <div style="font-size: 1.5rem; font-weight: 700;">${this.state.streak} 🔥</div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="game-grid cols-2">
                            <button id="random-challenge-btn" class="game-card" style="background: #7c3aed;">
                                <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎯</div>
                                <div style="font-weight: 600;">Random Challenge</div>
                                <div style="font-size: 0.75rem; opacity: 0.8;">Test your skills!</div>
                            </button>
                            
                            <button id="categories-btn" class="game-card" style="background: #2563eb;">
                                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📚</div>
                                <div style="font-weight: 600;">Recipe Types</div>
                                <div style="font-size: 0.75rem; opacity: 0.8;">Choose a category</div>
                            </button>
                            
                            <button id="recipes-btn" class="game-card" style="background: #d97706;">
                                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📖</div>
                                <div style="font-weight: 600;">Recipe Book</div>
                                <div style="font-size: 0.75rem; opacity: 0.8;">Study the recipes</div>
                            </button>
                            
                            <button id="tips-btn" class="game-card" style="background: #0891b2;">
                                <div style="font-size: 2rem; margin-bottom: 0.5rem;">💡</div>
                                <div style="font-weight: 600;">Barista Tips</div>
                                <div style="font-size: 0.75rem; opacity: 0.8;">Helpful advice</div>
                            </button>
                        </div>
                        
                        ${this.state.showTip ? `
                            <div class="game-info-panel game-fade-in">
                                <h3 style="font-weight: 700; margin-bottom: 0.5rem;">Quick Tip!</h3>
                                <p style="font-size: 0.875rem; margin: 0;">${this.baristaTips[Math.floor(Math.random() * this.baristaTips.length)]}</p>
                            </div>
                        ` : ''}
                        
                        <div style="text-align: center; font-size: 0.875rem; margin-top: 1rem;">
                            <p style="opacity: 0.7;">
                                ${this.state.streak > 0 ? `Current streak: ${this.state.streak} 🔥` : "Start a streak by getting answers right in a row!"}
                            </p>
                            <p style="opacity: 0.7; font-size: 0.75rem; margin-top: 0.25rem;">
                                ${this.state.playerLevel < 10 ? `${this.state.playerLevel * 5 - this.state.stars} more stars to level up!` : "You've reached max level!"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render categories screen
     */
    renderCategoriesScreen() {
        const categoryData = [
            { id: 'hotDrinks', icon: '☕', name: 'Hot Espresso Drinks', desc: 'Lattes, Cappuccinos & more', color: '#dc2626' },
            { id: 'icedDrinks', icon: '🧊', name: 'Iced Espresso Drinks', desc: 'Cool & refreshing coffee', color: '#0284c7' },
            { id: 'frappuccinos', icon: '🥤', name: 'Frappuccinos', desc: 'Blended frozen treats', color: '#7c3aed' },
            { id: 'refreshers', icon: '🍓', name: 'Refreshers', desc: 'Fruity & refreshing', color: '#ec4899' }
        ];
        
        return `
            <div class="game-screen">
                <div class="game-panel game-fade-in" style="background: linear-gradient(135deg, #1e40af, #3b82f6);">
                    <div class="game-content">
                        <div class="game-header">
                            <h1 class="game-title">Choose a Recipe Type</h1>
                            <div class="game-stats">Level ${this.state.playerLevel} • ${this.state.stars} ⭐</div>
                        </div>
                        
                        <div class="game-grid cols-1">
                            ${categoryData.map(cat => `
                                <button class="game-card category-btn" data-category="${cat.id}" style="background: ${cat.color}; display: flex; align-items: center; text-align: left;">
                                    <span style="font-size: 3rem; margin-right: 1rem;">${cat.icon}</span>
                                    <div>
                                        <div style="font-weight: 700; font-size: 1.125rem;">${cat.name}</div>
                                        <div style="font-size: 0.75rem; opacity: 0.8;">${cat.desc}</div>
                                    </div>
                                </button>
                            `).join('')}
                        </div>
                        
                        <button id="back-to-main-btn" class="game-button secondary" style="width: 100%; margin-top: 1rem;">
                            Back to Menu
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
        if (!this.state.currentChallenge) {
            return this.renderMainScreen();
        }
        
        const challenge = this.state.currentChallenge;
        const drinkData = this.recipes[challenge.category][challenge.drink];
        const sizeInfo = this.sizeInfo[challenge.size];
        
        return `
            <div class="game-screen">
                <div class="game-panel game-fade-in ${this.state.animation ? `game-animation-${this.state.animation}` : ''}" style="background: linear-gradient(135deg, #7c2d12, #a855f7);">
                    <div class="game-content">
                        <div class="game-header">
                            <h1 class="game-title">Barista Challenge</h1>
                            <div class="game-stats">
                                <span style="margin-right: 0.5rem;">${this.state.streak} 🔥</span>
                                <span>${this.state.stars} ⭐</span>
                            </div>
                        </div>
                        
                        <div class="game-info-panel" style="background-image: ${drinkData.color ? `linear-gradient(rgba(255,255,255,0.1), rgba(255,255,255,0.1)), linear-gradient(to right, ${drinkData.color}66, transparent)` : 'none'};">
                            <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                                <span style="font-size: 4rem; margin-right: 1rem;">${drinkData.icon}</span>
                                <div style="text-align: left;">
                                    <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem;">${challenge.drink}</h2>
                                    <p style="font-size: 0.875rem; opacity: 0.9; margin: 0;">${sizeInfo.name} (${sizeInfo.oz})</p>
                                </div>
                            </div>
                            
                            <div style="background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                                <p style="font-size: 0.875rem; margin: 0;">${drinkData.description}</p>
                                ${!this.state.showResult ? '<p style="font-size: 0.75rem; font-style: italic; margin: 0.5rem 0 0 0;">What goes in this drink?</p>' : ''}
                            </div>
                            
                            <div id="recipe-inputs">
                                ${this.renderRecipeInputs(challenge, drinkData)}
                            </div>
                        </div>
                        
                        ${!this.state.showResult ? `
                            <button id="check-answer-btn" class="game-button primary" style="width: 100%; padding: 1rem; font-size: 1.125rem; margin-bottom: 1rem;">
                                Make the Drink!
                            </button>
                        ` : `
                            <div class="game-info-panel" style="background: ${this.state.isCorrect ? '#059669' : '#dc2626'}; margin-bottom: 1rem;">
                                <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                                    <span style="font-size: 3rem; margin-right: 1rem;">${this.state.isCorrect ? '🎉' : '😢'}</span>
                                    <div style="text-align: left;">
                                        <h3 style="font-weight: 700; margin-bottom: 0.25rem;">${this.state.isCorrect ? 'Perfect Drink!' : 'Not Quite Right'}</h3>
                                        <p style="font-size: 0.875rem; margin: 0;">${this.state.isCorrect ? 'You nailed the recipe!' : "Let's check the recipe..."}</p>
                                    </div>
                                </div>
                                
                                ${!this.state.isCorrect ? `
                                    <div style="background: rgba(255,255,255,0.2); padding: 0.75rem; border-radius: 0.5rem; text-align: left;">
                                        <p style="font-weight: 700; margin-bottom: 0.5rem; font-size: 0.875rem;">Correct Recipe:</p>
                                        <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.875rem;">
                                            ${this.renderCorrectAnswer(challenge, drinkData)}
                                        </ul>
                                    </div>
                                ` : `
                                    <div style="background: rgba(255,255,255,0.2); padding: 0.75rem; border-radius: 0.5rem;">
                                        <p style="font-size: 0.875rem; margin: 0;">${drinkData.funFact}</p>
                                    </div>
                                `}
                            </div>
                        `}
                        
                        <div class="game-grid cols-2">
                            <button id="back-to-main-btn" class="game-button secondary">
                                Main Menu
                            </button>
                            <button id="next-challenge-btn" class="game-button secondary">
                                ${this.state.showResult ? 'Next Challenge' : 'Skip'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render recipe inputs based on drink category
     */
    renderRecipeInputs(challenge, drinkData) {
        let inputs = [];
        
        if (challenge.category === 'hotDrinks' || challenge.category === 'icedDrinks') {
            if (drinkData.shots) {
                inputs.push(`
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">
                            <span style="margin-right: 0.25rem;">☕</span> Espresso Shots:
                        </label>
                        <input 
                            type="number" 
                            id="shots-input"
                            class="game-input"
                            min="1" max="4"
                            value="${this.state.answer.shots || ''}"
                            ${this.state.showResult ? 'disabled' : ''}
                            style="text-align: center; padding: 0.5rem;"
                        />
                    </div>
                `);
            }
            
            if (drinkData.syrup) {
                inputs.push(`
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">
                            <span style="margin-right: 0.25rem;">🍯</span> Syrup Pumps:
                        </label>
                        <input 
                            type="number" 
                            id="syrup-input"
                            class="game-input"
                            min="1" max="7"
                            value="${this.state.answer.syrup || ''}"
                            ${this.state.showResult ? 'disabled' : ''}
                            style="text-align: center; padding: 0.5rem;"
                        />
                    </div>
                `);
            }
        } else if (challenge.category === 'frappuccinos') {
            const frappInputs = [
                { field: 'roast', label: 'Frapp Roast', icon: '☕' },
                { field: 'frappBase', label: 'Frapp Base', icon: '🧪' },
                { field: 'mochaSauce', label: 'Mocha Sauce', icon: '🍫' },
                { field: 'caramelSyrup', label: 'Caramel Syrup', icon: '🍮' }
            ];
            
            frappInputs.forEach(input => {
                if (drinkData[input.field]) {
                    inputs.push(`
                        <div style="margin-bottom: 1rem;">
                            <label style="display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">
                                <span style="margin-right: 0.25rem;">${input.icon}</span> ${input.label}:
                            </label>
                            <input 
                                type="number" 
                                id="${input.field}-input"
                                class="game-input"
                                min="1" max="4"
                                value="${this.state.answer[input.field] || ''}"
                                ${this.state.showResult ? 'disabled' : ''}
                                style="text-align: center; padding: 0.5rem;"
                            />
                        </div>
                    `);
                }
            });
        } else if (challenge.category === 'refreshers') {
            if (drinkData.inclusion) {
                inputs.push(`
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">
                            <span style="margin-right: 0.25rem;">🍓</span> Fruit Inclusion Scoops:
                        </label>
                        <input 
                            type="number" 
                            id="inclusion-input"
                            class="game-input"
                            min="1" max="2"
                            value="${this.state.answer.inclusion || ''}"
                            ${this.state.showResult ? 'disabled' : ''}
                            style="text-align: center; padding: 0.5rem;"
                        />
                    </div>
                `);
            }
        }
        
        return `<div class="game-grid cols-2">${inputs.join('')}</div>`;
    }
    
    /**
     * Render correct answer
     */
    renderCorrectAnswer(challenge, drinkData) {
        const fieldLabels = {
            shots: 'Espresso Shots',
            syrup: 'Syrup Pumps',
            roast: 'Frapp Roast',
            frappBase: 'Frapp Base',
            mochaSauce: 'Mocha Sauce',
            caramelSyrup: 'Caramel Syrup',
            inclusion: 'Fruit Inclusion'
        };
        
        const answers = [];
        Object.entries(drinkData).forEach(([field, value]) => {
            if (typeof value === 'object' && value[challenge.size] && fieldLabels[field]) {
                answers.push(`<li>${fieldLabels[field]}: ${value[challenge.size]}</li>`);
            }
        });
        
        return answers.join('');
    }
    
    /**
     * Render recipes screen
     */
    renderRecipesScreen() {
        return `
            <div class="game-screen">
                <div class="game-panel game-fade-in" style="background: linear-gradient(135deg, #b45309, #f59e0b);">
                    <div class="game-content">
                        <div class="game-header">
                            <h1 class="game-title">Recipe Book</h1>
                            <div class="game-stats">Level ${this.state.playerLevel} • ${this.state.stars} ⭐</div>
                        </div>
                        
                        <div class="game-info-panel">
                            <p style="font-size: 0.875rem; margin: 0;">Study the recipes to master your barista skills!</p>
                        </div>
                        
                        <div class="game-grid cols-1">
                            <button class="game-card category-btn" data-category="hotDrinks" style="background: #dc2626;">
                                <span style="font-size: 2rem; margin-right: 1rem;">☕</span>
                                <span style="font-weight: 700;">Hot Espresso Drinks</span>
                            </button>
                            
                            <button class="game-card category-btn" data-category="icedDrinks" style="background: #0284c7;">
                                <span style="font-size: 2rem; margin-right: 1rem;">🧊</span>
                                <span style="font-weight: 700;">Iced Espresso Drinks</span>
                            </button>
                            
                            <button class="game-card category-btn" data-category="frappuccinos" style="background: #7c3aed;">
                                <span style="font-size: 2rem; margin-right: 1rem;">🥤</span>
                                <span style="font-weight: 700;">Frappuccinos</span>
                            </button>
                            
                            <button class="game-card category-btn" data-category="refreshers" style="background: #ec4899;">
                                <span style="font-size: 2rem; margin-right: 1rem;">🍓</span>
                                <span style="font-weight: 700;">Refreshers</span>
                            </button>
                        </div>
                        
                        <button id="back-to-main-btn" class="game-button secondary" style="width: 100%; margin-top: 1rem;">
                            Back to Menu
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render badges screen
     */
    renderBadgesScreen() {
        return `
            <div class="game-screen">
                <div class="game-panel game-fade-in" style="background: linear-gradient(135deg, #a16207, #eab308);">
                    <div class="game-content">
                        <div class="game-header">
                            <h1 class="game-title">Your Badges</h1>
                            <div class="game-stats">Level ${this.state.playerLevel} • ${this.state.stars} ⭐</div>
                        </div>
                        
                        <div class="game-info-panel">
                            <p style="font-size: 0.875rem; margin-bottom: 0.5rem;">Collect badges by completing challenges and mastering recipes!</p>
                            <p style="font-weight: 700; margin: 0;">
                                ${this.state.badges.length} / ${this.badgeTypes.length} Badges Earned
                            </p>
                        </div>
                        
                        <div class="game-grid cols-2">
                            ${this.badgeTypes.map(badge => {
                                const earned = this.state.badges.includes(badge.id);
                                return `
                                    <div class="game-card" style="background: ${earned ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}; cursor: default;">
                                        <div style="display: flex; align-items: center;">
                                            <div style="font-size: 3rem; margin-right: 1rem; ${earned ? '' : 'opacity: 0.4;'}">
                                                ${badge.icon}
                                            </div>
                                            <div style="text-align: left;">
                                                <h3 style="font-weight: 700; margin-bottom: 0.25rem; ${earned ? '' : 'opacity: 0.6;'}">
                                                    ${badge.name}
                                                </h3>
                                                <p style="font-size: 0.75rem; margin: 0; ${earned ? '' : 'opacity: 0.6;'}">
                                                    ${badge.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        
                        <button id="back-to-main-btn" class="game-button secondary" style="width: 100%; margin-top: 1rem;">
                            Back to Menu
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Bind event listeners after rendering
     */
    bindEventListeners() {
        // Welcome screen events
        const playerNameInput = document.getElementById('player-name-input');
        const startGameBtn = document.getElementById('start-game-btn');
        
        if (playerNameInput) {
            playerNameInput.addEventListener('input', (e) => {
                const name = e.target.value.trim();
                this.setState({ playerName: name });
                if (startGameBtn) {
                    startGameBtn.disabled = !name;
                }
            });
            
            playerNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                    this.startGame();
                }
            });
        }
        
        if (startGameBtn) {
            startGameBtn.addEventListener('click', () => this.startGame());
        }
        
        // Main screen events
        const randomChallengeBtn = document.getElementById('random-challenge-btn');
        const categoriesBtn = document.getElementById('categories-btn');
        const recipesBtn = document.getElementById('recipes-btn');
        const tipsBtn = document.getElementById('tips-btn');
        const badgesBtn = document.getElementById('badges-btn');
        
        if (randomChallengeBtn) {
            randomChallengeBtn.addEventListener('click', () => this.startRandomChallenge());
        }
        
        if (categoriesBtn) {
            categoriesBtn.addEventListener('click', () => this.setState({ screen: 'categories' }));
        }
        
        if (recipesBtn) {
            recipesBtn.addEventListener('click', () => this.setState({ screen: 'recipes' }));
        }
        
        if (tipsBtn) {
            tipsBtn.addEventListener('click', () => this.toggleTips());
        }
        
        if (badgesBtn) {
            badgesBtn.addEventListener('click', () => this.setState({ screen: 'badges' }));
        }
        
        // Category selection events
        const categoryBtns = document.querySelectorAll('.category-btn');
        categoryBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.getAttribute('data-category');
                this.startCategoryChallenge(category);
            });
        });
        
        // Challenge screen events
        const checkAnswerBtn = document.getElementById('check-answer-btn');
        const nextChallengeBtn = document.getElementById('next-challenge-btn');
        
        if (checkAnswerBtn) {
            checkAnswerBtn.addEventListener('click', () => this.checkAnswer());
        }
        
        if (nextChallengeBtn) {
            nextChallengeBtn.addEventListener('click', () => this.nextChallenge());
        }
        
        // Answer input events
        const answerInputs = ['shots', 'syrup', 'roast', 'frappBase', 'mochaSauce', 'caramelSyrup', 'inclusion'];
        answerInputs.forEach(field => {
            const input = document.getElementById(`${field}-input`);
            if (input) {
                input.addEventListener('input', (e) => {
                    this.updateAnswer(field, e.target.value);
                });
            }
        });
        
        // Back to main events
        const backToMainBtns = document.querySelectorAll('#back-to-main-btn');
        backToMainBtns.forEach(btn => {
            btn.addEventListener('click', () => this.setState({ screen: 'main' }));
        });
    }
    
    /**
     * Start the game
     */
    startGame() {
        if (!this.state.playerName.trim()) return;
        
        this.playSound('start');
        this.setState({ screen: 'main' });
    }
    
    /**
     * Start random challenge
     */
    startRandomChallenge() {
        this.setState({ activeCategory: 'all' });
        this.generateChallenge();
        this.setState({ screen: 'challenge' });
    }
    
    /**
     * Start category challenge
     */
    startCategoryChallenge(category) {
        this.setState({ activeCategory: category });
        this.generateChallenge();
        this.setState({ screen: 'challenge' });
    }
    
    /**
     * Toggle tips display
     */
    toggleTips() {
        this.setState({ showTip: !this.state.showTip });
    }
    
    /**
     * Generate a random challenge
     */
    generateChallenge() {
        const categories = this.state.activeCategory === 'all' 
            ? Object.keys(this.recipes) 
            : [this.state.activeCategory];
        
        const randomCat = categories[Math.floor(Math.random() * categories.length)];
        const drinks = Object.keys(this.recipes[randomCat]);
        const randomDrink = drinks[Math.floor(Math.random() * drinks.length)];
        
        const sizes = this.getAvailableSizes(randomCat);
        const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
        
        this.setState({
            currentChallenge: {
                category: randomCat,
                drink: randomDrink,
                size: randomSize
            },
            answer: {},
            showResult: false,
            animation: ''
        });
    }
    
    /**
     * Get available sizes for category
     */
    getAvailableSizes(category) {
        switch(category) {
            case 'hotDrinks': return ['S', 'T', 'G', 'V'];
            case 'refreshers': return ['T', 'G', 'V', 'TR'];
            default: return ['T', 'G', 'V'];
        }
    }
    
    /**
     * Update answer field
     */
    updateAnswer(field, value) {
        this.setState({
            answer: { ...this.state.answer, [field]: value }
        });
    }
    
    /**
     * Check the current answer
     */
    checkAnswer() {
        if (!this.state.currentChallenge) return;
        
        const challenge = this.state.currentChallenge;
        const drinkData = this.recipes[challenge.category][challenge.drink];
        let correct = true;
        
        // Check all relevant fields
        const fieldsToCheck = ['shots', 'syrup', 'roast', 'frappBase', 'mochaSauce', 'caramelSyrup', 'inclusion'];
        
        fieldsToCheck.forEach(field => {
            if (drinkData[field] && parseInt(this.state.answer[field]) !== drinkData[field][challenge.size]) {
                correct = false;
            }
        });
        
        this.setState({
            isCorrect: correct,
            showResult: true,
            animation: correct ? 'success' : 'error'
        });
        
        // Update game progress
        if (correct) {
            this.handleCorrectAnswer(challenge);
            this.playSound('correct');
        } else {
            this.handleIncorrectAnswer();
            this.playSound('wrong');
        }
        
        // Clear animation after delay
        const timeout = setTimeout(() => {
            this.setState({ animation: '' });
        }, 600);
        this.timeouts.push(timeout);
    }
    
    /**
     * Handle correct answer
     */
    handleCorrectAnswer(challenge) {
        const newStars = this.state.stars + 1;
        const newStreak = this.state.streak + 1;
        const newMaxStreak = Math.max(newStreak, this.state.maxStreak);
        const newLevel = Math.floor(newStars / 5) + 1;
        
        let newBadges = [...this.state.badges];
        
        // Check for new badges
        if (newStars === 1 && !newBadges.includes("first_star")) {
            newBadges.push("first_star");
        }
        
        if (newStreak === 5 && !newBadges.includes("streak_5")) {
            newBadges.push("streak_5");
        }
        
        if (newLevel === 5 && !newBadges.includes("level_5")) {
            newBadges.push("level_5");
        }
        
        // Check category completion badges
        this.checkCategoryBadges(challenge, newBadges);
        
        // Update completed drinks
        const drinkKey = `${challenge.category}-${challenge.drink}`;
        const newCompletedDrinks = {
            ...this.state.completedDrinks,
            [drinkKey]: (this.state.completedDrinks[drinkKey] || 0) + 1
        };
        
        // Play level up sound if needed
        if (newLevel > this.state.playerLevel) {
            this.playSound('levelup');
        }
        
        this.setState({
            stars: newStars,
            streak: newStreak,
            maxStreak: newMaxStreak,
            playerLevel: newLevel,
            badges: newBadges,
            completedDrinks: newCompletedDrinks
        });
    }
    
    /**
     * Handle incorrect answer
     */
    handleIncorrectAnswer() {
        this.setState({ streak: 0 });
    }
    
    /**
     * Check for category completion badges
     */
    checkCategoryBadges(challenge, badges) {
        const categoryDrinks = Object.keys(this.recipes[challenge.category]);
        const completedInCategory = categoryDrinks.filter(drink => 
            this.state.completedDrinks[`${challenge.category}-${drink}`]
        ).length + 1; // +1 for current drink
        
        if (completedInCategory >= categoryDrinks.length) {
            let badgeId = "";
            switch(challenge.category) {
                case 'hotDrinks': badgeId = "hot_expert"; break;
                case 'icedDrinks': badgeId = "ice_master"; break;
                case 'frappuccinos': badgeId = "frapp_wizard"; break;
            }
            
            if (badgeId && !badges.includes(badgeId)) {
                badges.push(badgeId);
            }
        }
    }
    
    /**
     * Go to next challenge
     */
    nextChallenge() {
        this.generateChallenge();
    }
    
    /**
     * Play sound effects (placeholder)
     */
    playSound(type) {
        if (!this.config.sounds) return;
        
        // Placeholder for sound effects
        console.log(`🎵 Playing ${type} sound effect`);
        
        // In a real implementation, you would play actual audio files here
        // For now, we'll just log the sound type
    }
    
    /**
     * Show error message
     */
    showError(message) {
        this.container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; padding: 2rem; text-align: center;">
                <div style="background: #dc2626; color: white; padding: 2rem; border-radius: 1rem; max-width: 400px;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                    <h2 style="margin-bottom: 1rem;">Game Error</h2>
                    <p style="margin-bottom: 2rem;">${message}</p>
                    <button onclick="window.location.reload()" style="padding: 0.75rem 1.5rem; background: white; color: #dc2626; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer;">
                        Reload Game
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Cleanup game resources
     */
    cleanup() {
        console.log('🧹 Cleaning up Starbucks Game');
        
        // Clear timeouts and intervals
        this.timeouts.forEach(timeout => clearTimeout(timeout));
        this.intervals.forEach(interval => clearInterval(interval));
        this.timeouts = [];
        this.intervals = [];
        
        // Remove event listeners
        this.eventListeners.forEach(([event, handler]) => {
            if (event === 'resize' || event === 'scroll') {
                window.removeEventListener(event, handler);
            } else {
                document.removeEventListener(event, handler);
            }
        });
        this.eventListeners = [];
        
        // Remove injected styles
        const styles = document.getElementById(`${this.gameId}-styles`);
        if (styles) {
            styles.remove();
        }
        
        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
            this.container.className = '';
        }
        
        console.log('✅ Starbucks Game cleanup complete');
    }
    
    /**
     * Handle resize events
     */
    handleResize() {
        // Game handles responsive design through CSS
        // This method can be extended for specific resize logic
    }
}

// Export for module systems and global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StarbucksGame;
} else {
    window.StarbucksGame = StarbucksGame;
}

// Auto-register with PageManager if available
if (typeof window !== 'undefined' && window.pageManager) {
    // Register game with PageManager
    window.pageManager.registerGame = window.pageManager.registerGame || function(name, gameClass) {
        this.availableGames = this.availableGames || {};
        this.availableGames[name] = gameClass;
        console.log(`🎮 Registered game: ${name}`);
    };
    
    window.pageManager.registerGame('barista', StarbucksGame);
}