/**
 * ChallengeScreen.js - Challenge screen rendering
 * Pure function component for drink-making challenges
 */

import { SIZE_INFO } from '../../data/sizes.js';
import { escapeHtml } from '../../utils/BoundedUtilities.js';

/**
 * Render challenge header with stats
 * @param {Object} gameState - Current game state
 * @returns {string} HTML string for challenge header
 */
function renderChallengeHeader(gameState) {
    return `
        <div class="challenge-header">
            <h2>Barista Challenge</h2>
            <div class="challenge-stats">
                <span>${gameState.streak} 🔥</span>
                <span>${gameState.stars} ⭐</span>
            </div>
        </div>
    `;
}

/**
 * Render challenge card with drink info
 * @param {Object} challenge - Current challenge
 * @param {Object} drinkData - Drink recipe data
 * @param {Object} sizeInfo - Size information
 * @param {Object} gameState - Current game state
 * @returns {string} HTML string for challenge card
 */
function renderChallengeCard(challenge, drinkData, sizeInfo, gameState) {
    return `
        <div class="challenge-card ${gameState.animation}">
            <div class="drink-header">
                <span class="drink-icon">${drinkData.icon}</span>
                <div class="drink-info">
                    <h3>${challenge.drink}</h3>
                    <p class="size-info">${sizeInfo.name} (${sizeInfo.oz})</p>
                </div>
            </div>

            <div class="drink-description">
                <p>${drinkData.description}</p>
                ${!gameState.showResult ? '<p class="challenge-prompt">What goes in this drink?</p>' : ''}
            </div>

            ${renderRecipeInputs(drinkData, challenge, gameState)}
        </div>
    `;
}

/**
 * Render challenge actions or result
 * @param {Object} gameState - Current game state
 * @param {Object} drinkData - Drink recipe data
 * @param {Object} challenge - Current challenge
 * @returns {string} HTML string for actions/result
 */
function renderChallengeActions(gameState, drinkData, challenge) {
    if (!gameState.showResult) {
        return `
            <div class="challenge-actions">
                <button data-action="check-answer" class="check-button">Make the Drink!</button>
            </div>
        `;
    }
    return renderChallengeResult(gameState, drinkData, challenge);
}

/**
 * Render challenge screen with drink challenge and input fields
 * @param {Object} gameState - Current game state
 * @param {Object} recipes - Recipe data
 * @returns {string} HTML string for challenge screen
 */
export function renderChallengeScreen(gameState, recipes) {
    if (!gameState.currentChallenge || !recipes) {
        throw new Error('Challenge and recipes required');
    }

    const challenge = gameState.currentChallenge;
    const drinkData = recipes[challenge.category][challenge.drink];
    const sizeInfo = SIZE_INFO[challenge.size];

    return `
        <div class="game-screen challenge-screen">
            <div class="game-content">
                ${renderChallengeHeader(gameState)}
                ${renderChallengeCard(challenge, drinkData, sizeInfo, gameState)}
                ${renderChallengeActions(gameState, drinkData, challenge)}
                <div class="challenge-navigation">
                    <button data-action="go-to-main" class="nav-button">Main Menu</button>
                    <button data-action="next-challenge" class="nav-button">${gameState.showResult ? 'Next Challenge' : 'Skip'}</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render recipe input fields based on drink type
 * @param {Object} drinkData - Drink recipe data
 * @param {Object} challenge - Current challenge
 * @param {Object} gameState - Current game state
 * @returns {string} HTML string for input fields
 */
function renderRecipeInputs(drinkData, challenge, gameState) {
    if (!drinkData || !challenge) {
        return '<div class="recipe-inputs"></div>';
    }

    let inputsHtml = '<div class="recipe-inputs"><div class="inputs-grid">';

    // Hot drinks and iced drinks
    if (challenge.category === 'hotDrinks' || challenge.category === 'icedDrinks') {
        if (drinkData.shots) {
            inputsHtml += generateInputField('shots', 'Espresso Shots', '☕', gameState.answer.shots || '', gameState.showResult);
        }
        if (drinkData.syrup) {
            inputsHtml += generateInputField('syrup', 'Syrup Pumps', '🍯', gameState.answer.syrup || '', gameState.showResult);
        }
    }

    // Frappuccinos
    if (challenge.category === 'frappuccinos') {
        if (drinkData.roast) {
            inputsHtml += generateInputField('roast', 'Frapp Roast', '☕', gameState.answer.roast || '', gameState.showResult);
        }
        if (drinkData.frappBase) {
            inputsHtml += generateInputField('frappBase', 'Frapp Base', '🧪', gameState.answer.frappBase || '', gameState.showResult);
        }
        if (drinkData.mochaSauce) {
            inputsHtml += generateInputField('mochaSauce', 'Mocha Sauce', '🍫', gameState.answer.mochaSauce || '', gameState.showResult);
        }
        if (drinkData.caramelSyrup) {
            inputsHtml += generateInputField('caramelSyrup', 'Caramel Syrup', '🍮', gameState.answer.caramelSyrup || '', gameState.showResult);
        }
    }

    // Refreshers
    if (challenge.category === 'refreshers') {
        if (drinkData.inclusion) {
            inputsHtml += generateInputField('inclusion', 'Fruit Inclusion Scoops', '🍓', gameState.answer.inclusion || '', gameState.showResult);
        }
    }

    inputsHtml += '</div></div>';
    return inputsHtml;
}

/**
 * Generate individual input field HTML
 * @param {string} field - Field name
 * @param {string} label - Display label
 * @param {string} icon - Icon emoji
 * @param {string} value - Current value
 * @param {boolean} disabled - Whether input is disabled
 * @returns {string} HTML string for input field
 */
function generateInputField(field, label, icon, value, disabled) {
    if (typeof field !== 'string' || typeof label !== 'string') {
        return '';
    }

    const disabledAttr = disabled ? 'disabled' : '';
    const escapedValue = escapeHtml(String(value));

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
                ${disabledAttr}
            />
        </div>
    `;
}

/**
 * Render challenge result feedback
 * @param {Object} gameState - Current game state
 * @param {Object} drinkData - Drink recipe data
 * @param {Object} challenge - Current challenge
 * @returns {string} HTML string for result display
 */
function renderChallengeResult(gameState, drinkData, challenge) {
    if (!drinkData || typeof gameState.isCorrect !== 'boolean') {
        return '<div class="challenge-result"></div>';
    }

    const isCorrect = gameState.isCorrect;
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
        resultHtml += renderCorrectRecipe(drinkData, challenge);
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
 * Render correct recipe for wrong answers
 * @param {Object} drinkData - Drink recipe data
 * @param {Object} challenge - Current challenge
 * @returns {string} HTML string for correct recipe display
 */
function renderCorrectRecipe(drinkData, challenge) {
    if (!drinkData || !challenge) {
        return '<div class="correct-recipe"></div>';
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
