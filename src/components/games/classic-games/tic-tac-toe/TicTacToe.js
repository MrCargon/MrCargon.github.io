/**
 * TicTacToe - X vs O with simple AI
 * Follows portfolio game interface contract
 *
 * NASA Rule 4 Compliance: All functions under 60 lines
 * NASA Rule 1 Compliance: No recursion (iterative AI)
 */

class TicTacToe {
    /**
     * @param {HTMLElement} container - DOM element to render into
     */
    constructor(container) {
        this.container = container;
        this.state = 'welcome';      // welcome | playing | gameover | destroyed
        this.board = Array(9).fill(null);  // null | 'X' | 'O'
        this.currentPlayer = 'X';    // X = player, O = AI
        this.winner = null;          // null | 'X' | 'O' | 'draw'
        this.scores = { player: 0, ai: 0, draws: 0 };
        this.winningLine = null;     // [index, index, index] for highlight

        // Event handler references (for cleanup)
        this.clickHandler = null;
    }

    /**
     * Initialize game - required by portfolio interface
     * @returns {Promise<boolean>} true on success
     */
    async init() {
        try {
            console.log('[TicTacToe] Initializing');

            // Load persisted scores (graceful failure)
            try {
                this.scores = this._loadScores();
            } catch (e) {
                console.warn('[TicTacToe] Score load failed, using default:', e);
                this.scores = { player: 0, ai: 0, draws: 0 };
            }

            // Setup controls
            this._setupControls();

            // Initial render
            this._render();

            console.log('[TicTacToe] Initialization complete');
            return true;

        } catch (error) {
            console.error('[TicTacToe] Initialization failed:', error);
            this._renderInitError(error.message);
            return false;
        }
    }

    /**
     * Cleanup resources - required by portfolio interface
     * @returns {boolean} true on success
     */
    destroy() {
        console.log('[TicTacToe] Destroying game instance');

        if (this.clickHandler) {
            this.container.removeEventListener('click', this.clickHandler);
            this.clickHandler = null;
        }

        if (this.container) {
            this.container.innerHTML = '';
        }

        this.container = null;
        this.state = 'destroyed';
        return true;
    }

    /**
     * Setup event listeners with proper lifecycle management
     */
    _setupControls() {
        this.clickHandler = this._handleClick.bind(this);
        this.container.addEventListener('click', this.clickHandler);
    }

    /**
     * SECURITY: Load and validate scores from localStorage
     * Prevents XSS via localStorage manipulation
     * @returns {Object} Validated scores or defaults on failure
     */
    _loadScores() {
        try {
            const raw = localStorage.getItem('tictactoe-scores');
            if (raw === null) {
                return { player: 0, ai: 0, draws: 0 };
            }

            const parsed = JSON.parse(raw);

            // Validate structure and ranges
            if (typeof parsed.player !== 'number' || parsed.player < 0 || parsed.player > 9999 ||
                typeof parsed.ai !== 'number' || parsed.ai < 0 || parsed.ai > 9999 ||
                typeof parsed.draws !== 'number' || parsed.draws < 0 || parsed.draws > 9999) {
                console.warn('[TicTacToe] Invalid scores in storage, resetting');
                localStorage.removeItem('tictactoe-scores');
                return { player: 0, ai: 0, draws: 0 };
            }

            return {
                player: Math.floor(parsed.player),
                ai: Math.floor(parsed.ai),
                draws: Math.floor(parsed.draws)
            };
        } catch (e) {
            console.warn('[TicTacToe] Could not load scores:', e);
            return { player: 0, ai: 0, draws: 0 };
        }
    }

    /**
     * Save scores to localStorage
     */
    _saveScores() {
        try {
            localStorage.setItem('tictactoe-scores', JSON.stringify(this.scores));
        } catch (e) {
            console.warn('[TicTacToe] Could not save scores:', e);
        }
    }

    /**
     * Master click handler - routes to appropriate actions
     */
    _handleClick(e) {
        const target = e.target;

        // Start game
        if (target.classList.contains('tictactoe-start-btn')) {
            this._startGame();
            return;
        }

        // Restart game
        if (target.classList.contains('tictactoe-restart-btn')) {
            this._restart();
            return;
        }

        // Cell click
        if (target.classList.contains('tictactoe-cell')) {
            const index = parseInt(target.dataset.index, 10);
            if (!isNaN(index)) {
                this._handleCellClick(index);
            }
        }
    }

    /**
     * Handle cell click - player move
     */
    _handleCellClick(index) {
        // Only process if game is playing, it's player's turn, and cell is empty
        if (this.state !== 'playing' || this.currentPlayer !== 'X' || this.board[index] !== null) {
            return;
        }

        // Place player's mark
        this.board[index] = 'X';
        this._render();

        // Check for winner
        const winner = this._checkWinner();
        if (winner) {
            this._handleGameEnd(winner);
            return;
        }

        // Switch to AI
        this.currentPlayer = 'O';
        this._render();

        // Trigger AI move
        this._aiMove();
    }

    /**
     * AI move with non-blocking delay
     * Prevents UI freeze during "thinking"
     */
    async _aiMove() {
        if (this.state !== 'playing' || this.currentPlayer !== 'O') return;

        // Show thinking indicator
        this._showThinkingIndicator();

        // Non-blocking delay (500ms feels natural)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if game state changed during delay
        if (this.state !== 'playing' || this.currentPlayer !== 'O') {
            this._hideThinkingIndicator();
            return;
        }

        // Calculate move (simple priority, NOT recursive minimax)
        const bestMove = this._calculateBestMove();

        if (bestMove !== -1) {
            this.board[bestMove] = 'O';
            this.currentPlayer = 'X';

            const winner = this._checkWinner();
            if (winner) {
                this._handleGameEnd(winner);
            }
        }

        this._hideThinkingIndicator();
        this._render();
    }

    /**
     * Simple priority-based AI (NO recursion per NASA Rule 1)
     * @returns {number} Best move index or -1 if no moves
     */
    _calculateBestMove() {
        // Priority 1: Win
        const winMove = this._findWinningMove('O');
        if (winMove !== -1) return winMove;

        // Priority 2: Block
        const blockMove = this._findWinningMove('X');
        if (blockMove !== -1) return blockMove;

        // Priority 3: Center
        if (this.board[4] === null) return 4;

        // Priority 4: Corners
        const corners = [0, 2, 6, 8];
        const availableCorners = [];
        for (let i = 0; i < corners.length; i++) {
            if (this.board[corners[i]] === null) {
                availableCorners.push(corners[i]);
            }
        }
        if (availableCorners.length > 0) {
            return availableCorners[Math.floor(Math.random() * availableCorners.length)];
        }

        // Priority 5: Any available
        const available = [];
        for (let i = 0; i < this.board.length; i++) {
            if (this.board[i] === null) {
                available.push(i);
            }
        }
        if (available.length > 0) {
            return available[Math.floor(Math.random() * available.length)];
        }

        return -1;
    }

    /**
     * Find winning move for given player
     * Uses iteration, not recursion
     */
    _findWinningMove(player) {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
            [0, 4, 8], [2, 4, 6]             // diagonals
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let playerCount = 0;
            let emptyIndex = -1;

            for (let j = 0; j < line.length; j++) {
                const cellIndex = line[j];
                if (this.board[cellIndex] === player) {
                    playerCount++;
                } else if (this.board[cellIndex] === null) {
                    emptyIndex = cellIndex;
                }
            }

            if (playerCount === 2 && emptyIndex !== -1) {
                return emptyIndex;
            }
        }

        return -1;
    }

    /**
     * Check for winner or draw
     * @returns {string|null} 'X', 'O', 'draw', or null
     */
    _checkWinner() {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
            [0, 4, 8], [2, 4, 6]             // diagonals
        ];

        for (let i = 0; i < lines.length; i++) {
            const [a, b, c] = lines[i];
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                this.winningLine = [a, b, c];
                return this.board[a];
            }
        }

        // Check for draw
        let hasEmpty = false;
        for (let i = 0; i < this.board.length; i++) {
            if (this.board[i] === null) {
                hasEmpty = true;
                break;
            }
        }

        if (!hasEmpty) {
            return 'draw';
        }

        return null;
    }

    /**
     * Handle game end - update scores and transition
     */
    _handleGameEnd(winner) {
        this.winner = winner;

        if (winner === 'X') {
            this.scores.player++;
        } else if (winner === 'O') {
            this.scores.ai++;
        } else if (winner === 'draw') {
            this.scores.draws++;
        }

        this._saveScores();
        this.state = 'gameover';
        this._render();
    }

    /**
     * Start new game
     */
    _startGame() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 'X';
        this.winner = null;
        this.winningLine = null;
        this.state = 'playing';
        this._render();
    }

    /**
     * Restart game (from game over)
     */
    _restart() {
        this._startGame();
    }

    /**
     * Show thinking indicator
     */
    _showThinkingIndicator() {
        const indicator = this.container.querySelector('.tictactoe-thinking');
        if (indicator) {
            indicator.textContent = 'AI is thinking...';
        }
    }

    /**
     * Hide thinking indicator
     */
    _hideThinkingIndicator() {
        const indicator = this.container.querySelector('.tictactoe-thinking');
        if (indicator) {
            indicator.textContent = '';
        }
    }

    /**
     * Master render function
     */
    _render() {
        if (!this.container) return;

        if (this.state === 'welcome') {
            this._renderWelcome();
        } else if (this.state === 'playing') {
            this._renderGame();
        } else if (this.state === 'gameover') {
            this._renderGameOver();
        }
    }

    /**
     * Render welcome screen
     */
    _renderWelcome() {
        this.container.innerHTML = '';

        const game = document.createElement('div');
        game.className = 'tictactoe-game';

        const header = document.createElement('div');
        header.className = 'tictactoe-header';

        const title = document.createElement('h1');
        title.className = 'tictactoe-title';
        title.textContent = 'Tic Tac Toe';

        header.appendChild(title);

        const welcome = document.createElement('div');
        welcome.className = 'tictactoe-welcome';

        const desc = document.createElement('p');
        desc.textContent = 'Play as X against the AI (O). Get three in a row to win!';

        const startBtn = document.createElement('button');
        startBtn.className = 'tictactoe-button tictactoe-start-btn';
        startBtn.textContent = 'Start Game';

        welcome.appendChild(desc);
        welcome.appendChild(startBtn);

        game.appendChild(header);
        game.appendChild(welcome);

        this.container.appendChild(game);
    }

    /**
     * Render active game
     */
    _renderGame() {
        this.container.innerHTML = '';

        const game = document.createElement('div');
        game.className = 'tictactoe-game';

        // Header
        const header = document.createElement('div');
        header.className = 'tictactoe-header';

        const title = document.createElement('h1');
        title.className = 'tictactoe-title';
        title.textContent = 'Tic Tac Toe';

        const turn = document.createElement('p');
        turn.className = 'tictactoe-turn';
        turn.textContent = this.currentPlayer === 'X' ? 'Your Turn (X)' : 'AI Turn (O)';

        header.appendChild(title);
        header.appendChild(turn);

        // Scores
        const scores = this._renderScores();

        // Board
        const board = this._renderBoard();

        // Thinking indicator
        const thinking = document.createElement('div');
        thinking.className = 'tictactoe-thinking';

        game.appendChild(header);
        game.appendChild(scores);
        game.appendChild(board);
        game.appendChild(thinking);

        this.container.appendChild(game);
    }

    /**
     * Render game over screen
     */
    _renderGameOver() {
        this.container.innerHTML = '';

        const game = document.createElement('div');
        game.className = 'tictactoe-game';

        // Header
        const header = document.createElement('div');
        header.className = 'tictactoe-header';

        const title = document.createElement('h1');
        title.className = 'tictactoe-title';
        title.textContent = 'Game Over';

        header.appendChild(title);

        // Result
        const gameover = document.createElement('div');
        gameover.className = 'tictactoe-gameover';

        const result = document.createElement('p');
        result.className = 'tictactoe-result';
        if (this.winner === 'X') {
            result.textContent = 'You Win!';
        } else if (this.winner === 'O') {
            result.textContent = 'AI Wins!';
        } else {
            result.textContent = "It's a Draw!";
        }

        const restartBtn = document.createElement('button');
        restartBtn.className = 'tictactoe-button tictactoe-restart-btn';
        restartBtn.textContent = 'Play Again';

        gameover.appendChild(result);
        gameover.appendChild(restartBtn);

        // Scores
        const scores = this._renderScores();

        // Board (showing final state)
        const board = this._renderBoard();

        game.appendChild(header);
        game.appendChild(gameover);
        game.appendChild(scores);
        game.appendChild(board);

        this.container.appendChild(game);
    }

    /**
     * Render scores display (SECURITY: uses textContent)
     */
    _renderScores() {
        const scores = document.createElement('div');
        scores.className = 'tictactoe-scores';

        const playerScore = document.createElement('div');
        playerScore.className = 'score-item';
        const playerLabel = document.createElement('span');
        playerLabel.className = 'score-label';
        playerLabel.textContent = 'You (X)';
        const playerValue = document.createElement('span');
        playerValue.className = 'score-value';
        playerValue.textContent = String(this.scores.player);
        playerScore.appendChild(playerLabel);
        playerScore.appendChild(playerValue);

        const drawScore = document.createElement('div');
        drawScore.className = 'score-item';
        const drawLabel = document.createElement('span');
        drawLabel.className = 'score-label';
        drawLabel.textContent = 'Draws';
        const drawValue = document.createElement('span');
        drawValue.className = 'score-value';
        drawValue.textContent = String(this.scores.draws);
        drawScore.appendChild(drawLabel);
        drawScore.appendChild(drawValue);

        const aiScore = document.createElement('div');
        aiScore.className = 'score-item';
        const aiLabel = document.createElement('span');
        aiLabel.className = 'score-label';
        aiLabel.textContent = 'AI (O)';
        const aiValue = document.createElement('span');
        aiValue.className = 'score-value';
        aiValue.textContent = String(this.scores.ai);
        aiScore.appendChild(aiLabel);
        aiScore.appendChild(aiValue);

        scores.appendChild(playerScore);
        scores.appendChild(drawScore);
        scores.appendChild(aiScore);

        return scores;
    }

    /**
     * Render game board
     */
    _renderBoard() {
        const board = document.createElement('div');
        board.className = 'tictactoe-board';

        for (let i = 0; i < 9; i++) {
            const cell = document.createElement('div');
            cell.className = 'tictactoe-cell';
            cell.dataset.index = String(i);

            if (this.board[i] !== null) {
                cell.classList.add('occupied');
                cell.classList.add(this.board[i].toLowerCase());
                cell.textContent = this.board[i];
            }

            // Highlight winning line
            if (this.winningLine && this.winningLine.includes(i)) {
                cell.classList.add('winning');
            }

            board.appendChild(cell);
        }

        return board;
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
}

export { TicTacToe };
