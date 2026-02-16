/**
 * FunFactDisplay.js - Fun fact display component
 * Reusable component for showing drink fun facts
 */

/**
 * Render fun fact display
 * @param {string} funFact - Fun fact text
 * @returns {string} HTML string for fun fact display
 */
export function renderFunFactDisplay(funFact) {
    // Assertions
    if (window.Assert && typeof window.Assert.assertType === 'function') {
        window.Assert.assertType(funFact, 'string', 'Fun fact');
        window.Assert.assert(funFact.length > 0, 'Fun fact must not be empty');
    }

    return `
        <div class="fun-fact-display">
            <div class="fun-fact-header">
                <span class="fun-fact-icon">💡</span>
                <h4>Fun Fact</h4>
            </div>
            <div class="fun-fact-content">
                <p>${funFact}</p>
            </div>
        </div>
    `;
}
