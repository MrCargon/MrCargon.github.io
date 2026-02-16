/**
 * ChallengeManager.js - Challenge generation and management
 * Extracted from StarbucksGame.js Phase 2 refactoring
 */

import { SIZE_MAPPINGS } from '../data/sizes.js';

export class ChallengeManager {
    constructor(recipes) {
        this.recipes = recipes;
        this.currentChallenge = null;
    }

    /**
     * Select random size based on category
     */
    selectRandomSize(category) {
        const sizes = SIZE_MAPPINGS[category] || ['T', 'G', 'V'];
        const randomIndex = Math.floor(Math.random() * sizes.length);
        return sizes[randomIndex];
    }

    /**
     * Select random drink from category
     */
    selectRandomDrink(category) {
        const drinks = this.recipes[category];
        if (!drinks || Object.keys(drinks).length === 0) {
            return null;
        }

        const drinkNames = Object.keys(drinks);
        const drinkIndex = Math.floor(Math.random() * drinkNames.length);
        return drinkNames[drinkIndex];
    }

    /**
     * Generate a challenge for given category (or 'all' for random)
     * Returns challenge object: { category, drink, size }
     * @throws {Error} If unable to generate valid challenge after max attempts
     */
    startChallenge(activeCategory) {
        let categories = [];
        if (activeCategory === 'all') {
            categories = Object.keys(this.recipes);
        } else {
            categories = [activeCategory];
        }

        // Validate categories have drinks
        const hasValidDrinks = categories.some(cat => {
            const drinks = this.recipes[cat];
            return drinks && Object.keys(drinks).length > 0;
        });

        if (!hasValidDrinks) {
            throw new Error(`No drinks available in category: ${activeCategory}`);
        }

        // Fixed bounds random selection (max 10 attempts)
        const maxAttempts = 10;
        for (let attempts = 0; attempts < maxAttempts; attempts++) {
            const categoryIndex = Math.floor(Math.random() * categories.length);
            const category = categories[categoryIndex];

            const drinkName = this.selectRandomDrink(category);
            if (drinkName) {
                const size = this.selectRandomSize(category);

                this.currentChallenge = {
                    category: category,
                    drink: drinkName,
                    size: size
                };

                return this.currentChallenge;
            }
        }

        throw new Error(`Failed to generate challenge after ${maxAttempts} attempts`);
    }

    /**
     * Get current challenge
     */
    getCurrentChallenge() {
        return this.currentChallenge;
    }
}
