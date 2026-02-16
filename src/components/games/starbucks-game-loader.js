/**
 * starbucks-game-loader.js - Dual-Boot Module Entry Point
 * Supports: (1) Standalone mode via standalone.html
 *           (2) Portfolio mode via ProjectsPageManager
 *
 * Boot Mode Detection: Uses pathname (no timing race)
 *   - Standalone: location.pathname includes 'standalone.html'
 *   - Portfolio: location.pathname does NOT include 'standalone.html'
 *
 * v2.0 - Addresses roaster feedback:
 *   - Pathname detection instead of global flag (Issue 1)
 *   - Try-catch with timeout for init (Issue 2)
 *   - Duplicate load protection with destroy() (Issue 3)
 *   - CSS load wait before init (Issue 4)
 *   - Exit button for standalone (mobile UX)
 */

import { StarbucksGame } from './StarbucksGame.js';

const INIT_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Wait for CSS stylesheet to load
 * @param {string} selector - CSS selector for the link element
 * @param {number} timeoutMs - Maximum wait time
 * @returns {Promise<boolean>} - true if loaded, false if timeout/error
 */
async function waitForCSS(selector, timeoutMs = 5000) {
    const cssLink = document.querySelector(selector);
    if (!cssLink) {
        console.warn('[Barista:Loader] CSS link not found:', selector);
        return true; // Continue anyway
    }

    // Check if already loaded
    if (cssLink.sheet) {
        return true;
    }

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.warn('[Barista:Loader] CSS load timeout, continuing anyway');
            resolve(false);
        }, timeoutMs);

        cssLink.addEventListener('load', () => {
            clearTimeout(timeout);
            resolve(true);
        });

        cssLink.addEventListener('error', () => {
            clearTimeout(timeout);
            console.error('[Barista:Loader] CSS failed to load');
            resolve(false);
        });
    });
}

/**
 * Show error in a fresh container (not the potentially corrupted game container)
 * @param {string} message - Error message to display
 */
function showFatalError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'padding:20px;text-align:center;color:#ff6b6b;font-family:system-ui,sans-serif;';
    errorDiv.innerHTML = `<h2>Game Error</h2><p>${message}</p><p><button onclick="location.reload()">Reload</button></p>`;
    document.body.innerHTML = '';
    document.body.appendChild(errorDiv);
}

/**
 * Setup exit button for standalone mode
 */
function setupExitButton() {
    const exitBtn = document.getElementById('standalone-exit');
    if (!exitBtn) return;

    exitBtn.classList.add('visible');
    exitBtn.addEventListener('click', () => {
        // Try window.close() first (works if opened via JS)
        window.close();

        // If still here, try history.back()
        setTimeout(() => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                // Last resort: show message
                alert('Please close this tab manually.');
            }
        }, 100);
    });
}

/**
 * Initialize game in standalone mode with full error handling
 * NASA Rule 4 compliant: Under 60 lines
 */
async function initStandalone() {
    console.log('[Barista:Loader] Standalone mode detected - auto-booting');

    const container = document.getElementById('game-container');
    if (!container) {
        showFatalError('#game-container not found');
        return false;
    }

    // Issue 4 fix: Wait for CSS before init
    await waitForCSS('link[href*="StarbucksGame.css"]');

    // Issue 3 fix: Clean up existing instance if present
    if (window.__BARISTA_GAME_INSTANCE) {
        console.warn('[Barista:Loader] Existing instance detected - cleaning up');
        try {
            window.__BARISTA_GAME_INSTANCE.destroy();
        } catch (e) {
            console.error('[Barista:Loader] Cleanup failed:', e);
        }
        window.__BARISTA_GAME_INSTANCE = null;
    }

    // Clear loading message
    container.innerHTML = '';

    // Issue 2 fix: Wrap in try-catch with timeout
    let game = null;
    let initTimeout = null;

    try {
        game = new StarbucksGame(container);

        // Set up timeout
        const timeoutPromise = new Promise((_, reject) => {
            initTimeout = setTimeout(() => {
                reject(new Error('Initialization timeout (10 seconds)'));
            }, INIT_TIMEOUT_MS);
        });

        // Race init against timeout
        const success = await Promise.race([
            game.init(),
            timeoutPromise
        ]);

        clearTimeout(initTimeout);

        if (!success) {
            throw new Error('Initialization returned false');
        }

        // Store instance and setup exit
        window.__BARISTA_GAME_INSTANCE = game;
        setupExitButton();

        console.log('[Barista:Loader] Standalone game initialized successfully');
        return true;

    } catch (error) {
        if (initTimeout) clearTimeout(initTimeout);
        console.error('[Barista:Loader] Fatal error:', error);
        showFatalError(error.message || 'Unknown initialization error');
        return false;
    }
}

/**
 * Detect boot mode and initialize appropriately
 * Issue 1 fix: Use pathname detection (no timing race)
 */
function initializeGame() {
    if (typeof window === 'undefined') {
        console.error('[Barista:Loader] Window object not available');
        return false;
    }

    // Issue 1 fix: Pathname detection is always available when module runs
    const isStandalone = window.location.pathname.includes('standalone.html');

    if (isStandalone) {
        // STANDALONE MODE: Auto-create container and boot game
        initStandalone();
    } else {
        // PORTFOLIO MODE: Export to window for PageManager
        console.log('[Barista:Loader] Portfolio mode - exporting to window.StarbucksGame');
        window.StarbucksGame = StarbucksGame;
    }

    return true;
}

// Execute on module load
initializeGame();

// Export for ES6 module consumers
export { StarbucksGame };
