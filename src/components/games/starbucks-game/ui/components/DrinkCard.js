/**
 * DrinkCard.js - Drink card display component
 * Reusable component for displaying individual drinks
 */

import { escapeHtml } from '../../utils/BoundedUtilities.js';

/**
 * Render drink card component
 * @param {string} drinkName - Name of the drink
 * @param {Object} drinkData - Drink recipe data
 * @param {string} category - Category key
 * @param {boolean} isCompleted - Whether drink has been completed
 * @returns {string} HTML string for drink card
 */
export function renderDrinkCard(drinkName, drinkData, category, isCompleted) {
    // Assertions
    if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
        window.Assert.assertNotNull(drinkName, 'Drink name required');
        window.Assert.assertNotNull(drinkData, 'Drink data required');
    }

    const escapedName = escapeHtml(drinkName);

    return `
        <div class="drink-card ${isCompleted ? 'completed' : ''}"
             data-action="select-drink"
             data-drink="${escapedName}"
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
}
