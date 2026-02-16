/**
 * MainMenuScreen.js - Main menu screen rendering
 * Pure function component for main hub/dashboard
 */

import { escapeHtml } from '../../utils/BoundedUtilities.js';

/**
 * Render main menu screen with player stats and navigation
 * @param {Object} gameState - Current game state
 * @param {Array<string>} baristaTips - Array of tips
 * @returns {string} HTML string for main menu screen
 */
export function renderMainMenuScreen(gameState, baristaTips) {
    if (!gameState || !baristaTips || !Array.isArray(baristaTips)) {
        return '<div class="game-screen main-screen"></div>';
    }

    const currentTip = baristaTips[Math.min(gameState.playerLevel - 1, baristaTips.length - 1)];
    const baristaEmoji = gameState.isCorrect ? "😄" : (gameState.showResult && !gameState.isCorrect) ? "😢" : "😊";
    const starsToLevel = (gameState.playerLevel * 5) - gameState.stars;

    return `
        <div class="game-screen main-screen">
            <div class="game-content">
                <div class="main-header">
                    <div class="player-info">
                        <h1>Barista ${escapeHtml(gameState.playerName)}</h1>
                        <div class="player-stats">
                            <span>Level ${gameState.playerLevel}</span>
                            <span>${gameState.stars} ⭐</span>
                            <span>${gameState.streak} 🔥</span>
                        </div>
                    </div>
                    <button data-action="go-to-badges" class="badge-button">
                        🏆 ${gameState.badges.length} badges
                    </button>
                </div>

                <div class="tip-section">
                    <div class="barista-tip">
                        <div class="barista-character">
                            <span class="barista-emoji">${baristaEmoji}</span>
                        </div>
                        <div class="tip-content">
                            <h3>Barista Tip:</h3>
                            <p>${currentTip}</p>
                        </div>
                    </div>

                    ${gameState.streak >= 3 ? `
                        <div class="streak-indicator">
                            <div class="streak-content">
                                <div class="streak-label">Current Streak</div>
                                <div class="streak-number">${gameState.streak} 🔥</div>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <div class="main-actions">
                    <button data-action="generate-challenge" class="action-button primary">
                        <span class="button-icon">🎯</span>
                        <p class="button-text">Random Challenge</p>
                        <p class="button-subtitle">Test your skills!</p>
                    </button>

                    <button data-action="go-to-categories" class="action-button">
                        <span class="button-icon">📚</span>
                        <p class="button-text">Recipe Types</p>
                        <p class="button-subtitle">Choose a category</p>
                    </button>

                    <button data-action="go-to-recipes" class="action-button">
                        <span class="button-icon">📖</span>
                        <p class="button-text">Recipe Book</p>
                        <p class="button-subtitle">Study the recipes</p>
                    </button>

                    <button data-action="toggle-tip" class="action-button">
                        <span class="button-icon">💡</span>
                        <p class="button-text">Barista Tips</p>
                        <p class="button-subtitle">Helpful advice</p>
                    </button>
                </div>

                ${gameState.showTip ? `
                    <div class="random-tip">
                        <h3>Quick Tip!</h3>
                        <p>${baristaTips[Math.floor(Math.random() * baristaTips.length)]}</p>
                    </div>
                ` : ''}

                <div class="progress-info">
                    <p class="progress-text">
                        ${gameState.streak > 0 ?
                            `Current streak: ${gameState.streak} 🔥` :
                            "Start a streak by getting answers right in a row!"
                        }
                    </p>
                    <p class="level-progress">
                        ${gameState.playerLevel < 10 ?
                            `${starsToLevel} more stars to level up!` :
                            "You've reached max level!"
                        }
                    </p>
                </div>
            </div>
        </div>
    `;
}
