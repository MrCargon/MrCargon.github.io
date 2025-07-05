/**
 * Starbucks Barista Adventure Game
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
        
        this.eventListeners = [];
        this.animationFrames = [];
        this.timeouts = [];
        
        this.init();
    }

    /**
     * Game Data Constants
     */
    static get BADGE_TYPES() {
        return [
            { id: "first_star", name: "First Star", icon: "⭐", description: "Earned your first star!" },
            { id: "hot_expert", name: "Hot Drink Expert", icon: "☕", description: "Mastered hot drink recipes" },
            { id: "ice_master", name: "Ice Master", icon: "🧊", description: "Conquered all iced drink recipes" },
            { id: "frapp_wizard", name: "Frappuccino Wizard", icon: "🥤", description: "Perfected all Frappuccino recipes" },
            { id: "streak_5", name: "5-Streak", icon: "🔥", description: "5 correct answers in a row!" },
            { id: "level_5", name: "Level 5 Barista", icon: "🌟", description: "Reached level 5!" }
        ];
    }

    static get SIZE_INFO() {
        return {
            S: { name: "Short", oz: "8oz", description: "Tiny but mighty!" },
            T: { name: "Tall", oz: "12oz", description: "Not so tall after all!" },
            G: { name: "Grande", oz: "16oz", description: "Italian for 'big'" },
            V: { name: "Venti", oz: "20/24oz", description: "Italian for '20'" },
            TR: { name: "Trenta", oz: "30oz", description: "The giant cup!" }
        };
    }

    static get BARISTA_TIPS() {
        return [
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

    static get RECIPES() {
        return {
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
    init() {
        console.log('🎮 Initializing Starbucks Barista Game');
        
        if (!this.container) {
            console.error('❌ Game container not provided');
            return;
        }

        // Setup game container
        this.setupGameContainer();
        
        // Render initial screen
        this.render();
        
        // Load saved progress
        this.loadProgress();
        
        console.log('✅ Starbucks Game initialized successfully');
    }

    /**
     * Setup game container styles
     */
    setupGameContainer() {
        this.container.style.cssText = `
            width: 100%;
            height: 500px;
            background: #f8fafc;
            border-radius: 12px;
            overflow: hidden;
            position: relative;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;
    }

    /**
     * Load saved progress from localStorage
     */
    loadProgress() {
        try {
            const saved = localStorage.getItem('starbucks-game-progress');
            if (saved) {
                const progress = JSON.parse(saved);
                this.gameState = { ...this.gameState, ...progress };
                console.log('📚 Game progress loaded');
            }
        } catch (error) {
            console.warn('⚠️ Failed to load game progress:', error);
        }
    }

    /**
     * Save progress to localStorage
     */
    saveProgress() {
        try {
            const progress = {
                playerName: this.gameState.playerName,
                playerLevel: this.gameState.playerLevel,
                stars: this.gameState.stars,
                maxStreak: this.gameState.maxStreak,
                badges: this.gameState.badges,
                completedDrinks: this.gameState.completedDrinks
            };
            localStorage.setItem('starbucks-game-progress', JSON.stringify(progress));
        } catch (error) {
            console.warn('⚠️ Failed to save game progress:', error);
        }
    }

    /**
     * Main render method
     */
    render() {
        switch (this.gameState.screen) {
            case 'welcome':
                this.renderWelcomeScreen();
                break;
            case 'main':
                this.renderMainScreen();
                break;
            case 'categories':
                this.renderCategoriesScreen();
                break;
            case 'challenge':
                this.renderChallengeScreen();
                break;
            case 'recipes':
                this.renderRecipeBookScreen();
                break;
            case 'badges':
                this.renderBadgesScreen();
                break;
            default:
                this.renderWelcomeScreen();
        }
    }

    /**
     * Render Welcome Screen
     */
    renderWelcomeScreen() {
        this.container.innerHTML = `
            <div class="game-screen welcome-screen">
                <div class="welcome-content">
                    <div class="welcome-header">
                        <h1>☕ Starbucks Barista Adventure ☕</h1>
                        <p>Become a master barista through fun challenges!</p>
                    </div>
                    
                    <div class="welcome-form">
                        <div class="barista-avatar">
                            <span class="avatar-icon">👨‍🍳</span>
                            <h2>Welcome, Future Barista!</h2>
                            <p>What's your barista name?</p>
                        </div>
                        
                        <input type="text" 
                               id="player-name" 
                               placeholder="Enter your name" 
                               value="${this.gameState.playerName}"
                               maxlength="20">
                        
                        <button id="start-adventure" ${!this.gameState.playerName ? 'disabled' : ''}>
                            Start My Adventure!
                        </button>
                    </div>
                    
                    <div class="welcome-features">
                        <p>Learn recipes • Earn stars • Collect badges</p>
                        <p>Become the ultimate Starbucks barista!</p>
                    </div>
                </div>
            </div>
        `;

        this.addWelcomeStyles();
        this.setupWelcomeEvents();
    }

    /**
     * Add welcome screen styles
     */
    addWelcomeStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .game-screen {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            
            .welcome-screen {
                background: linear-gradient(135deg, #166534, #15803d);
                color: white;
                justify-content: center;
                align-items: center;
                text-align: center;
                padding: 2rem;
            }
            
            .welcome-content {
                max-width: 400px;
                width: 100%;
            }
            
            .welcome-header h1 {
                font-size: 1.8rem;
                font-weight: bold;
                margin-bottom: 0.5rem;
                line-height: 1.2;
            }
            
            .welcome-header p {
                font-size: 1.1rem;
                margin-bottom: 2rem;
                opacity: 0.9;
            }
            
            .welcome-form {
                background: rgba(255, 255, 255, 0.15);
                padding: 2rem;
                border-radius: 1rem;
                backdrop-filter: blur(10px);
                margin-bottom: 1.5rem;
            }
            
            .barista-avatar {
                margin-bottom: 1.5rem;
            }
            
            .avatar-icon {
                font-size: 4rem;
                display: block;
                margin-bottom: 1rem;
            }
            
            .barista-avatar h2 {
                font-size: 1.3rem;
                font-weight: 600;
                margin-bottom: 0.5rem;
            }
            
            .barista-avatar p {
                opacity: 0.9;
                margin-bottom: 0;
            }
            
            #player-name {
                width: 100%;
                padding: 0.75rem 1rem;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 2rem;
                background: rgba(255, 255, 255, 0.2);
                color: white;
                font-size: 1rem;
                text-align: center;
                margin-bottom: 1.5rem;
                outline: none;
                transition: all 0.3s ease;
            }
            
            #player-name::placeholder {
                color: rgba(255, 255, 255, 0.7);
            }
            
            #player-name:focus {
                border-color: rgba(255, 255, 255, 0.8);
                background: rgba(255, 255, 255, 0.25);
            }
            
            #start-adventure {
                width: 100%;
                padding: 0.75rem 1rem;
                border: none;
                border-radius: 2rem;
                font-size: 1.1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                background: #22c55e;
                color: white;
            }
            
            #start-adventure:hover:not(:disabled) {
                background: #16a34a;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }
            
            #start-adventure:disabled {
                background: #6b7280;
                cursor: not-allowed;
                opacity: 0.6;
            }
            
            .welcome-features {
                font-size: 0.9rem;
                opacity: 0.8;
                line-height: 1.6;
            }
            
            .welcome-features p {
                margin: 0.25rem 0;
            }
        `;
        
        if (!document.querySelector('#starbucks-game-styles')) {
            style.id = 'starbucks-game-styles';
            document.head.appendChild(style);
        }
    }

    /**
     * Setup welcome screen events
     */
    setupWelcomeEvents() {
        const nameInput = document.getElementById('player-name');
        const startButton = document.getElementById('start-adventure');

        // Name input validation
        this.addEventListener(nameInput, 'input', (e) => {
            const value = e.target.value.trim();
            this.gameState.playerName = value;
            startButton.disabled = !value;
            
            if (value) {
                startButton.style.background = '#22c55e';
                startButton.style.cursor = 'pointer';
            } else {
                startButton.style.background = '#6b7280';
                startButton.style.cursor = 'not-allowed';
            }
        });

        // Start game
        this.addEventListener(startButton, 'click', () => {
            if (this.gameState.playerName.trim()) {
                this.gameState.screen = 'main';
                this.saveProgress();
                this.render();
                this.playSound('start');
            }
        });

        // Enter key support
        this.addEventListener(nameInput, 'keydown', (e) => {
            if (e.key === 'Enter' && this.gameState.playerName.trim()) {
                startButton.click();
            }
        });
    }

    /**
     * Render Main Screen (Hub)
     */
    renderMainScreen() {
        const baristaEmoji = this.getBaristaEmoji();
        const currentTip = this.getCurrentTip();
        
        this.container.innerHTML = `
            <div class="game-screen main-screen">
                <div class="main-header">
                    <div class="player-info">
                        <h1>Barista ${this.gameState.playerName}</h1>
                        <p>Level ${this.gameState.playerLevel} • ${this.gameState.stars} ⭐</p>
                    </div>
                    
                    <div class="badges-btn-container">
                        <span class="badge-count">${this.gameState.badges.length} badges</span>
                        <button id="badges-btn" class="icon-btn">🏆</button>
                    </div>
                </div>
                
                <div class="barista-tip-panel">
                    <div class="tip-content">
                        <div class="barista-character">${baristaEmoji}</div>
                        <div class="tip-text">
                            <h2>Barista Tip:</h2>
                            <p>${currentTip}</p>
                        </div>
                    </div>
                    
                    ${this.gameState.streak >= 3 ? `
                        <div class="streak-indicator">
                            <div class="streak-content">
                                <div class="streak-label">Streak</div>
                                <div class="streak-value">${this.gameState.streak} 🔥</div>
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <div class="menu-grid">
                    <button class="menu-item purple" data-action="random-challenge">
                        <span class="menu-icon">🎯</span>
                        <span class="menu-title">Random Challenge</span>
                        <span class="menu-subtitle">Test your skills!</span>
                    </button>
                    
                    <button class="menu-item blue" data-action="categories">
                        <span class="menu-icon">📚</span>
                        <span class="menu-title">Recipe Types</span>
                        <span class="menu-subtitle">Choose a category</span>
                    </button>
                    
                    <button class="menu-item amber" data-action="recipes">
                        <span class="menu-icon">📖</span>
                        <span class="menu-title">Recipe Book</span>
                        <span class="menu-subtitle">Study the recipes</span>
                    </button>
                    
                    <button class="menu-item teal" data-action="toggle-tip">
                        <span class="menu-icon">💡</span>
                        <span class="menu-title">Barista Tips</span>
                        <span class="menu-subtitle">Helpful advice</span>
                    </button>
                </div>
                
                ${this.gameState.showTip ? `
                    <div class="additional-tip">
                        <h3>Quick Tip!</h3>
                        <p>${this.getRandomTip()}</p>
                    </div>
                ` : ''}
                
                <div class="progress-info">
                    <p>${this.gameState.streak > 0 ? 
                        `Current streak: ${this.gameState.streak} 🔥` : 
                        'Start a streak by getting answers right in a row!'
                    }</p>
                    <p class="level-progress">
                        ${this.gameState.playerLevel < 10 ? 
                            `${this.gameState.playerLevel * 5 - this.gameState.stars} more stars to level up!` : 
                            "You've reached max level!"
                        }
                    </p>
                </div>
            </div>
        `;

        this.addMainStyles();
        this.setupMainEvents();
    }

    /**
     * Add main screen styles
     */
    addMainStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .main-screen {
                background: linear-gradient(135deg, #059669, #047857);
                color: white;
                padding: 1.5rem;
                overflow-y: auto;
            }
            
            .main-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1.5rem;
            }
            
            .player-info h1 {
                font-size: 1.3rem;
                font-weight: bold;
                margin: 0 0 0.25rem 0;
            }
            
            .player-info p {
                font-size: 0.9rem;
                margin: 0;
                opacity: 0.9;
            }
            
            .badges-btn-container {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .badge-count {
                font-size: 0.85rem;
                opacity: 0.9;
            }
            
            .icon-btn {
                width: 2.5rem;
                height: 2.5rem;
                border: none;
                border-radius: 50%;
                background: #fbbf24;
                color: white;
                font-size: 1.2rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }
            
            .icon-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }
            
            .barista-tip-panel {
                background: rgba(255, 255, 255, 0.15);
                border-radius: 1rem;
                padding: 1rem;
                margin-bottom: 1.5rem;
                backdrop-filter: blur(10px);
                position: relative;
                overflow: hidden;
            }
            
            .tip-content {
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            
            .barista-character {
                font-size: 3.5rem;
                flex-shrink: 0;
            }
            
            .tip-text h2 {
                font-size: 1.1rem;
                font-weight: 600;
                margin: 0 0 0.5rem 0;
            }
            
            .tip-text p {
                font-size: 0.9rem;
                margin: 0;
                line-height: 1.4;
            }
            
            .streak-indicator {
                position: absolute;
                bottom: -0.75rem;
                right: -0.75rem;
                width: 5rem;
                height: 5rem;
                background: #f97316;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transform: rotate(12deg);
                animation: bounce 2s infinite;
            }
            
            .streak-content {
                text-align: center;
                transform: rotate(-12deg);
            }
            
            .streak-label {
                font-size: 0.7rem;
                font-weight: 600;
            }
            
            .streak-value {
                font-size: 1.2rem;
                font-weight: bold;
                line-height: 1;
            }
            
            .menu-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 0.75rem;
                margin-bottom: 1.5rem;
            }
            
            .menu-item {
                padding: 1rem;
                border: none;
                border-radius: 0.75rem;
                color: white;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                background: var(--item-bg);
            }
            
            .menu-item.purple { --item-bg: #7c3aed; }
            .menu-item.blue { --item-bg: #2563eb; }
            .menu-item.amber { --item-bg: #d97706; }
            .menu-item.teal { --item-bg: #0d9488; }
            
            .menu-item:hover {
                transform: translateY(-2px) scale(1.02);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
                filter: brightness(1.1);
            }
            
            .menu-icon {
                font-size: 1.5rem;
                margin-bottom: 0.25rem;
                display: block;
            }
            
            .menu-title {
                font-weight: 600;
                font-size: 0.9rem;
                margin-bottom: 0.25rem;
                display: block;
            }
            
            .menu-subtitle {
                font-size: 0.75rem;
                opacity: 0.9;
                display: block;
            }
            
            .additional-tip {
                background: rgba(255, 255, 255, 0.15);
                border-radius: 0.75rem;
                padding: 1rem;
                margin-bottom: 1rem;
                text-align: center;
                backdrop-filter: blur(10px);
                animation: fadeIn 0.5s ease;
            }
            
            .additional-tip h3 {
                font-weight: 600;
                margin: 0 0 0.5rem 0;
                font-size: 1rem;
            }
            
            .additional-tip p {
                font-size: 0.85rem;
                margin: 0;
                line-height: 1.4;
            }
            
            .progress-info {
                text-align: center;
                font-size: 0.85rem;
                opacity: 0.8;
                line-height: 1.5;
            }
            
            .progress-info p {
                margin: 0.25rem 0;
            }
            
            .level-progress {
                font-size: 0.75rem !important;
                opacity: 0.7 !important;
            }
            
            @keyframes bounce {
                0%, 20%, 50%, 80%, 100% { transform: translateY(0) rotate(12deg); }
                40% { transform: translateY(-10px) rotate(12deg); }
                60% { transform: translateY(-5px) rotate(12deg); }
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        this.updateStyles(style);
    }

    /**
     * Setup main screen events
     */
    setupMainEvents() {
        // Menu actions
        const menuItems = this.container.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            this.addEventListener(item, 'click', () => {
                const action = item.getAttribute('data-action');
                this.handleMenuAction(action);
            });
        });

        // Badges button
        const badgesBtn = document.getElementById('badges-btn');
        if (badgesBtn) {
            this.addEventListener(badgesBtn, 'click', () => {
                this.gameState.screen = 'badges';
                this.render();
            });
        }
    }

    /**
     * Handle menu actions
     */
    handleMenuAction(action) {
        switch (action) {
            case 'random-challenge':
                this.gameState.activeCategory = 'all';
                this.gameState.screen = 'challenge';
                this.generateChallenge();
                this.render();
                break;
            case 'categories':
                this.gameState.screen = 'categories';
                this.render();
                break;
            case 'recipes':
                this.gameState.screen = 'recipes';
                this.gameState.selectedDrink = null;
                this.render();
                break;
            case 'toggle-tip':
                this.gameState.showTip = !this.gameState.showTip;
                this.render();
                break;
        }
    }

    /**
     * Generate a random challenge
     */
    generateChallenge() {
        const recipes = StarbucksGame.RECIPES;
        const categories = this.gameState.activeCategory === 'all' 
            ? Object.keys(recipes) 
            : [this.gameState.activeCategory];
        
        const randomCat = categories[Math.floor(Math.random() * categories.length)];
        const drinks = Object.keys(recipes[randomCat]);
        const randomDrink = drinks[Math.floor(Math.random() * drinks.length)];
        
        const sizes = this.getAvailableSizes(randomCat);
        const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
        
        this.gameState.currentChallenge = {
            category: randomCat,
            drink: randomDrink,
            size: randomSize
        };
        
        this.gameState.answer = {};
        this.gameState.showResult = false;
        this.gameState.animation = '';
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
     * Check challenge answer
     */
    checkAnswer() {
        const { currentChallenge, answer } = this.gameState;
        if (!currentChallenge) return;
        
        const recipes = StarbucksGame.RECIPES;
        const drinkData = recipes[currentChallenge.category][currentChallenge.drink];
        let correct = true;
        
        // Check appropriate fields based on drink type
        const fieldsToCheck = ['shots', 'syrup', 'roast', 'frappBase', 'mochaSauce', 'caramelSyrup', 'inclusion'];
        
        for (const field of fieldsToCheck) {
            if (drinkData[field] && parseInt(answer[field]) !== drinkData[field][currentChallenge.size]) {
                correct = false;
                break;
            }
        }
        
        this.gameState.isCorrect = correct;
        this.gameState.showResult = true;
        this.gameState.animation = correct ? 'correct' : 'wrong';
        
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
        
        // Update stars and streak
        this.gameState.stars++;
        this.gameState.streak++;
        this.gameState.maxStreak = Math.max(this.gameState.streak, this.gameState.maxStreak);
        
        // Check for level up
        const newLevel = Math.floor(this.gameState.stars / 5) + 1;
        if (newLevel > this.gameState.playerLevel) {
            this.gameState.playerLevel = newLevel;
            this.playSound('levelup');
        }
        
        // Check for badges
        this.checkBadges();
        
        // Update completed drinks
        const drinkKey = `${this.gameState.currentChallenge.category}-${this.gameState.currentChallenge.drink}`;
        this.gameState.completedDrinks[drinkKey] = (this.gameState.completedDrinks[drinkKey] || 0) + 1;
        
        this.saveProgress();
    }

    /**
     * Handle wrong answer
     */
    handleWrongAnswer() {
        this.playSound('wrong');
        this.gameState.streak = 0;
        this.saveProgress();
    }

    /**
     * Check for new badges
     */
    checkBadges() {
        const badges = [...this.gameState.badges];
        
        // First star badge
        if (this.gameState.stars === 1 && !badges.includes("first_star")) {
            badges.push("first_star");
        }
        
        // Streak badge
        if (this.gameState.streak === 5 && !badges.includes("streak_5")) {
            badges.push("streak_5");
        }
        
        // Level badge
        if (this.gameState.playerLevel === 5 && !badges.includes("level_5")) {
            badges.push("level_5");
        }
        
        // Category completion badges
        this.checkCategoryBadges(badges);
        
        if (badges.length > this.gameState.badges.length) {
            this.gameState.badges = badges;
            this.playSound('badge');
        }
    }

    /**
     * Check category completion badges
     */
    checkCategoryBadges(badges) {
        const recipes = StarbucksGame.RECIPES;
        const { currentChallenge, completedDrinks } = this.gameState;
        
        const categoryDrinks = Object.keys(recipes[currentChallenge.category]);
        const completedInCategory = categoryDrinks.filter(drink => 
            completedDrinks[`${currentChallenge.category}-${drink}`]
        ).length;
        
        if (completedInCategory === categoryDrinks.length) {
            const badgeMap = {
                hotDrinks: "hot_expert",
                icedDrinks: "ice_master",
                frappuccinos: "frapp_wizard"
            };
            
            const badgeId = badgeMap[currentChallenge.category];
            if (badgeId && !badges.includes(badgeId)) {
                badges.push(badgeId);
            }
        }
    }

    /**
     * Play sound effects
     */
    playSound(type) {
        // Sound effect placeholders - can be implemented with Web Audio API
        const sounds = {
            start: '🎵 Start sound!',
            correct: '🎵 Correct sound!',
            wrong: '🎵 Wrong sound!',
            levelup: '🎵 Level up fanfare!',
            badge: '🎵 Badge earned sound!'
        };
        
        console.log(sounds[type] || '🎵 Sound effect');
    }

    /**
     * Get barista emoji based on state
     */
    getBaristaEmoji() {
        if (this.gameState.isCorrect) return "😄";
        if (this.gameState.showResult && !this.gameState.isCorrect) return "😢";
        return "😊";
    }

    /**
     * Get current tip based on level
     */
    getCurrentTip() {
        const tips = StarbucksGame.BARISTA_TIPS;
        return tips[Math.min(this.gameState.playerLevel - 1, tips.length - 1)];
    }

    /**
     * Get random tip
     */
    getRandomTip() {
        const tips = StarbucksGame.BARISTA_TIPS;
        return tips[Math.floor(Math.random() * tips.length)];
    }

    /**
     * Add event listener with cleanup tracking
     */
    addEventListener(element, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
            this.eventListeners.push({ element, event, handler });
        }
    }

    /**
     * Update styles helper
     */
    updateStyles(newStyle) {
        const existingStyle = document.querySelector('#starbucks-game-styles');
        if (existingStyle) {
            existingStyle.textContent += '\n' + newStyle.textContent;
        } else {
            newStyle.id = 'starbucks-game-styles';
            document.head.appendChild(newStyle);
        }
    }

    /**
     * Cleanup method
     */
    cleanup() {
        console.log('🧹 Cleaning up Starbucks Game');
        
        // Remove event listeners
        this.eventListeners.forEach(({ element, event, handler }) => {
            if (element) {
                element.removeEventListener(event, handler);
            }
        });
        this.eventListeners = [];
        
        // Clear timeouts
        this.timeouts.forEach(timeout => clearTimeout(timeout));
        this.timeouts = [];
        
        // Clear animation frames
        this.animationFrames.forEach(frame => cancelAnimationFrame(frame));
        this.animationFrames = [];
        
        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // Remove styles
        const styles = document.querySelector('#starbucks-game-styles');
        if (styles) {
            styles.remove();
        }
    }

    /**
     * Resize handler
     */
    handleResize() {
        // Handle responsive updates if needed
        if (this.container) {
            // Update container dimensions or layout
        }
    }

    /**
     * Format category name
     */
    formatCategory(category) {
        const categoryNames = {
            hotDrinks: 'Hot Drinks',
            icedDrinks: 'Iced Drinks',
            frappuccinos: 'Frappuccinos',
            refreshers: 'Refreshers'
        };
        return categoryNames[category] || category;
    }
}

// Export for use with PageManager
window.StarbucksGame = StarbucksGame;

// Auto-initialize if container is available
document.addEventListener('DOMContentLoaded', () => {
    const gameContainer = document.getElementById('starbucks-game-container');
    if (gameContainer) {
        window.starbucksGameInstance = new StarbucksGame(gameContainer);
    }
});

console.log('✅ StarbucksGame.js loaded successfully');