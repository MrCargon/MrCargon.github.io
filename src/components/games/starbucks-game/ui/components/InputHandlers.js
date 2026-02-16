/**
 * InputHandlers.js - Event delegation and action routing
 * Handles all user interactions through delegated event listeners
 * Uses callback map pattern to avoid circular dependencies
 */

export class InputHandlers {
    /**
     * Create input handlers instance
     * @param {HTMLElement} container - Game container element
     * @param {Object} callbacks - Map of callback functions
     */
    constructor(container, callbacks) {
        if (!container) {
            throw new Error('Container element required');
        }
        if (!callbacks || typeof callbacks !== 'object') {
            throw new Error('Callbacks object required');
        }

        this.container = container;
        this.callbacks = callbacks;
        this.eventHandlers = new Map();

        // Explicit action mapping - uses injected callbacks
        this.actionMap = {
            'start-game': () => this.callbacks.startGame && this.callbacks.startGame(),
            'go-to-main': () => this.callbacks.goToScreen && this.callbacks.goToScreen('main'),
            'go-to-categories': () => this.callbacks.goToScreen && this.callbacks.goToScreen('categories'),
            'go-to-recipes': () => this.callbacks.goToScreen && this.callbacks.goToScreen('recipes'),
            'go-to-badges': () => this.callbacks.goToScreen && this.callbacks.goToScreen('badges'),
            'go-to-recipe-category': (e) => {
                const actionElement = e.target.closest('[data-action]');
                if (!actionElement) return;
                const category = actionElement.getAttribute('data-category');
                return this.callbacks.goToRecipeCategory &&
                    this.callbacks.goToRecipeCategory(category);
            },
            'generate-challenge': () => this.callbacks.generateRandomChallenge && this.callbacks.generateRandomChallenge(),
            'select-category': (e) => {
                const actionElement = e.target.closest('[data-action]');
                if (!actionElement) return;
                return this.callbacks.selectCategory &&
                    this.callbacks.selectCategory(actionElement.getAttribute('data-category'));
            },
            'select-drink': (e) => {
                const actionElement = e.target.closest('[data-action]');
                if (!actionElement) return;
                const drink = actionElement.getAttribute('data-drink');
                const cat = actionElement.getAttribute('data-category');
                return this.callbacks.selectDrink && this.callbacks.selectDrink(drink, cat);
            },
            'practice-drink': () => this.callbacks.startPractice && this.callbacks.startPractice(),
            'check-answer': () => this.callbacks.checkAnswer && this.callbacks.checkAnswer(),
            'next-challenge': () => this.callbacks.generateRandomChallenge && this.callbacks.generateRandomChallenge(),
            'toggle-tip': () => this.callbacks.toggleTip && this.callbacks.toggleTip(),
            'back': () => this.callbacks.goBack && this.callbacks.goBack()
        };
    }

    /**
     * Setup all event handlers using event delegation
     * @returns {boolean} Success status
     */
    setupEventHandlers() {
        if (!this.container) {
            throw new Error('Container required');
        }

        try {
            this.clearEventHandlers();

            const clickHandler = (event) => this.handleClick(event);
            const inputHandler = (event) => this.handleInput(event);
            const focusHandler = (event) => {
                if (event.target.classList.contains('recipe-input') ||
                    event.target.classList.contains('name-input')) {
                    this.handleInputFocus(event);
                }
            };
            const blurHandler = (event) => {
                if (event.target.classList.contains('recipe-input') ||
                    event.target.classList.contains('name-input')) {
                    this.handleInputBlur(event);
                }
            };
            const keydownHandler = (event) => this.handleKeyDown(event);

            this.container.addEventListener('click', clickHandler);
            this.container.addEventListener('input', inputHandler);
            this.container.addEventListener('focus', focusHandler, true); // Capture phase
            this.container.addEventListener('blur', blurHandler, true); // Capture phase
            this.container.addEventListener('keydown', keydownHandler);

            this.eventHandlers.set('click', clickHandler);
            this.eventHandlers.set('input', inputHandler);
            this.eventHandlers.set('focus', focusHandler);
            this.eventHandlers.set('blur', blurHandler);
            this.eventHandlers.set('keydown', keydownHandler);

            return true;
        } catch (error) {
            console.error('❌ Event handler setup failed:', error);
            return false;
        }
    }

    /**
     * Clear all event handlers
     * @returns {boolean} Success status
     */
    clearEventHandlers() {
        if (!this.container) {
            throw new Error('Container required');
        }

        try {
            this.eventHandlers.forEach((handler, eventType) => {
                this.container.removeEventListener(eventType, handler);
            });
            this.eventHandlers.clear();
            return true;
        } catch (error) {
            console.error('❌ Failed to clear event handlers:', error);
            return false;
        }
    }

    /**
     * Handle click events through action delegation
     * @param {MouseEvent} event - Click event
     * @returns {boolean} Success status
     */
    handleClick(event) {
        if (!event || !event.target) {
            return true;
        }

        // Check if animating via callback
        if (this.callbacks.isAnimating && this.callbacks.isAnimating()) {
            return true;
        }

        const actionElement = event.target.closest('[data-action]');
        const action = actionElement ? actionElement.getAttribute('data-action') : null;
        if (!action) {
            return true;
        }

        event.preventDefault();

        const handler = this.actionMap[action];
        if (handler) {
            handler(event);
        } else {
            console.warn(`Unknown action: ${action}`);
        }

        return true;
    }

    /**
     * Handle input field changes
     * @param {InputEvent} event - Input event
     * @returns {boolean} Success status
     */
    handleInput(event) {
        if (!event || !event.target) {
            return true;
        }

        const target = event.target;

        if (target.id === 'player-name') {
            return this.callbacks.updatePlayerName && this.callbacks.updatePlayerName(target.value);
        }

        if (target.hasAttribute('data-answer-field')) {
            const field = target.getAttribute('data-answer-field');
            return this.callbacks.updateAnswer && this.callbacks.updateAnswer(field, target.value);
        }

        return true;
    }

    /**
     * Handle input focus for mobile keyboard positioning
     * @param {FocusEvent} event - Focus event
     * @returns {boolean} Always true
     */
    handleInputFocus(event) {
        if (!event || !event.target) {
            return true;
        }

        const input = event.target;

        // Mobile keyboard positioning (iOS/Android)
        if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
            setTimeout(() => {
                input.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest'
                });

                setTimeout(() => {
                    const inputRect = input.getBoundingClientRect();
                    const viewportHeight = window.visualViewport?.height || window.innerHeight;

                    if (inputRect.bottom > viewportHeight * 0.6) {
                        const scrollAdjustment = inputRect.bottom - (viewportHeight * 0.4);
                        this.container.scrollTop += scrollAdjustment;
                    }
                }, 100);
            }, 300);
        }

        return true;
    }

    /**
     * Handle input blur events
     * @param {FocusEvent} event - Blur event
     * @returns {boolean} Always true
     */
    handleInputBlur(event) {
        if (!event || !event.target) {
            return true;
        }

        // Future: Add cleanup logic if needed
        return true;
    }

    /**
     * Handle keyboard navigation for interactive cards
     * @param {KeyboardEvent} event - Keyboard event
     * @returns {boolean} Success status
     */
    handleKeyDown(event) {
        if (!event) {
            return true;
        }

        if (event.key !== 'Enter' && event.key !== ' ') {
            return true;
        }

        const target = event.target.closest('[role="button"][data-action]');
        if (!target) {
            return true;
        }

        event.preventDefault();
        target.click();

        return true;
    }
}
