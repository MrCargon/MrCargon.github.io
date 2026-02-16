/**
 * GameConfig.js - Configuration constants
 * Centralized configuration and magic numbers
 */

/**
 * Game configuration constants
 */
export const GAME_CONFIG = {
    DEBUG_MODE: false,
    STARS_PER_LEVEL: 5,
    MIN_NAME_LENGTH: 1,
    MAX_NAME_LENGTH: 20,
    MAX_INPUT_VALUE: 10,
    ERROR_TOAST_DURATION: 3000,
    RESIZE_DEBOUNCE_MS: 150,
    ORIENTATION_DELAY_MS: 200
};

/**
 * Screen name constants
 */
export const SCREENS = {
    WELCOME: 'welcome',
    MAIN: 'main',
    CATEGORIES: 'categories',
    CHALLENGE: 'challenge',
    RECIPES: 'recipes',
    RECIPE_DETAIL: 'recipe-detail',
    BADGES: 'badges'
};

/**
 * Category name constants
 */
export const CATEGORIES = {
    HOT_DRINKS: 'hotDrinks',
    ICED_DRINKS: 'icedDrinks',
    FRAPPUCCINOS: 'frappuccinos',
    REFRESHERS: 'refreshers'
};
