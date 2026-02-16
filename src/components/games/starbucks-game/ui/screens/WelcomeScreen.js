/**
 * WelcomeScreen.js - Welcome screen rendering
 * Pure function component for initial player name entry
 */

import { escapeHtml } from '../../utils/BoundedUtilities.js';

/**
 * Render welcome screen with player name input
 * @param {Object} gameState - Current game state
 * @returns {string} HTML string for welcome screen
 */
export function renderWelcomeScreen(gameState) {
    if (!gameState || typeof gameState.playerName !== 'string') {
        return '<div class="game-screen welcome-screen"></div>';
    }

    const escapedName = escapeHtml(gameState.playerName);
    const isEnabled = gameState.playerName.trim().length > 0;

    return `
        <div class="game-screen welcome-screen">
            <div class="game-content">
                <div class="welcome-header">
                    <h1 class="game-title">☕ Barista Adventure ☕</h1>
                    <p class="game-subtitle">Become a master barista through fun challenges!</p>
                </div>

                <div class="barista-avatar">
                    <span class="avatar-icon">👨‍🍳</span>
                    <h2>Welcome, Future Barista!</h2>
                    <p>What's your barista name?</p>
                </div>

                <div class="welcome-form">
                    <div class="form-group">
                        <input
                            type="text"
                            id="player-name"
                            value="${escapedName}"
                            placeholder="Enter your name"
                            maxlength="20"
                            class="name-input"
                        />
                    </div>

                    <button
                        data-action="start-game"
                        class="start-button ${isEnabled ? 'enabled' : 'disabled'}"
                        ${!isEnabled ? 'disabled' : ''}
                    >
                        Start My Adventure!
                    </button>
                </div>

                <div class="welcome-features">
                    <div class="feature">
                        <span class="feature-icon">⭐</span>
                        <strong>Learn recipes</strong>
                    </div>
                    <div class="feature">
                        <span class="feature-icon">🏆</span>
                        <strong>Earn badges</strong>
                    </div>
                    <div class="feature">
                        <span class="feature-icon">🔥</span>
                        <strong>Build streaks</strong>
                    </div>
                </div>
            </div>
        </div>
    `;
}
