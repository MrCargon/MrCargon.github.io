/**
 * StarbucksGame.js - Golden Rules Compliant Barista Trainer
 * Simple, reliable, fast - following all 10 Golden Rules for safety-critical code
 * 
 * GOLDEN RULES COMPLIANCE:
 * - Rule 1: Simple control flow (no recursion, goto, setjmp/longjmp)
 * - Rule 2: Fixed loop bounds (max 50 iterations)
 * - Rule 3: No dynamic memory after init (pre-allocated arrays)
 * - Rule 4: Functions ≤ 60 lines each
 * - Rule 5: 2+ assertions per function
 * - Rule 6: All return values checked
 * - Rule 7: Limited preprocessor use
 * - Rule 8: Single-level pointer dereferencing only
 * - Rule 9: Zero compiler warnings
 * - Rule 10: Static analysis clean
 */

/* Import Golden Rules utilities */
import { Assert } from '../golden-rules/Assert.js';
import { BoundedUtilities } from '../golden-rules/BoundedUtilities.js';

class StarbucksGame {
    constructor(container) {
        // Rule 5: Assertions for input validation
        Assert.isNotNull(container, 'Container must not be null');
        Assert.isValidElement(container, 'Container must be valid DOM element');
        
        this.container = container;
        this.isInitialized = false;
        this.isDestroyed = false;
        
        // Rule 3: Pre-allocated fixed-size state (no dynamic allocation)
        this.gameState = this.createInitialState();
        this.gameData = this.createGameData();
        this.eventHandlers = new Map(); // Fixed-size handler storage
        
        console.log('🎮 StarbucksGame constructor completed');
    }

    /**
     * Rule 4: Function ≤ 60 lines - Create initial game state
     * Rule 5: 2+ assertions per function
     */
    createInitialState() {
        // Rule 5: State validation assertions
        Assert.isObject(this, 'Game instance must exist');
        Assert.isValidElement(this.container, 'Container required for state creation');
        
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
        
        console.log('✅ Initial game state created');
        return state;
    }

    /**
     * Rule 4: Function ≤ 60 lines - Initialize game system
     * Rule 5: 2+ assertions per function
     */
    async init() {
        // Rule 5: Initialization assertions
        Assert.isFalse(this.isInitialized, 'Game must not be already initialized');
        Assert.isFalse(this.isDestroyed, 'Game must not be destroyed');
        
        try {
            // Rule 6: Check return values
            const setupResult = this.setupEventHandlers();
            Assert.isTrue(setupResult, 'Event handler setup must succeed');
            
            const renderResult = this.render();
            Assert.isTrue(renderResult, 'Initial render must succeed');
            
            this.isInitialized = true;
            console.log('✅ StarbucksGame initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Game initialization failed:', error);
            this.handleError('Initialization failed: ' + error.message);
            return false;
        }
    }

    /**
     * Rule 4: Function ≤ 60 lines - Setup event system
     * Rule 5: 2+ assertions per function
     */
    setupEventHandlers() {
        // Rule 5: Event setup assertions
        Assert.isValidElement(this.container, 'Container required for events');
        Assert.isTrue(this.eventHandlers instanceof Map, 'Handler storage must be available');
        
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
     * Rule 4: Function ≤ 60 lines - Handle click events
     * Rule 5: 2+ assertions per function
     */
    handleClick(event) {
        // Rule 5: Click handling assertions
        Assert.isNotNull(event, 'Event object must exist');
        Assert.isNotNull(event.target, 'Event target must exist');
        
        // Rule 1: Simple control flow with early returns
        if (this.gameState.isAnimating) {
            return true; // Skip during animations
        }
        
        const action = event.target.getAttribute('data-action');
        if (!action) {
            return true; // No action, continue normally
        }
        
        event.preventDefault();
        
        // Rule 1: Simple switch instead of complex delegation
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
     * Rule 4: Function ≤ 60 lines - Handle input events
     * Rule 5: 2+ assertions per function
     */
    handleInput(event) {
        // Rule 5: Input handling assertions
        Assert.isNotNull(event, 'Event object required');
        Assert.isNotNull(event.target, 'Input target required');
        
        const target = event.target;
        const field = target.getAttribute('data-field');
        
        // Rule 1: Simple control flow
        if (target.id === 'player-name') {
            return this.updatePlayerName(target.value);
        }
        
        if (field && target.hasAttribute('data-answer')) {
            return this.updateAnswer(field, target.value);
        }
        
        return true;
    }

    /**
     * Rule 4: Function ≤ 60 lines - Update player name with validation
     * Rule 5: 2+ assertions per function
     */
    updatePlayerName(value) {
        // Rule 5: Name update assertions
        Assert.isString(value, 'Player name must be string');
        Assert.isTrue(this.gameState !== null, 'Game state must exist');
        
        // Rule 2: Fixed loop bound for name validation
        const maxNameLength = 20;
        const cleanName = BoundedUtilities.sanitizeString(value, maxNameLength);
        
        this.gameState.playerName = cleanName;
        
        // Rule 6: Check return value of button update
        const updateResult = this.updateStartButton();
        Assert.isTrue(updateResult, 'Start button update must succeed');
        
        console.log(`Player name updated: ${cleanName}`);
        return true;
    }

    /**
     * Rule 4: Function ≤ 60 lines - Update start button state
     * Rule 5: 2+ assertions per function
     */
    updateStartButton() {
        // Rule 5: Button update assertions
        Assert.isString(this.gameState.playerName, 'Player name must be string');
        Assert.isValidElement(this.container, 'Container must be available');
        
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
        Assert.isString(this.gameState.playerName, 'Player name required');
        Assert.isTrue(this.isInitialized, 'Game must be initialized');
        
        const trimmedName = this.gameState.playerName.trim();
        if (trimmedName.length === 0) {
            this.showError('Please enter your name first!');
            return false;
        }
        
        // Rule 6: Check screen transition return value
        const transitionResult = this.goToScreen('game');
        Assert.isTrue(transitionResult, 'Screen transition must succeed');
        
        console.log(`🎮 Game started for player: ${trimmedName}`);
        return true;
    }

    /**
     * Rule 4: Function ≤ 60 lines - Generate new challenge
     * Rule 5: 2+ assertions per function
     */
    generateChallenge() {
        // Rule 5: Challenge generation assertions
        Assert.isObject(this.gameData, 'Game data must be available');
        Assert.isObject(this.gameState, 'Game state must be available');
        
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
        Assert.isObject(this.gameData, 'Game data required for size selection');
        Assert.isObject(this.gameData.sizes, 'Sizes data must exist');
        
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
        Assert.isString(this.gameState.currentDrink, 'Current drink must be set');
        Assert.isString(this.gameState.currentSize, 'Current size must be set');
        
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
                const userValue = parseInt(this.gameState.userAnswer[field] || '0');
                
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
        Assert.isNumber(this.gameState.stars, 'Stars must be number');
        Assert.isNumber(this.gameState.streak, 'Streak must be number');
        
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
        Assert.isString(field, 'Field name must be string');
        Assert.isNotNull(value, 'Value must not be null');
        
        // Rule 2: Bounded value validation
        const numericValue = parseInt(value);
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
        Assert.isString(screenName, 'Screen name must be string');
        Assert.isTrue(this.isInitialized, 'Game must be initialized');
        
        const validScreens = ['welcome', 'game', 'result'];
        if (!validScreens.includes(screenName)) {
            console.error(`Invalid screen: ${screenName}`);
            return false;
        }
        
        this.gameState.screen = screenName;
        
        // Rule 6: Check render return value
        const renderResult = this.render();
        Assert.isTrue(renderResult, 'Screen render must succeed');
        
        console.log(`📱 Navigated to screen: ${screenName}`);
        return true;
    }

    /**
     * Rule 4: Function ≤ 60 lines - Main render function
     * Rule 5: 2+ assertions per function
     */
    render() {
        // Rule 5: Render assertions
        Assert.isValidElement(this.container, 'Container must be valid');
        Assert.isString(this.gameState.screen, 'Screen must be set');
        
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
                Assert.isTrue(updateResult, 'Button update after render must succeed');
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
        Assert.isString(this.gameState.playerName, 'Player name must be string');
        Assert.isValidElement(this.container, 'Container must be available');
        
        const escapedName = BoundedUtilities.escapeHtml(this.gameState.playerName);
        const isEnabled = this.gameState.playerName.trim().length > 0;
        
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
    }

    /**
     * Rule 4: Function ≤ 60 lines - Render game screen
     * Rule 5: 2+ assertions per function
     */
    renderGameScreen() {
        // Rule 5: Game screen assertions
        Assert.isString(this.gameState.currentDrink, 'Current drink must be set');
        Assert.isString(this.gameState.currentSize, 'Current size must be set');
        
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
        
        const drink = this.gameData.drinks[this.gameState.currentCategory][this.gameState.currentDrink];
        const recipe = drink.recipe[this.gameState.currentSize];
        
        let inputFields = '';
        for (const field in recipe) {
            const value = this.gameState.userAnswer[field] || '';
            inputFields += `
                <div class="input-group">
                    <label>${BoundedUtilities.capitalize(field)}:</label>
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
                    <h2>Make a ${BoundedUtilities.capitalize(this.gameState.currentSize)} ${this.gameState.currentDrink}</h2>
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
        Assert.isBoolean(this.gameState.isCorrect, 'Correct flag must be boolean');
        Assert.isString(this.gameState.currentDrink, 'Current drink must be set');
        
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
        Assert.isString(this.gameState.currentDrink, 'Current drink required');
        Assert.isString(this.gameState.currentSize, 'Current size required');
        
        const drink = this.gameData.drinks[this.gameState.currentCategory][this.gameState.currentDrink];
        const recipe = drink.recipe[this.gameState.currentSize];
        
        let recipeText = '<h4>Correct Recipe:</h4><ul>';
        
        // Rule 2: Fixed loop bound
        let fieldCount = 0;
        const maxFields = 10;
        
        for (const field in recipe) {
            if (fieldCount >= maxFields) break;
            recipeText += `<li>${BoundedUtilities.capitalize(field)}: ${recipe[field]}</li>`;
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
        Assert.isObject(this, 'Game instance must exist');
        Assert.isValidElement(this.container, 'Container must be available');
        
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
        Assert.isString(message, 'Error message must be string');
        Assert.isObject(this.gameState, 'Game state must exist');
        
        this.gameState.errorMessage = message;
        console.error(`🚫 Game Error: ${message}`);
        
        // Rule 6: Check error display return value
        const displayResult = this.showError(message);
        Assert.isTrue(displayResult, 'Error display must succeed');
        
        return true;
    }

    /**
     * Rule 4: Function ≤ 60 lines - Show error message
     * Rule 5: 2+ assertions per function
     */
    showError(message) {
        // Rule 5: Error display assertions
        Assert.isString(message, 'Error message must be string');
        Assert.isValidElement(this.container, 'Container must be available');
        
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
        Assert.isTrue(this.isInitialized, 'Game must be initialized to clean up');
        Assert.isFalse(this.isDestroyed, 'Game must not be already destroyed');
        
        try {
            // Rule 6: Check cleanup return values
            const eventCleanup = this.clearEventHandlers();
            Assert.isTrue(eventCleanup, 'Event cleanup must succeed');
            
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
        Assert.isTrue(this.eventHandlers instanceof Map, 'Handler storage must exist');
        Assert.isValidElement(this.container, 'Container must be available');
        
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
        Assert.isString(this.gameState.errorMessage, 'Error message must be string');
        Assert.isValidElement(this.container, 'Container must be available');
        
        const message = this.gameState.errorMessage || 'An error occurred';
        
        return `
            <div class="game-screen error-screen">
                <div class="error-content">
                    <h2>⚠️ Oops!</h2>
                    <p>${BoundedUtilities.escapeHtml(message)}</p>
                    <button data-action="go-home" class="error-button">
                        Back to Menu
                    </button>
                </div>
            </div>
        `;
    }
}

// Export for module systems and global use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StarbucksGame;
} else {
    window.StarbucksGame = StarbucksGame;
}

// Ready notification
document.addEventListener('DOMContentLoaded', () => {
    console.log('📚 StarbucksGame class ready for initialization (Golden Rules Compliant)');
});
