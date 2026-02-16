/**
 * RecipeDetailScreen.js - Recipe detail screen rendering
 * Pure function component for viewing detailed recipe information
 */

import { SIZE_INFO, SIZE_MAPPINGS } from '../../data/sizes.js';

/**
 * Render recipe table for a specific drink
 * @param {Object} drinkData - Drink recipe data
 * @param {string} category - Category key
 * @returns {string} HTML string for recipe table
 */
function renderRecipeTable(drinkData, category) {
    // Assertions
    if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
        window.Assert.assertNotNull(drinkData, 'Drink data required');
        window.Assert.assertType(category, 'string', 'Category required');
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
    const sizes = SIZE_MAPPINGS[category] || ['T', 'G', 'V'];
    sizes.forEach(size => {
        const sizeInfo = SIZE_INFO[size];
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
    return tableHtml;
}

/**
 * Render recipe detail screen for a specific drink
 * @param {Object} gameState - Current game state
 * @param {Object} recipes - Recipe data
 * @param {function} renderErrorScreen - Error screen renderer
 * @returns {string} HTML string for recipe detail screen
 */
export function renderRecipeDetailScreen(gameState, recipes, renderErrorScreen) {
    // Assertions
    if (window.Assert && typeof window.Assert.assertType === 'function') {
        window.Assert.assertType(gameState.selectedDrink, 'string', 'Selected drink');
        window.Assert.assertType(gameState.activeCategory, 'string', 'Active category');
    }

    const drinkData = recipes[gameState.activeCategory][gameState.selectedDrink];
    if (!drinkData) {
        return renderErrorScreen('Drink not found');
    }

    return `
        <div class="game-screen recipe-detail-screen">
            <div class="game-content">
                <div class="recipe-detail-card">
                    <div class="recipe-header">
                        <span class="drink-icon-large">${drinkData.icon}</span>
                        <h2>${gameState.selectedDrink}</h2>
                        <p class="drink-description">${drinkData.description}</p>
                    </div>

                    <div class="recipe-sizes">
                        <h3>Recipe by Size:</h3>
                        ${renderRecipeTable(drinkData, gameState.activeCategory)}
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
