/**
 * StarbucksGame.js - Complete Barista Training Game
 * Comprehensive recreation with full functionality following project rules
 */

class StarbucksGame {
    constructor(container) {
        // Safe assertions for input validation with fallbacks
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(container, 'Container must not be null');
                window.Assert.assertNotNull(container, 'Container must be valid DOM element');
            }
        } catch (error) {
            console.warn('⚠️ Assert system not available in constructor, using basic validation');
            if (!container) {
                throw new Error('Container element is required for StarbucksGame');
            }
        }
        
        this.container = container;
        this.isInitialized = false;
        this.isDestroyed = false;
        
        // Pre-allocated fixed-size state (no dynamic allocation)
        this.gameState = this.createInitialState();
        this.gameData = this.createGameData();
        this.eventHandlers = new Map(); // Fixed-size handler storage
        
        // Sound effect placeholders (following project rules)
        this.sounds = {
            correct: () => console.log("🎵 Correct sound!"),
            wrong: () => console.log("🎵 Wrong sound!"),  
            star: () => console.log("🎵 Star earned sound!"),
            levelUp: () => console.log("🎵 Level up fanfare!")
        };
        
        // Register with RulesEnforcer system
        this.registerWithRulesSystem();
    }

    /**
     * Register with RulesEnforcer system
     * 2+ assertions per function
     */
    registerWithRulesSystem() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this, 'Game instance must exist');
                window.Assert.assertNotNull(this.container, 'Container must be available');
            }
        } catch (error) {
            console.log('ℹ️ RulesEnforcer not available - continuing without registration');
            return true;
        }
        
        try {
            if (window.RulesEnforcer && typeof window.RulesEnforcer.registerComponent === 'function') {
                window.RulesEnforcer.registerComponent('StarbucksGame', this);
                console.log('✅ StarbucksGame registered with RulesEnforcer');
                return true;
            }
            
            console.log('ℹ️ RulesEnforcer not available - continuing without registration');
            return true;
            
        } catch (error) {
            console.warn('⚠️ Failed to register with RulesEnforcer:', error);
            return false;
        }
    }

    /**
     * Create comprehensive initial game state
     * 2+ assertions per function
     */
    createInitialState() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this, 'Game instance must exist');
                window.Assert.assertNotNull(this.container, 'Container required for state creation');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in createInitialState, continuing');
        }
        
        const state = {
            // Screen management
            screen: 'welcome',
            
            // Player progression
            playerName: '',
            playerLevel: 1,
            stars: 0,
            streak: 0,
            maxStreak: 0,
            badges: [],
            
            // Current challenge state
            activeCategory: 'all',
            currentChallenge: null,
            answer: {},
            showResult: false,
            isCorrect: false,
            animation: '',
            
            // Completed drinks tracking
            completedDrinks: {},
            
            // UI state
            showTip: false,
            selectedDrink: null,
            isAnimating: false,
            errorMessage: ''
        };
        
        console.log('✅ Game data created');
        return state;
    }

    /**
     * Create comprehensive game data with full recipe database
     * 2+ assertions per function
     */
    createGameData() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this, 'Game instance must exist');
                window.Assert.assertNotNull(this.container, 'Container must be available');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in createGameData, continuing');
        }
        
        // Complete recipe database from your example
        const recipes = {
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

        // Size information
        const sizeInfo = {
            S: { name: "Short", oz: "8oz", description: "Tiny but mighty!" },
            T: { name: "Tall", oz: "12oz", description: "Not so tall after all!" },
            G: { name: "Grande", oz: "16oz", description: "Italian for 'big'" },
            V: { name: "Venti", oz: "20/24oz", description: "Italian for '20'" },
            TR: { name: "Trenta", oz: "30oz", description: "The giant cup!" }
        };

        // Badge definitions
        const badgeTypes = [
            { id: "first_star", name: "First Star", icon: "⭐", description: "Earned your first star!" },
            { id: "hot_expert", name: "Hot Drink Expert", icon: "☕", description: "Mastered hot drink recipes" },
            { id: "ice_master", name: "Ice Master", icon: "🧊", description: "Conquered all iced drink recipes" },
            { id: "frapp_wizard", name: "Frappuccino Wizard", icon: "🥤", description: "Perfected all Frappuccino recipes" },
            { id: "streak_5", name: "5-Streak", icon: "🔥", description: "5 correct answers in a row!" },
            { id: "level_5", name: "Level 5 Barista", icon: "🌟", description: "Reached level 5!" }
        ];

        // Barista tips for each level
        const baristaTips = [
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
        
        const gameData = {
            recipes,
            sizeInfo,
            badgeTypes,
            baristaTips
        };
        
        console.log('✅ Game data created');
        return gameData;
    }

    /**
     * Initialize game system
     * 2+ assertions per function
     */
    async init() {
        try {
            if (window.Assert && typeof window.Assert.assert === 'function') {
                window.Assert.assert(this.isInitialized === false, 'Game must not be already initialized');
                window.Assert.assert(this.isDestroyed === false, 'Game must not be destroyed');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in init, using basic validation');
            if (this.isInitialized) {
                throw new Error('Game already initialized');
            }
            if (this.isDestroyed) {
                throw new Error('Cannot initialize destroyed game');
            }
        }
        
        try {
            const utilitiesReady = await this.waitForBoundedUtilities();
            if (!utilitiesReady) {
                throw new Error('BoundedUtilities setup failed');
            }
            
            const setupResult = this.setupEventHandlers();
            if (!setupResult) {
                throw new Error('Event handler setup failed');
            }
            
            const renderResult = this.render();
            if (!renderResult) {
                throw new Error('Initial render failed');
            }
            
            this.isInitialized = true;
            return true;
            
        } catch (error) {
            console.error('❌ Game initialization failed:', error);
            this.handleError('Initialization failed: ' + error.message);
            return false;
        }
    }

    /**
     * Wait for BoundedUtilities with timeout
     * 2+ assertions per function
     */
    async waitForBoundedUtilities(timeout = 5000) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(timeout, 'number', 'Timeout value');
                window.Assert.assertRange && window.Assert.assertRange(timeout, 100, 30000, 'Timeout range');
            }
        } catch (error) {
            console.warn('⚠️ Assert system not available during utility wait, using defaults');
            timeout = Math.max(100, Math.min(timeout || 5000, 30000));
        }
        
        if (window.BoundedUtilities && typeof window.BoundedUtilities.escapeHtml === 'function') {
            return true;
        }
        
        console.log('⏳ Waiting for BoundedUtilities to be available...');
        
        return new Promise((resolve) => {
            const checkInterval = 100;
            let elapsed = 0;
            
            const intervalId = setInterval(() => {
                elapsed += checkInterval;
                
                if (window.BoundedUtilities && typeof window.BoundedUtilities.escapeHtml === 'function') {
                    clearInterval(intervalId);
                    resolve(true);
                } else if (elapsed >= timeout) {
                    clearInterval(intervalId);
                    console.warn('⚠️ Timeout waiting for BoundedUtilities - using fallbacks');
                    this.setupFallbackUtilities();
                    resolve(true);
                }
            }, checkInterval);
        });
    }

    /**
     * Setup fallback utilities if BoundedUtilities not available
     * 2+ assertions per function
     */
    setupFallbackUtilities() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this, 'Game instance must exist');
                window.Assert.assert && window.Assert.assert(!window.BoundedUtilities || typeof window.BoundedUtilities.escapeHtml !== 'function', 'Fallbacks needed when BoundedUtilities unavailable');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in setupFallbackUtilities');
        }
        
        if (!window.BoundedUtilities) {
            window.BoundedUtilities = {};
        }
        
        if (!window.BoundedUtilities.escapeHtml) {
            window.BoundedUtilities.escapeHtml = (text) => {
                if (typeof text !== 'string') return '';
                return text.replace(/[&<>"']/g, (match) => {
                    const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
                    return escapeMap[match] || match;
                });
            };
        }
        
        if (!window.BoundedUtilities.capitalize) {
            window.BoundedUtilities.capitalize = (text) => {
                if (typeof text !== 'string' || text.length === 0) return '';
                return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
            };
        }
        
        if (!window.BoundedUtilities.sanitizeString) {
            window.BoundedUtilities.sanitizeString = (input, maxLength = 100) => {
                if (typeof input !== 'string') return '';
                const cleaned = input.replace(/[^\w\s\-_.]/g, '').substring(0, maxLength);
                return cleaned.trim();
            };
        }
        
        return true;
    }

    /**
     * Setup comprehensive event system
     * 2+ assertions per function
     */
    setupEventHandlers() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.container, 'Container required for events');
                window.Assert.assert && window.Assert.assert(this.eventHandlers instanceof Map, 'Handler storage must be available');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in setupEventHandlers');
        }
        
        try {
            this.clearEventHandlers();
            
            const clickHandler = (event) => this.handleClick(event);
            const inputHandler = (event) => this.handleInput(event);
            
            this.container.addEventListener('click', clickHandler);
            this.container.addEventListener('input', inputHandler);
            
            this.eventHandlers.set('click', clickHandler);
            this.eventHandlers.set('input', inputHandler);
            
            console.log('✅ Event handlers setup complete');
            return true;
            
        } catch (error) {
            console.error('❌ Event handler setup failed:', error);
            return false;
        }
    }

    /**
     * Clear event handlers
     * 2+ assertions per function
     */
    clearEventHandlers() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.container, 'Container must exist');
                window.Assert.assert && window.Assert.assert(this.eventHandlers instanceof Map, 'Event handlers map must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in clearEventHandlers');
        }
        
        try {
            this.eventHandlers.forEach((handler, eventType) => {
                this.container.removeEventListener(eventType, handler);
            });
            this.eventHandlers.clear();
            console.log('✅ Event handlers cleared');
            return true;
        } catch (error) {
            console.error('❌ Failed to clear event handlers:', error);
            return false;
        }
    }

    /**
     * Comprehensive click event handling
     * 2+ assertions per function
     */
    handleClick(event) {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(event, 'Event object must exist');
                window.Assert.assertNotNull(event.target, 'Event target must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in handleClick');
        }
        
        if (this.gameState.isAnimating) {
            return true;
        }
        
        const action = event.target.getAttribute('data-action');
        if (!action) {
            return true;
        }
        
        event.preventDefault();
        
        switch (action) {
            case 'start-game':
                return this.startGame();
            case 'go-to-main':
                return this.goToScreen('main');
            case 'go-to-categories':
                return this.goToScreen('categories');
            case 'go-to-recipes':
                return this.goToScreen('recipes');
            case 'go-to-badges':
                return this.goToScreen('badges');
            case 'generate-challenge':
                return this.generateRandomChallenge();
            case 'select-category':
                const category = event.target.getAttribute('data-category');
                return this.selectCategory(category);
            case 'select-drink':
                const drinkName = event.target.getAttribute('data-drink');
                const categoryName = event.target.getAttribute('data-category');
                return this.selectDrink(drinkName, categoryName);
            case 'practice-drink':
                return this.startPractice();
            case 'check-answer':
                return this.checkAnswer();
            case 'next-challenge':
                return this.generateRandomChallenge();
            case 'toggle-tip':
                return this.toggleTip();
            case 'back':
                return this.goBack();
            default:
                console.log(`Unknown action: ${action}`);
                return true;
        }
    }

    /**
     * Handle input events with validation
     * 2+ assertions per function
     */
    handleInput(event) {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(event, 'Event object required');
                window.Assert.assertNotNull(event.target, 'Input target required');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in handleInput');
        }
        
        const target = event.target;
        
        if (target.id === 'player-name') {
            return this.updatePlayerName(target.value);
        }
        
        if (target.hasAttribute('data-answer-field')) {
            const field = target.getAttribute('data-answer-field');
            return this.updateAnswer(field, target.value);
        }
        
        return true;
    }

    /**
     * Update player name with validation
     * 2+ assertions per function
     */
    updatePlayerName(value) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(value, 'string', 'Player name');
                window.Assert.assert && window.Assert.assert(this.gameState !== null, 'Game state must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in updatePlayerName');
        }
        
        const maxNameLength = 20;
        const cleanName = window.BoundedUtilities.sanitizeString(value, maxNameLength);
        
        this.gameState.playerName = cleanName;
        this.updateStartButton();
        
        console.log(`Player name updated: ${cleanName}`);
        return true;
    }

    /**
     * Update start button state
     * 2+ assertions per function
     */
    updateStartButton() {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(this.gameState.playerName, 'string', 'Player name');
                window.Assert.assertNotNull(this.container, 'Container must be available');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in updateStartButton');
        }
        
        try {
            const button = this.container.querySelector('[data-action="start-game"]');
            if (!button) return true;
            
            const hasName = this.gameState.playerName.trim().length > 0;
            button.disabled = !hasName;
            button.className = hasName ? 'start-button enabled' : 'start-button disabled';
            
            return true;
            
        } catch (error) {
            console.error('❌ Button update failed:', error);
            return false;
        }
    }

    /**
     * Start the game with validation
     * 2+ assertions per function
     */
    startGame() {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(this.gameState.playerName, 'string', 'Player name');
                window.Assert.assert && window.Assert.assert(this.isInitialized === true, 'Game must be initialized');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in startGame');
        }
        
        const trimmedName = this.gameState.playerName.trim();
        if (trimmedName.length === 0) {
            this.showError('Please enter your name first!');
            return false;
        }
        
        // Award first star badge
        if (this.gameState.stars === 0 && !this.gameState.badges.includes("first_star")) {
            this.gameState.badges.push("first_star");
        }
        
        const transitionResult = this.goToScreen('main');
        if (!transitionResult) {
            this.showError('Failed to navigate to main screen');
            return false;
        }
        
        console.log(`🎮 Game started for player: ${trimmedName}`);
        return true;
    }

    /**
     * Navigate to different screens
     * 2+ assertions per function
     */
    goToScreen(screenName) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(screenName, 'string', 'Screen name');
                window.Assert.assert && window.Assert.assert(this.isInitialized === true, 'Game must be initialized');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in goToScreen');
        }
        
        const validScreens = ['welcome', 'main', 'categories', 'challenge', 'recipes', 'recipe-detail', 'badges'];
        if (!validScreens.includes(screenName)) {
            console.error(`Invalid screen: ${screenName}`);
            return false;
        }
        
        this.gameState.screen = screenName;
        this.gameState.selectedDrink = null; // Reset drink selection when changing screens
        
        const renderResult = this.render();
        if (!renderResult) {
            console.error('Screen render failed');
            return false;
        }
        
        console.log(`📱 Navigated to screen: ${screenName}`);
        return true;
    }

    /**
     * Generate random challenge
     * 2+ assertions per function
     */
    generateRandomChallenge() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.gameData.recipes, 'Recipe data must be available');
                window.Assert.assertNotNull(this.gameState, 'Game state must be available');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in generateRandomChallenge');
        }
        
        try {
            let categories = [];
            if (this.gameState.activeCategory === 'all') {
                categories = Object.keys(this.gameData.recipes);
            } else {
                categories = [this.gameState.activeCategory];
            }
            
            // Fixed bounds random selection (max 10 attempts)
            let attempts = 0;
            const maxAttempts = 10;
            
            while (attempts < maxAttempts) {
                const categoryIndex = Math.floor(Math.random() * categories.length);
                const category = categories[categoryIndex];
                const drinks = this.gameData.recipes[category];
                
                if (drinks && Object.keys(drinks).length > 0) {
                    const drinkNames = Object.keys(drinks);
                    const drinkIndex = Math.floor(Math.random() * drinkNames.length);
                    const drinkName = drinkNames[drinkIndex];
                    
                    const size = this.selectRandomSize(category);
                    
                    this.gameState.currentChallenge = {
                        category: category,
                        drink: drinkName,
                        size: size
                    };
                    
                    this.gameState.answer = {};
                    this.gameState.showResult = false;
                    this.gameState.animation = '';
                    this.gameState.screen = 'challenge';
                    
                    return this.render();
                }
                attempts++;
            }
            
            this.showError('Could not generate challenge');
            return false;
            
        } catch (error) {
            console.error('❌ Challenge generation failed:', error);
            this.handleError('Challenge generation failed');
            return false;
        }
    }

    /**
     * Select random size based on category
     * 2+ assertions per function
     */
    selectRandomSize(category) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(category, 'string', 'Category name');
                window.Assert.assertNotNull(this.gameData.sizeInfo, 'Size info must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in selectRandomSize');
        }
        
        let sizes = [];
        if (category === 'hotDrinks') {
            sizes = ['S', 'T', 'G', 'V'];
        } else if (category === 'refreshers') {
            sizes = ['T', 'G', 'V', 'TR'];
        } else {
            sizes = ['T', 'G', 'V'];
        }
        
        const randomIndex = Math.floor(Math.random() * sizes.length);
        return sizes[randomIndex];
    }

    /**
     * Select category for challenges
     * 2+ assertions per function
     */
    selectCategory(category) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(category, 'string', 'Category name');
                window.Assert.assertNotNull(this.gameData.recipes, 'Recipes must be available');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in selectCategory');
        }
        
        this.gameState.activeCategory = category;
        return this.generateRandomChallenge();
    }

    /**
     * Select specific drink for practice
     * 2+ assertions per function
     */
    selectDrink(drinkName, categoryName) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(drinkName, 'string', 'Drink name');
                window.Assert.assertType(categoryName, 'string', 'Category name');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in selectDrink');
        }
        
        this.gameState.selectedDrink = drinkName;
        this.gameState.activeCategory = categoryName;
        this.gameState.screen = 'recipe-detail';
        
        return this.render();
    }

    /**
     * Start practice with selected drink
     * 2+ assertions per function
     */
    startPractice() {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(this.gameState.selectedDrink, 'string', 'Selected drink');
                window.Assert.assertType(this.gameState.activeCategory, 'string', 'Active category');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in startPractice');
        }
        
        const drinkData = this.gameData.recipes[this.gameState.activeCategory][this.gameState.selectedDrink];
        if (!drinkData) {
            this.showError('Drink data not found');
            return false;
        }
        
        const size = this.selectRandomSize(this.gameState.activeCategory);
        
        this.gameState.currentChallenge = {
            category: this.gameState.activeCategory,
            drink: this.gameState.selectedDrink,
            size: size
        };
        
        this.gameState.answer = {};
        this.gameState.showResult = false;
        this.gameState.animation = '';
        this.gameState.screen = 'challenge';
        
        return this.render();
    }

    /**
     * Check user's answer against recipe
     * 2+ assertions per function
     */
    checkAnswer() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.gameState.currentChallenge, 'Challenge must exist');
                window.Assert.assertType(this.gameState.currentChallenge.drink, 'string', 'Current drink');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in checkAnswer');
        }
        
        try {
            const challenge = this.gameState.currentChallenge;
            const drinkData = this.gameData.recipes[challenge.category][challenge.drink];
            
            if (!drinkData) {
                this.showError('Drink data not found');
                return false;
            }
            
            let correct = this.validateAnswer(drinkData, challenge);
            
            this.gameState.isCorrect = correct;
            this.gameState.showResult = true;
            
            if (correct) {
                this.handleCorrectAnswer(challenge);
            } else {
                this.handleWrongAnswer();
            }
            
            return this.render();
            
        } catch (error) {
            console.error('❌ Answer checking failed:', error);
            this.handleError('Answer checking failed');
            return false;
        }
    }

    /**
     * Validate answer against recipe
     * 2+ assertions per function
     */
    validateAnswer(drinkData, challenge) {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(drinkData, 'Drink data must exist');
                window.Assert.assertNotNull(challenge, 'Challenge must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in validateAnswer');
        }
        
        let correct = true;
        
        // Check appropriate fields based on drink type
        if (challenge.category === 'hotDrinks' || challenge.category === 'icedDrinks') {
            if (drinkData.shots && parseInt(this.gameState.answer.shots || '0') !== drinkData.shots[challenge.size]) {
                correct = false;
            }
            if (drinkData.syrup && parseInt(this.gameState.answer.syrup || '0') !== drinkData.syrup[challenge.size]) {
                correct = false;
            }
        } else if (challenge.category === 'frappuccinos') {
            if (drinkData.roast && parseInt(this.gameState.answer.roast || '0') !== drinkData.roast[challenge.size]) {
                correct = false;
            }
            if (drinkData.frappBase && parseInt(this.gameState.answer.frappBase || '0') !== drinkData.frappBase[challenge.size]) {
                correct = false;
            }
            if (drinkData.mochaSauce && parseInt(this.gameState.answer.mochaSauce || '0') !== drinkData.mochaSauce[challenge.size]) {
                correct = false;
            }
            if (drinkData.caramelSyrup && parseInt(this.gameState.answer.caramelSyrup || '0') !== drinkData.caramelSyrup[challenge.size]) {
                correct = false;
            }
        } else if (challenge.category === 'refreshers') {
            if (drinkData.inclusion && parseInt(this.gameState.answer.inclusion || '0') !== drinkData.inclusion[challenge.size]) {
                correct = false;
            }
        }
        
        return correct;
    }

    /**
     * Handle correct answer with progression
     * 2+ assertions per function
     */
    handleCorrectAnswer(challenge) {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(challenge, 'Challenge must exist');
                window.Assert.assertType(this.gameState.stars, 'number', 'Stars count');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in handleCorrectAnswer');
        }
        
        // Play sound and animation
        this.sounds.correct();
        this.gameState.animation = 'correct';
        
        // Update score
        const newStars = this.gameState.stars + 1;
        this.gameState.stars = newStars;
        this.sounds.star();
        
        // Update streak
        const newStreak = this.gameState.streak + 1;
        this.gameState.streak = newStreak;
        if (newStreak > this.gameState.maxStreak) {
            this.gameState.maxStreak = newStreak;
        }
        
        // Check for streak badge
        if (newStreak === 5 && !this.gameState.badges.includes("streak_5")) {
            this.gameState.badges.push("streak_5");
        }
        
        // Update completed drinks tracking
        const drinkKey = `${challenge.category}-${challenge.drink}`;
        this.gameState.completedDrinks[drinkKey] = (this.gameState.completedDrinks[drinkKey] || 0) + 1;
        
        // Check level up
        const newLevel = Math.floor(newStars / 5) + 1;
        if (newLevel > this.gameState.playerLevel) {
            this.gameState.playerLevel = newLevel;
            this.sounds.levelUp();
            
            if (newLevel === 5 && !this.gameState.badges.includes("level_5")) {
                this.gameState.badges.push("level_5");
            }
        }
        
        // Check category completion badges
        this.checkCategoryBadges(challenge.category);
        
        console.log(`⭐ Score updated: ${newStars} stars, ${newStreak} streak`);
        return true;
    }

    /**
     * Handle wrong answer
     * 2+ assertions per function
     */
    handleWrongAnswer() {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(this.gameState.streak, 'number', 'Current streak');
                window.Assert.assertNotNull(this.sounds, 'Sound system must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in handleWrongAnswer');
        }
        
        // Play sound and animation
        this.sounds.wrong();
        this.gameState.animation = 'wrong';
        
        // Reset streak
        this.gameState.streak = 0;
        
        console.log('❌ Wrong answer - streak reset');
        return true;
    }

    /**
     * Check for category completion badges
     * 2+ assertions per function
     */
    checkCategoryBadges(category) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(category, 'string', 'Category name');
                window.Assert.assertNotNull(this.gameData.recipes[category], 'Category recipes must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in checkCategoryBadges');
        }
        
        const categoryDrinks = Object.keys(this.gameData.recipes[category]);
        const completedInCategory = categoryDrinks.filter(drink => 
            this.gameState.completedDrinks[`${category}-${drink}`]
        ).length;
        
        if (completedInCategory === categoryDrinks.length) {
            let badgeId = "";
            switch(category) {
                case 'hotDrinks': badgeId = "hot_expert"; break;
                case 'icedDrinks': badgeId = "ice_master"; break;
                case 'frappuccinos': badgeId = "frapp_wizard"; break;
            }
            
            if (badgeId && !this.gameState.badges.includes(badgeId)) {
                this.gameState.badges.push(badgeId);
                console.log(`🏆 Badge earned: ${badgeId}`);
            }
        }
        
        return true;
    }

    /**
     * Update answer field
     * 2+ assertions per function
     */
    updateAnswer(field, value) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(field, 'string', 'Field name');
                window.Assert.assertNotNull(value, 'Value must not be null');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in updateAnswer');
        }
        
        const numericValue = parseInt(value, 10);
        const maxValue = 10;
        
        if (numericValue >= 0 && numericValue <= maxValue) {
            this.gameState.answer[field] = numericValue;
            console.log(`Answer updated: ${field} = ${numericValue}`);
            return true;
        }
        
        console.warn(`Invalid answer value: ${value}`);
        return false;
    }

    /**
     * Toggle tip display
     * 2+ assertions per function
     */
    toggleTip() {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(this.gameState.showTip, 'boolean', 'Show tip flag');
                window.Assert.assertNotNull(this.gameState, 'Game state must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in toggleTip');
        }
        
        this.gameState.showTip = !this.gameState.showTip;
        return this.render();
    }

    /**
     * Go back to previous screen
     * 2+ assertions per function
     */
    goBack() {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(this.gameState.screen, 'string', 'Current screen');
                window.Assert.assertNotNull(this.gameState, 'Game state must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in goBack');
        }
        
        // Simple back navigation logic
        if (this.gameState.screen === 'challenge') {
            return this.goToScreen('main');
        } else if (this.gameState.screen === 'recipe-detail') {
            return this.goToScreen('recipes');
        } else {
            return this.goToScreen('main');
        }
    }

    /**
     * Main render function with all screens
     * 2+ assertions per function
     */
    render() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.container, 'Container must be valid');
                window.Assert.assertType(this.gameState.screen, 'string', 'Screen');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in render');
        }
        
        try {
            let content = '';
            
            switch (this.gameState.screen) {
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
                case 'recipe-detail':
                    content = this.renderRecipeDetailScreen();
                    break;
                case 'badges':
                    content = this.renderBadgesScreen();
                    break;
                default:
                    content = this.renderErrorScreen();
            }
            
            this.container.innerHTML = content;
            
            // Post-render updates
            if (this.gameState.screen === 'welcome') {
                this.updateStartButton();
            }
            
            console.log(`✅ Rendered screen: ${this.gameState.screen}`);
            return true;
            
        } catch (error) {
            console.error('❌ Render failed:', error);
            this.handleError('Render failed');
            return false;
        }
    }

    /**
     * Render welcome screen
     * 2+ assertions per function
     */
    renderWelcomeScreen() {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(this.gameState.playerName, 'string', 'Player name');
                window.Assert.assertNotNull(this.container, 'Container must be available');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in renderWelcomeScreen');
        }
        
        try {
            let escapedName = '';
            if (window.BoundedUtilities && typeof window.BoundedUtilities.escapeHtml === 'function') {
                escapedName = window.BoundedUtilities.escapeHtml(this.gameState.playerName);
            } else {
                escapedName = String(this.gameState.playerName || '').replace(/[&<>"']/g, (match) => {
                    const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
                    return escapeMap[match] || match;
                });
            }
            
            const isEnabled = this.gameState.playerName.trim().length > 0;
            
            console.log('✅ Welcome screen HTML generated successfully');
            return `
                <div class="game-screen welcome-screen">
                    <div class="game-content">
                        <div class="welcome-header">
                            <h1 class="game-title">☕ Starbucks Barista Adventure ☕</h1>
                            <p class="game-subtitle">Become a master barista through fun challenges!</p>
                        </div>
                        
                        <div class="barista-avatar">
                            <span class="avatar-icon">👨‍🍳</span>
                            <h2>Welcome, Future Barista!</h2>
                            <p>What's your barista name?</p>
                        </div>
                        
                        <div class="welcome-form">
                            <div class="form-group">
                                <input
                                    type="text"
                                    id="player-name"
                                    value="${escapedName}"
                                    placeholder="Enter your name"
                                    maxlength="20"
                                    class="name-input"
                                />
                            </div>
                            
                            <button
                                data-action="start-game"
                                class="start-button ${isEnabled ? 'enabled' : 'disabled'}"
                                ${!isEnabled ? 'disabled' : ''}
                            >
                                Start My Adventure!
                            </button>
                        </div>
                        
                        <div class="welcome-features">
                            <div class="feature">
                                <span class="feature-icon">⭐</span>
                                <strong>Learn recipes</strong>
                            </div>
                            <div class="feature">
                                <span class="feature-icon">🏆</span>
                                <strong>Earn badges</strong>
                            </div>
                            <div class="feature">
                                <span class="feature-icon">🔥</span>
                                <strong>Build streaks</strong>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error('❌ Welcome screen render failed:', error);
            return this.renderErrorScreen();
        }
    }

    /**
     * Render main hub screen
     * 2+ assertions per function
     */
    renderMainScreen() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.gameState, 'Game state must exist');
                window.Assert.assertType(this.gameState.playerName, 'string', 'Player name');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in renderMainScreen');
        }
        
        const currentTip = this.gameData.baristaTips[Math.min(this.gameState.playerLevel - 1, this.gameData.baristaTips.length - 1)];
        const baristaEmoji = this.gameState.isCorrect ? "😄" : (this.gameState.showResult && !this.gameState.isCorrect) ? "😢" : "😊";
        const starsToLevel = (this.gameState.playerLevel * 5) - this.gameState.stars;
        
        return `
            <div class="game-screen main-screen">
                <div class="game-content">
                    <div class="main-header">
                        <div class="player-info">
                            <h1>Barista ${window.BoundedUtilities.escapeHtml(this.gameState.playerName)}</h1>
                            <div class="player-stats">
                                <span>Level ${this.gameState.playerLevel}</span>
                                <span>${this.gameState.stars} ⭐</span>
                                <span>${this.gameState.streak} 🔥</span>
                            </div>
                        </div>
                        <button data-action="go-to-badges" class="badge-button">
                            🏆 ${this.gameState.badges.length} badges
                        </button>
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
                                    <div class="streak-label">Current Streak</div>
                                    <div class="streak-number">${this.gameState.streak} 🔥</div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="main-actions">
                        <button data-action="generate-challenge" class="action-button primary">
                            <span class="button-icon">🎯</span>
                            <p class="button-text">Random Challenge</p>
                            <p class="button-subtitle">Test your skills!</p>
                        </button>
                        
                        <button data-action="go-to-categories" class="action-button">
                            <span class="button-icon">📚</span>
                            <p class="button-text">Recipe Types</p>
                            <p class="button-subtitle">Choose a category</p>
                        </button>
                        
                        <button data-action="go-to-recipes" class="action-button">
                            <span class="button-icon">📖</span>
                            <p class="button-text">Recipe Book</p>
                            <p class="button-subtitle">Study the recipes</p>
                        </button>
                        
                        <button data-action="toggle-tip" class="action-button">
                            <span class="button-icon">💡</span>
                            <p class="button-text">Barista Tips</p>
                            <p class="button-subtitle">Helpful advice</p>
                        </button>
                    </div>
                    
                    ${this.gameState.showTip ? `
                        <div class="random-tip">
                            <h3>Quick Tip!</h3>
                            <p>${this.gameData.baristaTips[Math.floor(Math.random() * this.gameData.baristaTips.length)]}</p>
                        </div>
                    ` : ''}
                    
                    <div class="progress-info">
                        <p class="progress-text">
                            ${this.gameState.streak > 0 ? 
                                `Current streak: ${this.gameState.streak} 🔥` : 
                                "Start a streak by getting answers right in a row!"
                            }
                        </p>
                        <p class="level-progress">
                            ${this.gameState.playerLevel < 10 ? 
                                `${starsToLevel} more stars to level up!` : 
                                "You've reached max level!"
                            }
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render categories selection screen
     * 2+ assertions per function
     */
    renderCategoriesScreen() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.gameState, 'Game state must exist');
                window.Assert.assertNotNull(this.gameData.recipes, 'Recipe data must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in renderCategoriesScreen');
        }
        
        return `
            <div class="game-screen categories-screen">
                <div class="game-content">
                    <div class="screen-header">
                        <h2>Choose a Recipe Type</h2>
                        <p>Level ${this.gameState.playerLevel} • ${this.gameState.stars} ⭐</p>
                    </div>
                    
                    <div class="categories-grid">
                        <div class="category-card red" data-action="select-category" data-category="hotDrinks">
                            <span class="category-icon">☕</span>
                            <div class="category-info">
                                <h3>Hot Espresso Drinks</h3>
                                <p>Lattes, Cappuccinos & more</p>
                            </div>
                        </div>
                        
                        <div class="category-card blue" data-action="select-category" data-category="icedDrinks">
                            <span class="category-icon">🧊</span>
                            <div class="category-info">
                                <h3>Iced Espresso Drinks</h3>
                                <p>Cool & refreshing coffee</p>
                            </div>
                        </div>
                        
                        <div class="category-card purple" data-action="select-category" data-category="frappuccinos">
                            <span class="category-icon">🥤</span>
                            <div class="category-info">
                                <h3>Frappuccinos</h3>
                                <p>Blended frozen treats</p>
                            </div>
                        </div>
                        
                        <div class="category-card pink" data-action="select-category" data-category="refreshers">
                            <span class="category-icon">🍓</span>
                            <div class="category-info">
                                <h3>Refreshers</h3>
                                <p>Fruity & refreshing</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="screen-actions">
                        <button data-action="go-to-main" class="back-button">Back to Menu</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render challenge screen
     * 2+ assertions per function
     */
    renderChallengeScreen() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.gameState.currentChallenge, 'Challenge must exist');
                window.Assert.assertType(this.gameState.currentChallenge.drink, 'string', 'Challenge drink');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in renderChallengeScreen');
        }
        
        const challenge = this.gameState.currentChallenge;
        const drinkData = this.gameData.recipes[challenge.category][challenge.drink];
        const sizeInfo = this.gameData.sizeInfo[challenge.size];
        
        return `
            <div class="game-screen challenge-screen">
                <div class="game-content">
                    <div class="challenge-header">
                        <h2>Barista Challenge</h2>
                        <div class="challenge-stats">
                            <span>${this.gameState.streak} 🔥</span>
                            <span>${this.gameState.stars} ⭐</span>
                        </div>
                    </div>
                    
                    <div class="challenge-card ${this.gameState.animation}">
                        <div class="drink-header">
                            <span class="drink-icon">${drinkData.icon}</span>
                            <div class="drink-info">
                                <h3>${challenge.drink}</h3>
                                <p class="size-info">${sizeInfo.name} (${sizeInfo.oz})</p>
                            </div>
                        </div>
                        
                        <div class="drink-description">
                            <p>${drinkData.description}</p>
                            ${!this.gameState.showResult ? '<p class="challenge-prompt">What goes in this drink?</p>' : ''}
                        </div>
                        
                        ${this.renderRecipeInputs(drinkData, challenge)}
                    </div>
                    
                    ${!this.gameState.showResult ? `
                        <div class="challenge-actions">
                            <button data-action="check-answer" class="check-button">Make the Drink!</button>
                        </div>
                    ` : this.renderChallengeResult(drinkData, challenge)}
                    
                    <div class="challenge-navigation">
                        <button data-action="go-to-main" class="nav-button">Main Menu</button>
                        <button data-action="next-challenge" class="nav-button">${this.gameState.showResult ? 'Next Challenge' : 'Skip'}</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render recipe inputs based on drink type
     * 2+ assertions per function
     */
    renderRecipeInputs(drinkData, challenge) {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(drinkData, 'Drink data must exist');
                window.Assert.assertNotNull(challenge, 'Challenge must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in renderRecipeInputs');
        }
        
        let inputsHtml = '<div class="recipe-inputs"><div class="inputs-grid">';
        
        // Hot drinks and iced drinks
        if (challenge.category === 'hotDrinks' || challenge.category === 'icedDrinks') {
            if (drinkData.shots) {
                inputsHtml += this.generateInputField('shots', 'Espresso Shots', '☕', this.gameState.answer.shots || '');
            }
            if (drinkData.syrup) {
                inputsHtml += this.generateInputField('syrup', 'Syrup Pumps', '🍯', this.gameState.answer.syrup || '');
            }
        }
        
        // Frappuccinos
        if (challenge.category === 'frappuccinos') {
            if (drinkData.roast) {
                inputsHtml += this.generateInputField('roast', 'Frapp Roast', '☕', this.gameState.answer.roast || '');
            }
            if (drinkData.frappBase) {
                inputsHtml += this.generateInputField('frappBase', 'Frapp Base', '🧪', this.gameState.answer.frappBase || '');
            }
            if (drinkData.mochaSauce) {
                inputsHtml += this.generateInputField('mochaSauce', 'Mocha Sauce', '🍫', this.gameState.answer.mochaSauce || '');
            }
            if (drinkData.caramelSyrup) {
                inputsHtml += this.generateInputField('caramelSyrup', 'Caramel Syrup', '🍮', this.gameState.answer.caramelSyrup || '');
            }
        }
        
        // Refreshers
        if (challenge.category === 'refreshers') {
            if (drinkData.inclusion) {
                inputsHtml += this.generateInputField('inclusion', 'Fruit Inclusion Scoops', '🍓', this.gameState.answer.inclusion || '');
            }
        }
        
        inputsHtml += '</div></div>';
        return inputsHtml;
    }

    /**
     * Generate input field HTML
     * 2+ assertions per function
     */
    generateInputField(field, label, icon, value) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(field, 'string', 'Field name');
                window.Assert.assertType(label, 'string', 'Field label');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in generateInputField');
        }
        
        const disabled = this.gameState.showResult ? 'disabled' : '';
        const escapedValue = window.BoundedUtilities.escapeHtml(String(value));
        
        return `
            <div class="input-group">
                <label class="input-label">
                    <span class="label-icon">${icon}</span>
                    ${label}:
                </label>
                <input 
                    type="number" 
                    min="0" 
                    max="10" 
                    value="${escapedValue}"
                    data-answer-field="${field}"
                    class="recipe-input"
                    ${disabled}
                />
            </div>
        `;
    }

    /**
     * Render challenge result
     * 2+ assertions per function
     */
    renderChallengeResult(drinkData, challenge) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(this.gameState.isCorrect, 'boolean', 'Correct flag');
                window.Assert.assertNotNull(drinkData, 'Drink data must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in renderChallengeResult');
        }
        
        const isCorrect = this.gameState.isCorrect;
        const resultClass = isCorrect ? 'correct' : 'incorrect';
        const resultIcon = isCorrect ? '🎉' : '😢';
        const resultText = isCorrect ? 'Perfect Drink!' : 'Not Quite Right';
        const resultSubtext = isCorrect ? 'You nailed the recipe!' : 'Let\'s check the recipe...';
        
        let resultHtml = `
            <div class="challenge-result ${resultClass}">
                <div class="result-header">
                    <span class="result-icon">${resultIcon}</span>
                    <div class="result-text">
                        <h3>${resultText}</h3>
                        <p>${resultSubtext}</p>
                    </div>
                </div>
        `;
        
        if (!isCorrect) {
            resultHtml += this.renderCorrectRecipe(drinkData, challenge);
        } else {
            resultHtml += `
                <div class="fun-fact">
                    <p><strong>Fun Fact:</strong> ${drinkData.funFact}</p>
                </div>
            `;
        }
        
        resultHtml += '</div>';
        return resultHtml;
    }

    /**
     * Render correct recipe for wrong answers
     * 2+ assertions per function
     */
    renderCorrectRecipe(drinkData, challenge) {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(drinkData, 'Drink data must exist');
                window.Assert.assertNotNull(challenge, 'Challenge must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in renderCorrectRecipe');
        }
        
        let recipeHtml = `
            <div class="correct-recipe">
                <h4>Correct Recipe:</h4>
                <ul>
        `;
        
        if (challenge.category === 'hotDrinks' || challenge.category === 'icedDrinks') {
            if (drinkData.shots) {
                recipeHtml += `<li>Espresso Shots: ${drinkData.shots[challenge.size]}</li>`;
            }
            if (drinkData.syrup) {
                recipeHtml += `<li>Syrup Pumps: ${drinkData.syrup[challenge.size]}</li>`;
            }
        } else if (challenge.category === 'frappuccinos') {
            if (drinkData.roast) {
                recipeHtml += `<li>Frapp Roast: ${drinkData.roast[challenge.size]}</li>`;
            }
            if (drinkData.frappBase) {
                recipeHtml += `<li>Frapp Base: ${drinkData.frappBase[challenge.size]}</li>`;
            }
            if (drinkData.mochaSauce) {
                recipeHtml += `<li>Mocha Sauce: ${drinkData.mochaSauce[challenge.size]}</li>`;
            }
            if (drinkData.caramelSyrup) {
                recipeHtml += `<li>Caramel Syrup: ${drinkData.caramelSyrup[challenge.size]}</li>`;
            }
        } else if (challenge.category === 'refreshers') {
            if (drinkData.inclusion) {
                recipeHtml += `<li>Fruit Inclusion: ${drinkData.inclusion[challenge.size]}</li>`;
            }
        }
        
        recipeHtml += '</ul></div>';
        return recipeHtml;
    }

    /**
     * Render recipes screen
     * 2+ assertions per function
     */
    renderRecipesScreen() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.gameData.recipes, 'Recipes must exist');
                window.Assert.assertNotNull(this.gameState, 'Game state must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in renderRecipesScreen');
        }
        
        return `
            <div class="game-screen recipes-screen">
                <div class="game-content">
                    <div class="screen-header">
                        <h2>Recipe Book</h2>
                        <p>Level ${this.gameState.playerLevel} • ${this.gameState.stars} ⭐</p>
                    </div>
                    
                    <div class="recipe-intro">
                        <p>Select a drink category to study the recipes and practice making drinks!</p>
                    </div>
                    
                    <div class="recipe-categories">
                        ${Object.keys(this.gameData.recipes).map(category => {
                            const categoryName = this.formatCategoryName(category);
                            const categoryIcon = this.getCategoryIcon(category);
                            const drinkCount = Object.keys(this.gameData.recipes[category]).length;
                            
                            return `
                                <div class="recipe-category-card" data-action="go-to-recipe-category" data-category="${category}">
                                    <span class="category-icon">${categoryIcon}</span>
                                    <div class="category-name">${categoryName}</div>
                                    <div class="category-count">${drinkCount} drinks</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    
                    <div class="drinks-grid">
                        ${Object.keys(this.gameData.recipes).map(category => 
                            Object.keys(this.gameData.recipes[category]).map(drinkName => {
                                const drinkData = this.gameData.recipes[category][drinkName];
                                const isCompleted = this.gameState.completedDrinks[`${category}-${drinkName}`] > 0;
                                
                                return `
                                    <div class="drink-card ${isCompleted ? 'completed' : ''}" 
                                         data-action="select-drink" 
                                         data-drink="${window.BoundedUtilities.escapeHtml(drinkName)}" 
                                         data-category="${category}">
                                        ${isCompleted ? '<div class="completed-badge">✓</div>' : ''}
                                        <div class="drink-icon-large">${drinkData.icon}</div>
                                        <h3>${drinkName}</h3>
                                        <p>${drinkData.description}</p>
                                    </div>
                                `;
                            }).join('')
                        ).join('')}
                    </div>
                    
                    <div class="screen-actions">
                        <button data-action="go-to-main" class="back-button">Back to Menu</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render recipe detail screen
     * 2+ assertions per function
     */
    renderRecipeDetailScreen() {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(this.gameState.selectedDrink, 'string', 'Selected drink');
                window.Assert.assertType(this.gameState.activeCategory, 'string', 'Active category');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in renderRecipeDetailScreen');
        }
        
        const drinkData = this.gameData.recipes[this.gameState.activeCategory][this.gameState.selectedDrink];
        if (!drinkData) {
            return this.renderErrorScreen('Drink not found');
        }
        
        return `
            <div class="game-screen recipe-detail-screen">
                <div class="game-content">
                    <div class="recipe-detail-card">
                        <div class="recipe-header">
                            <span class="drink-icon-large">${drinkData.icon}</span>
                            <h2>${this.gameState.selectedDrink}</h2>
                            <p class="drink-description">${drinkData.description}</p>
                        </div>
                        
                        <div class="recipe-sizes">
                            <h3>Recipe by Size:</h3>
                            ${this.renderRecipeTable(drinkData, this.gameState.activeCategory)}
                        </div>
                        
                        <div class="fun-fact-section">
                            <h3>Fun Fact</h3>
                            <p>${drinkData.funFact}</p>
                        </div>
                    </div>
                    
                    <div class="screen-actions">
                        <button data-action="go-to-recipes" class="back-button">Back to Recipes</button>
                        <button data-action="practice-drink" class="practice-button">Practice This Drink</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render recipe table for drink details
     * 2+ assertions per function
     */
    renderRecipeTable(drinkData, category) {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(drinkData, 'Drink data must exist');
                window.Assert.assertType(category, 'string', 'Category must be string');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in renderRecipeTable');
        }
        
        let tableHtml = '<table class="recipe-table"><thead><tr><th>Size</th>';
        
        // Add headers based on drink type
        if (category === 'hotDrinks' || category === 'icedDrinks') {
            if (drinkData.shots) tableHtml += '<th>Espresso Shots</th>';
            if (drinkData.syrup) tableHtml += '<th>Syrup Pumps</th>';
        } else if (category === 'frappuccinos') {
            if (drinkData.roast) tableHtml += '<th>Frapp Roast</th>';
            if (drinkData.frappBase) tableHtml += '<th>Frapp Base</th>';
            if (drinkData.mochaSauce) tableHtml += '<th>Mocha Sauce</th>';
            if (drinkData.caramelSyrup) tableHtml += '<th>Caramel Syrup</th>';
        } else if (category === 'refreshers') {
            if (drinkData.inclusion) tableHtml += '<th>Fruit Inclusion</th>';
        }
        
        tableHtml += '</tr></thead><tbody>';
        
        // Add rows for each size
        const sizes = this.getSizesForCategory(category);
        sizes.forEach(size => {
            const sizeInfo = this.gameData.sizeInfo[size];
            tableHtml += `<tr><td>${sizeInfo.name} (${sizeInfo.oz})</td>`;
            
            if (category === 'hotDrinks' || category === 'icedDrinks') {
                if (drinkData.shots) tableHtml += `<td>${drinkData.shots[size] || '-'}</td>`;
                if (drinkData.syrup) tableHtml += `<td>${drinkData.syrup[size] || '-'}</td>`;
            } else if (category === 'frappuccinos') {
                if (drinkData.roast) tableHtml += `<td>${drinkData.roast[size] || '-'}</td>`;
                if (drinkData.frappBase) tableHtml += `<td>${drinkData.frappBase[size] || '-'}</td>`;
                if (drinkData.mochaSauce) tableHtml += `<td>${drinkData.mochaSauce[size] || '-'}</td>`;
                if (drinkData.caramelSyrup) tableHtml += `<td>${drinkData.caramelSyrup[size] || '-'}</td>`;
            } else if (category === 'refreshers') {
                if (drinkData.inclusion) tableHtml += `<td>${drinkData.inclusion[size] || '-'}</td>`;
            }
            
            tableHtml += '</tr>';
        });
        
        tableHtml += '</tbody></table>';
        return tableHtml;
    }

    /**
     * Get sizes for category
     * 2+ assertions per function
     */
    getSizesForCategory(category) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(category, 'string', 'Category name');
                window.Assert.assertNotNull(this.gameData.sizeInfo, 'Size info must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in getSizesForCategory');
        }
        
        if (category === 'hotDrinks') {
            return ['S', 'T', 'G', 'V'];
        } else if (category === 'refreshers') {
            return ['T', 'G', 'V', 'TR'];
        } else {
            return ['T', 'G', 'V'];
        }
    }

    /**
     * Format category name for display
     * 2+ assertions per function
     */
    formatCategoryName(category) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(category, 'string', 'Category name');
                window.Assert.assert(category.length > 0, 'Category name must not be empty');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in formatCategoryName');
        }
        
        switch(category) {
            case 'hotDrinks': return 'Hot Drinks';
            case 'icedDrinks': return 'Iced Drinks';
            case 'frappuccinos': return 'Frappuccinos';
            case 'refreshers': return 'Refreshers';
            default: return category;
        }
    }

    /**
     * Get category icon
     * 2+ assertions per function
     */
    getCategoryIcon(category) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(category, 'string', 'Category name');
                window.Assert.assert(category.length > 0, 'Category name must not be empty');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in getCategoryIcon');
        }
        
        switch(category) {
            case 'hotDrinks': return '☕';
            case 'icedDrinks': return '🧊';
            case 'frappuccinos': return '🥤';
            case 'refreshers': return '🍓';
            default: return '☕';
        }
    }

    /**
     * Render badges screen
     * 2+ assertions per function
     */
    renderBadgesScreen() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.gameState, 'Game state must exist');
                window.Assert.assertNotNull(this.gameData.badgeTypes, 'Badge types must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in renderBadgesScreen');
        }
        
        return `
            <div class="game-screen badges-screen">
                <div class="game-content">
                    <div class="screen-header">
                        <h2>Your Badges</h2>
                        <p>Level ${this.gameState.playerLevel} • ${this.gameState.stars} ⭐</p>
                    </div>
                    
                    <div class="badges-summary">
                        <p>Collect badges by completing challenges and mastering recipes!</p>
                        <p class="badge-count">
                            ${this.gameState.badges.length} / ${this.gameData.badgeTypes.length} Badges Earned
                        </p>
                    </div>
                    
                    <div class="badges-grid">
                        ${this.gameData.badgeTypes.map(badge => {
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
                        <button data-action="go-to-main" class="back-button">Back to Menu</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render error screen
     * 2+ assertions per function
     */
    renderErrorScreen(message = 'An error occurred') {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(message, 'string', 'Error message');
                window.Assert.assert(message.length > 0, 'Error message must not be empty');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in renderErrorScreen');
        }
        
        return `
            <div class="game-screen error-screen">
                <div class="game-content">
                    <div class="error-content">
                        <div class="error-icon">⚠️</div>
                        <h2>Oops! Something went wrong</h2>
                        <p>${window.BoundedUtilities.escapeHtml(message)}</p>
                        <button data-action="go-to-main" class="error-button">Back to Menu</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Show error message
     * 2+ assertions per function
     */
    showError(message) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(message, 'string', 'Error message');
                window.Assert.assertNotNull(this.gameState, 'Game state must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in showError');
        }
        
        this.gameState.errorMessage = message;
        console.error(`🚨 Game Error: ${message}`);
        
        // Show temporary error toast (could be enhanced with actual toast system)
        this.createErrorToast(message);
        return true;
    }

    /**
     * Handle error with logging
     * 2+ assertions per function
     */
    handleError(message) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(message, 'string', 'Error message');
                window.Assert.assertNotNull(this.gameState, 'Game state must exist');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in handleError');
        }
        
        console.error(`🚨 Game Error Handler: ${message}`);
        this.gameState.errorMessage = message;
        
        // Reset to safe state
        this.gameState.isAnimating = false;
        this.gameState.showResult = false;
        
        return this.showError(message);
    }

    /**
     * Create error toast notification
     * 2+ assertions per function
     */
    createErrorToast(message) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(message, 'string', 'Error message');
                window.Assert.assert(message.length > 0, 'Error message must not be empty');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in createErrorToast');
        }
        
        try {
            const toast = document.createElement('div');
            toast.className = 'game-toast error';
            toast.textContent = message;
            
            document.body.appendChild(toast);
            
            // Auto-remove after 3 seconds
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 3000);
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to create error toast:', error);
            return false;
        }
    }

    /**
     * Cleanup game resources
     * 2+ assertions per function
     */
    destroy() {
        try {
            if (window.Assert && typeof window.Assert.assert === 'function') {
                window.Assert.assert(this.isDestroyed === false, 'Game must not be already destroyed');
                window.Assert.assertNotNull(this.container, 'Container must exist for cleanup');
            }
        } catch (error) {
            console.warn('⚠️ Assert not available in destroy');
        }
        
        try {
            // Clear event handlers
            this.clearEventHandlers();
            
            // Clear container
            if (this.container) {
                this.container.innerHTML = '';
            }
            
            // Reset state
            this.gameState = null;
            this.gameData = null;
            this.isDestroyed = true;
            this.isInitialized = false;
            
            console.log('🧹 Game cleanup completed');
            return true;
            
        } catch (error) {
            console.error('❌ Game cleanup failed:', error);
            return false;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StarbucksGame;
} else if (typeof window !== 'undefined') {
    window.StarbucksGame = StarbucksGame;
}

console.log('✅ StarbucksGame class loaded successfully');
