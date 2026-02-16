/**
 * ScreenRenderer.js - Screen routing coordinator
 * Routes screen names to appropriate screen rendering modules
 * Follows NASA Rule 4: ≤60 lines per function
 */

import { renderWelcomeScreen } from './screens/WelcomeScreen.js';
import { renderMainMenuScreen } from './screens/MainMenuScreen.js';
import { renderCategoryScreen } from './screens/CategoryScreen.js';
import { renderChallengeScreen } from './screens/ChallengeScreen.js';
import { renderRecipeBookScreen } from './screens/RecipeBookScreen.js';
import { renderRecipeDetailScreen } from './screens/RecipeDetailScreen.js';
import { renderBadgeScreen } from './screens/BadgeScreen.js';

/**
 * Static screen rendering coordinator
 * Maps screen names to render functions
 */
export class ScreenRenderer {
    /**
     * Render a screen by name
     * @param {string} screenName - Screen identifier
     * @param {Object} state - Current game state
     * @param {Object} data - Game data (recipes, badges, etc.)
     * @returns {string} HTML string for the screen
     */
    static render(screenName, state, data) {
        // Assertions (Rule 5: ≥2 per function)
        if (!screenName || typeof screenName !== 'string') {
            throw new Error('Screen name must be a non-empty string');
        }
        if (!state || typeof state !== 'object') {
            throw new Error('State must be a valid object');
        }

        // Route to appropriate screen renderer
        switch(screenName) {
            case 'welcome':
                return renderWelcomeScreen(state);

            case 'main':
                return renderMainMenuScreen(state, data.baristaTips);

            case 'categories':
                return renderCategoryScreen(state);

            case 'challenge':
                return renderChallengeScreen(state, data.recipes);

            case 'recipes':
                return renderRecipeBookScreen(state, data.recipes);

            case 'recipe-detail':
                return renderRecipeDetailScreen(state, data.recipes);

            case 'badges':
                return renderBadgeScreen(state, data.badgeTypes);

            default:
                throw new Error(`Unknown screen: ${screenName}`);
        }
    }
}
