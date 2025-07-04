/**
 * StarbucksGame - Interactive Barista Training Game
 * Vanilla JavaScript implementation for seamless integration with PageManager
 * 
 * Features:
 * - Educational drink recipe challenges
 * - Progressive difficulty and leveling system
 * - Badge collection and achievements
 * - Multiple game screens and navigation
 * - Responsive design and accessibility
 * - Memory management and cleanup
 */
class StarbucksGame {
    /**
     * Initialize the Starbucks Barista Game
     * @param {HTMLElement} container - Container element for the game
     */
    constructor(container) {
        if (!container) {
            throw new Error('Game container is required');
        }

        this.container = container;
        this.isInitialized = false;
        this.eventListeners = [];
        this.intervals = [];
        this.timeouts = [];

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
            maxLevel: 10,
            starsPerLevel: 5,
            badgeUnlockConditions: {
                first_star: (state) => state.stars >= 1,
                hot_expert: (state) => this.getCategoryCompletionCount('hotDrinks') >= 4,
                ice_master: (state) => this.getCategoryCompletionCount('icedDrinks') >= 3,
                frapp_wizard: (state) => this.getCategoryCompletionCount('frappuccinos') >= 3,
                streak_5: (state) => state.streak >= 5,
                level_5: (state) => state.playerLevel >= 5
            }
        };

        this.initializeData();
    }

    /**
     * Initialize game data and constants
     */
    initializeData() {
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

        // Size information
        this.sizeInfo = {
            S: { name: "Short", oz: "8oz", description: "Tiny but mighty!" },
            T: { name: "Tall", oz: "12oz", description: "Not so tall after all!" },
            G: { name: "Grande", oz: "16oz", description: "Italian for 'big'" },
            V: { name: "Venti", oz: "20/24oz", description: "Italian for '20'" },
            TR: { name: "Trenta", oz: "30oz", description: "The giant cup!" }
        };

        // Badge types
        this.badgeTypes = [
            { id: "first_star", name: "First Star", icon: "⭐", description: "Earned your first star!" },
            { id: "hot_expert", name: "Hot Drink Expert", icon: "☕", description: "Mastered hot drink recipes" },
            { id: "ice_master", name: "Ice Master", icon: "🧊", description: "Conquered all iced drink recipes" },
            { id: "frapp_wizard", name: "Frappuccino Wizard", icon: "🥤", description: "Perfected all Frappuccino recipes" },
            { id: "streak_5", name: "5-Streak", icon: "🔥", description: "5 correct answers in a row!" },
            { id: "level_5", name: "Level 5 Barista", icon: "🌟", description: "Reached level 5!" }
        ];

        // Barista tips
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
    }

    /**
     * Initialize the game
     */
    async init() {
        try {
            console.log('🎮 Initializing Starbucks Barista Game...');
            
            this.container.className = 'starbucks-game-container';
            this.container.style.cssText = `
                width: 100%;
                height: 500px;
                background: #f8fafc;
                border-radius: 12px;
                overflow: hidden;
                position: relative;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;

            // Add game styles
            this.injectStyles();

            // Load saved game state
            this.loadGameState();

            // Render initial screen
            this.render();

            // Set up event listeners
            this.setupEventListeners();

            this.isInitialized = true;
            console.log('✅ Starbucks Barista Game initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize Starbucks Barista Game:', error);
            this.handleInitError(error);
        }
    }

    /**
     * Inject game-specific styles
     */
    injectStyles() {
        const styleId = 'starbucks-game-styles';
        if (document.getElementById(styleId)) return;

        const styles = `
            <style id="${styleId}">
                .starbucks-game-container * {
                    box-sizing: border-box;
                }

                .game-screen {
                    width: 100%;
                    height: 100%;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    max-width: 600px;
                    margin: 0 auto;
                    overflow-y: auto;
                }

                .game-button {
                    padding: 0.75rem 1.5rem;
                    border: none;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    font-size: 0.9rem;
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

                .game-input {
                    padding: 0.75rem;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.1);
                    color: inherit;
                    font-size: 1rem;
                    transition: border-color 0.3s ease;
                }

                .game-input:focus {
                    outline: none;
                    border-color: rgba(255, 255, 255, 0.8);
                }

                .game-input::placeholder {
                    color: rgba(255, 255, 255, 0.6);
                }

                .game-grid {
                    display: grid;
                    gap: 0.75rem;
                }

                .game-grid-2 { grid-template-columns: repeat(2, 1fr); }
                .game-grid-1 { grid-template-columns: 1fr; }

                .game-card {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 1rem;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    transition: all 0.3s ease;
                }

                .game-card:hover {
                    background: rgba(255, 255, 255, 0.15);
                    transform: translateY(-2px);
                }

                .badge-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 0.75rem;
                }

                .badge-item {
                    display: flex;
                    align-items: center;
                    padding: 0.75rem;
                    border-radius: 12px;
                    gap: 0.75rem;
                }

                .badge-earned {
                    background: rgba(255, 255, 255, 0.2);
                }

                .badge-locked {
                    background: rgba(0, 0, 0, 0.2);
                    opacity: 0.6;
                }

                .challenge-container {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 1rem;
                    margin-bottom: 1rem;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }

                .result-success {
                    background: rgba(34, 197, 94, 0.2) !important;
                    border-color: rgba(34, 197, 94, 0.5) !important;
                    animation: successPulse 0.6s ease-out;
                }

                .result-error {
                    background: rgba(239, 68, 68, 0.2) !important;
                    border-color: rgba(239, 68, 68, 0.5) !important;
                    animation: errorShake 0.5s ease-out;
                }

                @keyframes successPulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.02); }
                    100% { transform: scale(1); }
                }

                @keyframes errorShake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }

                .streak-indicator {
                    position: absolute;
                    top: -0.5rem;
                    right: -0.5rem;
                    background: #f59e0b;
                    color: white;
                    padding: 0.25rem 0.5rem;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: bold;
                    transform: rotate(12deg);
                }

                .progress-bar {
                    width: 100%;
                    height: 8px;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 4px;
                    overflow: hidden;
                    margin: 0.5rem 0;
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #10b981, #059669);
                    border-radius: 4px;
                    transition: width 0.5s ease;
                }

                /* Responsive design */
                @media (max-width: 480px) {
                    .game-screen {
                        padding: 1rem;
                    }
                    
                    .game-grid-2 {
                        grid-template-columns: 1fr;
                    }
                    
                    .badge-grid {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Main click handler with event delegation
        const clickHandler = (event) => this.handleClick(event);
        this.container.addEventListener('click', clickHandler);
        this.eventListeners.push({ element: this.container, type: 'click', handler: clickHandler });

        // Input change handler
        const changeHandler = (event) => this.handleInputChange(event);
        this.container.addEventListener('input', changeHandler);
        this.eventListeners.push({ element: this.container, type: 'input', handler: changeHandler });

        // Keyboard navigation
        const keyHandler = (event) => this.handleKeyboard(event);
        this.container.addEventListener('keydown', keyHandler);
        this.eventListeners.push({ element: this.container, type: 'keydown', handler: keyHandler });
    }

    /**
     * Handle click events
     */
    handleClick(event) {
        const target = event.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const params = target.dataset.params ? JSON.parse(target.dataset.params) : {};

        this.executeAction(action, params, target);
    }

    /**
     * Handle input changes
     */
    handleInputChange(event) {
        const target = event.target;
        if (!target.dataset.field) return;

        const field = target.dataset.field;
        const value = target.value;

        if (field.startsWith('answer.')) {
            const answerField = field.replace('answer.', '');
            this.updateState({
                answer: { ...this.state.answer, [answerField]: value }
            });
        } else {
            this.updateState({ [field]: value });
        }
    }

    /**
     * Handle keyboard events
     */
    handleKeyboard(event) {
        // Handle escape key to go back
        if (event.key === 'Escape' && this.state.screen !== 'welcome') {
            this.goToMainMenu();
        }

        // Handle enter key on buttons
        if (event.key === 'Enter' && event.target.dataset.action) {
            event.target.click();
        }
    }

    /**
     * Execute game actions
     */
    executeAction(action, params, element) {
        switch (action) {
            case 'start-game':
                this.startGame();
                break;
            case 'go-to-screen':
                this.goToScreen(params.screen);
                break;
            case 'start-challenge':
                this.startChallenge(params.category);
                break;
            case 'check-answer':
                this.checkAnswer();
                break;
            case 'generate-challenge':
                this.generateChallenge();
                break;
            case 'select-drink':
                this.selectDrink(params.category, params.drink);
                break;
            case 'practice-drink':
                this.practiceDrink();
                break;
            case 'toggle-tip':
                this.toggleTip();
                break;
            case 'main-menu':
                this.goToMainMenu();
                break;
            default:
                console.warn('Unknown action:', action);
        }
    }

    /**
     * Update game state and re-render
     */
    updateState(updates) {
        this.state = { ...this.state, ...updates };
        this.saveGameState();
        this.render();
    }

    /**
     * Render the current screen
     */
    render() {
        if (!this.isInitialized) return;

        const screen = this.state.screen;
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

        this.container.innerHTML = content;
    }

    /**
     * Render welcome screen
     */
    renderWelcomeScreen() {
        return `
            <div class="game-screen" style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); color: white; text-align: center;">
                <div style="margin-bottom: 2rem;">
                    <h1 style="font-size: 2rem; margin-bottom: 1rem; font-weight: bold;">☕ Starbucks Barista Adventure ☕</h1>
                    <p style="font-size: 1.1rem; opacity: 0.9;">Become a master barista through fun challenges!</p>
                </div>
                
                <div class="game-card" style="margin-bottom: 2rem; text-align: center;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">👨‍🍳</div>
                    <h2 style="font-size: 1.5rem; margin-bottom: 1rem; font-weight: bold;">Welcome, Future Barista!</h2>
                    <p style="margin-bottom: 1.5rem; opacity: 0.9;">What's your barista name?</p>
                    
                    <input 
                        type="text" 
                        class="game-input" 
                        data-field="playerName"
                        placeholder="Enter your name"
                        value="${this.state.playerName}"
                        style="width: 100%; margin-bottom: 1.5rem; text-align: center; background: rgba(255, 255, 255, 0.2); color: white;"
                    />
                    
                    <button 
                        class="game-button" 
                        data-action="start-game"
                        ${!this.state.playerName.trim() ? 'disabled' : ''}
                        style="width: 100%; background: #10b981; color: white; font-size: 1.1rem; padding: 1rem;"
                    >
                        Start My Adventure!
                    </button>
                </div>
                
                <div style="opacity: 0.8; font-size: 0.9rem;">
                    <p>Learn recipes • Earn stars • Collect badges</p>
                    <p>Become the ultimate Starbucks barista!</p>
                </div>
            </div>
        `;
    }

    /**
     * Render main menu screen
     */
    renderMainScreen() {
        const currentTip = this.baristaTips[Math.min(this.state.playerLevel - 1, this.baristaTips.length - 1)];
        const baristaEmoji = this.getBaristaEmoji();
        const progressToNextLevel = ((this.state.stars % this.config.starsPerLevel) / this.config.starsPerLevel) * 100;

        return `
            <div class="game-screen" style="background: linear-gradient(135deg, #047857 0%, #10b981 100%); color: white;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <div>
                        <h1 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem;">Barista ${this.state.playerName}</h1>
                        <p style="opacity: 0.9;">Level ${this.state.playerLevel} • ${this.state.stars} ⭐</p>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressToNextLevel}%;"></div>
                        </div>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="font-size: 0.9rem;">${this.state.badges.length} badges</span>
                        <button class="game-button" data-action="go-to-screen" data-params='{"screen":"badges"}' 
                                style="background: #f59e0b; color: white; padding: 0.5rem; border-radius: 50%; width: 3rem; height: 3rem;">
                            🏆
                        </button>
                    </div>
                </div>

                <!-- Barista Tips Card -->
                <div class="game-card" style="margin-bottom: 1.5rem; position: relative;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="font-size: 4rem;">${baristaEmoji}</div>
                        <div style="flex: 1;">
                            <h2 style="font-weight: bold; margin-bottom: 0.5rem;">Barista Tip:</h2>
                            <p style="font-size: 0.9rem; opacity: 0.9;">${currentTip}</p>
                        </div>
                    </div>
                    
                    ${this.state.streak >= 3 ? `
                        <div class="streak-indicator">
                            <div style="text-align: center;">
                                <div style="font-size: 0.7rem;">Streak</div>
                                <div style="font-weight: bold;">${this.state.streak} 🔥</div>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Main Actions -->
                <div class="game-grid game-grid-2" style="margin-bottom: 1.5rem;">
                    <button class="game-button" data-action="start-challenge" data-params='{"category":"all"}'
                            style="background: #7c3aed; color: white; padding: 1rem; flex-direction: column; gap: 0.5rem;">
                        <span style="font-size: 2rem;">🎯</span>
                        <span style="font-weight: bold;">Random Challenge</span>
                        <span style="font-size: 0.8rem; opacity: 0.9;">Test your skills!</span>
                    </button>
                    
                    <button class="game-button" data-action="go-to-screen" data-params='{"screen":"categories"}'
                            style="background: #2563eb; color: white; padding: 1rem; flex-direction: column; gap: 0.5rem;">
                        <span style="font-size: 2rem;">📚</span>
                        <span style="font-weight: bold;">Recipe Types</span>
                        <span style="font-size: 0.8rem; opacity: 0.9;">Choose a category</span>
                    </button>
                    
                    <button class="game-button" data-action="go-to-screen" data-params='{"screen":"recipes"}'
                            style="background: #d97706; color: white; padding: 1rem; flex-direction: column; gap: 0.5rem;">
                        <span style="font-size: 2rem;">📖</span>
                        <span style="font-weight: bold;">Recipe Book</span>
                        <span style="font-size: 0.8rem; opacity: 0.9;">Study recipes</span>
                    </button>
                    
                    <button class="game-button" data-action="toggle-tip"
                            style="background: #059669; color: white; padding: 1rem; flex-direction: column; gap: 0.5rem;">
                        <span style="font-size: 2rem;">💡</span>
                        <span style="font-weight: bold;">Barista Tips</span>
                        <span style="font-size: 0.8rem; opacity: 0.9;">Helpful advice</span>
                    </button>
                </div>

                ${this.state.showTip ? `
                    <div class="game-card" style="text-align: center; margin-bottom: 1rem; animation: fadeIn 0.3s ease;">
                        <h3 style="font-weight: bold; margin-bottom: 0.5rem;">Quick Tip!</h3>
                        <p style="font-size: 0.9rem;">${this.getRandomTip()}</p>
                    </div>
                ` : ''}

                <!-- Status Text -->
                <div style="text-align: center; font-size: 0.9rem; opacity: 0.8;">
                    <p>${this.state.streak > 0 ? `Current streak: ${this.state.streak} 🔥` : "Start a streak by getting answers right in a row!"}</p>
                    <p style="font-size: 0.8rem; margin-top: 0.5rem;">
                        ${this.state.playerLevel < this.config.maxLevel ? 
                            `${this.config.starsPerLevel - (this.state.stars % this.config.starsPerLevel)} more stars to level up!` : 
                            "You've reached max level!"
                        }
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Render categories screen
     */
    renderCategoriesScreen() {
        const categories = [
            { id: 'hotDrinks', icon: '☕', name: 'Hot Espresso Drinks', desc: 'Lattes, Cappuccinos & more', color: '#dc2626' },
            { id: 'icedDrinks', icon: '🧊', name: 'Iced Espresso Drinks', desc: 'Cool & refreshing coffee', color: '#0284c7' },
            { id: 'frappuccinos', icon: '🥤', name: 'Frappuccinos', desc: 'Blended frozen treats', color: '#7c3aed' },
            { id: 'refreshers', icon: '🍓', name: 'Refreshers', desc: 'Fruity & refreshing', color: '#ec4899' }
        ];

        return `
            <div class="game-screen" style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h1 style="font-size: 1.5rem; font-weight: bold;">Choose a Recipe Type</h1>
                    <div style="font-size: 0.9rem;">Level ${this.state.playerLevel} • ${this.state.stars} ⭐</div>
                </div>
                
                <div class="game-grid game-grid-1" style="gap: 1rem; margin-bottom: 2rem;">
                    ${categories.map(cat => `
                        <button class="game-button" data-action="start-challenge" data-params='{"category":"${cat.id}"}'
                                style="background: ${cat.color}; color: white; padding: 1rem; justify-content: flex-start; gap: 1rem;">
                            <span style="font-size: 2rem;">${cat.icon}</span>
                            <div style="text-align: left;">
                                <div style="font-weight: bold; margin-bottom: 0.25rem;">${cat.name}</div>
                                <div style="font-size: 0.8rem; opacity: 0.9;">${cat.desc}</div>
                            </div>
                        </button>
                    `).join('')}
                </div>
                
                <button class="game-button" data-action="main-menu"
                        style="width: 100%; background: rgba(255, 255, 255, 0.2); color: white;">
                    Back to Menu
                </button>
            </div>
        `;
    }

    /**
     * Render challenge screen
     */
    renderChallengeScreen() {
        if (!this.state.currentChallenge) {
            return this.renderErrorScreen('No challenge available');
        }

        const challenge = this.state.currentChallenge;
        const drinkData = this.recipes[challenge.category][challenge.drink];
        const sizeInfo = this.sizeInfo[challenge.size];

        return `
            <div class="game-screen" style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h1 style="font-size: 1.5rem; font-weight: bold;">Barista Challenge</h1>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span>${this.state.streak} 🔥</span>
                        <span>${this.state.stars} ⭐</span>
                    </div>
                </div>

                <!-- Challenge Card -->
                <div class="challenge-container ${this.state.animation ? `result-${this.state.animation}` : ''}" 
                     style="background-image: ${drinkData.color ? 
                        `linear-gradient(rgba(255,255,255,0.1), rgba(255,255,255,0.1)), linear-gradient(to right, ${drinkData.color}66, transparent)` : 
                        'none'}; margin-bottom: 1.5rem;">
                    
                    <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                        <span style="font-size: 3rem; margin-right: 1rem;">${drinkData.icon}</span>
                        <div>
                            <h2 style="font-size: 1.3rem; font-weight: bold; margin-bottom: 0.25rem;">${challenge.drink}</h2>
                            <p style="opacity: 0.9;">${sizeInfo.name} (${sizeInfo.oz})</p>
                        </div>
                    </div>
                    
                    <div style="background: rgba(0, 0, 0, 0.2); padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem;">
                        <p style="font-size: 0.9rem;">${drinkData.description}</p>
                        ${!this.state.showResult ? `
                            <p style="font-size: 0.8rem; font-style: italic; margin-top: 0.5rem; opacity: 0.8;">What goes in this drink?</p>
                        ` : ''}
                    </div>
                    
                    ${this.renderRecipeInputs(challenge, drinkData)}
                </div>

                ${this.renderChallengeActions()}
                
                ${this.renderChallengeResult(challenge, drinkData)}
            </div>
        `;
    }

    /**
     * Render recipe inputs based on drink category
     */
    renderRecipeInputs(challenge, drinkData) {
        if (this.state.showResult) return '';

        let inputs = [];

        if (challenge.category === 'hotDrinks' || challenge.category === 'icedDrinks') {
            if (drinkData.shots) {
                inputs.push(`
                    <div>
                        <label style="display: flex; align-items: center; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">
                            <span style="margin-right: 0.5rem;">☕</span> Espresso Shots:
                        </label>
                        <input type="number" min="1" max="4" 
                               class="game-input" 
                               data-field="answer.shots"
                               value="${this.state.answer.shots || ''}"
                               style="width: 100%;">
                    </div>
                `);
            }
            
            if (drinkData.syrup) {
                inputs.push(`
                    <div>
                        <label style="display: flex; align-items: center; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">
                            <span style="margin-right: 0.5rem;">🍯</span> Syrup Pumps:
                        </label>
                        <input type="number" min="1" max="7" 
                               class="game-input" 
                               data-field="answer.syrup"
                               value="${this.state.answer.syrup || ''}"
                               style="width: 100%;">
                    </div>
                `);
            }
        } else if (challenge.category === 'frappuccinos') {
            if (drinkData.roast) {
                inputs.push(`
                    <div>
                        <label style="display: flex; align-items: center; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">
                            <span style="margin-right: 0.5rem;">☕</span> Frapp Roast:
                        </label>
                        <input type="number" min="1" max="4" 
                               class="game-input" 
                               data-field="answer.roast"
                               value="${this.state.answer.roast || ''}"
                               style="width: 100%;">
                    </div>
                `);
            }
            
            if (drinkData.frappBase) {
                inputs.push(`
                    <div>
                        <label style="display: flex; align-items: center; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">
                            <span style="margin-right: 0.5rem;">🧪</span> Frapp Base:
                        </label>
                        <input type="number" min="1" max="4" 
                               class="game-input" 
                               data-field="answer.frappBase"
                               value="${this.state.answer.frappBase || ''}"
                               style="width: 100%;">
                    </div>
                `);
            }
            
            if (drinkData.mochaSauce) {
                inputs.push(`
                    <div>
                        <label style="display: flex; align-items: center; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">
                            <span style="margin-right: 0.5rem;">🍫</span> Mocha Sauce:
                        </label>
                        <input type="number" min="1" max="4" 
                               class="game-input" 
                               data-field="answer.mochaSauce"
                               value="${this.state.answer.mochaSauce || ''}"
                               style="width: 100%;">
                    </div>
                `);
            }
            
            if (drinkData.caramelSyrup) {
                inputs.push(`
                    <div>
                        <label style="display: flex; align-items: center; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">
                            <span style="margin-right: 0.5rem;">🍮</span> Caramel Syrup:
                        </label>
                        <input type="number" min="1" max="4" 
                               class="game-input" 
                               data-field="answer.caramelSyrup"
                               value="${this.state.answer.caramelSyrup || ''}"
                               style="width: 100%;">
                    </div>
                `);
            }
        } else if (challenge.category === 'refreshers') {
            if (drinkData.inclusion) {
                inputs.push(`
                    <div>
                        <label style="display: flex; align-items: center; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem;">
                            <span style="margin-right: 0.5rem;">🍓</span> Fruit Inclusion Scoops:
                        </label>
                        <input type="number" min="1" max="2" 
                               class="game-input" 
                               data-field="answer.inclusion"
                               value="${this.state.answer.inclusion || ''}"
                               style="width: 100%;">
                    </div>
                `);
            }
        }

        return `
            <div class="game-grid game-grid-2" style="gap: 0.75rem;">
                ${inputs.join('')}
            </div>
        `;
    }

    /**
     * Render challenge actions
     */
    renderChallengeActions() {
        if (!this.state.showResult) {
            return `
                <button class="game-button" data-action="check-answer"
                        style="width: 100%; background: #10b981; color: white; font-size: 1.1rem; margin-bottom: 1rem;">
                    Make the Drink!
                </button>
            `;
        }

        return `
            <div class="game-grid game-grid-2" style="gap: 1rem;">
                <button class="game-button" data-action="main-menu"
                        style="background: rgba(255, 255, 255, 0.2); color: white;">
                    Main Menu
                </button>
                <button class="game-button" data-action="generate-challenge"
                        style="background: rgba(255, 255, 255, 0.2); color: white;">
                    ${this.state.showResult ? 'Next Challenge' : 'Skip'}
                </button>
            </div>
        `;
    }

    /**
     * Render challenge result
     */
    renderChallengeResult(challenge, drinkData) {
        if (!this.state.showResult) return '';

        const isCorrect = this.state.isCorrect;

        return `
            <div style="padding: 1rem; border-radius: 12px; margin-top: 1rem; ${
                isCorrect ? 'background: rgba(34, 197, 94, 0.2);' : 'background: rgba(239, 68, 68, 0.2);'
            }">
                <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                    <span style="font-size: 2rem; margin-right: 1rem;">${isCorrect ? '🎉' : '😢'}</span>
                    <div>
                        <h3 style="font-weight: bold; margin-bottom: 0.25rem;">${isCorrect ? 'Perfect Drink!' : 'Not Quite Right'}</h3>
                        <p style="font-size: 0.9rem;">${isCorrect ? 'You nailed the recipe!' : 'Let\'s check the recipe...'}</p>
                    </div>
                </div>
                
                ${!isCorrect ? this.renderCorrectRecipe(challenge, drinkData) : ''}
                
                ${isCorrect ? `
                    <div style="background: rgba(255, 255, 255, 0.2); padding: 0.75rem; border-radius: 8px; font-size: 0.9rem;">
                        <p>${drinkData.funFact}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render correct recipe for wrong answers
     */
    renderCorrectRecipe(challenge, drinkData) {
        const recipeItems = [];
        
        Object.entries(drinkData).forEach(([field, value]) => {
            if (typeof value === 'object' && value[challenge.size]) {
                const fieldLabels = {
                    shots: 'Espresso Shots',
                    syrup: 'Syrup Pumps',
                    roast: 'Frapp Roast',
                    frappBase: 'Frapp Base',
                    mochaSauce: 'Mocha Sauce',
                    caramelSyrup: 'Caramel Syrup',
                    inclusion: 'Fruit Inclusion'
                };
                
                if (fieldLabels[field]) {
                    recipeItems.push(`<li>${fieldLabels[field]}: ${value[challenge.size]}</li>`);
                }
            }
        });

        return `
            <div style="background: rgba(255, 255, 255, 0.2); padding: 0.75rem; border-radius: 8px; font-size: 0.9rem; margin-bottom: 1rem;">
                <p style="font-weight: bold; margin-bottom: 0.5rem;">Correct Recipe:</p>
                <ul style="margin-left: 1.25rem;">
                    ${recipeItems.join('')}
                </ul>
            </div>
        `;
    }

    /**
     * Render recipes screen
     */
    renderRecipesScreen() {
        if (this.state.selectedDrink) {
            return this.renderDrinkDetails();
        }

        return `
            <div class="game-screen" style="background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); color: white;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h1 style="font-size: 1.5rem; font-weight: bold;">Recipe Book</h1>
                    <div style="font-size: 0.9rem;">Level ${this.state.playerLevel} • ${this.state.stars} ⭐</div>
                </div>
                
                <div class="game-card" style="text-align: center; margin-bottom: 1.5rem;">
                    <p>Select a drink type to study the recipes</p>
                </div>
                
                <div class="game-grid game-grid-1" style="gap: 1rem; margin-bottom: 2rem;">
                    ${this.renderCategoryButtons()}
                </div>
                
                <button class="game-button" data-action="main-menu"
                        style="width: 100%; background: rgba(255, 255, 255, 0.2); color: white;">
                    Back to Menu
                </button>
            </div>
        `;
    }

    /**
     * Render category buttons for recipe book
     */
    renderCategoryButtons() {
        const categories = [
            { id: 'hotDrinks', icon: '☕', name: 'Hot Espresso Drinks', color: '#dc2626' },
            { id: 'icedDrinks', icon: '🧊', name: 'Iced Espresso Drinks', color: '#0284c7' },
            { id: 'frappuccinos', icon: '🥤', name: 'Frappuccinos', color: '#7c3aed' },
            { id: 'refreshers', icon: '🍓', name: 'Refreshers', color: '#ec4899' }
        ];

        return categories.map(cat => `
            <button class="game-button" data-action="select-drink" data-params='{"category":"${cat.id}"}'
                    style="background: ${cat.color}70; color: white; padding: 1rem; justify-content: flex-start; gap: 1rem;">
                <span style="font-size: 1.5rem;">${cat.icon}</span>
                <span style="font-weight: bold;">${cat.name}</span>
            </button>
        `).join('');
    }

    /**
     * Render badges screen
     */
    renderBadgesScreen() {
        return `
            <div class="game-screen" style="background: linear-gradient(135deg, #b45309 0%, #d97706 100%); color: white;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h1 style="font-size: 1.5rem; font-weight: bold;">Your Badges</h1>
                    <div style="font-size: 0.9rem;">Level ${this.state.playerLevel} • ${this.state.stars} ⭐</div>
                </div>
                
                <div class="game-card" style="text-align: center; margin-bottom: 2rem;">
                    <p style="margin-bottom: 0.5rem;">Collect badges by completing challenges and mastering recipes!</p>
                    <p style="font-weight: bold;">
                        ${this.state.badges.length} / ${this.badgeTypes.length} Badges Earned
                    </p>
                </div>
                
                <div class="badge-grid" style="margin-bottom: 2rem;">
                    ${this.badgeTypes.map(badge => this.renderBadgeItem(badge)).join('')}
                </div>
                
                <button class="game-button" data-action="main-menu"
                        style="width: 100%; background: rgba(255, 255, 255, 0.2); color: white;">
                    Back to Menu
                </button>
            </div>
        `;
    }

    /**
     * Render individual badge item
     */
    renderBadgeItem(badge) {
        const earned = this.state.badges.includes(badge.id);
        
        return `
            <div class="badge-item ${earned ? 'badge-earned' : 'badge-locked'}">
                <div style="font-size: 2rem; ${earned ? '' : 'opacity: 0.4;'}">${badge.icon}</div>
                <div>
                    <h3 style="font-weight: bold; margin-bottom: 0.25rem; ${earned ? '' : 'opacity: 0.6;'}">${badge.name}</h3>
                    <p style="font-size: 0.8rem; ${earned ? '' : 'opacity: 0.6;'}">${badge.description}</p>
                </div>
            </div>
        `;
    }

    /**
     * Render error screen
     */
    renderErrorScreen(message = 'Something went wrong') {
        return `
            <div class="game-screen" style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; text-align: center; justify-content: center;">
                <div>
                    <div style="font-size: 4rem; margin-bottom: 1rem;">😕</div>
                    <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">Oops!</h2>
                    <p style="margin-bottom: 2rem; opacity: 0.9;">${message}</p>
                    <button class="game-button" data-action="main-menu"
                            style="background: rgba(255, 255, 255, 0.2); color: white;">
                        Back to Menu
                    </button>
                </div>
            </div>
        `;
    }

    // =====================================
    // GAME LOGIC METHODS
    // =====================================

    /**
     * Start the game
     */
    startGame() {
        if (!this.state.playerName.trim()) return;
        
        this.updateState({ screen: 'main' });
        this.checkBadges();
    }

    /**
     * Go to a specific screen
     */
    goToScreen(screen) {
        this.updateState({ screen });
    }

    /**
     * Go to main menu
     */
    goToMainMenu() {
        this.updateState({ 
            screen: 'main',
            activeCategory: 'all',
            selectedDrink: null,
            showResult: false,
            currentChallenge: null,
            answer: {},
            animation: ''
        });
    }

    /**
     * Start a challenge with given category
     */
    startChallenge(category) {
        this.updateState({ 
            activeCategory: category,
            screen: 'challenge'
        });
        this.generateChallenge();
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
        
        this.updateState({
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
     * Get available sizes for a category
     */
    getAvailableSizes(category) {
        switch(category) {
            case 'hotDrinks': return ['S', 'T', 'G', 'V'];
            case 'refreshers': return ['T', 'G', 'V', 'TR'];
            default: return ['T', 'G', 'V'];
        }
    }

    /**
     * Check the player's answer
     */
    checkAnswer() {
        if (!this.state.currentChallenge) return;
        
        const challenge = this.state.currentChallenge;
        const drinkData = this.recipes[challenge.category][challenge.drink];
        let correct = true;
        
        // Check all relevant fields
        const fieldsToCheck = ['shots', 'syrup', 'roast', 'frappBase', 'mochaSauce', 'caramelSyrup', 'inclusion'];
        
        for (const field of fieldsToCheck) {
            if (drinkData[field] && parseInt(this.state.answer[field]) !== drinkData[field][challenge.size]) {
                correct = false;
                break;
            }
        }
        
        this.updateState({
            isCorrect: correct,
            showResult: true,
            animation: correct ? 'success' : 'error'
        });
        
        if (correct) {
            this.handleCorrectAnswer(challenge);
        } else {
            this.handleWrongAnswer();
        }
        
        // Clear animation after delay
        setTimeout(() => {
            this.updateState({ animation: '' });
        }, 1000);
    }

    /**
     * Handle correct answer
     */
    handleCorrectAnswer(challenge) {
        const newStars = this.state.stars + 1;
        const newStreak = this.state.streak + 1;
        const newMaxStreak = Math.max(newStreak, this.state.maxStreak);
        const newLevel = Math.floor(newStars / this.config.starsPerLevel) + 1;
        
        // Update completed drinks
        const drinkKey = `${challenge.category}-${challenge.drink}`;
        const newCompletedDrinks = {
            ...this.state.completedDrinks,
            [drinkKey]: (this.state.completedDrinks[drinkKey] || 0) + 1
        };
        
        this.updateState({
            stars: newStars,
            streak: newStreak,
            maxStreak: newMaxStreak,
            playerLevel: Math.min(newLevel, this.config.maxLevel),
            completedDrinks: newCompletedDrinks
        });
        
        this.checkBadges();
    }

    /**
     * Handle wrong answer
     */
    handleWrongAnswer() {
        this.updateState({ streak: 0 });
    }

    /**
     * Check and award badges
     */
    checkBadges() {
        const newBadges = [...this.state.badges];
        
        for (const [badgeId, condition] of Object.entries(this.config.badgeUnlockConditions)) {
            if (!newBadges.includes(badgeId) && condition(this.state)) {
                newBadges.push(badgeId);
            }
        }
        
        if (newBadges.length > this.state.badges.length) {
            this.updateState({ badges: newBadges });
        }
    }

    /**
     * Get category completion count
     */
    getCategoryCompletionCount(category) {
        const categoryDrinks = Object.keys(this.recipes[category]);
        return categoryDrinks.filter(drink => 
            this.state.completedDrinks[`${category}-${drink}`]
        ).length;
    }

    /**
     * Select a drink category for recipe viewing
     */
    selectDrink(category) {
        this.updateState({ 
            activeCategory: category,
            screen: 'recipes'
        });
    }

    /**
     * Toggle tip display
     */
    toggleTip() {
        this.updateState({ showTip: !this.state.showTip });
    }

    /**
     * Get barista emoji based on state
     */
    getBaristaEmoji() {
        if (this.state.isCorrect && this.state.showResult) return "😄";
        if (!this.state.isCorrect && this.state.showResult) return "😢";
        return "😊";
    }

    /**
     * Get random tip
     */
    getRandomTip() {
        return this.baristaTips[Math.floor(Math.random() * this.baristaTips.length)];
    }

    // =====================================
    // PERSISTENCE & CLEANUP
    // =====================================

    /**
     * Save game state to localStorage
     */
    saveGameState() {
        try {
            const saveData = {
                playerName: this.state.playerName,
                playerLevel: this.state.playerLevel,
                stars: this.state.stars,
                maxStreak: this.state.maxStreak,
                badges: this.state.badges,
                completedDrinks: this.state.completedDrinks
            };
            localStorage.setItem('starbucks-barista-game', JSON.stringify(saveData));
        } catch (error) {
            console.warn('Failed to save game state:', error);
        }
    }

    /**
     * Load game state from localStorage
     */
    loadGameState() {
        try {
            const saveData = localStorage.getItem('starbucks-barista-game');
            if (saveData) {
                const parsed = JSON.parse(saveData);
                this.state = { ...this.state, ...parsed };
            }
        } catch (error) {
            console.warn('Failed to load game state:', error);
        }
    }

    /**
     * Handle initialization errors
     */
    handleInitError(error) {
        this.container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 2rem; background: linear-gradient(135deg, #dc2626, #ef4444); color: white;">
                <div>
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                    <h2 style="margin-bottom: 1rem;">Game Load Error</h2>
                    <p style="margin-bottom: 1.5rem; opacity: 0.9;">Failed to initialize the Barista Game</p>
                    <button onclick="location.reload()" 
                            style="padding: 0.75rem 1.5rem; background: rgba(255, 255, 255, 0.2); color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Reload Game
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Pause the game
     */
    pause() {
        // Pause any running timers
        this.intervals.forEach(clearInterval);
        this.timeouts.forEach(clearTimeout);
    }

    /**
     * Resume the game
     */
    resume() {
        // Resume functionality if needed
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Handle responsive adjustments if needed
    }

    /**
     * Destroy the game and clean up resources
     */
    destroy() {
        try {
            // Clear all event listeners
            this.eventListeners.forEach(({ element, type, handler }) => {
                element.removeEventListener(type, handler);
            });
            this.eventListeners = [];

            // Clear intervals and timeouts
            this.intervals.forEach(clearInterval);
            this.timeouts.forEach(clearTimeout);
            this.intervals = [];
            this.timeouts = [];

            // Remove game styles
            const styleElement = document.getElementById('starbucks-game-styles');
            if (styleElement) {
                styleElement.remove();
            }

            // Clear container
            this.container.innerHTML = '';
            this.container.className = '';
            this.container.style.cssText = '';

            // Reset state
            this.isInitialized = false;
            
            console.log('🧹 Starbucks Barista Game destroyed and cleaned up');
        } catch (error) {
            console.error('❌ Error during game cleanup:', error);
        }
    }
}

// Export for use with module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StarbucksGame;
} else {
    window.StarbucksGame = StarbucksGame;
}