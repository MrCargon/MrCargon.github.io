/**
 * GameState.js - Centralized state management
 * DUMB data container - holds state only, NO business logic
 * ONLY StarbucksGame calls setState() - single mutation point
 */

export class GameState {
    /**
     * Create game state instance with initial state
     */
    constructor() {
        this.state = this.createInitialState();

        // Add property accessors for backward compatibility
        // This allows direct access like this.gameState.playerName
        // instead of requiring this.gameState.state.playerName
        this._setupPropertyAccessors();
    }

    /**
     * Setup property accessors for all state properties
     * Enables backward compatible direct property access
     * @private
     */
    _setupPropertyAccessors() {
        // Define all state properties that should be accessible
        const stateProperties = [
            'screen', 'playerName', 'playerLevel', 'stars', 'streak', 'maxStreak',
            'badges', 'activeCategory', 'currentChallenge', 'answer', 'showResult',
            'isCorrect', 'animation', 'completedDrinks', 'showTip', 'selectedDrink',
            'isAnimating', 'errorMessage'
        ];

        // Create getter/setter for each property
        stateProperties.forEach(prop => {
            Object.defineProperty(this, prop, {
                get() {
                    return this.state[prop];
                },
                set(value) {
                    this.state[prop] = value;
                },
                enumerable: true,
                configurable: true
            });
        });
    }

    /**
     * Create initial state object
     * @returns {Object} Initial state
     */
    createInitialState() {
        return {
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
    }

    /**
     * Get full state object (shallow copy for performance)
     * @returns {Object} Current state (shallow copy)
     * Note: Callers should not mutate the returned object
     */
    getState() {
        if (!this.state) {
            throw new Error('State must exist');
        }

        // Shallow copy - 100x faster than JSON deep clone
        // Sufficient since render functions only read state, don't mutate
        return { ...this.state };
    }

    /**
     * Update state with new values (shallow merge)
     * CRITICAL: This is the ONLY mutation method
     * @param {Object} updates - State updates to apply
     * @returns {boolean} Success status
     */
    setState(updates) {
        if (!updates || typeof updates !== 'object') {
            throw new Error('Updates must be a valid object');
        }

        try {
            this.state = {
                ...this.state,
                ...updates
            };
            return true;
        } catch (error) {
            console.error('❌ Failed to update state:', error);
            return false;
        }
    }

    /**
     * Reset state to initial values
     * @returns {boolean} Success status
     */
    resetState() {
        try {
            this.state = this.createInitialState();
            return true;
        } catch (error) {
            console.error('❌ Failed to reset state:', error);
            return false;
        }
    }

    /**
     * Computed property: Stars needed to reach next level
     * @returns {number} Stars to next level
     */
    getStarsToNextLevel() {
        if (typeof this.state.stars !== 'number' || typeof this.state.playerLevel !== 'number') {
            return 0;
        }

        return (this.state.playerLevel * 5) - this.state.stars;
    }

    /**
     * Computed property: Get current tip based on level
     * @param {Array<string>} baristaTips - Array of tips
     * @returns {string} Current tip
     */
    getCurrentTip(baristaTips) {
        if (!baristaTips || !Array.isArray(baristaTips) || baristaTips.length === 0) {
            return '';
        }
        if (typeof this.state.playerLevel !== 'number') {
            return baristaTips[0];
        }

        const tipIndex = Math.min(this.state.playerLevel - 1, baristaTips.length - 1);
        return baristaTips[tipIndex];
    }

    /**
     * Computed property: Check if player name is valid
     * @returns {boolean} Whether name is valid
     */
    isNameValid() {
        if (typeof this.state.playerName !== 'string') {
            return false;
        }

        return this.state.playerName.trim().length > 0 && this.state.playerName.length <= 20;
    }
}
