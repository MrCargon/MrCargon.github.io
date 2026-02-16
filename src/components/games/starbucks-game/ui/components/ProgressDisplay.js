/**
 * ProgressDisplay.js - Player stats header component
 * Reusable component for displaying player progression stats
 */

import { escapeHtml } from '../../utils/BoundedUtilities.js';

/**
 * Render player progress display header
 * @param {Object} gameState - Current game state
 * @returns {string} HTML string for progress display
 */
export function renderProgressDisplay(gameState) {
    // Assertions
    if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
        window.Assert.assertNotNull(gameState, 'Game state required');
        window.Assert.assertType(gameState.playerLevel, 'number', 'Player level');
    }

    const escapedName = escapeHtml(gameState.playerName);

    return `
        <div class="player-progress-header">
            <div class="player-info">
                <h2>Barista ${escapedName}</h2>
                <div class="player-stats">
                    <span class="stat-item">Level ${gameState.playerLevel}</span>
                    <span class="stat-item">${gameState.stars} ⭐</span>
                    <span class="stat-item">${gameState.streak} 🔥</span>
                    <span class="stat-item">🏆 ${gameState.badges.length}</span>
                </div>
            </div>
        </div>
    `;
}
