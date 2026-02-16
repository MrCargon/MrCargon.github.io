/**
 * RecipeBookScreen.js - Recipe book screen rendering
 * Pure function component for browsing all recipes
 */

import { escapeHtml } from '../../utils/BoundedUtilities.js';

/**
 * Format category name for display
 * @param {string} category - Category key
 * @returns {string} Formatted category name
 */
function formatCategoryName(category) {
    if (window.Assert && typeof window.Assert.assertType === 'function') {
        window.Assert.assertType(category, 'string', 'Category name');
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
 * Get category icon
 * @param {string} category - Category key
 * @returns {string} Category emoji icon
 */
function getCategoryIcon(category) {
    if (window.Assert && typeof window.Assert.assertType === 'function') {
        window.Assert.assertType(category, 'string', 'Category name');
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
 * Render recipe book screen with all drinks
 * @param {Object} gameState - Current game state
 * @param {Object} recipes - Recipe data
 * @returns {string} HTML string for recipe book screen
 */
export function renderRecipeBookScreen(gameState, recipes) {
    // Assertions
    if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
        window.Assert.assertNotNull(gameState, 'Game state required');
        window.Assert.assertNotNull(recipes, 'Recipes required');
    }

    return `
        <div class="game-screen recipes-screen">
            <div class="game-content">
                <div class="screen-header">
                    <h2>Recipe Book</h2>
                    <p>Level ${gameState.playerLevel} • ${gameState.stars} ⭐</p>
                </div>

                <div class="recipe-intro">
                    <p>Select a drink category to study the recipes and practice making drinks!</p>
                </div>

                <div class="recipe-categories">
                    ${Object.keys(recipes).map(category => {
                        const categoryName = formatCategoryName(category);
                        const categoryIcon = getCategoryIcon(category);
                        const drinkCount = Object.keys(recipes[category]).length;

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
                    ${Object.keys(recipes).map(category =>
                        Object.keys(recipes[category]).map(drinkName => {
                            const drinkData = recipes[category][drinkName];
                            const isCompleted = gameState.completedDrinks[`${category}-${drinkName}`] > 0;

                            return `
                                <div class="drink-card ${isCompleted ? 'completed' : ''}"
                                     data-action="select-drink"
                                     data-drink="${escapeHtml(drinkName)}"
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
