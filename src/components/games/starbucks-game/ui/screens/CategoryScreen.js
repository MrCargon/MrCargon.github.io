/**
 * CategoryScreen.js - Category selection screen rendering
 * Pure function component for drink category selection
 */

/**
 * Render category selection screen
 * @param {Object} gameState - Current game state
 * @returns {string} HTML string for category screen
 */
export function renderCategoryScreen(gameState) {
    // Assertions
    if (window.Assert && typeof window.Assert.assertNotNull === 'function') {
        window.Assert.assertNotNull(gameState, 'Game state required');
        window.Assert.assertType(gameState.playerLevel, 'number', 'Player level');
    }

    return `
        <div class="game-screen categories-screen">
            <div class="game-content">
                <div class="screen-header">
                    <h2>Choose a Recipe Type</h2>
                    <p>Level ${gameState.playerLevel} • ${gameState.stars} ⭐</p>
                </div>

                <div class="categories-grid">
                    <div class="category-card red"
                         data-action="select-category"
                         data-category="hotDrinks"
                         role="button"
                         tabindex="0"
                         aria-label="Select Hot Espresso Drinks category">
                        <span class="category-icon">☕</span>
                        <div class="category-info">
                            <h3>Hot Espresso Drinks</h3>
                            <p>Lattes, Cappuccinos & more</p>
                        </div>
                    </div>

                    <div class="category-card blue"
                         data-action="select-category"
                         data-category="icedDrinks"
                         role="button"
                         tabindex="0"
                         aria-label="Select Iced Espresso Drinks category">
                        <span class="category-icon">🧊</span>
                        <div class="category-info">
                            <h3>Iced Espresso Drinks</h3>
                            <p>Cool & refreshing coffee</p>
                        </div>
                    </div>

                    <div class="category-card purple"
                         data-action="select-category"
                         data-category="frappuccinos"
                         role="button"
                         tabindex="0"
                         aria-label="Select Frappuccinos category">
                        <span class="category-icon">🥤</span>
                        <div class="category-info">
                            <h3>Frappuccinos</h3>
                            <p>Blended frozen treats</p>
                        </div>
                    </div>

                    <div class="category-card pink"
                         data-action="select-category"
                         data-category="refreshers"
                         role="button"
                         tabindex="0"
                         aria-label="Select Refreshers category">
                        <span class="category-icon">🍓</span>
                        <div class="category-info">
                            <h3>Refreshers</h3>
                            <p>Fruity & refreshing</p>
                        </div>
                    </div>
                </div>

                <div class="screen-actions">
                    <button data-action="go-to-main" class="back-button">Back to Menu</button>
                </div>
            </div>
        </div>
    `;
}
