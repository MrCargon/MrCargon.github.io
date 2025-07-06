/**
 * Starbucks Barista Adventure Game
 */

class StarbucksGame {
    constructor(container) {
        // Core properties
        this.container = container;
        this.gameContainer = null;
        this.isInitialized = false;
        this.isDestroyed = false;
        
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
        
        // Event listeners storage for cleanup
        this.eventListeners = [];
        
        // Performance and accessibility
        this.soundEnabled = true;
        this.animationsEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        // Game data
        this.initializeGameData();
        
        // Auto-initialize
        this.init();
    }

    /**
     * Initialize game data constants
     */
    initializeGameData() {
        // Badge definitions
        this.BADGE_TYPES = [
            { id: "first_star", name: "First Star", icon: "⭐", description: "Earned your first star!" },
            { id: "hot_expert", name: "Hot Drink Expert", icon: "☕", description: "Mastered hot drink recipes" },
            { id: "ice_master", name: "Ice Master", icon: "🧊", description: "Conquered all iced drink recipes" },
            { id: "frapp_wizard", name: "Frappuccino Wizard", icon: "🥤", description: "Perfected all Frappuccino recipes" },
            { id: "streak_5", name: "5-Streak", icon: "🔥", description: "5 correct answers in a row!" },
            { id: "level_5", name: "Level 5 Barista", icon: "🌟", description: "Reached level 5!" }
        ];

        // Size information
        this.SIZE_INFO = {
            S: { name: "Short", oz: "8oz", description: "Tiny but mighty!" },
            T: { name: "Tall", oz: "12oz", description: "Not so tall after all!" },
            G: { name: "Grande", oz: "16oz", description: "Italian for 'big'" },
            V: { name: "Venti", oz: "20/24oz", description: "Italian for '20'" },
            TR: { name: "Trenta", oz: "30oz", description: "The giant cup!" }
        };

        // Barista tips for each level
        this.BARISTA_TIPS = [
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

        // Recipe database with complete drink information
        this.RECIPES = {
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
    }

    /**
     * Initialize the game
     */
    async init() {
        if (this.isInitialized || this.isDestroyed) return;

        try {
            console.log('🎮 Initializing Starbucks Barista Game');
            
            // Create game container
            this.createGameContainer();
            
            // Load saved state if available
            this.loadGameState();
            
            // Render initial screen
            this.render();
            
            // Setup global event listeners
            this.setupGlobalListeners();
            
            this.isInitialized = true;
            console.log('✅ Starbucks Game initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Starbucks Game:', error);
            this.showError('Failed to initialize game. Please refresh and try again.');
        }
    }

    /**
     * Create main game container
     */
    createGameContainer() {
        if (!this.container) {
            throw new Error('Game container element not provided');
        }

        // Clear container
        this.container.innerHTML = '';
        
        // Create game wrapper
        this.gameContainer = document.createElement('div');
        this.gameContainer.className = 'starbucks-game-wrapper';
        this.gameContainer.style.cssText = `
            width: 100%;
            height: 100%;
            min-height: 500px;
            background: linear-gradient(135deg, #10b981, #059669);
            border-radius: 12px;
            overflow: hidden;
            position: relative;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            color: white;
            display: flex;
            flex-direction: column;
        `;
        
        this.container.appendChild(this.gameContainer);
    }

    /**
     * Setup global event listeners for accessibility and performance
     */
    setupGlobalListeners() {
        // Keyboard navigation
        const keyHandler = (e) => this.handleGlobalKeyboard(e);
        document.addEventListener('keydown', keyHandler);
        this.eventListeners.push({ element: document, event: 'keydown', handler: keyHandler });
        
        // Visibility change for performance
        const visibilityHandler = () => this.handleVisibilityChange();
        document.addEventListener('visibilitychange', visibilityHandler);
        this.eventListeners.push({ element: document, event: 'visibilitychange', handler: visibilityHandler });
    }

    /**
     * Handle global keyboard events for accessibility
     */
    handleGlobalKeyboard(e) {
        // Escape key to close game
        if (e.key === 'Escape' && this.state.screen !== 'welcome') {
            this.goToMainMenu();
        }
        
        // Arrow keys for navigation in some screens
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            this.handleArrowNavigation(e.key);
        }
    }

    /**
     * Handle visibility change for performance optimization
     */
    handleVisibilityChange() {
        if (document.hidden) {
            // Pause animations when page is hidden
            this.pauseAnimations();
        } else {
            // Resume animations when page is visible
            this.resumeAnimations();
        }
    }

    /**
     * Main render method - renders current screen
     */
    render() {
        if (!this.gameContainer || this.isDestroyed) return;

        // Clear existing content
        this.gameContainer.innerHTML = '';
        
        // Create screen based on current state
        let screenElement;
        
        switch (this.state.screen) {
            case 'welcome':
                screenElement = this.createWelcomeScreen();
                break;
            case 'main':
                screenElement = this.createMainScreen();
                break;
            case 'categories':
                screenElement = this.createCategoriesScreen();
                break;
            case 'challenge':
                screenElement = this.createChallengeScreen();
                break;
            case 'recipes':
                screenElement = this.createRecipeBookScreen();
                break;
            case 'badges':
                screenElement = this.createBadgesScreen();
                break;
            default:
                screenElement = this.createErrorScreen();
        }
        
        if (screenElement) {
            this.gameContainer.appendChild(screenElement);
            
            // Setup screen-specific event listeners
            this.setupScreenListeners(screenElement);
            
            // Handle accessibility
            this.setupAccessibility(screenElement);
        }
    }

    /**
     * Create Welcome Screen
     */
    createWelcomeScreen() {
        const screen = document.createElement('div');
        screen.className = 'game-screen welcome-screen';
        screen.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            height: 100%;
            text-align: center;
        `;

        screen.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h1 style="font-size: 2rem; font-weight: bold; margin-bottom: 1rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">
                    ☕ Starbucks Barista Adventure ☕
                </h1>
                <p style="font-size: 1.1rem; opacity: 0.9;">
                    Become a master barista through fun challenges!
                </p>
            </div>

            <div style="background: rgba(255,255,255,0.15); padding: 2rem; border-radius: 16px; backdrop-filter: blur(10px); margin-bottom: 2rem; width: 100%; max-width: 400px;">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem; animation: bounce 2s infinite;">👨‍🍳</div>
                    <h2 style="font-size: 1.3rem; font-weight: bold; margin-bottom: 0.5rem;">Welcome, Future Barista!</h2>
                    <p style="opacity: 0.9;">What's your barista name?</p>
                </div>

                <input 
                    type="text" 
                    id="player-name-input"
                    placeholder="Enter your name"
                    value="${this.state.playerName}"
                    style="
                        width: 100%;
                        padding: 1rem;
                        border-radius: 25px;
                        background: rgba(255,255,255,0.2);
                        border: 2px solid rgba(255,255,255,0.3);
                        color: white;
                        text-align: center;
                        font-size: 1rem;
                        margin-bottom: 1.5rem;
                        outline: none;
                        transition: all 0.3s ease;
                    "
                />

                <button 
                    id="start-game-btn"
                    ${!this.state.playerName.trim() ? 'disabled' : ''}
                    style="
                        width: 100%;
                        padding: 1rem 2rem;
                        border-radius: 25px;
                        font-size: 1.1rem;
                        font-weight: bold;
                        border: none;
                        cursor: ${this.state.playerName.trim() ? 'pointer' : 'not-allowed'};
                        background: ${this.state.playerName.trim() ? '#059669' : '#6b7280'};
                        color: white;
                        transition: all 0.3s ease;
                        opacity: ${this.state.playerName.trim() ? '1' : '0.6'};
                    "
                >
                    Start My Adventure!
                </button>
            </div>

            <div style="text-align: center; font-size: 0.9rem; opacity: 0.7;">
                <p>Learn recipes • Earn stars • Collect badges</p>
                <p>Become the ultimate Starbucks barista!</p>
            </div>

            <style>
                @keyframes bounce {
                    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-10px); }
                    60% { transform: translateY(-5px); }
                }
            </style>
        `;

        return screen;
    }

    /**
     * Create Main Screen (Hub)
     */
    createMainScreen() {
        const screen = document.createElement('div');
        screen.className = 'game-screen main-screen';
        screen.style.cssText = `
            padding: 1.5rem;
            height: 100%;
            display: flex;
            flex-direction: column;
        `;

        const baristaEmoji = this.getBaristaEmoji();
        const currentTip = this.getCurrentTip();

        screen.innerHTML = `
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div>
                    <h1 style="font-size: 1.3rem; font-weight: bold; margin: 0;">Barista ${this.state.playerName}</h1>
                    <p style="font-size: 0.9rem; margin: 0; opacity: 0.8;">Level ${this.state.playerLevel} • ${this.state.stars} ⭐</p>
                </div>
                
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span style="font-size: 0.9rem;">${this.state.badges.length} badges</span>
                    <button id="badges-btn" style="width: 2.5rem; height: 2.5rem; border-radius: 50%; background: #fbbf24; border: none; cursor: pointer; font-size: 1.2rem;">
                        🏆
                    </button>
                </div>
            </div>

            <!-- Barista Tip Panel -->
            <div style="background: rgba(255,255,255,0.15); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; position: relative; overflow: hidden;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="font-size: 3rem;">${baristaEmoji}</div>
                    <div style="flex: 1;">
                        <h2 style="font-size: 1.1rem; font-weight: bold; margin: 0 0 0.5rem 0;">Barista Tip:</h2>
                        <p style="font-size: 0.9rem; margin: 0; line-height: 1.4;">${currentTip}</p>
                    </div>
                </div>
                
                ${this.state.streak >= 3 ? `
                    <div style="position: absolute; bottom: -0.75rem; right: -0.75rem; background: #f97316; width: 6rem; height: 6rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; transform: rotate(12deg);">
                        <div style="text-align: center;">
                            <div style="font-size: 0.7rem;">Streak</div>
                            <div style="font-size: 1.5rem; font-weight: bold;">${this.state.streak} 🔥</div>
                        </div>
                    </div>
                ` : ''}
            </div>

            <!-- Action Buttons Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; flex: 1;">
                <button id="random-challenge-btn" style="padding: 1.5rem; background: #7c3aed; border: none; border-radius: 12px; cursor: pointer; color: white; display: flex; flex-direction: column; align-items: center; text-align: center; transition: all 0.3s ease;">
                    <span style="font-size: 2rem; margin-bottom: 0.5rem;">🎯</span>
                    <span style="font-weight: bold; margin-bottom: 0.25rem;">Random Challenge</span>
                    <span style="font-size: 0.8rem; opacity: 0.9;">Test your skills!</span>
                </button>
                
                <button id="categories-btn" style="padding: 1.5rem; background: #2563eb; border: none; border-radius: 12px; cursor: pointer; color: white; display: flex; flex-direction: column; align-items: center; text-align: center; transition: all 0.3s ease;">
                    <span style="font-size: 2rem; margin-bottom: 0.5rem;">📚</span>
                    <span style="font-weight: bold; margin-bottom: 0.25rem;">Recipe Types</span>
                    <span style="font-size: 0.8rem; opacity: 0.9;">Choose a category</span>
                </button>
                
                <button id="recipes-btn" style="padding: 1.5rem; background: #f59e0b; border: none; border-radius: 12px; cursor: pointer; color: white; display: flex; flex-direction: column; align-items: center; text-align: center; transition: all 0.3s ease;">
                    <span style="font-size: 2rem; margin-bottom: 0.5rem;">📖</span>
                    <span style="font-weight: bold; margin-bottom: 0.25rem;">Recipe Book</span>
                    <span style="font-size: 0.8rem; opacity: 0.9;">Study the recipes</span>
                </button>
                
                <button id="tips-btn" style="padding: 1.5rem; background: #059669; border: none; border-radius: 12px; cursor: pointer; color: white; display: flex; flex-direction: column; align-items: center; text-align: center; transition: all 0.3s ease;">
                    <span style="font-size: 2rem; margin-bottom: 0.5rem;">💡</span>
                    <span style="font-weight: bold; margin-bottom: 0.25rem;">Barista Tips</span>
                    <span style="font-size: 0.8rem; opacity: 0.9;">Helpful advice</span>
                </button>
            </div>

            <!-- Status Footer -->
            <div style="text-align: center; font-size: 0.9rem; opacity: 0.8;">
                <p style="margin: 0;">
                    ${this.state.streak > 0 ? `Current streak: ${this.state.streak} 🔥` : "Start a streak by getting answers right in a row!"}
                </p>
                <p style="margin: 0.25rem 0 0 0; font-size: 0.8rem;">
                    ${this.state.playerLevel < 10 ? `${this.state.playerLevel * 5 - this.state.stars} more stars to level up!` : "You've reached max level!"}
                </p>
            </div>
        `;

        return screen;
    }

    /**
     * Create Categories Screen
     */
    createCategoriesScreen() {
        const screen = document.createElement('div');
        screen.className = 'game-screen categories-screen';
        screen.style.cssText = `
            padding: 1.5rem;
            height: 100%;
            display: flex;
            flex-direction: column;
        `;

        const categories = [
            { id: 'hotDrinks', icon: '☕', name: 'Hot Espresso Drinks', desc: 'Lattes, Cappuccinos & more', color: '#dc2626' },
            { id: 'icedDrinks', icon: '🧊', name: 'Iced Espresso Drinks', desc: 'Cool & refreshing coffee', color: '#0ea5e9' },
            { id: 'frappuccinos', icon: '🥤', name: 'Frappuccinos', desc: 'Blended frozen treats', color: '#7c3aed' },
            { id: 'refreshers', icon: '🍓', name: 'Refreshers', desc: 'Fruity & refreshing', color: '#ec4899' }
        ];

        screen.innerHTML = `
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h1 style="font-size: 1.3rem; font-weight: bold; margin: 0;">Choose a Recipe Type</h1>
                <div style="font-size: 0.9rem; opacity: 0.8;">Level ${this.state.playerLevel} • ${this.state.stars} ⭐</div>
            </div>

            <!-- Categories Grid -->
            <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem; flex: 1;">
                ${categories.map(cat => `
                    <button 
                        id="category-${cat.id}" 
                        data-category="${cat.id}"
                        style="
                            padding: 1.5rem; 
                            background: ${cat.color}; 
                            border: none; 
                            border-radius: 12px; 
                            cursor: pointer; 
                            color: white; 
                            display: flex; 
                            align-items: center; 
                            text-align: left;
                            transition: all 0.3s ease;
                        "
                    >
                        <span style="font-size: 2.5rem; margin-right: 1rem;">${cat.icon}</span>
                        <div>
                            <div style="font-weight: bold; font-size: 1.1rem; margin-bottom: 0.25rem;">${cat.name}</div>
                            <div style="font-size: 0.9rem; opacity: 0.9;">${cat.desc}</div>
                        </div>
                    </button>
                `).join('')}
            </div>

            <!-- Back Button -->
            <button id="back-to-main" style="width: 100%; padding: 1rem; background: rgba(255,255,255,0.2); border: none; border-radius: 12px; cursor: pointer; color: white; font-weight: bold; transition: all 0.3s ease;">
                Back to Menu
            </button>
        `;

        return screen;
    }

    /**
     * Create Challenge Screen
     */
    createChallengeScreen() {
        const screen = document.createElement('div');
        screen.className = 'game-screen challenge-screen';
        screen.style.cssText = `
            padding: 1.5rem;
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
        `;

        const challenge = this.state.currentChallenge;
        if (!challenge) {
            return this.createErrorScreen('No challenge available');
        }

        const drinkData = this.RECIPES[challenge.category][challenge.drink];
        const sizeInfo = this.SIZE_INFO[challenge.size];

        screen.innerHTML = `
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h1 style="font-size: 1.3rem; font-weight: bold; margin: 0;">Barista Challenge</h1>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span>${this.state.streak} 🔥</span>
                    <span>${this.state.stars} ⭐</span>
                </div>
            </div>

            <!-- Challenge Card -->
            <div id="challenge-card" style="
                background: rgba(255,255,255,0.15); 
                padding: 1.5rem; 
                border-radius: 12px; 
                margin-bottom: 1.5rem;
                ${this.state.animation ? `animation: ${this.state.animation} 0.6s ease-out;` : ''}
                ${drinkData.color ? `background-image: linear-gradient(rgba(255,255,255,0.1), rgba(255,255,255,0.1)), linear-gradient(to right, ${drinkData.color}66, transparent);` : ''}
            ">
                <!-- Drink Info -->
                <div style="display: flex; align-items: center; margin-bottom: 1.5rem;">
                    <span style="font-size: 3rem; margin-right: 1rem;">${drinkData.icon}</span>
                    <div>
                        <h2 style="font-size: 1.2rem; font-weight: bold; margin: 0 0 0.25rem 0;">${challenge.drink}</h2>
                        <p style="font-size: 0.9rem; margin: 0; opacity: 0.9;">${sizeInfo.name} (${sizeInfo.oz})</p>
                    </div>
                </div>

                <!-- Description -->
                <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <p style="font-size: 0.9rem; margin: 0;">${drinkData.description}</p>
                    ${!this.state.showResult ? '<p style="font-size: 0.8rem; margin: 0.5rem 0 0 0; font-style: italic;">What goes in this drink?</p>' : ''}
                </div>

                <!-- Input Fields -->
                <div id="recipe-inputs">
                    ${this.createRecipeInputs(challenge, drinkData)}
                </div>
            </div>

            <!-- Action Area -->
            <div id="action-area" style="flex: 1; display: flex; flex-direction: column; justify-content: flex-end;">
                ${this.createChallengeActions()}
            </div>

            <!-- Navigation -->
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button id="main-menu-btn" style="flex: 1; padding: 0.75rem; background: rgba(255,255,255,0.2); border: none; border-radius: 8px; cursor: pointer; color: white; font-weight: bold;">
                    Main Menu
                </button>
                <button id="next-challenge-btn" style="flex: 1; padding: 0.75rem; background: rgba(255,255,255,0.2); border: none; border-radius: 8px; cursor: pointer; color: white; font-weight: bold;">
                    ${this.state.showResult ? 'Next Challenge' : 'Skip'}
                </button>
            </div>

            <style>
                @keyframes correct {
                    0% { transform: scale(1); background-color: rgba(34, 197, 94, 0.2); }
                    50% { transform: scale(1.05); background-color: rgba(34, 197, 94, 0.4); }
                    100% { transform: scale(1); background-color: rgba(34, 197, 94, 0.2); }
                }
                @keyframes wrong {
                    0% { transform: translateX(0); background-color: rgba(239, 68, 68, 0.2); }
                    25% { transform: translateX(-10px); background-color: rgba(239, 68, 68, 0.4); }
                    75% { transform: translateX(10px); background-color: rgba(239, 68, 68, 0.4); }
                    100% { transform: translateX(0); background-color: rgba(239, 68, 68, 0.2); }
                }
            </style>
        `;

        return screen;
    }

    /**
     * Create recipe inputs based on drink type
     */
    createRecipeInputs(challenge, drinkData) {
        let inputs = '';
        
        if (challenge.category === 'hotDrinks' || challenge.category === 'icedDrinks') {
            if (drinkData.shots) {
                inputs += this.createInputField('shots', 'Espresso Shots', '☕', 4);
            }
            if (drinkData.syrup) {
                inputs += this.createInputField('syrup', 'Syrup Pumps', '🍯', 7);
            }
        } else if (challenge.category === 'frappuccinos') {
            if (drinkData.roast) {
                inputs += this.createInputField('roast', 'Frapp Roast', '☕', 4);
            }
            if (drinkData.frappBase) {
                inputs += this.createInputField('frappBase', 'Frapp Base', '🧪', 4);
            }
            if (drinkData.mochaSauce) {
                inputs += this.createInputField('mochaSauce', 'Mocha Sauce', '🍫', 4);
            }
            if (drinkData.caramelSyrup) {
                inputs += this.createInputField('caramelSyrup', 'Caramel Syrup', '🍮', 4);
            }
        } else if (challenge.category === 'refreshers') {
            if (drinkData.inclusion) {
                inputs += this.createInputField('inclusion', 'Fruit Inclusion Scoops', '🍓', 2);
            }
        }

        return `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">${inputs}</div>`;
    }

    /**
     * Create individual input field
     */
    createInputField(field, label, icon, max) {
        const value = this.state.answer[field] || '';
        const disabled = this.state.showResult;
        
        return `
            <div>
                <label style="font-size: 0.9rem; font-weight: bold; display: flex; align-items: center; margin-bottom: 0.5rem;">
                    <span style="margin-right: 0.5rem;">${icon}</span> ${label}:
                </label>
                <input 
                    type="number" 
                    id="input-${field}"
                    min="1"
                    max="${max}"
                    value="${value}"
                    ${disabled ? 'disabled' : ''}
                    style="
                        width: 100%;
                        padding: 0.75rem;
                        background: rgba(255,255,255,0.2);
                        border: 1px solid rgba(255,255,255,0.3);
                        border-radius: 8px;
                        color: white;
                        font-size: 1rem;
                        outline: none;
                        transition: all 0.3s ease;
                        ${disabled ? 'opacity: 0.6; cursor: not-allowed;' : ''}
                    "
                />
            </div>
        `;
    }

    /**
     * Create challenge action buttons
     */
    createChallengeActions() {
        if (!this.state.showResult) {
            return `
                <button id="check-answer-btn" style="
                    width: 100%;
                    padding: 1rem;
                    background: #059669;
                    border: none;
                    border-radius: 12px;
                    cursor: pointer;
                    color: white;
                    font-size: 1.1rem;
                    font-weight: bold;
                    transition: all 0.3s ease;
                ">
                    Make the Drink!
                </button>
            `;
        } else {
            const isCorrect = this.state.isCorrect;
            const drinkData = this.RECIPES[this.state.currentChallenge.category][this.state.currentChallenge.drink];
            
            return `
                <div style="
                    padding: 1.5rem;
                    border-radius: 12px;
                    background: ${isCorrect ? '#059669' : '#dc2626'};
                    text-align: center;
                ">
                    <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
                        <span style="font-size: 3rem; margin-right: 1rem;">${isCorrect ? '🎉' : '😢'}</span>
                        <div>
                            <h3 style="font-size: 1.2rem; font-weight: bold; margin: 0;">${isCorrect ? 'Perfect Drink!' : 'Not Quite Right'}</h3>
                            <p style="font-size: 0.9rem; margin: 0;">${isCorrect ? 'You nailed the recipe!' : 'Let\'s check the recipe...'}</p>
                        </div>
                    </div>

                    ${!isCorrect ? this.createCorrectRecipeDisplay() : ''}
                    
                    ${isCorrect ? `
                        <div style="background: rgba(255,255,255,0.2); padding: 1rem; border-radius: 8px; font-size: 0.9rem;">
                            ${drinkData.funFact}
                        </div>
                    ` : ''}
                </div>
            `;
        }
    }

    /**
     * Create correct recipe display for wrong answers
     */
    createCorrectRecipeDisplay() {
        const challenge = this.state.currentChallenge;
        const drinkData = this.RECIPES[challenge.category][challenge.drink];
        let recipeItems = '';

        const fieldLabels = {
            shots: 'Espresso Shots',
            syrup: 'Syrup Pumps',
            roast: 'Frapp Roast',
            frappBase: 'Frapp Base',
            mochaSauce: 'Mocha Sauce',
            caramelSyrup: 'Caramel Syrup',
            inclusion: 'Fruit Inclusion'
        };

        Object.entries(drinkData).forEach(([field, value]) => {
            if (typeof value === 'object' && value[challenge.size]) {
                const label = fieldLabels[field];
                if (label) {
                    recipeItems += `<li>${label}: ${value[challenge.size]}</li>`;
                }
            }
        });

        return `
            <div style="background: rgba(255,255,255,0.2); padding: 1rem; border-radius: 8px; text-align: left; margin-bottom: 1rem;">
                <p style="font-weight: bold; margin: 0 0 0.5rem 0; font-size: 0.9rem;">Correct Recipe:</p>
                <ul style="margin: 0; padding-left: 1.5rem; font-size: 0.9rem;">
                    ${recipeItems}
                </ul>
            </div>
        `;
    }

    /**
     * Create Recipe Book Screen
     */
    createRecipeBookScreen() {
        const screen = document.createElement('div');
        screen.className = 'game-screen recipes-screen';
        screen.style.cssText = `
            padding: 1.5rem;
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
        `;

        if (!this.state.selectedDrink) {
            // Show category selection
            screen.innerHTML = this.createRecipeCategorySelection();
        } else {
            // Show specific drink recipe
            screen.innerHTML = this.createDrinkRecipeView();
        }

        return screen;
    }

    /**
     * Create recipe category selection
     */
    createRecipeCategorySelection() {
        const categories = [
            { id: 'hotDrinks', name: 'Hot Espresso Drinks', icon: '☕', color: '#dc2626' },
            { id: 'icedDrinks', name: 'Iced Espresso Drinks', icon: '🧊', color: '#0ea5e9' },
            { id: 'frappuccinos', name: 'Frappuccinos', icon: '🥤', color: '#7c3aed' },
            { id: 'refreshers', name: 'Refreshers', icon: '🍓', color: '#ec4899' }
        ];

        return `
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h1 style="font-size: 1.3rem; font-weight: bold; margin: 0;">Recipe Book</h1>
                <div style="font-size: 0.9rem; opacity: 0.8;">Level ${this.state.playerLevel} • ${this.state.stars} ⭐</div>
            </div>

            <!-- Instructions -->
            <div style="background: rgba(255,255,255,0.15); padding: 1rem; border-radius: 8px; margin-bottom: 2rem; text-align: center;">
                <p style="font-size: 0.9rem; margin: 0;">Select a drink type to study the recipes</p>
            </div>

            <!-- Categories -->
            <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem; flex: 1;">
                ${categories.map(cat => `
                    <button 
                        id="recipe-category-${cat.id}" 
                        data-category="${cat.id}"
                        style="
                            padding: 1rem; 
                            background: ${cat.color}aa; 
                            border: none; 
                            border-radius: 12px; 
                            cursor: pointer; 
                            color: white; 
                            display: flex; 
                            align-items: center; 
                            text-align: left;
                            transition: all 0.3s ease;
                        "
                    >
                        <span style="font-size: 2rem; margin-right: 1rem;">${cat.icon}</span>
                        <span style="font-weight: bold; font-size: 1.1rem;">${cat.name}</span>
                    </button>
                `).join('')}
            </div>

            <!-- Back Button -->
            <button id="back-to-main" style="width: 100%; padding: 1rem; background: rgba(255,255,255,0.2); border: none; border-radius: 12px; cursor: pointer; color: white; font-weight: bold;">
                Back to Menu
            </button>
        `;
    }

    /**
     * Create Badges Screen
     */
    createBadgesScreen() {
        const screen = document.createElement('div');
        screen.className = 'game-screen badges-screen';
        screen.style.cssText = `
            padding: 1.5rem;
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
        `;

        const earnedBadges = this.state.badges;
        
        screen.innerHTML = `
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h1 style="font-size: 1.3rem; font-weight: bold; margin: 0;">Your Badges</h1>
                <div style="font-size: 0.9rem; opacity: 0.8;">Level ${this.state.playerLevel} • ${this.state.stars} ⭐</div>
            </div>

            <!-- Badge Progress -->
            <div style="background: rgba(255,255,255,0.15); padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; text-align: center;">
                <p style="font-size: 0.9rem; margin: 0 0 1rem 0;">Collect badges by completing challenges and mastering recipes!</p>
                <p style="font-weight: bold; font-size: 1.1rem; margin: 0;">
                    ${earnedBadges.length} / ${this.BADGE_TYPES.length} Badges Earned
                </p>
            </div>

            <!-- Badges Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem; flex: 1;">
                ${this.BADGE_TYPES.map(badge => {
                    const earned = earnedBadges.includes(badge.id);
                    return `
                        <div style="
                            padding: 1.5rem; 
                            border-radius: 12px; 
                            background: ${earned ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'};
                            text-align: center;
                            transition: all 0.3s ease;
                        ">
                            <div style="font-size: 3rem; margin-bottom: 1rem; ${earned ? '' : 'opacity: 0.4;'}">${badge.icon}</div>
                            <h3 style="font-size: 1rem; font-weight: bold; margin: 0 0 0.5rem 0; ${earned ? '' : 'opacity: 0.6;'}">${badge.name}</h3>
                            <p style="font-size: 0.8rem; margin: 0; ${earned ? '' : 'opacity: 0.6;'}">${badge.description}</p>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Back Button -->
            <button id="back-to-main" style="width: 100%; padding: 1rem; background: rgba(255,255,255,0.2); border: none; border-radius: 12px; cursor: pointer; color: white; font-weight: bold;">
                Back to Menu
            </button>
        `;

        return screen;
    }

    /**
     * Create Error Screen
     */
    createErrorScreen(message = 'An error occurred') {
        const screen = document.createElement('div');
        screen.className = 'game-screen error-screen';
        screen.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            height: 100%;
            text-align: center;
        `;

        screen.innerHTML = `
            <div style="font-size: 4rem; margin-bottom: 1rem;">⚠️</div>
            <h2 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">Oops!</h2>
            <p style="font-size: 1rem; margin-bottom: 2rem; opacity: 0.9;">${message}</p>
            <button id="back-to-main" style="padding: 1rem 2rem; background: #059669; border: none; border-radius: 12px; cursor: pointer; color: white; font-weight: bold;">
                Back to Menu
            </button>
        `;

        return screen;
    }

    // ===========================
    // EVENT HANDLING METHODS
    // ===========================

    /**
     * Setup screen-specific event listeners
     */
    setupScreenListeners(screenElement) {
        // Remove previous listeners (they're automatically removed when DOM is replaced)
        
        // Add new listeners based on screen
        switch (this.state.screen) {
            case 'welcome':
                this.setupWelcomeListeners(screenElement);
                break;
            case 'main':
                this.setupMainListeners(screenElement);
                break;
            case 'categories':
                this.setupCategoriesListeners(screenElement);
                break;
            case 'challenge':
                this.setupChallengeListeners(screenElement);
                break;
            case 'recipes':
                this.setupRecipesListeners(screenElement);
                break;
            case 'badges':
                this.setupBadgesListeners(screenElement);
                break;
        }
    }

    /**
     * Setup welcome screen listeners
     */
    setupWelcomeListeners(screen) {
        const nameInput = screen.querySelector('#player-name-input');
        const startBtn = screen.querySelector('#start-game-btn');

        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.state.playerName = e.target.value;
                
                // Update button state
                if (startBtn) {
                    const hasName = this.state.playerName.trim();
                    startBtn.disabled = !hasName;
                    startBtn.style.opacity = hasName ? '1' : '0.6';
                    startBtn.style.background = hasName ? '#059669' : '#6b7280';
                    startBtn.style.cursor = hasName ? 'pointer' : 'not-allowed';
                }
            });

            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && this.state.playerName.trim()) {
                    this.startGame();
                }
            });
        }

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (this.state.playerName.trim()) {
                    this.startGame();
                }
            });
        }
    }

    /**
     * Setup main screen listeners
     */
    setupMainListeners(screen) {
        const buttons = {
            'badges-btn': () => this.goToBadges(),
            'random-challenge-btn': () => this.startRandomChallenge(),
            'categories-btn': () => this.goToCategories(),
            'recipes-btn': () => this.goToRecipes(),
            'tips-btn': () => this.toggleTips()
        };

        Object.entries(buttons).forEach(([id, handler]) => {
            const btn = screen.querySelector(`#${id}`);
            if (btn) {
                btn.addEventListener('click', handler);
                // Add hover effects
                btn.addEventListener('mouseenter', () => {
                    if (this.animationsEnabled) {
                        btn.style.transform = 'scale(1.05)';
                    }
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.transform = 'scale(1)';
                });
            }
        });
    }

    /**
     * Setup categories screen listeners
     */
    setupCategoriesListeners(screen) {
        // Category buttons
        const categoryButtons = screen.querySelectorAll('[data-category]');
        categoryButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.getAttribute('data-category');
                this.startCategoryChallenge(category);
            });
        });

        // Back button
        const backBtn = screen.querySelector('#back-to-main');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.goToMainMenu());
        }
    }

    /**
     * Setup challenge screen listeners
     */
    setupChallengeListeners(screen) {
        // Input change handlers
        const inputs = screen.querySelectorAll('input[type="number"]');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const field = e.target.id.replace('input-', '');
                this.state.answer[field] = e.target.value;
            });
        });

        // Action buttons
        const checkBtn = screen.querySelector('#check-answer-btn');
        if (checkBtn) {
            checkBtn.addEventListener('click', () => this.checkAnswer());
        }

        const mainMenuBtn = screen.querySelector('#main-menu-btn');
        if (mainMenuBtn) {
            mainMenuBtn.addEventListener('click', () => this.goToMainMenu());
        }

        const nextBtn = screen.querySelector('#next-challenge-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.generateChallenge();
                this.state.animation = '';
                this.render();
            });
        }
    }

    /**
     * Setup recipes screen listeners
     */
    setupRecipesListeners(screen) {
        // Category buttons
        const categoryButtons = screen.querySelectorAll('[data-category]');
        categoryButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.getAttribute('data-category');
                this.state.activeCategory = category;
                this.render();
            });
        });

        // Back button
        const backBtn = screen.querySelector('#back-to-main');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.goToMainMenu());
        }
    }

    /**
     * Setup badges screen listeners
     */
    setupBadgesListeners(screen) {
        const backBtn = screen.querySelector('#back-to-main');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.goToMainMenu());
        }
    }

    // ===========================
    // GAME LOGIC METHODS
    // ===========================

    /**
     * Start the game
     */
    startGame() {
        if (!this.state.playerName.trim()) return;
        
        this.playSound('start');
        this.state.screen = 'main';
        this.saveGameState();
        this.render();
    }

    /**
     * Go to main menu
     */
    goToMainMenu() {
        this.state.screen = 'main';
        this.state.activeCategory = 'all';
        this.state.selectedDrink = null;
        this.render();
    }

    /**
     * Start random challenge
     */
    startRandomChallenge() {
        this.state.activeCategory = 'all';
        this.state.screen = 'challenge';
        this.generateChallenge();
        this.render();
    }

    /**
     * Start challenge for specific category
     */
    startCategoryChallenge(category) {
        this.state.activeCategory = category;
        this.state.screen = 'challenge';
        this.generateChallenge();
        this.render();
    }

    /**
     * Go to categories screen
     */
    goToCategories() {
        this.state.screen = 'categories';
        this.render();
    }

    /**
     * Go to recipes screen
     */
    goToRecipes() {
        this.state.screen = 'recipes';
        this.state.selectedDrink = null;
        this.render();
    }

    /**
     * Go to badges screen
     */
    goToBadges() {
        this.state.screen = 'badges';
        this.render();
    }

    /**
     * Toggle tips display
     */
    toggleTips() {
        this.state.showTip = !this.state.showTip;
        this.showToast(this.getRandomTip(), 'info');
    }

    /**
     * Generate a random challenge
     */
    generateChallenge() {
        // Choose category
        let categories = [];
        if (this.state.activeCategory === 'all') {
            categories = Object.keys(this.RECIPES);
        } else {
            categories = [this.state.activeCategory];
        }

        const randomCat = categories[Math.floor(Math.random() * categories.length)];
        const drinks = Object.keys(this.RECIPES[randomCat]);
        const randomDrink = drinks[Math.floor(Math.random() * drinks.length)];

        // Get available sizes
        let sizes = [];
        if (randomCat === 'hotDrinks') {
            sizes = ['S', 'T', 'G', 'V'];
        } else if (randomCat === 'refreshers') {
            sizes = ['T', 'G', 'V', 'TR'];
        } else {
            sizes = ['T', 'G', 'V'];
        }

        const randomSize = sizes[Math.floor(Math.random() * sizes.length)];

        this.state.currentChallenge = {
            category: randomCat,
            drink: randomDrink,
            size: randomSize
        };

        this.state.answer = {};
        this.state.showResult = false;
        this.state.animation = '';
    }

    /**
     * Check the answer
     */
    checkAnswer() {
        if (!this.state.currentChallenge) return;

        const challenge = this.state.currentChallenge;
        const drinkData = this.RECIPES[challenge.category][challenge.drink];
        let correct = true;

        // Check all relevant fields
        const fieldsToCheck = ['shots', 'syrup', 'roast', 'frappBase', 'mochaSauce', 'caramelSyrup', 'inclusion'];

        fieldsToCheck.forEach(field => {
            if (drinkData[field] && parseInt(this.state.answer[field]) !== drinkData[field][challenge.size]) {
                correct = false;
            }
        });

        this.state.isCorrect = correct;
        this.state.showResult = true;
        this.state.animation = correct ? 'correct' : 'wrong';

        if (correct) {
            this.handleCorrectAnswer();
        } else {
            this.handleWrongAnswer();
        }

        this.render();
    }

    /**
     * Handle correct answer
     */
    handleCorrectAnswer() {
        this.playSound('correct');

        // Update stars
        this.state.stars += 1;

        // Update streak
        this.state.streak += 1;
        if (this.state.streak > this.state.maxStreak) {
            this.state.maxStreak = this.state.streak;
        }

        // Check for level up
        const newLevel = Math.floor(this.state.stars / 5) + 1;
        if (newLevel > this.state.playerLevel) {
            this.state.playerLevel = newLevel;
            this.playSound('levelup');
            this.showToast(`Level Up! You're now level ${newLevel}!`, 'success');
        }

        // Check for new badges
        this.checkForNewBadges();

        // Update completed drinks
        const drinkKey = `${this.state.currentChallenge.category}-${this.state.currentChallenge.drink}`;
        this.state.completedDrinks[drinkKey] = (this.state.completedDrinks[drinkKey] || 0) + 1;

        this.saveGameState();
    }

    /**
     * Handle wrong answer
     */
    handleWrongAnswer() {
        this.playSound('wrong');
        this.state.streak = 0;
        this.saveGameState();
    }

    /**
     * Check for new badges
     */
    checkForNewBadges() {
        const newBadges = [];

        // First star badge
        if (this.state.stars === 1 && !this.state.badges.includes("first_star")) {
            newBadges.push("first_star");
        }

        // Streak badge
        if (this.state.streak === 5 && !this.state.badges.includes("streak_5")) {
            newBadges.push("streak_5");
        }

        // Level badge
        if (this.state.playerLevel === 5 && !this.state.badges.includes("level_5")) {
            newBadges.push("level_5");
        }

        // Category mastery badges
        this.checkCategoryMasteryBadges(newBadges);

        if (newBadges.length > 0) {
            this.state.badges.push(...newBadges);
            this.playSound('badge');
            this.showToast(`New badge${newBadges.length > 1 ? 's' : ''} earned!`, 'success');
        }
    }

    /**
     * Check for category mastery badges
     */
    checkCategoryMasteryBadges(newBadges) {
        const categoryBadges = {
            hotDrinks: 'hot_expert',
            icedDrinks: 'ice_master',
            frappuccinos: 'frapp_wizard'
        };

        Object.entries(categoryBadges).forEach(([category, badgeId]) => {
            if (this.state.badges.includes(badgeId)) return;

            const categoryDrinks = Object.keys(this.RECIPES[category]);
            const completedInCategory = categoryDrinks.filter(drink => 
                this.state.completedDrinks[`${category}-${drink}`]
            ).length;

            if (completedInCategory === categoryDrinks.length) {
                newBadges.push(badgeId);
            }
        });
    }

    // ===========================
    // HELPER METHODS
    // ===========================

    /**
     * Get barista emoji based on current state
     */
    getBaristaEmoji() {
        if (this.state.isCorrect) return "😄";
        if (this.state.showResult && !this.state.isCorrect) return "😢";
        return "😊";
    }

    /**
     * Get current tip based on level
     */
    getCurrentTip() {
        return this.BARISTA_TIPS[Math.min(this.state.playerLevel - 1, this.BARISTA_TIPS.length - 1)];
    }

    /**
     * Get random tip
     */
    getRandomTip() {
        return this.BARISTA_TIPS[Math.floor(Math.random() * this.BARISTA_TIPS.length)];
    }

    /**
     * Play sound effect
     */
    playSound(type) {
        if (!this.soundEnabled) return;

        // Sound effect placeholders - implement with Web Audio API or audio files
        console.log(`🎵 Playing ${type} sound`);
        
        // You can add actual sound implementation here
        switch (type) {
            case 'correct':
                this.playTone(800, 100);
                break;
            case 'wrong':
                this.playTone(300, 200);
                break;
            case 'levelup':
                this.playTone(600, 100);
                setTimeout(() => this.playTone(800, 100), 150);
                break;
            case 'badge':
                this.playTone(900, 150);
                break;
        }
    }

    /**
     * Play simple tone using Web Audio API
     */
    playTone(frequency, duration) {
        if (!this.soundEnabled || typeof AudioContext === 'undefined') return;

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration / 1000);
        } catch (error) {
            console.warn('Could not play sound:', error);
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);
        
        // Simple toast implementation
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#3b82f6'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            font-weight: bold;
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Setup accessibility features
     */
    setupAccessibility(screenElement) {
        // Set proper ARIA labels and roles
        const buttons = screenElement.querySelectorAll('button');
        buttons.forEach(button => {
            if (!button.getAttribute('aria-label') && button.textContent) {
                button.setAttribute('aria-label', button.textContent.trim());
            }
        });

        // Set focus to first interactive element
        const firstInteractive = screenElement.querySelector('button, input');
        if (firstInteractive) {
            setTimeout(() => firstInteractive.focus(), 100);
        }
    }

    /**
     * Handle arrow navigation for accessibility
     */
    handleArrowNavigation(key) {
        // Implement arrow key navigation for better accessibility
        // This is a placeholder for more complex navigation logic
    }

    /**
     * Animation control methods
     */
    pauseAnimations() {
        this.animationsEnabled = false;
    }

    resumeAnimations() {
        this.animationsEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /**
     * Save game state to localStorage
     */
    saveGameState() {
        try {
            const gameState = {
                playerName: this.state.playerName,
                playerLevel: this.state.playerLevel,
                stars: this.state.stars,
                streak: this.state.streak,
                maxStreak: this.state.maxStreak,
                badges: this.state.badges,
                completedDrinks: this.state.completedDrinks
            };
            localStorage.setItem('starbucksGameState', JSON.stringify(gameState));
        } catch (error) {
            console.warn('Could not save game state:', error);
        }
    }

    /**
     * Load game state from localStorage
     */
    loadGameState() {
        try {
            const saved = localStorage.getItem('starbucksGameState');
            if (saved) {
                const gameState = JSON.parse(saved);
                Object.assign(this.state, gameState);
                console.log('🎮 Game state loaded');
            }
        } catch (error) {
            console.warn('Could not load game state:', error);
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        this.showToast(message, 'error');
    }

    /**
     * Cleanup and destroy the game
     */
    destroy() {
        if (this.isDestroyed) return;

        console.log('🧹 Cleaning up Starbucks Game');

        // Remove all event listeners
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];

        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }

        // Save final state
        this.saveGameState();

        // Mark as destroyed
        this.isDestroyed = true;
        this.isInitialized = false;

        console.log('✅ Starbucks Game cleanup complete');
    }

    /**
     * Get game info for external integration
     */
    getGameInfo() {
        return {
            name: 'Starbucks Barista Adventure',
            version: '1.0',
            isInitialized: this.isInitialized,
            currentScreen: this.state.screen,
            playerLevel: this.state.playerLevel,
            stars: this.state.stars,
            badges: this.state.badges.length
        };
    }
}

// Global game instance management
window.StarbucksGame = StarbucksGame;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StarbucksGame;
}

// Game factory function for easy integration
window.createStarbucksGame = function(container) {
    return new StarbucksGame(container);
};

// Auto-cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.currentStarbucksGame) {
        window.currentStarbucksGame.destroy();
    }
});

console.log('🎮 StarbucksGame.js loaded successfully');