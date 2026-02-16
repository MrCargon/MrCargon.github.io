/**
 * BadgeScreen.js - Badge display screen rendering
 * Pure function component for showing earned and locked badges
 */

/**
 * Render badge screen with earned and locked badges
 * @param {Object} gameState - Current game state
 * @param {Array} badgeTypes - Badge type definitions
 * @returns {string} HTML string for badge screen
 */
export function renderBadgeScreen(gameState, badgeTypes) {
    // Assertions
    if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
        window.Assert.assertNotNull(gameState, 'Game state required');
        window.Assert.assertNotNull(badgeTypes, 'Badge types required');
    }

    return `
        <div class="game-screen badges-screen">
            <div class="game-content">
                <div class="screen-header">
                    <h2>Your Badges</h2>
                    <p>Level ${gameState.playerLevel} • ${gameState.stars} ⭐</p>
                </div>

                <div class="badges-summary">
                    <p>Collect badges by completing challenges and mastering recipes!</p>
                    <p class="badge-count">
                        ${gameState.badges.length} / ${badgeTypes.length} Badges Earned
                    </p>
                </div>

                <div class="badges-grid">
                    ${badgeTypes.map(badge => {
                        const earned = gameState.badges.includes(badge.id);

                        return `
                            <div class="badge-card ${earned ? 'earned' : 'locked'}">
                                <div class="badge-icon ${earned ? '' : 'grayscale'}">${badge.icon}</div>
                                <h3>${badge.name}</h3>
                                <p>${badge.description}</p>
                                ${earned ? '<div class="earned-check">✓</div>' : '<div class="locked-overlay">🔒</div>'}
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="screen-actions">
                    <button data-action="go-to-main" class="back-button">Back to Menu</button>
                </div>
            </div>
        </div>
    `;
}
