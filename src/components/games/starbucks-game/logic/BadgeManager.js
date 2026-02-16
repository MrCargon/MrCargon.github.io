/**
 * BadgeManager.js - Badge tracking and awarding logic
 * Extracted from StarbucksGame.js Phase 2 refactoring
 *
 * IMPORTANT: Pure functions - receives current badges, returns new badges to add
 * Does NOT mutate state directly
 */

export class BadgeManager {
    constructor(badgeTypes, recipes) {
        this.badgeTypes = badgeTypes;
        this.recipes = recipes;
    }

    /**
     * Check if badge is already earned
     */
    hasBadge(badgeArray, badgeId) {
        return badgeArray.includes(badgeId);
    }

    /**
     * Check and award badges based on game context
     * Returns: { newBadges: [...badgeIds to add], updatedBadges: [...full array] }
     */
    checkAndAwardBadges(currentBadges, context) {
        const { stars, level, streak, category, completedDrinks } = context;
        const newBadges = [];

        // First star badge
        if (stars === 1 && !this.hasBadge(currentBadges, 'first_star')) {
            newBadges.push('first_star');
        }

        // Streak badge
        if (streak === 5 && !this.hasBadge(currentBadges, 'streak_5')) {
            newBadges.push('streak_5');
        }

        // Level 5 badge
        if (level === 5 && !this.hasBadge(currentBadges, 'level_5')) {
            newBadges.push('level_5');
        }

        // Category completion badges
        if (category) {
            const categoryBadge = this.checkCategoryCompletion(
                category,
                completedDrinks,
                currentBadges
            );
            if (categoryBadge) {
                newBadges.push(categoryBadge);
            }
        }

        // Return updated badge array
        const updatedBadges = [...currentBadges, ...newBadges];

        return {
            newBadges,
            updatedBadges
        };
    }

    /**
     * Check if category is complete and return badge ID if earned
     */
    checkCategoryCompletion(category, completedDrinks, currentBadges) {
        const categoryDrinks = Object.keys(this.recipes[category] || {});
        const completedInCategory = categoryDrinks.filter(drink =>
            completedDrinks[`${category}-${drink}`]
        ).length;

        if (completedInCategory === categoryDrinks.length) {
            let badgeId = "";
            switch (category) {
                case 'hotDrinks':
                    badgeId = "hot_expert";
                    break;
                case 'icedDrinks':
                    badgeId = "ice_master";
                    break;
                case 'frappuccinos':
                    badgeId = "frapp_wizard";
                    break;
            }

            if (badgeId && !this.hasBadge(currentBadges, badgeId)) {
                return badgeId;
            }
        }

        return null;
    }

    /**
     * Get earned badges (with full details)
     */
    getEarnedBadges(badgeArray) {
        return this.badgeTypes.filter(badge =>
            badgeArray.includes(badge.id)
        );
    }

    /**
     * Get locked badges (not yet earned)
     */
    getLockedBadges(badgeArray) {
        return this.badgeTypes.filter(badge =>
            !badgeArray.includes(badge.id)
        );
    }
}
