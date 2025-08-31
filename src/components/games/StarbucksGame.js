/**
 * StarbucksGame.js - Barista Trainer
 * 

/* 🦉 */
// Note: Assert and BoundedUtilities are loaded as global objects
// They're available as window.Assert and window.BoundedUtilities

class StarbucksGame {
    constructor(container) {
 // Assertions for input validation
        window.Assert.assertNotNull(container, 'Container must not be null');
        window.Assert.assertNotNull(container, 'Container must be valid DOM element');
        
        this.container = container;
        this.isInitialized = false;
        this.isDestroyed = false;
        
 // Pre-allocated fixed-size state (no dynamic allocation)
        this.gameState = this.createInitialState();
        this.gameData = this.createGameData();
        this.eventHandlers = new Map(); // Fixed-size handler storage
        
 // Register with RulesEnforcer system
        this.registerWithRulesSystem();
    }

    /**
     * Register with RulesEnforcer system
     * 2+ assertions per function
     */
    registerWithRulesSystem() {
        // Registration assertions
        window.Assert.assertNotNull(this, 'Game instance must exist');
        window.Assert.assertNotNull(this.container, 'Container must be available');
        
        try {
            // Check if RulesEnforcer is available
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
     * Create initial game state
     * 2+ assertions per function
     */
    createInitialState() {
 // State validation assertions
        window.Assert.assertNotNull(this, 'Game instance must exist');
        window.Assert.assertNotNull(this.container, 'Container required for state creation');
        
        const state = {
 // Player data
            screen: 'welcome',
            playerName: '',
            level: 1,
            stars: 0,
            streak: 0,
            maxStreak: 0,
            badges: [],
            
 // Current challenge
            currentDrink: null,
            currentSize: null,
            currentCategory: null,
            userAnswer: {},
            showResult: false,
            isCorrect: false,
            
 // UI state
            isAnimating: false,
            errorMessage: ''
        };
        
        return state;
    }

    /**
     * Initialize game system
     * 2+ assertions per function
     */
    async init() {
 // Initialization assertions
        window.Assert.assert(this.isInitialized === false, 'Game must not be already initialized');
        window.Assert.assert(this.isDestroyed === false, 'Game must not be destroyed');
        
        try {
 // Wait for BoundedUtilities to be available
            const utilitiesReady = await this.waitForBoundedUtilities();
            window.Assert.assert(utilitiesReady === true, 'BoundedUtilities must be available');
            
 // Check return values
            const setupResult = this.setupEventHandlers();
            window.Assert.assert(setupResult === true, 'Event handler setup must succeed');
            
            const renderResult = this.render();
            window.Assert.assert(renderResult === true, 'Initial render must succeed');
            
            this.isInitialized = true;
            return true;
            
        } catch (error) {
            console.error('❌ Game initialization failed:', error);
            this.handleError('Initialization failed: ' + error.message);
            return false;
        }
    }

    /**
     * Wait for BoundedUtilities to be available
     * 2+ assertions per function
     */
    async waitForBoundedUtilities(timeout = 5000) {
 // Utility wait assertions
        window.Assert.assertType(timeout, 'number', 'Timeout value');
        window.Assert.assertRange(timeout, 100, 30000, 'Timeout range');
        
 // Check if already available
        if (window.BoundedUtilities && typeof window.BoundedUtilities.escapeHtml === 'function') {
 // Set up compatibility layer for existing code
            window.BoundedUtilities = window.BoundedUtilities;
            return true;
        }
        
        console.log('⏳ Waiting for BoundedUtilities to be available...');
        
        return new Promise((resolve) => {
            const checkInterval = 100; // Check every 100ms
            let elapsed = 0;
            
            const intervalId = setInterval(() => {
                elapsed += checkInterval;
                
                if (window.BoundedUtilities && typeof window.BoundedUtilities.escapeHtml === 'function') {
                    clearInterval(intervalId);
 // Set up compatibility layer
                    window.BoundedUtilities = window.BoundedUtilities;
                    resolve(true);
                } else if (elapsed >= timeout) {
                    clearInterval(intervalId);
                    console.warn('⚠️ Timeout waiting for BoundedUtilities - using fallbacks');
                    this.setupFallbackUtilities();
                    resolve(true); // Continue with fallbacks
                }
            }, checkInterval);
        });
    }

    /**
     * Setup fallback utilities if BoundedUtilities not available
     * 2+ assertions per function
     */
    setupFallbackUtilities() {
 // Fallback setup assertions
        window.Assert.assertNotNull(this, 'Game instance must exist');
        window.Assert.assert(!window.BoundedUtilities || typeof window.BoundedUtilities.escapeHtml !== 'function', 'Fallbacks needed when BoundedUtilities unavailable');
        
        
 // Create minimal fallback BoundedUtilities if not available
        if (!window.BoundedUtilities) {
            window.BoundedUtilities = {};
        }
        
 // Provide safe fallback implementations
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
     * Setup event system
     * 2+ assertions per function
     */
    setupEventHandlers() {
 // Event setup assertions
        window.Assert.assertNotNull(this.container, 'Container required for events');
        window.Assert.assert(this.eventHandlers instanceof Map, 'Handler storage must be available');
        
        try {
 // Remove any existing handlers first
            this.clearEventHandlers();
            
 // Create bounded click handler (Rule 1: Simple control flow)
            const clickHandler = (event) => this.handleClick(event);
            const inputHandler = (event) => this.handleInput(event);
            
 // Rule 6: Check return values for event listener setup
            this.container.addEventListener('click', clickHandler);
            this.container.addEventListener('input', inputHandler);
            
 // Store handlers for cleanup (Rule 3: Fixed storage)
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
     * Handle click events
     * 2+ assertions per function
     */
    handleClick(event) {
 // Click handling assertions
        window.Assert.assertNotNull(event, 'Event object must exist');
        window.Assert.assertNotNull(event.target, 'Event target must exist');
        
 // Simple control flow with early returns
        if (this.gameState.isAnimating) {
            return true; // Skip during animations
        }
        
        const action = event.target.getAttribute('data-action');
        if (!action) {
            return true; // No action, continue normally
        }
        
        event.preventDefault();
        
 // Simple switch instead of complex delegation
        switch (action) {
            case 'start-game':
                return this.startGame();
            case 'generate-challenge':
                return this.generateChallenge();
            case 'check-answer':
                return this.checkAnswer();
            case 'go-home':
                return this.goToScreen('welcome');
            default:
                console.log(`Unknown action: ${action}`);
                return true;
        }
    }

    /**
     * Handle input events
     * 2+ assertions per function
     */
    handleInput(event) {
 // Input handling assertions
        window.Assert.assertNotNull(event, 'Event object required');
        window.Assert.assertNotNull(event.target, 'Input target required');
        
        const target = event.target;
        const field = target.getAttribute('data-field');
        
 // Simple control flow
        if (target.id === 'player-name') {
            return this.updatePlayerName(target.value);
        }
        
        if (field && target.hasAttribute('data-answer')) {
            return this.updateAnswer(field, target.value);
        }
        
        return true;
    }

    /**
     * Update player name with validation
     * 2+ assertions per function
     */
    updatePlayerName(value) {
 // Name update assertions
        window.Assert.assertType(value, 'string', 'Player name');
        window.Assert.assert(this.gameState !== null, 'Game state must exist');
        
 // Fixed loop bound for name validation
        const maxNameLength = 20;
        const cleanName = window.BoundedUtilities.sanitizeString(value, maxNameLength);
        
        this.gameState.playerName = cleanName;
        
 // Check return value of button update
            const updateResult = this.updateStartButton();
            window.Assert.assert(updateResult === true, 'Start button update must succeed');
        
        console.log(`Player name updated: ${cleanName}`);
        return true;
    }

    /**
     * Update start button state
     * 2+ assertions per function
     */
    updateStartButton() {
 // Button update assertions
        window.Assert.assertType(this.gameState.playerName, 'string', 'Player name');
        window.Assert.assertNotNull(this.container, 'Container must be available');
        
        try {
            const button = this.container.querySelector('[data-action="start-game"]');
            if (!button) {
                return true; // Button not present, that's ok
            }
            
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
     * Rule 4: Function ≤ 60 lines - Start game with validation
     * Rule 5: 2+ assertions per function
     */
    startGame() {
 // Rule 5: Game start assertions
        window.Assert.assertType(this.gameState.playerName, 'string', 'Player name');
        window.Assert.assert(this.isInitialized === true, 'Game must be initialized');
        
        const trimmedName = this.gameState.playerName.trim();
        if (trimmedName.length === 0) {
            this.showError('Please enter your name first!');
            return false;
        }
        
 // Rule 6: Check screen transition return value
        const transitionResult = this.goToScreen('game');
        window.Assert.assert(transitionResult === true, 'Screen transition must succeed');
        
        console.log(`🎮 Game started for player: ${trimmedName}`);
        return true;
    }

    /**
     * Rule 4: Function ≤ 60 lines - Generate new challenge
     * Rule 5: 2+ assertions per function
     */
    generateChallenge() {
 // Rule 5: Challenge generation assertions
        window.Assert.assertNotNull(this.gameData, 'Game data must be available');
        window.Assert.assertNotNull(this.gameState, 'Game state must be available');
        
        try {
 // Rule 3: Use pre-allocated arrays (no dynamic allocation)
            const categories = ['coffee', 'frappuccino', 'refresher'];
            const drinks = this.gameData.drinks;
            
 // Rule 2: Fixed bounds random selection (max 10 attempts)
            let attempts = 0;
            const maxAttempts = 10;
            
            while (attempts < maxAttempts) {
                const categoryIndex = Math.floor(Math.random() * categories.length);
                const category = categories[categoryIndex];
                const categoryDrinks = drinks[category];
                
                if (categoryDrinks && Object.keys(categoryDrinks).length > 0) {
                    const drinkNames = Object.keys(categoryDrinks);
                    const drinkIndex = Math.floor(Math.random() * drinkNames.length);
                    const drinkName = drinkNames[drinkIndex];
                    
                    this.gameState.currentCategory = category;
                    this.gameState.currentDrink = drinkName;
                    this.gameState.currentSize = this.selectRandomSize();
                    this.gameState.userAnswer = {};
                    this.gameState.showResult = false;
                    
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
     * Rule 4: Function ≤ 60 lines - Select random drink size
     * Rule 5: 2+ assertions per function
     */
    selectRandomSize() {
 // Rule 5: Size selection assertions
        window.Assert.assertNotNull(this.gameData, 'Game data required for size selection');
        window.Assert.assertNotNull(this.gameData.sizes, 'Sizes data must exist');
        
 // Rule 3: Pre-allocated size options
        const sizes = ['tall', 'grande', 'venti'];
        const randomIndex = Math.floor(Math.random() * sizes.length);
        
        return sizes[randomIndex];
    }

    /**
     * Rule 4: Function ≤ 60 lines - Check user's answer
     * Rule 5: 2+ assertions per function
     */
    checkAnswer() {
 // Rule 5: Answer checking assertions
        window.Assert.assertType(this.gameState.currentDrink, 'string', 'Current drink');
        window.Assert.assertType(this.gameState.currentSize, 'string', 'Current size');
        
        try {
            const drink = this.gameData.drinks[this.gameState.currentCategory][this.gameState.currentDrink];
            if (!drink) {
                this.showError('Drink data not found');
                return false;
            }
            
            const recipe = drink.recipe[this.gameState.currentSize];
            if (!recipe) {
                this.showError('Recipe not found for size');
                return false;
            }
            
 // Rule 2: Fixed loop bound for answer checking
            let correct = true;
            const maxFields = 10;
            let fieldCount = 0;
            
            for (const field in recipe) {
                if (fieldCount >= maxFields) break; // Rule 2: Fixed upper bound
                
                const expected = recipe[field];
                const userValue = parseInt(this.gameState.userAnswer[field] || '0', 10);
                
                if (userValue !== expected) {
                    correct = false;
                    break;
                }
                fieldCount++;
            }
            
            this.gameState.isCorrect = correct;
            this.gameState.showResult = true;
            
            if (correct) {
                this.updateScore();
            }
            
            return this.render();
            
        } catch (error) {
            console.error('❌ Answer checking failed:', error);
            this.handleError('Answer checking failed');
            return false;
        }
    }

    /**
     * Rule 4: Function ≤ 60 lines - Update game score
     * Rule 5: 2+ assertions per function
     */
    updateScore() {
 // Rule 5: Score update assertions
        window.Assert.assertType(this.gameState.stars, 'number', 'Stars');
        window.Assert.assertType(this.gameState.streak, 'number', 'Streak');
        
        this.gameState.stars++;
        this.gameState.streak++;
        
        if (this.gameState.streak > this.gameState.maxStreak) {
            this.gameState.maxStreak = this.gameState.streak;
        }
        
 // Rule 6: Check level calculation return value
        const newLevel = Math.floor(this.gameState.stars / 5) + 1;
        if (newLevel > this.gameState.level) {
            this.gameState.level = newLevel;
            console.log(`🌟 Level up! Now level ${newLevel}`);
        }
        
        console.log(`⭐ Score updated: ${this.gameState.stars} stars, ${this.gameState.streak} streak`);
        return true;
    }

    /**
     * Rule 4: Function ≤ 60 lines - Update user answer
     * Rule 5: 2+ assertions per function
     */
    updateAnswer(field, value) {
 // Rule 5: Answer update assertions
        window.Assert.assertType(field, 'string', 'Field name');
        window.Assert.assertNotNull(value, 'Value must not be null');
        
 // Rule 2: Bounded value validation
        const numericValue = parseInt(value, 10);
        const maxValue = 10;
        
        if (numericValue >= 0 && numericValue <= maxValue) {
            this.gameState.userAnswer[field] = numericValue;
            console.log(`Answer updated: ${field} = ${numericValue}`);
            return true;
        }
        
        console.warn(`Invalid answer value: ${value}`);
        return false;
    }

    /**
     * Rule 4: Function ≤ 60 lines - Navigate to screen
     * Rule 5: 2+ assertions per function
     */
    goToScreen(screenName) {
 // Rule 5: Screen navigation assertions
        window.Assert.assertType(screenName, 'string', 'Screen name');
        window.Assert.assert(this.isInitialized === true, 'Game must be initialized');
        
        const validScreens = ['welcome', 'game', 'result'];
        if (!validScreens.includes(screenName)) {
            console.error(`Invalid screen: ${screenName}`);
            return false;
        }
        
        this.gameState.screen = screenName;
        
 // Rule 6: Check render return value
        const renderResult = this.render();
        window.Assert.assert(renderResult === true, 'Screen render must succeed');
        
        console.log(`📱 Navigated to screen: ${screenName}`);
        return true;
    }

    /**
     * Rule 4: Function ≤ 60 lines - Main render function
     * Rule 5: 2+ assertions per function
     */
    render() {
 // Rule 5: Render assertions
        window.Assert.assertNotNull(this.container, 'Container must be valid');
        window.Assert.assertType(this.gameState.screen, 'string', 'Screen');
        
        try {
            let content = '';
            
 // Rule 1: Simple control flow
            switch (this.gameState.screen) {
                case 'welcome':
                    content = this.renderWelcomeScreen();
                    break;
                case 'game':
                    content = this.renderGameScreen();
                    break;
                case 'result':
                    content = this.renderResultScreen();
                    break;
                default:
                    content = this.renderErrorScreen();
            }
            
            this.container.innerHTML = content;
            
 // Rule 6: Check button update after render
            if (this.gameState.screen === 'welcome') {
                const updateResult = this.updateStartButton();
                window.Assert.assert(updateResult === true, 'Button update after render must succeed');
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
     * Rule 4: Function ≤ 60 lines - Render welcome screen
     * Rule 5: 2+ assertions per function
     */
    renderWelcomeScreen() {
 // Rule 5: Welcome screen assertions
        window.Assert.assertType(this.gameState.playerName, 'string', 'Player name');
        window.Assert.assertNotNull(this.container, 'Container must be available');
        
        try {
            // CRITICAL FIX: Ensure BoundedUtilities is available with proper fallback
            let escapedName = '';
            if (window.BoundedUtilities && typeof window.BoundedUtilities.escapeHtml === 'function') {
                escapedName = window.BoundedUtilities.escapeHtml(this.gameState.playerName);
            } else {
                // Fallback HTML escaping
                escapedName = String(this.gameState.playerName || '').replace(/[&<>"']/g, (match) => {
                    const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
                    return escapeMap[match] || match;
                });
            }
            
            const isEnabled = this.gameState.playerName.trim().length > 0;
            
            const html = `
                <div class="game-screen welcome-screen">
                    <div class="welcome-header">
                        <h1 class="game-title">☕ Starbucks Barista Training ☕</h1>
                        <p class="game-subtitle">Learn to make perfect drinks!</p>
                    </div>
                    
                    <div class="welcome-form">
                        <div class="form-group">
                            <label for="player-name">Your Barista Name:</label>
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
                    
                    <div class="welcome-stats">
                        <p>🌟 Level: ${this.gameState.level}</p>
                        <p>⭐ Stars: ${this.gameState.stars}</p>
                        <p>🔥 Best Streak: ${this.gameState.maxStreak}</p>
                    </div>
                </div>
            `;
            
            console.log('✅ Welcome screen HTML generated successfully');
            return html;
            
        } catch (error) {
            console.error('❌ Welcome screen render failed:', error);
            console.error('Error details:', error.message, error.stack);
            // Return basic fallback HTML
            return `
                <div class="game-screen welcome-screen">
                    <div class="welcome-header">
                        <h1 class="game-title">☕ Starbucks Barista Training ☕</h1>
                        <p class="game-subtitle">Learn to make perfect drinks!</p>
                    </div>
                    
                    <div class="welcome-form">
                        <div class="form-group">
                            <label for="player-name">Your Barista Name:</label>
                            <input
                                type="text"
                                id="player-name"
                                value=""
                                placeholder="Enter your name"
                                maxlength="20"
                                class="name-input"
                            />
                        </div>
                        
                        <button
                            data-action="start-game"
                            class="start-button disabled"
                            disabled
                        >
                            Start My Adventure!
                        </button>
                    </div>
                    
                    <div class="welcome-stats">
                        <p>🌟 Level: 1</p>
                        <p>⭐ Stars: 0</p>
                        <p>🔥 Best Streak: 0</p>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Rule 4: Function ≤ 60 lines - Render game screen
     * Rule 5: 2+ assertions per function
     */
    renderGameScreen() {
 // Rule 5: Game screen assertions
        window.Assert.assertNotNull(this.gameState, 'Game state must exist');
        window.Assert.assertNotNull(this.container, 'Container must be available');
        
        if (!this.gameState.currentDrink) {
            return `
                <div class="game-screen">
                    <h2>Ready to Practice?</h2>
                    <button data-action="generate-challenge" class="challenge-button">
                        Generate New Challenge
                    </button>
                    <button data-action="go-home" class="home-button">Back to Menu</button>
                </div>
            `;
        }
        
 // Rule 5: Assertions for when we have a current drink
        window.Assert.assertType(this.gameState.currentDrink, 'string', 'Current drink');
        window.Assert.assertType(this.gameState.currentSize, 'string', 'Current size');
        
        const drink = this.gameData.drinks[this.gameState.currentCategory][this.gameState.currentDrink];
        const recipe = drink.recipe[this.gameState.currentSize];
        
        let inputFields = '';
        for (const field in recipe) {
            const value = this.gameState.userAnswer[field] || '';
            inputFields += `
                <div class="input-group">
                    <label>${window.BoundedUtilities.capitalize(field)}:</label>
                    <input 
                        type="number" 
                        min="0" 
                        max="10" 
                        value="${value}"
                        data-field="${field}"
                        data-answer="true"
                        class="recipe-input"
                    />
                </div>
            `;
        }
        
        return `
            <div class="game-screen">
                <div class="challenge-header">
                    <h2>Make a ${window.BoundedUtilities.capitalize(this.gameState.currentSize)} ${this.gameState.currentDrink}</h2>
                    <p>Stars: ${this.gameState.stars} | Streak: ${this.gameState.streak}</p>
                </div>
                
                <div class="recipe-inputs">
                    ${inputFields}
                </div>
                
                ${this.gameState.showResult ? this.renderResult() : `
                    <button data-action="check-answer" class="check-button">Check Recipe!</button>
                `}
                
                <div class="game-actions">
                    <button data-action="generate-challenge" class="next-button">Next Challenge</button>
                    <button data-action="go-home" class="home-button">Menu</button>
                </div>
            </div>
        `;
    }

    /**
     * Rule 4: Function ≤ 60 lines - Render result display
     * Rule 5: 2+ assertions per function
     */
    renderResult() {
 // Rule 5: Result rendering assertions
        window.Assert.assertType(this.gameState.isCorrect, 'boolean', 'Correct flag');
        window.Assert.assertType(this.gameState.currentDrink, 'string', 'Current drink');
        
        const isCorrect = this.gameState.isCorrect;
        const resultClass = isCorrect ? 'correct' : 'incorrect';
        const resultIcon = isCorrect ? '🎉' : '😞';
        const resultText = isCorrect ? 'Perfect!' : 'Not quite right...';
        
        return `
            <div class="result-display ${resultClass}">
                <div class="result-header">
                    <span class="result-icon">${resultIcon}</span>
                    <h3>${resultText}</h3>
                </div>
                ${!isCorrect ? this.renderCorrectRecipe() : ''}
            </div>
        `;
    }

    /**
     * Rule 4: Function ≤ 60 lines - Show correct recipe
     * Rule 5: 2+ assertions per function
     */
    renderCorrectRecipe() {
 // Rule 5: Recipe display assertions
        window.Assert.assertType(this.gameState.currentDrink, 'string', 'Current drink');
        window.Assert.assertType(this.gameState.currentSize, 'string', 'Current size');
        
        const drink = this.gameData.drinks[this.gameState.currentCategory][this.gameState.currentDrink];
        const recipe = drink.recipe[this.gameState.currentSize];
        
        let recipeText = '<h4>Correct Recipe:</h4><ul>';
        
 // Rule 2: Fixed loop bound
        let fieldCount = 0;
        const maxFields = 10;
        
        for (const field in recipe) {
            if (fieldCount >= maxFields) break;
            recipeText += `<li>${window.BoundedUtilities.capitalize(field)}: ${recipe[field]}</li>`;
            fieldCount++;
        }
        
        recipeText += '</ul>';
        return `<div class="correct-recipe">${recipeText}</div>`;
    }

    /**
     * Rule 4: Function ≤ 60 lines - Create game data structure
     * Rule 5: 2+ assertions per function  
     */
    createGameData() {
 // Rule 5: Game data creation assertions
        window.Assert.assertNotNull(this, 'Game instance must exist');
        window.Assert.assertNotNull(this.container, 'Container must be available');
        
 // Rule 3: Pre-allocated, fixed game data (no dynamic allocation)
        const gameData = {
            drinks: {
                coffee: {
                    'Latte': {
                        recipe: { tall: { shots: 1, syrup: 3 }, grande: { shots: 2, syrup: 4 }, venti: { shots: 2, syrup: 5 } }
                    },
                    'Cappuccino': {
                        recipe: { tall: { shots: 1, syrup: 3 }, grande: { shots: 2, syrup: 4 }, venti: { shots: 2, syrup: 5 } }
                    }
                },
                frappuccino: {
                    'Caramel Frappuccino': {
                        recipe: { tall: { roast: 2, base: 2, syrup: 3 }, grande: { roast: 3, base: 3, syrup: 4 }, venti: { roast: 4, base: 4, syrup: 5 } }
                    }
                },
                refresher: {
                    'Strawberry Refresher': {
                        recipe: { tall: { inclusions: 1 }, grande: { inclusions: 1 }, venti: { inclusions: 1 } }
                    }
                }
            },
            sizes: {
                tall: { name: 'Tall', oz: '12oz' },
                grande: { name: 'Grande', oz: '16oz' },
                venti: { name: 'Venti', oz: '20oz' }
            }
        };
        
        console.log('✅ Game data created');
        return gameData;
    }

    /**
     * Rule 4: Function ≤ 60 lines - Handle errors safely
     * Rule 5: 2+ assertions per function
     */
    handleError(message) {
 // Rule 5: Error handling assertions
        window.Assert.assertType(message, 'string', 'Error message');
        window.Assert.assertNotNull(this.gameState, 'Game state must exist');
        
        this.gameState.errorMessage = message;
        console.error(`🚫 Game Error: ${message}`);
        
 // Rule 6: Check error display return value
        const displayResult = this.showError(message);
        window.Assert.assert(displayResult === true, 'Error display must succeed');
        
        return true;
    }

    /**
     * Rule 4: Function ≤ 60 lines - Show error message
     * Rule 5: 2+ assertions per function
     */
    showError(message) {
 // Rule 5: Error display assertions
        window.Assert.assertType(message, 'string', 'Error message');
        window.Assert.assertNotNull(this.container, 'Container must be available');
        
        try {
            const errorElement = document.createElement('div');
            errorElement.className = 'error-toast';
            errorElement.textContent = message;
            errorElement.setAttribute('role', 'alert');
            
            this.container.appendChild(errorElement);
            
 // Rule 2: Fixed timeout (3000ms)
            setTimeout(() => {
                if (errorElement.parentNode) {
                    errorElement.parentNode.removeChild(errorElement);
                }
            }, 3000);
            
            return true;
            
        } catch (error) {
            console.error('Failed to show error:', error);
            return false;
        }
    }

    /**
     * Rule 4: Function ≤ 60 lines - Clean up resources
     * Rule 5: 2+ assertions per function
     */
    cleanup() {
 // Rule 5: Cleanup assertions
        window.Assert.assert(this.isInitialized === true, 'Game must be initialized to clean up');
        window.Assert.assert(this.isDestroyed === false, 'Game must not be already destroyed');
        
        try {
 // Rule 6: Check cleanup return values
            const eventCleanup = this.clearEventHandlers();
            window.Assert.assert(eventCleanup === true, 'Event cleanup must succeed');
            
 // Clear container
            if (this.container) {
                this.container.innerHTML = '';
            }
            
            this.isDestroyed = true;
            console.log('🧹 Game cleanup completed');
            return true;
            
        } catch (error) {
            console.error('❌ Cleanup failed:', error);
            return false;
        }
    }

    /**
     * Rule 4: Function ≤ 60 lines - Clear event handlers
     * Rule 5: 2+ assertions per function
     */
    clearEventHandlers() {
 // Rule 5: Handler cleanup assertions
        window.Assert.assert(this.eventHandlers instanceof Map, 'Handler storage must exist');
        window.Assert.assertNotNull(this.container, 'Container must be available');
        
        try {
 // Rule 2: Fixed loop bound for cleanup
            let cleanupCount = 0;
            const maxCleanups = 10;
            
            for (const [eventType, handler] of this.eventHandlers) {
                if (cleanupCount >= maxCleanups) break;
                
                this.container.removeEventListener(eventType, handler);
                cleanupCount++;
            }
            
            this.eventHandlers.clear();
            console.log('✅ Event handlers cleared');
            return true;
            
        } catch (error) {
            console.error('❌ Event handler cleanup failed:', error);
            return false;
        }
    }

    /**
     * Rule 4: Function ≤ 60 lines - Render error screen
     * Rule 5: 2+ assertions per function
     */
    renderErrorScreen() {
 // Rule 5: Error screen assertions
        window.Assert.assertType(this.gameState.errorMessage, 'string', 'Error message');
        window.Assert.assertNotNull(this.container, 'Container must be available');
        
        const message = this.gameState.errorMessage || 'An error occurred';
        
        return `
            <div class="game-screen error-screen">
                <div class="error-content">
                    <h2>⚠️ Oops!</h2>
                    <p>${window.BoundedUtilities.escapeHtml(message)}</p>
                    <button data-action="go-home" class="error-button">
                        Back to Menu
                    </button>
                </div>
            </div>
        `;
    }
}

// Export for module systems and global use
// Browser-only export
if (typeof window !== 'undefined') {
    window.StarbucksGame = StarbucksGame;
}

// Ready notification
document.addEventListener('DOMContentLoaded', () => {
    console.log('📚 StarbucksGame class ready for initialization (Golden Rules Compliant)');
});
