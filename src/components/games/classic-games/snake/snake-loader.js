/**
 * snake-loader.js - Dual-Boot Module Entry Point
 * Supports: (1) Standalone mode via standalone.html
 *           (2) Portfolio mode via ProjectsPageManager
 *
 * Boot Mode Detection: Uses pathname (no timing race)
 *   - Standalone: location.pathname includes 'standalone.html'
 *   - Portfolio: location.pathname does NOT include 'standalone.html'
 */

import { SnakeGame } from './SnakeGame.js';

const INIT_TIMEOUT_MS = 5000; // 5 seconds

let gameInstance = null;

/**
 * Wait for CSS stylesheet to load
 * @param {string} selector - CSS selector for the link element
 * @param {number} timeoutMs - Maximum wait time
 * @returns {Promise<boolean>} - true if loaded, false if timeout/error
 */
async function waitForCSS(selector, timeoutMs = 5000) {
    const cssLink = document.querySelector(selector);
    if (!cssLink) {
        console.warn('[Snake:Loader] CSS link not found:', selector);
        return true; // Continue anyway
    }

    // Check if already loaded
    if (cssLink.sheet) {
        return true;
    }

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.warn('[Snake:Loader] CSS load timeout, continuing anyway');
            resolve(false);
        }, timeoutMs);

        cssLink.addEventListener('load', () => {
            clearTimeout(timeout);
            resolve(true);
        });

        cssLink.addEventListener('error', () => {
            clearTimeout(timeout);
            console.error('[Snake:Loader] CSS failed to load');
            resolve(false);
        });
    });
}

/**
 * Setup exit button for standalone mode
 */
function setupExitButton() {
    const exitBtn = document.getElementById('standalone-exit');
    if (!exitBtn) return;

    exitBtn.classList.add('visible');
    exitBtn.addEventListener('click', () => {
        // Clean up game instance
        if (gameInstance) {
            gameInstance.destroy();
            gameInstance = null;
        }

        // Try window.close() first (works if opened via JS)
        window.close();

        // Fallback: navigate to portfolio
        setTimeout(() => {
            window.location.href = '../../../index.html';
        }, 100);
    });
}

/**
 * Initialize game in standalone mode
 * NASA Rule 4 compliant: Under 60 lines
 */
async function initStandalone() {
    console.log('[Snake:Loader] Standalone mode detected - auto-booting');

    const container = document.getElementById('game-container');
    if (!container) {
        console.error('[Snake:Loader] #game-container not found');
        return false;
    }

    // Wait for CSS before init
    await waitForCSS('link[href*="SnakeGame.css"]');

    // Clean up existing instance if present
    if (gameInstance) {
        console.warn('[Snake:Loader] Existing instance detected - cleaning up');
        try {
            gameInstance.destroy();
        } catch (e) {
            console.error('[Snake:Loader] Cleanup failed:', e);
        }
        gameInstance = null;
    }

    // Clear loading message
    container.innerHTML = '';

    try {
        gameInstance = new SnakeGame(container);
        window.__SNAKE_GAME_INSTANCE = gameInstance; // For testing

        // Set up timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Initialization timeout'));
            }, INIT_TIMEOUT_MS);
        });

        // Race init against timeout
        const success = await Promise.race([
            gameInstance.init(),
            timeoutPromise
        ]);

        if (!success) {
            throw new Error('Initialization returned false');
        }

        setupExitButton();
        console.log('[Snake:Loader] Game initialized successfully');
        return true;

    } catch (error) {
        console.error('[Snake:Loader] Fatal error:', error);
        container.innerHTML = '<p style="color: white; text-align: center;">Failed to load game. Please refresh.</p>';
        return false;
    }
}

/**
 * Detect boot mode and initialize appropriately
 */
function initializeGame() {
    if (typeof window === 'undefined') {
        console.error('[Snake:Loader] Window object not available');
        return false;
    }

    const isStandalone = window.location.pathname.includes('standalone.html');

    if (isStandalone) {
        // STANDALONE MODE: Auto-create container and boot game
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initStandalone);
        } else {
            initStandalone();
        }
    } else {
        // PORTFOLIO MODE: Export to window for PageManager
        console.log('[Snake:Loader] Portfolio mode - exporting to window.SnakeGame');
        window.SnakeGame = SnakeGame;
    }

    return true;
}

// CRITICAL: Cleanup on window unload
window.addEventListener('beforeunload', () => {
    if (gameInstance) {
        gameInstance.destroy();
        gameInstance = null;
    }
});

// Execute on module load
initializeGame();

// Export for ES6 module consumers
export { SnakeGame };
