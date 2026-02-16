/**
 * SnakeGame - Classic Snake implementation
 * Follows portfolio game interface contract
 * NASA Rule 1: No recursion
 * NASA Rule 4: Functions under 60 lines
 */

class SnakeGame {
    /**
     * @param {HTMLElement} container - DOM element to render into
     */
    constructor(container) {
        this.container = container;
        this.state = 'welcome';
        this.snake = [];
        this.direction = 'right';
        this.nextDirection = null;
        this.food = null;
        this.score = 0;
        this.highScore = 0;
        this.gameLoop = null;
        this.gridSize = 20;
        this.speed = 150;

        // Event handler references (for cleanup)
        this.keyboardHandler = null;
        this.blurHandler = null;
        this.visibilityHandler = null;
        this.touchHandlers = null;

        // DOM element references
        this.scoreElement = null;
        this.highScoreElement = null;
        this.gridElement = null;
    }

    /**
     * Initialize game - required by portfolio interface
     * @returns {Promise<boolean>} true on success
     */
    async init() {
        try {
            console.log('[Snake] Initializing');

            // Load persisted data (graceful failure)
            try {
                this.highScore = this._loadHighScore();
            } catch (e) {
                console.warn('[Snake] Score load failed, using default:', e);
                this.highScore = 0;
            }

            // Initialize game state
            this._initializeState();

            // Setup controls
            this._setupControls();

            // Initial render
            this._render();

            console.log('[Snake] Initialization complete');
            return true;

        } catch (error) {
            console.error('[Snake] Initialization failed:', error);
            this._renderInitError(error.message);
            return false;
        }
    }

    /**
     * Initialize game state
     */
    _initializeState() {
        // Starting snake in center
        const center = Math.floor(this.gridSize / 2);
        this.snake = [
            { x: center, y: center },
            { x: center - 1, y: center },
            { x: center - 2, y: center }
        ];
        this.direction = 'right';
        this.nextDirection = null;
        this.score = 0;
        this.speed = 150;
        this._spawnFood();
    }

    /**
     * SECURITY: Load and validate high score from localStorage
     * Prevents XSS via localStorage manipulation
     * @returns {number} Validated high score or 0 on failure
     */
    _loadHighScore() {
        try {
            const raw = localStorage.getItem('snake-high-score');
            if (raw === null) return 0;

            const parsed = parseInt(raw, 10);

            // Validate range (0-999999)
            if (isNaN(parsed) || parsed < 0 || parsed > 999999) {
                console.warn('[Snake] Invalid high score in storage, resetting');
                localStorage.removeItem('snake-high-score');
                return 0;
            }

            return parsed;
        } catch (e) {
            console.warn('[Snake] Could not load high score:', e);
            return 0;
        }
    }

    /**
     * Save high score to localStorage
     */
    _saveHighScore() {
        if (this.score > this.highScore) {
            this.highScore = this.score;
            try {
                localStorage.setItem('snake-high-score', this.highScore.toString());
            } catch (e) {
                console.warn('[Snake] Could not save high score:', e);
            }
        }
    }

    /**
     * SECURITY: Update score display using textContent (NOT innerHTML)
     * Prevents XSS injection via score values
     */
    _updateScoreDisplay() {
        if (this.scoreElement) {
            this.scoreElement.textContent = `Score: ${this.score}`;
        }
        if (this.highScoreElement) {
            this.highScoreElement.textContent = `High: ${this.highScore}`;
        }
    }

    /**
     * Setup event listeners with proper lifecycle management
     * Store references for cleanup in destroy()
     */
    _setupControls() {
        // Store bound functions for cleanup
        this.keyboardHandler = this._handleInput.bind(this);
        this.blurHandler = this._handleBlur.bind(this);
        this.visibilityHandler = this._handleVisibilityChange.bind(this);

        // Keyboard controls
        document.addEventListener('keydown', this.keyboardHandler);

        // Auto-pause on window blur
        window.addEventListener('blur', this.blurHandler);

        // Auto-pause on tab visibility change
        document.addEventListener('visibilitychange', this.visibilityHandler);

        // Touch handlers (if touch device)
        if (this._isTouchDevice()) {
            this._setupTouchControls();
        }
    }

    _isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    _handleBlur() {
        if (this.state === 'playing') {
            this._pause();
        }
    }

    _handleVisibilityChange() {
        if (document.hidden && this.state === 'playing') {
            this._pause();
        }
    }

    /**
     * Setup touch controls for mobile devices
     * Minimum swipe distance: 50px (prevents accidental swipes)
     */
    _setupTouchControls() {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;

        this.touchHandlers = {
            start: (e) => {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
                e.preventDefault();
            },

            end: (e) => {
                const touchEndX = e.changedTouches[0].clientX;
                const touchEndY = e.changedTouches[0].clientY;
                const touchDuration = Date.now() - touchStartTime;

                // Ignore long touches (>500ms)
                if (touchDuration > 500) return;

                const deltaX = touchEndX - touchStartX;
                const deltaY = touchEndY - touchStartY;
                const absDeltaX = Math.abs(deltaX);
                const absDeltaY = Math.abs(deltaY);

                // Swipe threshold: 50px minimum
                if (absDeltaX < 50 && absDeltaY < 50) return;

                // Determine direction (dominant axis wins)
                let direction;
                if (absDeltaX > absDeltaY) {
                    direction = deltaX > 0 ? 'right' : 'left';
                } else {
                    direction = deltaY > 0 ? 'down' : 'up';
                }

                // Use same input handler for consistency
                const fakeEvent = {
                    key: 'Arrow' + direction.charAt(0).toUpperCase() + direction.slice(1),
                    preventDefault: () => {}
                };
                this._handleInput(fakeEvent);
            }
        };

        this.container.addEventListener('touchstart', this.touchHandlers.start, { passive: false });
        this.container.addEventListener('touchend', this.touchHandlers.end);
    }

    /**
     * Input handling with 180-degree turn prevention and input buffering
     * Only ONE input is processed per tick
     */
    _handleInput(e) {
        // Only handle game keys, let browser handle others
        const keyMap = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right',
            'w': 'up',
            's': 'down',
            'a': 'left',
            'd': 'right'
        };

        // Pause toggle
        if (e.key === 'p' || e.key === 'P') {
            e.preventDefault();
            this._togglePause();
            return;
        }

        const newDir = keyMap[e.key];
        if (!newDir) return;

        e.preventDefault();

        if (this.state !== 'playing') return;

        // CRITICAL: Reject 180-degree turns
        const opposites = {
            'up': 'down',
            'down': 'up',
            'left': 'right',
            'right': 'left'
        };

        // Check against CURRENT direction (not buffered)
        if (opposites[this.direction] === newDir) {
            return;
        }

        // Buffer for next tick (only one input per tick)
        this.nextDirection = newDir;
    }

    /**
     * Toggle pause state
     */
    _togglePause() {
        if (this.state === 'playing') {
            this._pause();
        } else if (this.state === 'paused') {
            this._resume();
        }
    }

    /**
     * Pause game
     */
    _pause() {
        if (this.state !== 'playing') return;

        this.state = 'paused';

        // CRITICAL: Stop game loop during pause
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }

        this._render();
    }

    /**
     * Resume game
     */
    _resume() {
        if (this.state !== 'paused') return;

        this.state = 'playing';
        this._startGameLoop();
        this._render();
    }

    /**
     * Start game
     */
    _startGame() {
        this._initializeState();
        this.state = 'playing';
        this._startGameLoop();
        this._render();
    }

    /**
     * Start game loop
     */
    _startGameLoop() {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
        }
        this.gameLoop = setInterval(() => this._tick(), this.speed);
    }

    /**
     * Stop game loop
     */
    _stopGameLoop() {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
    }

    /**
     * Game tick - process buffered input FIRST, then move
     */
    _tick() {
        if (this.state !== 'playing') return;

        // Process buffered input at START of tick
        if (this.nextDirection) {
            const opposites = { 'up': 'down', 'down': 'up', 'left': 'right', 'right': 'left' };
            if (opposites[this.direction] !== this.nextDirection) {
                this.direction = this.nextDirection;
            }
            this.nextDirection = null;
        }

        // Move snake
        this._moveSnake();

        // Check collisions
        if (this._checkCollision()) {
            this._gameOver();
            return;
        }

        // Check food
        this._checkFood();

        // Render
        this._render();
    }

    /**
     * Move snake one cell
     */
    _moveSnake() {
        const head = this.snake[0];
        let newHead = { x: head.x, y: head.y };

        // Calculate new head position
        if (this.direction === 'up') newHead.y--;
        if (this.direction === 'down') newHead.y++;
        if (this.direction === 'left') newHead.x--;
        if (this.direction === 'right') newHead.x++;

        // Add new head
        this.snake.unshift(newHead);

        // Check if food eaten (before removing tail)
        if (newHead.x === this.food.x && newHead.y === this.food.y) {
            // Don't remove tail (snake grows)
            this.score += 10;
            this._updateScoreDisplay();
            this._spawnFood();

            // Increase speed (max out at 80ms)
            if (this.speed > 80) {
                this.speed = Math.max(80, this.speed - 5);
                this._startGameLoop(); // Restart with new speed
            }
        } else {
            // Remove tail (snake moves)
            this.snake.pop();
        }
    }

    /**
     * Check collision with walls or self
     * @returns {boolean} true if collision detected
     */
    _checkCollision() {
        const head = this.snake[0];

        // Wall collision
        if (head.x < 0 || head.x >= this.gridSize || head.y < 0 || head.y >= this.gridSize) {
            return true;
        }

        // Self collision (check from index 1 onwards)
        for (let i = 1; i < this.snake.length; i++) {
            if (head.x === this.snake[i].x && head.y === this.snake[i].y) {
                return true;
            }
        }

        return false;
    }

    /**
     * Spawn food at random unoccupied cell
     */
    _spawnFood() {
        let attempts = 0;
        const maxAttempts = 100;

        while (attempts < maxAttempts) {
            const x = Math.floor(Math.random() * this.gridSize);
            const y = Math.floor(Math.random() * this.gridSize);

            // Check if cell is occupied by snake
            const occupied = this.snake.some(segment => segment.x === x && segment.y === y);

            if (!occupied) {
                this.food = { x, y };
                return;
            }

            attempts++;
        }

        // Grid is full - player wins!
        this.food = null;
    }

    /**
     * Check if snake ate food
     */
    _checkFood() {
        if (!this.food) return;

        const head = this.snake[0];
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            this._updateScoreDisplay();
            this._spawnFood();

            // Increase speed
            if (this.speed > 80) {
                this.speed = Math.max(80, this.speed - 5);
                this._startGameLoop();
            }
        }
    }

    /**
     * Game over
     */
    _gameOver() {
        this.state = 'gameover';
        this._stopGameLoop();
        this._saveHighScore();
        this._render();
    }

    /**
     * Restart game
     */
    _restart() {
        this._startGame();
    }

    /**
     * Render game state
     */
    _render() {
        if (!this.container) return;

        // Clear container
        this.container.innerHTML = '';

        // Create game wrapper
        const gameDiv = document.createElement('div');
        gameDiv.className = 'snake-game';

        // Header with score
        const header = document.createElement('div');
        header.className = 'snake-header';

        this.scoreElement = document.createElement('div');
        this.scoreElement.className = 'snake-score';
        this._updateScoreDisplay();

        this.highScoreElement = document.createElement('div');
        this.highScoreElement.className = 'snake-high-score';
        this._updateScoreDisplay();

        header.appendChild(this.scoreElement);
        header.appendChild(this.highScoreElement);

        // Grid
        const gridWrapper = document.createElement('div');
        gridWrapper.style.position = 'relative';

        this.gridElement = document.createElement('div');
        this.gridElement.className = 'snake-grid';

        // Create cells
        for (let i = 0; i < this.gridSize * this.gridSize; i++) {
            const cell = document.createElement('div');
            cell.className = 'snake-cell';
            this.gridElement.appendChild(cell);
        }

        // Draw snake
        this.snake.forEach((segment, index) => {
            const cellIndex = segment.y * this.gridSize + segment.x;
            const cell = this.gridElement.children[cellIndex];
            if (cell) {
                cell.classList.add(index === 0 ? 'snake-head' : 'snake-body');
            }
        });

        // Draw food
        if (this.food) {
            const foodIndex = this.food.y * this.gridSize + this.food.x;
            const foodCell = this.gridElement.children[foodIndex];
            if (foodCell) {
                foodCell.classList.add('food');
            }
        }

        gridWrapper.appendChild(this.gridElement);

        // State overlays
        if (this.state === 'welcome') {
            const welcome = this._createWelcomeScreen();
            gridWrapper.appendChild(welcome);
        } else if (this.state === 'paused') {
            const pause = this._createPauseOverlay();
            gridWrapper.appendChild(pause);
        } else if (this.state === 'gameover') {
            const gameover = this._createGameOverScreen();
            gridWrapper.appendChild(gameover);
        }

        gameDiv.appendChild(header);
        gameDiv.appendChild(gridWrapper);

        // Instructions
        const instructions = document.createElement('div');
        instructions.className = 'snake-instructions';
        instructions.textContent = 'Arrow keys or WASD to move. P to pause.';
        gameDiv.appendChild(instructions);

        // Touch controls for mobile
        if (this._isTouchDevice()) {
            const controls = this._createTouchControls();
            gameDiv.appendChild(controls);
        }

        this.container.appendChild(gameDiv);
    }

    /**
     * Create welcome screen
     */
    _createWelcomeScreen() {
        const welcome = document.createElement('div');
        welcome.className = 'snake-welcome';

        const title = document.createElement('h1');
        title.textContent = 'Snake';

        const instructions = document.createElement('p');
        instructions.textContent = 'Eat the red food to grow.';

        const controls = document.createElement('p');
        controls.textContent = 'Use arrow keys or WASD to move.';

        const pause = document.createElement('p');
        pause.textContent = 'Press P to pause.';

        const startBtn = document.createElement('button');
        startBtn.textContent = 'Start Game';
        startBtn.onclick = () => this._startGame();

        welcome.appendChild(title);
        welcome.appendChild(instructions);
        welcome.appendChild(controls);
        welcome.appendChild(pause);
        welcome.appendChild(startBtn);

        return welcome;
    }

    /**
     * Create pause overlay
     */
    _createPauseOverlay() {
        const pause = document.createElement('div');
        pause.className = 'snake-pause-overlay';

        const title = document.createElement('div');
        title.textContent = 'PAUSED';

        const hint = document.createElement('p');
        hint.textContent = 'Press P to resume';

        pause.appendChild(title);
        pause.appendChild(hint);

        return pause;
    }

    /**
     * Create game over screen
     */
    _createGameOverScreen() {
        const gameover = document.createElement('div');
        gameover.className = 'snake-gameover';

        const title = document.createElement('h2');
        title.textContent = 'Game Over';

        const scoreText = document.createElement('p');
        scoreText.textContent = `Final Score: ${this.score}`;

        const highScoreText = document.createElement('p');
        highScoreText.textContent = `High Score: ${this.highScore}`;

        const restartBtn = document.createElement('button');
        restartBtn.textContent = 'Play Again';
        restartBtn.onclick = () => this._restart();

        gameover.appendChild(title);
        gameover.appendChild(scoreText);
        gameover.appendChild(highScoreText);
        gameover.appendChild(restartBtn);

        return gameover;
    }

    /**
     * Create touch controls
     */
    _createTouchControls() {
        const controls = document.createElement('div');
        controls.className = 'snake-controls';

        const directions = ['up', 'down', 'left', 'right'];
        const arrows = { up: '↑', down: '↓', left: '←', right: '→' };

        directions.forEach(dir => {
            const btn = document.createElement('button');
            btn.className = 'snake-control-btn';
            btn.dataset.dir = dir;
            btn.textContent = arrows[dir];
            btn.onclick = () => {
                const fakeEvent = {
                    key: 'Arrow' + dir.charAt(0).toUpperCase() + dir.slice(1),
                    preventDefault: () => {}
                };
                this._handleInput(fakeEvent);
            };
            controls.appendChild(btn);
        });

        return controls;
    }

    /**
     * Render error state with retry option
     * @param {string} message - Error message to display
     */
    _renderInitError(message) {
        if (!this.container) return;

        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'text-align: center; padding: 2rem; color: white;';

        const title = document.createElement('h2');
        title.textContent = 'Game Failed to Load';

        const msg = document.createElement('p');
        msg.textContent = message || 'An unexpected error occurred';

        const btn = document.createElement('button');
        btn.textContent = 'Reload and Retry';
        btn.style.cssText = `
            margin-top: 1rem;
            padding: 0.75rem 1.5rem;
            background: #FFA500;
            border: none;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            cursor: pointer;
        `;
        btn.onclick = () => location.reload();

        errorDiv.appendChild(title);
        errorDiv.appendChild(msg);
        errorDiv.appendChild(btn);

        this.container.innerHTML = '';
        this.container.appendChild(errorDiv);
    }

    /**
     * Cleanup resources - REQUIRED by portfolio interface
     * MUST be called on:
     * - User closes modal (X button or click outside)
     * - Escape key pressed
     * - Window beforeunload
     * - New game launched (before new instance created)
     *
     * @returns {boolean} true on success
     */
    destroy() {
        console.log('[Snake] Destroying game instance');

        // CRITICAL: Clear game loop FIRST (stop state changes)
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }

        // Remove keyboard listener
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }

        // Remove touch listeners
        if (this.touchHandlers) {
            this.container.removeEventListener('touchstart', this.touchHandlers.start);
            this.container.removeEventListener('touchend', this.touchHandlers.end);
            this.touchHandlers = null;
        }

        // Remove window listeners
        if (this.blurHandler) {
            window.removeEventListener('blur', this.blurHandler);
            this.blurHandler = null;
        }

        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = null;
        }

        // Clear DOM references
        if (this.container) {
            this.container.innerHTML = '';
        }

        // Null all references
        this.container = null;
        this.scoreElement = null;
        this.highScoreElement = null;
        this.gridElement = null;

        this.state = 'destroyed';
        return true;
    }
}

export { SnakeGame };
