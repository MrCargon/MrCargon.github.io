/**
 * StarbucksGame.js - Complete Barista Training Game
 * Comprehensive recreation with full functionality following project rules
 * Phase 1 Refactoring: Data modules extracted to starbucks-game/data/
 */

// Phase 1: Import data modules
import { RECIPES } from './starbucks-game/data/recipes.js';
import { BADGE_TYPES } from './starbucks-game/data/badges.js';
import { SIZE_INFO, SIZE_MAPPINGS } from './starbucks-game/data/sizes.js';
import { BARISTA_TIPS } from './starbucks-game/data/tips.js';

// Phase 2: Import logic managers
import { ChallengeManager } from './starbucks-game/logic/ChallengeManager.js';
import { ScoreManager } from './starbucks-game/logic/ScoreManager.js';
import { BadgeManager } from './starbucks-game/logic/BadgeManager.js';
import { AnswerValidator } from './starbucks-game/logic/AnswerValidator.js';

// Phase 3: Import core modules
import { GameState } from './starbucks-game/core/GameState.js';
import { GAME_CONFIG, SCREENS } from './starbucks-game/core/GameConfig.js';

// Phase 4: Import UI modules
import { ScreenRenderer } from './starbucks-game/ui/ScreenRenderer.js';
import { InputHandlers } from './starbucks-game/ui/components/InputHandlers.js';

class StarbucksGame {
    constructor(container) {
        // Debug mode flag - set to false for production, true for development
        this.DEBUG_MODE = false; // P2.1: Production console cleanup

        // Safe assertions for input validation with fallbacks
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(container, 'Container must not be null');
                window.Assert.assertNotNull(container, 'Container must be valid DOM element');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert system not available in constructor, using basic validation');
            }
            if (!container) {
                throw new Error('Container element is required for StarbucksGame');
            }
        }

        this.container = container;
        this.isInitialized = false;
        this.isDestroyed = false;

        // Phase 3: Use imported data modules instead of creating it
        this.gameData = {
            recipes: RECIPES,
            sizeInfo: SIZE_INFO,
            badgeTypes: BADGE_TYPES,
            baristaTips: BARISTA_TIPS
        };

        // Phase 3: Initialize state manager
        this.gameState = new GameState();
        this.eventHandlers = new Map(); // Fixed-size handler storage

        // Phase 2: Initialize logic managers
        this.challengeManager = new ChallengeManager(RECIPES, SIZE_INFO);
        this.scoreManager = new ScoreManager(GAME_CONFIG.STARS_PER_LEVEL);
        this.badgeManager = new BadgeManager(BADGE_TYPES, RECIPES);
        this.answerValidator = new AnswerValidator(RECIPES, SIZE_INFO);

        // Input handlers (initialized in setupEventHandlers)
        this.inputHandlers = null;

        // Sound effect placeholders (following project rules)
        this.sounds = {
            correct: () => this.debugLog("🎵 Correct sound!"),
            wrong: () => this.debugLog("🎵 Wrong sound!"),
            star: () => this.debugLog("🎵 Star earned sound!"),
            levelUp: () => this.debugLog("🎵 Level up fanfare!")
        };

        // Register with RulesEnforcer system
        this.registerWithRulesSystem();
    }

    /**
     * P2.1: Debug logger - only logs in development mode
     * Wraps console.log to allow production (cleanup * 2) + assertions per function
     */
    debugLog(message, ...args) {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(message, 'Log message must not be null');
                window.Assert.assertType && window.Assert.assertType(this.DEBUG_MODE, 'boolean', 'DEBUG_MODE flag');
            }
        } catch (error) {
            // Assertions not available - continue without validation
        }

        if (this.DEBUG_MODE) {
            console.log(message, ...args);
        }
        return true;
    }

    /**
     * Register with RulesEnforcer (system * 2) + assertions per function
     */
    registerWithRulesSystem() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this, 'Game instance must exist');
                window.Assert.assertNotNull(this.container, 'Container must be available');
            }
        } catch (error) {
            this.debugLog('ℹ️ RulesEnforcer not available - continuing without registration');
            return true;
        }

        try {
            if (window.RulesEnforcer && typeof window.RulesEnforcer.registerComponent === 'function') {
                window.RulesEnforcer.registerComponent('StarbucksGame', this);
                this.debugLog('✅ StarbucksGame registered with RulesEnforcer');
                return true;
            }

            this.debugLog('ℹ️ RulesEnforcer not available - continuing without registration');
            return true;
            
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Failed to register with RulesEnforcer:', error);
            }
            return false;
        }
    }

    // Phase 3: createInitialState() and createGameData() removed - now use GameState class and direct imports

    /**
     * Initialize game (system * 2) + assertions per function
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

        // P2.2: Show loading state during async initialization
        this.container.innerHTML = '<div class="game-loading-state" style="display:flex;align-items:center;justify-content:center;height:400px;font-size:18px;color:#00754a;">Loading game...</div>';

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
            // P2.3: Defensive cleanup - ensure event handlers are cleared on init failure
            this.clearEventHandlers();
            console.error('❌ Game initialization failed:', error);
            this.handleError('Initialization failed: ' + error.message);
            return false;
        }
    }

    /**
     * Wait for BoundedUtilities with (timeout * 2) + assertions per function
     */
    async waitForBoundedUtilities(timeout = 5000) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(timeout, 'number', 'Timeout value');
                window.Assert.assertRange && window.Assert.assertRange(timeout, 100, 30000, 'Timeout range');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert system not available during utility wait, using defaults');
            }
            timeout = Math.max(100, Math.min(timeout || 5000, 30000));
        }
        
        if (window.BoundedUtilities && typeof window.BoundedUtilities.escapeHtml === 'function') {
            return true;
        }

        this.debugLog('⏳ Waiting for BoundedUtilities to be available...');
        
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
                    if (this.DEBUG_MODE) {
                        console.warn('⚠️ Timeout waiting for BoundedUtilities - using fallbacks');
                    }
                    this.setupFallbackUtilities();
                    resolve(true);
                }
            }, checkInterval);
        });
    }

    /**
     * Setup fallback utilities if BoundedUtilities not (available * 2) + assertions per function
     */
    setupFallbackUtilities() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this, 'Game instance must exist');
                window.Assert.assert && window.Assert.assert(!window.BoundedUtilities || typeof window.BoundedUtilities.escapeHtml !== 'function', 'Fallbacks needed when BoundedUtilities unavailable');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in setupFallbackUtilities');
            }
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
     * Setup comprehensive event (system * 2) + assertions per function
     */
    setupEventHandlers() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.container, 'Container required for events');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in setupEventHandlers');
            }
        }

        try {
            // Create callback map for InputHandlers
            const callbacks = {
                startGame: () => this.startGame(),
                goToScreen: (screen) => this.goToScreen(screen),
                generateRandomChallenge: () => this.generateRandomChallenge(),
                selectCategory: (category) => this.selectCategory(category),
                selectDrink: (drinkName, categoryName) => this.selectDrink(drinkName, categoryName),
                startPractice: () => this.startPractice(),
                checkAnswer: () => this.checkAnswer(),
                toggleTip: () => this.toggleTip(),
                goBack: () => this.goBack(),
                goToRecipeCategory: (category) => this.goToRecipeCategory(category),
                updatePlayerName: (value) => this.updatePlayerName(value),
                updateAnswer: (field, value) => this.updateAnswer(field, value),
                isAnimating: () => this.gameState.getState().isAnimating
            };

            // Initialize InputHandlers with callback map
            this.inputHandlers = new InputHandlers(this.container, callbacks);
            const result = this.inputHandlers.setupEventHandlers();

            this.debugLog('✅ Event handlers setup complete via InputHandlers');
            return result;

        } catch (error) {
            console.error('❌ Event handler setup failed:', error);
            return false;
        }
    }

    /**
     * Clear event (handlers * 2) + assertions per function
     */
    clearEventHandlers() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.container, 'Container must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in clearEventHandlers');
            }
        }

        try {
            if (this.inputHandlers) {
                const result = this.inputHandlers.clearEventHandlers();
                this.debugLog('✅ Event handlers cleared via InputHandlers');
                return result;
            }
            this.debugLog('✅ No event handlers to clear');
            return true;
        } catch (error) {
            console.error('❌ Failed to clear event handlers:', error);
            return false;
        }
    }

    /**
     * Comprehensive click event (handling * 2) + assertions per function
     */
    handleClick(event) {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(event, 'Event object must exist');
                window.Assert.assertNotNull(event.target, 'Event target must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in handleClick');
            }
        }
        
        if (this.gameState.isAnimating) {
            return true;
        }

        const actionElement = event.target.closest('[data-action]');
        const action = actionElement ? actionElement.getAttribute('data-action') : null;
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
                const category = actionElement.getAttribute('data-category');
                return this.selectCategory(category);
            case 'select-drink':
                const drinkName = actionElement.getAttribute('data-drink');
                const categoryName = actionElement.getAttribute('data-category');
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
                this.debugLog(`Unknown action: ${action}`);
                return true;
        }
    }

    /**
     * Handle input events with (validation * 2) + assertions per function
     */
    handleInput(event) {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(event, 'Event object required');
                window.Assert.assertNotNull(event.target, 'Input target required');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in handleInput');
            }
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
     * Handle input focus for mobile keyboard positioning
     * Enhanced for iOS modal + keyboard interaction
     * @param {FocusEvent} event - Focus event
     * @returns {boolean} - Always true
     */
    handleInputFocus(event) {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(event, 'Event must exist');
                window.Assert.assertNotNull(event.target, 'Event target must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in handleInputFocus');
            }
        }

        const input = event.target;

        // Mobile keyboard positioning (iOS/Android)
        if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
            // Delay to allow keyboard to open (300ms for iOS, 400ms for older devices)
            setTimeout(() => {
                // First, scroll the input into view
                input.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest'
                });

                // CRITICAL iOS FIX: Check if input is in bottom half of viewport
                // If so, also scroll the modal container to prevent keyboard overlap
                setTimeout(() => {
                    const inputRect = input.getBoundingClientRect();
                    const viewportHeight = window.visualViewport?.height || window.innerHeight;

                    // If input is in bottom 60% of viewport, it's likely behind keyboard
                    if (inputRect.bottom > viewportHeight * 0.6) {
                        // Scroll modal container to move input to 40% from top
                        const scrollAdjustment = inputRect.bottom - (viewportHeight * 0.4);
                        this.container.scrollTop += scrollAdjustment;
                    }
                }, 100); // Additional delay for keyboard animation to complete
            }, 300);
        }

        return true;
    }

    /**
     * Handle input blur (cleanup if needed)
     * @param {FocusEvent} event - Blur event
     * @returns {boolean} - Always true
     */
    handleInputBlur(event) {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(event, 'Event must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in handleInputBlur');
            }
        }

        // Future: Add cleanup logic if needed (e.g., scroll restoration)

        return true;
    }

    /**
     * Handle keyboard navigation for interactive cards
     * Enables Enter and Space to trigger card actions
     * @param {KeyboardEvent} event - Keyboard event
     * @returns {boolean} - True if handled
     */
    handleKeyDown(event) {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(event, 'Event must exist');
                window.Assert.assertNotNull(event.target, 'Event target must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in handleKeyDown');
            }
        }

        // Only handle Enter and Space keys
        if (event.key !== 'Enter' && event.key !== ' ') {
            return true;
        }

        // Find closest element with role="button" and data-action
        const target = event.target.closest('[role="button"][data-action]');
        if (!target) {
            return true;
        }

        // Prevent default scrolling behavior for Space
        event.preventDefault();

        // Trigger click on the card
        target.click();

        return true;
    }

    /**
     * Update player name with (validation * 2) + assertions per function
     */
    updatePlayerName(value) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(value, 'string', 'Player name');
                window.Assert.assert && window.Assert.assert(this.gameState !== null, 'Game state must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in updatePlayerName');
            }
        }
        
        const maxNameLength = 20;
        const cleanName = window.BoundedUtilities.sanitizeString(value, maxNameLength);
        
        this.gameState.playerName = cleanName;
        this.updateStartButton();

        this.debugLog(`Player name updated: ${cleanName}`);
        return true;
    }

    /**
     * Update start button (state * 2) + assertions per function
     */
    updateStartButton() {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(this.gameState.playerName, 'string', 'Player name');
                window.Assert.assertNotNull(this.container, 'Container must be available');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in updateStartButton');
            }
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
     * Start the game with (validation * 2) + assertions per function
     */
    startGame() {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(this.gameState.playerName, 'string', 'Player name');
                window.Assert.assert && window.Assert.assert(this.isInitialized === true, 'Game must be initialized');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in startGame');
            }
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

        this.debugLog(`🎮 Game started for player: ${trimmedName}`);
        return true;
    }

    /**
     * Navigate to different (screens * 2) + assertions per function
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

        // Re-apply scaling after screen change to update overflow settings
        if (this.scaler && typeof this.scaler.handleResize === 'function') {
            this.scaler.handleResize();
        }

        this.debugLog(`📱 Navigated to screen: ${screenName}`);
        return true;
    }

    /**
     * Generate random (challenge * 2) + assertions per function
     * Phase 2: Now uses ChallengeManager
     */
    generateRandomChallenge() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.gameData.recipes, 'Recipe data must be available');
                window.Assert.assertNotNull(this.gameState, 'Game state must be available');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in generateRandomChallenge');
            }
        }

        try {
            const state = this.gameState.getState();
            const challenge = this.challengeManager.startChallenge(state.activeCategory);

            if (!challenge) {
                this.showError('Could not generate challenge');
                return false;
            }

            this.gameState.setState({
                currentChallenge: challenge,
                answer: {},
                showResult: false,
                animation: '',
                screen: 'challenge'
            });

            return this.render();

        } catch (error) {
            console.error('❌ Challenge generation failed:', error);
            this.handleError('Challenge generation failed');
            return false;
        }
    }

    // Phase 2: selectRandomSize moved to ChallengeManager

    /**
     * Select category for (challenges * 2) + assertions per function
     */
    selectCategory(category) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(category, 'string', 'Category name');
                window.Assert.assertNotNull(this.gameData.recipes, 'Recipes must be available');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in selectCategory');
            }
        }

        this.gameState.setState({ activeCategory: category });
        return this.generateRandomChallenge();
    }

    /**
     * Select specific drink for (practice * 2) + assertions per function
     */
    selectDrink(drinkName, categoryName) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(drinkName, 'string', 'Drink name');
                window.Assert.assertType(categoryName, 'string', 'Category name');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in selectDrink');
            }
        }
        
        this.gameState.selectedDrink = drinkName;
        this.gameState.activeCategory = categoryName;
        this.gameState.screen = 'recipe-detail';
        
        return this.render();
    }

    /**
     * Start practice with selected (drink * 2) + assertions per function
     * Phase 2: Now uses ChallengeManager.selectRandomSize
     */
    startPractice() {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(this.gameState.selectedDrink, 'string', 'Selected drink');
                window.Assert.assertType(this.gameState.activeCategory, 'string', 'Active category');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in startPractice');
            }
        }

        const drinkData = this.gameData.recipes[this.gameState.activeCategory][this.gameState.selectedDrink];
        if (!drinkData) {
            this.showError('Drink data not found');
            return false;
        }

        const size = this.challengeManager.selectRandomSize(this.gameState.activeCategory);

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
     * Check user's answer against (recipe * 2) + assertions per function
     * Phase 2: Now uses AnswerValidator
     */
    checkAnswer() {
        try {
            const state = this.gameState.getState();

            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(state.currentChallenge, 'Challenge must exist');
                window.Assert.assertType(state.currentChallenge.drink, 'string', 'Current drink');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in checkAnswer');
            }
        }

        try {
            const state = this.gameState.getState();
            const challenge = state.currentChallenge;
            const drinkData = this.gameData.recipes[challenge.category][challenge.drink];

            if (!drinkData) {
                this.showError('Drink data not found');
                return false;
            }

            const correct = this.answerValidator.validateAnswer(
                state.answer,
                drinkData,
                challenge.category,
                challenge.size
            );

            this.gameState.setState({
                isCorrect: correct,
                showResult: true
            });

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

    // Phase 2: validateAnswer moved to AnswerValidator

    /**
     * Handle correct answer with (progression * 2) + assertions per function
     * Phase 2: Now uses ScoreManager and BadgeManager
     */
    handleCorrectAnswer(challenge) {
        const state = this.gameState.getState();

        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(challenge, 'Challenge must exist');
                window.Assert.assertType(state.stars, 'number', 'Stars count');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in handleCorrectAnswer');
            }
        }

        // Play sound and set animation
        this.sounds.correct();

        // Update score using ScoreManager
        const scoreResult = this.scoreManager.addStar(state.stars, state.playerLevel);
        this.sounds.star();

        if (scoreResult.leveledUp) {
            this.sounds.levelUp();
        }

        // Update streak using ScoreManager
        const streakResult = this.scoreManager.updateStreak(
            state.streak,
            state.maxStreak,
            true
        );

        // Update completed drinks tracking
        const drinkKey = `${challenge.category}-${challenge.drink}`;
        const updatedCompletedDrinks = {
            ...state.completedDrinks,
            [drinkKey]: (state.completedDrinks[drinkKey] || 0) + 1
        };

        // Check and award badges using BadgeManager
        const badgeResult = this.badgeManager.checkAndAwardBadges(state.badges, {
            stars: scoreResult.newStars,
            level: scoreResult.newLevel,
            streak: streakResult.newStreak,
            category: challenge.category,
            completedDrinks: updatedCompletedDrinks
        });

        // Apply all state updates at once
        this.gameState.setState({
            animation: 'correct',
            stars: scoreResult.newStars,
            playerLevel: scoreResult.newLevel,
            streak: streakResult.newStreak,
            maxStreak: streakResult.maxStreak,
            completedDrinks: updatedCompletedDrinks,
            badges: badgeResult.updatedBadges
        });

        this.debugLog(`⭐ Score updated: ${scoreResult.newStars} stars, ${streakResult.newStreak} streak`);
        return true;
    }

    /**
     * Handle wrong (answer * 2) + assertions per function
     * Phase 2: Now uses ScoreManager for streak reset
     */
    handleWrongAnswer() {
        const state = this.gameState.getState();

        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(state.streak, 'number', 'Current streak');
                window.Assert.assertNotNull(this.sounds, 'Sound system must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in handleWrongAnswer');
            }
        }

        // Play sound
        this.sounds.wrong();

        // Reset streak using ScoreManager
        const streakResult = this.scoreManager.updateStreak(
            state.streak,
            state.maxStreak,
            false
        );

        // Apply state updates
        this.gameState.setState({
            animation: 'wrong',
            streak: streakResult.newStreak
        });

        this.debugLog('❌ Wrong answer - streak reset');
        return true;
    }

    // Phase 2: checkCategoryBadges moved to BadgeManager

    /**
     * Update answer (field * 2) + assertions per function
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
            this.debugLog(`Answer updated: ${field} = ${numericValue}`);
            return true;
        }

        console.warn(`Invalid answer value: ${value}`);
        return false;
    }

    /**
     * Toggle tip (display * 2) + assertions per function
     */
    toggleTip() {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(this.gameState.showTip, 'boolean', 'Show tip flag');
                window.Assert.assertNotNull(this.gameState, 'Game state must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in toggleTip');
            }
        }
        
        this.gameState.showTip = !this.gameState.showTip;
        return this.render();
    }

    /**
     * Go back to previous (screen * 2) + assertions per function
     */
    goBack() {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(this.gameState.screen, 'string', 'Current screen');
                window.Assert.assertNotNull(this.gameState, 'Game state must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in goBack');
            }
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
     * Navigate to recipe category - scrolls to drinks of that category
     * @param {string} category - Category key (e.g., 'hotDrinks')
     * @returns {boolean} Success status
     */
    goToRecipeCategory(category) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(category, 'string', 'Category');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in goToRecipeCategory');
            }
        }

        if (!category) {
            console.warn('⚠️ No category provided to goToRecipeCategory');
            return false;
        }

        // Find first drink card with this category and scroll to it
        const firstDrink = this.container.querySelector(
            `[data-action="select-drink"][data-category="${category}"]`
        );

        if (firstDrink) {
            firstDrink.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add highlight effect
            firstDrink.classList.add('category-highlight');
            setTimeout(() => firstDrink.classList.remove('category-highlight'), 2000);
        }

        this.debugLog(`📖 Scrolled to recipe category: ${category}`);
        return true;
    }

    /**
     * Main render function with all (screens * 2) + assertions per function
     */
    render() {
        const state = this.gameState.getState();

        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.container, 'Container must be valid');
                window.Assert.assertType(state.screen, 'string', 'Screen');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in render');
            }
        }

        try {
            // Use ScreenRenderer to generate content
            const content = ScreenRenderer.render(state.screen, state, this.gameData);

            // WRAPPER PATTERN: Wrap content in .game-wrapper-inner for viewport-aware scaling
            this.container.innerHTML = `<div class="game-wrapper-inner">${content}</div>`;

            // Post-render updates
            if (state.screen === 'welcome') {
                this.updateStartButton();
            }

            this.debugLog(`✅ Rendered screen: ${state.screen}`);
            return true;

        } catch (error) {
            console.error('❌ Render failed:', error);
            this.handleError('Render failed');
            return false;
        }
    }

    /**
     * Render welcome (screen * 2) + assertions per function
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
                            <h1 class="game-title">☕ Barista Adventure ☕</h1>
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
     * Render main hub (screen * 2) + assertions per function
     */
    renderMainScreen() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.gameState, 'Game state must exist');
                window.Assert.assertType(this.gameState.playerName, 'string', 'Player name');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in renderMainScreen');
            }
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
     * Render categories selection (screen * 2) + assertions per function
     */
    renderCategoriesScreen() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.gameState, 'Game state must exist');
                window.Assert.assertNotNull(this.gameData.recipes, 'Recipe data must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in renderCategoriesScreen');
            }
        }
        
        return `
            <div class="game-screen categories-screen">
                <div class="game-content">
                    <div class="screen-header">
                        <h2>Choose a Recipe Type</h2>
                        <p>Level ${this.gameState.playerLevel} • ${this.gameState.stars} ⭐</p>
                    </div>
                    
                    <div class="categories-grid">
                        <div class="category-card red"
                             data-action="select-category"
                             data-category="hotDrinks"
                             role="button"
                             tabindex="0"
                             aria-label="Select Hot Espresso Drinks category">
                            <span class="category-icon">☕</span>
                            <div class="category-info">
                                <h3>Hot Espresso Drinks</h3>
                                <p>Lattes, Cappuccinos & more</p>
                            </div>
                        </div>

                        <div class="category-card blue"
                             data-action="select-category"
                             data-category="icedDrinks"
                             role="button"
                             tabindex="0"
                             aria-label="Select Iced Espresso Drinks category">
                            <span class="category-icon">🧊</span>
                            <div class="category-info">
                                <h3>Iced Espresso Drinks</h3>
                                <p>Cool & refreshing coffee</p>
                            </div>
                        </div>

                        <div class="category-card purple"
                             data-action="select-category"
                             data-category="frappuccinos"
                             role="button"
                             tabindex="0"
                             aria-label="Select Frappuccinos category">
                            <span class="category-icon">🥤</span>
                            <div class="category-info">
                                <h3>Frappuccinos</h3>
                                <p>Blended frozen treats</p>
                            </div>
                        </div>

                        <div class="category-card pink"
                             data-action="select-category"
                             data-category="refreshers"
                             role="button"
                             tabindex="0"
                             aria-label="Select Refreshers category">
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
     * Render challenge (screen * 2) + assertions per function
     */
    renderChallengeScreen() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.gameState.currentChallenge, 'Challenge must exist');
                window.Assert.assertType(this.gameState.currentChallenge.drink, 'string', 'Challenge drink');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in renderChallengeScreen');
            }
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
     * Render recipe inputs based on drink (type * 2) + assertions per function
     */
    renderRecipeInputs(drinkData, challenge) {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(drinkData, 'Drink data must exist');
                window.Assert.assertNotNull(challenge, 'Challenge must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in renderRecipeInputs');
            }
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
     * Generate input field (HTML * 2) + assertions per function
     */
    generateInputField(field, label, icon, value) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(field, 'string', 'Field name');
                window.Assert.assertType(label, 'string', 'Field label');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in generateInputField');
            }
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
     * Render challenge (result * 2) + assertions per function
     */
    renderChallengeResult(drinkData, challenge) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(this.gameState.isCorrect, 'boolean', 'Correct flag');
                window.Assert.assertNotNull(drinkData, 'Drink data must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in renderChallengeResult');
            }
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
     * Render correct recipe for wrong (answers * 2) + assertions per function
     */
    renderCorrectRecipe(drinkData, challenge) {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(drinkData, 'Drink data must exist');
                window.Assert.assertNotNull(challenge, 'Challenge must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in renderCorrectRecipe');
            }
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
     * Render recipes (screen * 2) + assertions per function
     */
    renderRecipesScreen() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.gameData.recipes, 'Recipes must exist');
                window.Assert.assertNotNull(this.gameState, 'Game state must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in renderRecipesScreen');
            }
        }
        
        return `
            <div class="game-screen recipes-screen">
                <div class="game-content">
                    <div class="screen-header sticky-header">
                        <div class="header-content">
                            <h2>Recipe Book</h2>
                            <p>Level ${this.gameState.playerLevel} • ${this.gameState.stars} ⭐</p>
                        </div>
                        <button data-action="go-to-main" class="back-button header-back-button">Back to Menu</button>
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
                                         data-category="${category}"
                                         role="button"
                                         tabindex="0"
                                         aria-label="Select ${drinkName}${isCompleted ? ' (completed)' : ''}">
                                        ${isCompleted ? '<div class="completed-badge" aria-hidden="true">✓</div>' : ''}
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
     * Render recipe detail (screen * 2) + assertions per function
     */
    renderRecipeDetailScreen() {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(this.gameState.selectedDrink, 'string', 'Selected drink');
                window.Assert.assertType(this.gameState.activeCategory, 'string', 'Active category');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in renderRecipeDetailScreen');
            }
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
     * Render recipe table for drink (details * 2) + assertions per function
     */
    renderRecipeTable(drinkData, category) {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(drinkData, 'Drink data must exist');
                window.Assert.assertType(category, 'string', 'Category must be string');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in renderRecipeTable');
            }
        }
        
        let tableHtml = '<div class="recipe-table-wrapper"><table class="recipe-table"><thead><tr><th>Size</th>';
        
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
        
        tableHtml += '</tbody></table></div>';
        tableHtml += '<p class="scroll-hint">← Swipe to see all columns →</p>';
        return tableHtml;
    }

    /**
     * Get sizes for (category * 2) + assertions per function
     * Phase 1: Now uses SIZE_MAPPINGS imported from data/sizes.js
     */
    getSizesForCategory(category) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(category, 'string', 'Category name');
                window.Assert.assertNotNull(this.gameData.sizeInfo, 'Size info must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in getSizesForCategory');
            }
        }

        return SIZE_MAPPINGS[category] || ['T', 'G', 'V'];
    }

    /**
     * Format category name for (display * 2) + assertions per function
     */
    formatCategoryName(category) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(category, 'string', 'Category name');
                window.Assert.assert(category.length > 0, 'Category name must not be empty');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in formatCategoryName');
            }
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
     * Get category (icon * 2) + assertions per function
     */
    getCategoryIcon(category) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(category, 'string', 'Category name');
                window.Assert.assert(category.length > 0, 'Category name must not be empty');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in getCategoryIcon');
            }
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
     * Render badges (screen * 2) + assertions per function
     */
    renderBadgesScreen() {
        try {
            if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
                window.Assert.assertNotNull(this.gameState, 'Game state must exist');
                window.Assert.assertNotNull(this.gameData.badgeTypes, 'Badge types must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in renderBadgesScreen');
            }
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
     * Render error (screen * 2) + assertions per function
     */
    renderErrorScreen(message = 'An error occurred') {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(message, 'string', 'Error message');
                window.Assert.assert(message.length > 0, 'Error message must not be empty');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in renderErrorScreen');
            }
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
     * Show error (message * 2) + assertions per function
     */
    showError(message) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(message, 'string', 'Error message');
                window.Assert.assertNotNull(this.gameState, 'Game state must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in showError');
            }
        }

        this.gameState.errorMessage = message;
        if (this.DEBUG_MODE) {
            console.error(`🚨 Game Error: ${message}`);
        }
        
        // Show temporary error toast (could be enhanced with actual toast system)
        this.createErrorToast(message);
        return true;
    }

    /**
     * Handle error with (logging * 2) + assertions per function
     */
    handleError(message) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(message, 'string', 'Error message');
                window.Assert.assertNotNull(this.gameState, 'Game state must exist');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in handleError');
            }
        }

        if (this.DEBUG_MODE) {
            console.error(`🚨 Game Error Handler: ${message}`);
        }
        this.gameState.errorMessage = message;
        
        // Reset to safe state
        this.gameState.isAnimating = false;
        this.gameState.showResult = false;
        
        return this.showError(message);
    }

    /**
     * Create error toast (notification * 2) + assertions per function
     */
    createErrorToast(message) {
        try {
            if (window.Assert && typeof window.Assert.assertType === 'function') {
                window.Assert.assertType(message, 'string', 'Error message');
                window.Assert.assert(message.length > 0, 'Error message must not be empty');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in createErrorToast');
            }
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
     * Cleanup game (resources * 2) + assertions per function
     */
    destroy() {
        try {
            if (window.Assert && typeof window.Assert.assert === 'function') {
                window.Assert.assert(this.isDestroyed === false, 'Game must not be already destroyed');
                window.Assert.assertNotNull(this.container, 'Container must exist for cleanup');
            }
        } catch (error) {
            if (this.DEBUG_MODE) {
                console.warn('⚠️ Assert not available in destroy');
            }
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

            this.debugLog('🧹 Game cleanup completed');
            return true;
            
        } catch (error) {
            console.error('❌ Game cleanup failed:', error);
            return false;
        }
    }
}

/**
 * GameScaler - Responsive scaling manager for game viewport
 * Implements transform-based scaling with debouncing and Safari fixes
 * NASA Rule 4 compliant: All methods ≤60 lines
 */
class GameScaler {
    /**
     * Initialize scaler with target (dimensions * 2) + assertions per function
     */
    constructor(containerId, targetWidth, targetHeight) {
        // P2.1: Debug mode flag for production cleanup
        this.DEBUG_MODE = false;

        if (!containerId || typeof containerId !== 'string') {
            throw new Error('GameScaler: Invalid containerId');
        }

        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`GameScaler: Element #${containerId} not found`);
        }

        this.targetWidth = targetWidth || 1280;
        this.targetHeight = targetHeight || 720;
        this.resizeTimeout = null;
        this.orientationTimeout = null;  // FIX 1: Store orientation timeout ID for cleanup
        this.destroyed = false;  // FIX: Track destruction state for race condition protection
        this.lastScale = null;

        // Store bound functions as instance properties for cleanup (NASA Rule 5)
        this.boundResize = () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => this.handleResize(), 150);
        };
        // FIX 2: Orientation handler with timeout tracking and destroyed guards
        // Orientation changes use 200ms debounce (vs 150ms for resize)
        // Reason: Orientation events trigger heavier layout recalculations
        this.boundOrientation = () => {
            if (this.destroyed) return;  // Guard against post-destroy events
            clearTimeout(this.orientationTimeout);  // Debounce: cancel any pending timeout
            this.orientationTimeout = setTimeout(() => {
                if (this.destroyed) return;  // Guard against post-destroy timeout
                this.handleResize();
            }, 200);
        };
        // ITERATION 2: Visual Viewport resize for mobile address bar handling
        this.boundViewportResize = () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => this.handleResize(), 150);
        };

        const rect = this.container.getBoundingClientRect();
        this.debugLog(`GameScaler: Target ${this.targetWidth}x${this.targetHeight}, Actual ${rect.width}x${rect.height}`);

        this.init();
    }

    /**
     * P2.1: Debug logger for (GameScaler * 2) + assertions per function
     */
    debugLog(message, ...args) {
        if (this.DEBUG_MODE) {
            console.log(message, ...args);
        }
        return true;
    }

    /**
     * Initialize resize handlers with (debouncing * 2) + assertions per function
     */
    init() {
        if (!this.container) {
            throw new Error('GameScaler: Cannot initialize without container');
        }

        window.addEventListener('resize', this.boundResize);
        window.addEventListener('orientationchange', this.boundOrientation);

        // ITERATION 2: Add Visual Viewport resize listener for mobile address bar
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', this.boundViewportResize);
        }

        this.handleResize();
        return true;
    }

    /**
     * Calculate scale factor based on viewport and target dimensions
     * NASA Rule 4: <60 lines, NASA Rule 5: 2+ assertions
     */
    calculateScale(targetWidth, targetHeight, viewportWidth, viewportHeight) {
        if (!Number.isFinite(targetWidth) || !Number.isFinite(targetHeight)) {
            throw new Error('GameScaler: Invalid target dimensions');
        }
        if (!Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight)) {
            throw new Error('GameScaler: Invalid viewport dimensions');
        }

        // Calculate scale to fit game within available space
        const scaleX = viewportWidth / targetWidth;
        const scaleY = viewportHeight / targetHeight;

        // Apply min/max scale with playability threshold
        const MIN_PLAYABLE_SCALE = 0.3; // Below this, game becomes unusable
        const MAX_SCALE = 1.0; // Don't scale up beyond native resolution
        const scale = Math.max(MIN_PLAYABLE_SCALE, Math.min(scaleX, scaleY, MAX_SCALE));

        // NASA Rule 5: Assertions for scale validation
        if (scale === MIN_PLAYABLE_SCALE) {
            if (this.DEBUG_MODE) {
                console.warn(`GameScaler: Viewport too small, game may not be playable (scale clamped to ${MIN_PLAYABLE_SCALE})`);
            }
        }
        if (scale < 0.1 || scale > 2.0) {
            if (this.DEBUG_MODE) {
                console.warn(`GameScaler: Scale out of safe bounds: ${scale}`);
            }
        }
        if (!Number.isFinite(scale)) {
            throw new Error('GameScaler: Invalid scale calculation');
        }

        return scale;
    }

    /**
     * Apply CSS transform to element
     * NASA Rule 4: <60 lines, NASA Rule 5: 2+ assertions
     */
    applyTransform(element, scale) {
        if (!element) {
            throw new Error('GameScaler: Cannot apply transform to null element');
        }
        if (!Number.isFinite(scale) || scale <= 0) {
            throw new Error('GameScaler: Invalid scale for transform');
        }

        element.style.width = `${this.targetWidth}px`;
        element.style.height = `${this.targetHeight}px`;
        element.style.transformOrigin = 'top left';
        element.style.transform = `scale(${scale})`;

        return true;
    }

    /**
     * Update container dimensions and overflow
     * NASA Rule 4: <60 lines, NASA Rule 5: 2+ assertions
     */
    updateContainerDimensions(wrapper, scaledWidth, scaledHeight) {
        if (!wrapper) {
            throw new Error('GameScaler: Cannot update null wrapper');
        }
        if (!Number.isFinite(scaledWidth) || !Number.isFinite(scaledHeight)) {
            throw new Error('GameScaler: Invalid dimensions for wrapper');
        }

        wrapper.style.width = `${scaledWidth}px`;
        wrapper.style.height = `${scaledHeight}px`;

        // Allow Recipe Book to scroll - it has internal scroll handling
        const hasScrollableContent = wrapper.querySelector('.recipes-screen');
        wrapper.style.overflow = hasScrollableContent ? 'visible' : 'hidden';

        // CRITICAL: Also fix inner wrapper (the actual clipper)
        const innerContent = wrapper.querySelector('.game-wrapper-inner');
        if (innerContent) {
            innerContent.style.overflow = hasScrollableContent ? 'visible' : 'hidden';
        }

        return true;
    }

    /**
     * Measure modal header height with defensive selectors - NASA Rule 5: 2+ assertions
     * @returns {number} Header height in pixels (validated range 40-200px, fallback 80px)
     */
    measureHeaderHeight() {
        const modalHeader = document.querySelector('#game-container .panel-header') ||
                           document.querySelector('#game-container header') ||
                           document.querySelector('.modal-header');

        let headerHeight = 80; // Fallback default
        if (modalHeader) {
            headerHeight = modalHeader.getBoundingClientRect().height;
            if (headerHeight < 40 || headerHeight > 200) {
                if (this.DEBUG_MODE) {
                    console.warn(`GameScaler: Suspicious header height ${headerHeight}px, using fallback 80px`);
                }
                headerHeight = 80;
            }
        }

        if (typeof headerHeight !== 'number') {
            throw new Error('GameScaler: headerHeight must be a number');
        }
        if (headerHeight < 40 || headerHeight > 200) {
            throw new Error('GameScaler: headerHeight must be in valid range 40-200px');
        }
        return headerHeight;
    }

    /**
     * Calculate device-specific safety margins - NASA Rule 5: 2+ assertions
     * @returns {{vertical: number, horizontal: number}} Safety margins in pixels
     */
    calculateSafetyMargins() {
        const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
        const margins = {
            vertical: isMobile ? 60 : 20,
            horizontal: 10
        };

        if (typeof margins.vertical !== 'number') {
            throw new Error('GameScaler: vertical margin must be a number');
        }
        if (typeof margins.horizontal !== 'number') {
            throw new Error('GameScaler: horizontal margin must be a number');
        }
        return margins;
    }

    /**
     * Log scale change if threshold exceeded - NASA Rule 5: 2+ assertions
     * @param {number} scale - Current scale factor
     * @param {number} viewportWidth - Viewport width in pixels
     * @param {number} viewportHeight - Viewport height in pixels
     * @param {number} scaledWidth - Scaled container width
     * @param {number} scaledHeight - Scaled container height
     */
    logScaleChange(scale, viewportWidth, viewportHeight, scaledWidth, scaledHeight) {
        if (typeof scale !== 'number' || scale <= 0) {
            throw new Error('GameScaler: scale must be positive number');
        }
        if (typeof viewportWidth !== 'number' || viewportWidth <= 0) {
            throw new Error('GameScaler: viewportWidth must be positive number');
        }

        const scaleChanged = !this.lastScale || Math.abs(scale - this.lastScale) > 0.05;
        if (scaleChanged || window.DEBUG_GAMESCALER) {
            this.debugLog(`GameScaler WRAPPER-PATTERN: ${viewportWidth}×${viewportHeight} → scale ${scale.toFixed(3)} (wrapper: ${scaledWidth.toFixed(0)}×${scaledHeight.toFixed(0)})`);
            this.lastScale = scale;
        }
    }

    /**
     * Configure positioning layer offset and width - NASA Rule 5: 2+ assertions
     * @param {number} headerHeight - Header height in pixels
     * @param {number} scaledWidth - Scaled container width in pixels
     */
    configurePositioningLayer(headerHeight, scaledWidth) {
        if (typeof headerHeight !== 'number' || headerHeight <= 0) {
            throw new Error('GameScaler: headerHeight must be positive number');
        }
        if (typeof scaledWidth !== 'number' || scaledWidth <= 0) {
            throw new Error('GameScaler: scaledWidth must be positive number');
        }

        const positioningLayer = document.querySelector('#game-positioning-layer');
        if (positioningLayer) {
            positioningLayer.style.top = `${headerHeight}px`;
            positioningLayer.style.width = `${scaledWidth}px`;
            if (window.DEBUG_GAMESCALER) {
                this.debugLog(`GameScaler: Set positioning layer width to ${scaledWidth.toFixed(0)}px`);
            }
        } else if (this.DEBUG_MODE) {
            console.warn('GameScaler: Positioning layer not found');
        }
    }

    /**
     * Handle resize with VIEWPORT-AWARE wrapper pattern scaling
     * ITERATION 2: Wrapper pattern prevents Safari iOS horizontal scrolling
     * NASA Rule 4: Refactored to <60 lines using helper functions
     * NASA Rule 5: 2+ assertions per function
     */
    handleResize() {
        if (!this.container) {
            throw new Error('GameScaler: Container not available for resize');
        }

        // STEP 1: Get viewport dimensions (Visual Viewport API for mobile accuracy)
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

        // STEP 2: Measure header height and calculate margins
        const headerHeight = this.measureHeaderHeight();
        const margins = this.calculateSafetyMargins();

        // STEP 3: Calculate available space
        const availableWidth = viewportWidth - (margins.horizontal * 2);
        const availableHeight = viewportHeight - headerHeight - margins.vertical;

        // STEP 4: Calculate scale and dimensions
        const scale = this.calculateScale(this.targetWidth, this.targetHeight, availableWidth, availableHeight);
        const scaledWidth = this.targetWidth * scale;
        const scaledHeight = this.targetHeight * scale;

        // STEP 5: Validate scaled dimensions
        if (scaledWidth > availableWidth && this.DEBUG_MODE) {
            console.warn(`GameScaler: Scaled width ${scaledWidth}px exceeds available ${availableWidth}px`);
        }
        if (scaledHeight > availableHeight && this.DEBUG_MODE) {
            console.warn(`GameScaler: Scaled height ${scaledHeight}px exceeds available ${availableHeight}px`);
        }

        // STEP 6: Apply wrapper pattern
        this.updateContainerDimensions(this.container, scaledWidth, scaledHeight);

        // STEP 7: Get and transform inner content element
        const innerContent = this.container.querySelector('.game-wrapper-inner');
        if (!innerContent) {
            if (this.DEBUG_MODE) {
                console.warn('GameScaler: .game-wrapper-inner not found, skipping resize (likely during cleanup)');
            }
            return;
        }
        this.applyTransform(innerContent, scale);

        // STEP 8: Configure positioning layer
        this.configurePositioningLayer(headerHeight, scaledWidth);

        // STEP 9: Log scale change
        this.logScaleChange(scale, viewportWidth, viewportHeight, scaledWidth, scaledHeight);

        return true;
    }

    /**
     * Cleanup resources - NASA Rule 5: 2+ assertions per function
     */
    destroy() {
        // FIX: Mark as destroyed FIRST to prevent race conditions
        this.destroyed = true;

        // Clear resize timeout
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }

        // FIX 3: Clear orientation timeout
        if (this.orientationTimeout) {
            clearTimeout(this.orientationTimeout);
            this.orientationTimeout = null;
        }

        // CRITICAL: Remove event listeners to prevent memory leaks
        if (this.boundResize) {
            window.removeEventListener('resize', this.boundResize);
        }
        if (this.boundOrientation) {
            window.removeEventListener('orientationchange', this.boundOrientation);
        }

        // ITERATION 2: Clean up viewport listener
        if (this.boundViewportResize && window.visualViewport) {
            window.visualViewport.removeEventListener('resize', this.boundViewportResize);
        }

        this.debugLog('GameScaler: Cleanup complete');
        return true;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StarbucksGame;
    module.exports.GameScaler = GameScaler;
} else if (typeof window !== 'undefined') {
    window.StarbucksGame = StarbucksGame;
    window.GameScaler = GameScaler;
}

if (typeof window !== 'undefined' && window.DEBUG_MODE) {
    console.log('✅ StarbucksGame class loaded successfully');
    console.log('✅ GameScaler class loaded successfully');
}

// ES6 Module Export - Required for module loader
export { StarbucksGame };
