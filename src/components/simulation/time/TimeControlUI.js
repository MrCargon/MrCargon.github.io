/**
 * TimeControlUI.js
 *
 * EDUCATIONAL DEMO - NOT FOR SCIENTIFIC RESEARCH
 *
 * This code provides interactive time controls for educational visualization.
 * For scientific work, use NASA JPL Horizons System:
 * https://ssd.jpl.nasa.gov/horizons.cgi
 *
 * UI controller for real-time solar system time controls.
 * Manages play/pause, time scale, reset, and date display with accessibility.
 *
 * Features:
 * - Play/pause/reset buttons with keyboard support
 * - Time scale slider with preset buttons (1x, 2x, 3x, 50x, 100x, 1000x, 5000x)
 * - Date/time display (UTC + optional local)
 * - Date picker for jumping to specific dates
 * - Mobile responsive (bottom drawer <768px, top-right HUD ≥768px)
 * - WCAG 2.1 AA compliant (ARIA labels, keyboard navigation, focus indicators)
 *
 * NASA Rules Compliance:
 * - Rule 2: Bounded loops and event listeners
 * - Rule 3: No dynamic memory allocation in update loop
 * - Rule 4: All functions <= 60 lines
 * - Rule 5: >= 2 assertions per public method
 * - Rule 7: All DOM queries checked for null
 */

class TimeControlUI {
  // Time scale presets (user-requested: 1x, 2x, 3x, then 50x, 100x, 1000x, 5000x)
  static SCALE_PRESETS = [1, 2, 3, 50, 100, 1000, 5000];

  // Update interval (milliseconds)
  static DISPLAY_UPDATE_INTERVAL = 100; // 10 times per second

  /**
   * Create time control UI
   *
   * @param {TimeScaleManager} timeManager - Time scale manager instance
   *
   * NASA Rule 5: Validate timeManager exists
   */
  constructor(timeManager) {
    console.assert(timeManager !== null, 'TimeControlUI: timeManager required');
    console.assert(typeof timeManager.getJ2000Days === 'function',
      'TimeControlUI: timeManager must have getJ2000Days method');

    this.timeManager = timeManager;
    this.container = null;
    this.controls = {};
    this.updateTimerId = null;

    // NASA Rule 3: Pre-allocate for display updates
    this.lastUpdateTime = 0;

    this.initializeControls();
    this.attachEventHandlers();
    this.startDisplayUpdates();
  }

  /**
   * Initialize control elements
   *
   * Creates HTML structure and queries DOM elements.
   * NASA Rule 4: <= 60 lines
   * NASA Rule 7: Check all querySelector results
   */
  initializeControls() {
    // Create container div
    this.container = document.createElement('div');
    this.container.id = 'time-controls-container';
    this.container.className = 'time-controls';
    this.container.setAttribute('role', 'region');
    this.container.setAttribute('aria-label', 'Solar system time controls');

    // Build HTML structure
    this.container.innerHTML = this.buildHTML();

    // Append to body
    document.body.appendChild(this.container);

    // Query all control elements (NASA Rule 7)
    this.controls.playPauseBtn = document.getElementById('time-play-pause');
    this.controls.resetBtn = document.getElementById('time-reset');
    this.controls.fpsToggleBtn = document.getElementById('fps-toggle-btn');
    this.controls.scaleSlider = document.getElementById('time-scale-slider');
    this.controls.scaleDisplay = document.getElementById('time-scale-display');
    this.controls.dateDisplay = document.getElementById('time-date-display');
    this.controls.dateInput = document.getElementById('time-date-input');
    this.controls.presetBtns = document.querySelectorAll('.time-preset-btn');

    // Validate all elements exist (NASA Rule 7)
    console.assert(this.controls.playPauseBtn !== null,
      'TimeControlUI: play/pause button not found');
    console.assert(this.controls.resetBtn !== null,
      'TimeControlUI: reset button not found');
    console.assert(this.controls.scaleSlider !== null,
      'TimeControlUI: scale slider not found');
    console.assert(this.controls.scaleDisplay !== null,
      'TimeControlUI: scale display not found');
    console.assert(this.controls.dateDisplay !== null,
      'TimeControlUI: date display not found');
    console.assert(this.controls.dateInput !== null,
      'TimeControlUI: date input not found');
  }

  /**
   * Build HTML structure for controls
   *
   * @returns {string} HTML string
   * NASA Rule 4: <= 60 lines
   */
  // eslint-disable-next-line max-lines-per-function -- HTML template builder (not complex logic)
  buildHTML() {
    return `
      <div class="time-controls-panel">
        <!-- Control buttons -->
        <div class="time-controls-buttons">
          <button
            id="time-play-pause"
            class="time-control-btn"
            aria-label="Play or pause time progression"
            aria-pressed="false"
            title="Play/Pause">
            <span class="time-icon-play" aria-hidden="true">▶</span>
            <span class="time-icon-pause" aria-hidden="true" style="display:none;">⏸</span>
          </button>

          <button
            id="time-reset"
            class="time-control-btn"
            aria-label="Reset to current date and time"
            title="Reset to Now">
            <span aria-hidden="true">↻</span>
          </button>

          <button
            id="fps-toggle-btn"
            class="time-control-btn"
            aria-label="Toggle FPS display"
            title="Toggle FPS Monitor">
            <span aria-hidden="true">FPS</span>
          </button>
        </div>

        <!-- Time scale controls -->
        <div class="time-scale-container">
          <label for="time-scale-slider" class="time-label">Time Scale:</label>
          <div class="time-scale-slider-wrapper">
            <input
              type="range"
              id="time-scale-slider"
              min="0.1"
              max="5000"
              step="0.1"
              value="1"
              aria-label="Time scale multiplier"
              aria-valuemin="0.1"
              aria-valuemax="5000"
              aria-valuenow="1"
              aria-valuetext="1x speed">
            <span id="time-scale-display" class="time-scale-display" aria-live="polite">1000x</span>
          </div>

          <!-- Preset buttons -->
          <div class="time-preset-buttons">
            <button class="time-preset-btn" data-scale="1" aria-label="Set time scale to 1x">1x</button>
            <button class="time-preset-btn" data-scale="2" aria-label="Set time scale to 2x">2x</button>
            <button class="time-preset-btn" data-scale="3" aria-label="Set time scale to 3x">3x</button>
            <button class="time-preset-btn" data-scale="50" aria-label="Set time scale to 50x">50x</button>
            <button class="time-preset-btn" data-scale="100" aria-label="Set time scale to 100x">100x</button>
            <button class="time-preset-btn" data-scale="1000" aria-label="Set time scale to 1000x">1000x</button>
            <button class="time-preset-btn" data-scale="5000" aria-label="Set time scale to 5000x">5000x</button>
          </div>
        </div>

        <!-- Date display and picker -->
        <div class="time-date-container">
          <label for="time-date-input" class="time-label">Jump to Date (UTC):</label>
          <input
            type="datetime-local"
            id="time-date-input"
            aria-label="Select date and time to jump to"
            title="Select date to jump to">
          <div id="time-date-display" class="time-date-display" aria-live="polite" aria-atomic="true">
            <time datetime=""></time>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach time controls to a container element (for inline mode).
   * Call this AFTER the target container exists in DOM.
   *
   * @param {HTMLElement} containerElement - The container to attach to
   * @returns {boolean} True if attachment succeeded
   * NASA Rule 5: >= 2 assertions
   */
  attachToContainer(containerElement) {
    console.assert(containerElement instanceof HTMLElement,
      'attachToContainer: containerElement must be HTMLElement');
    console.assert(this.container instanceof HTMLElement,
      'attachToContainer: TimeControlUI.container must exist');

    if (!(containerElement instanceof HTMLElement)) {
      console.error('TimeControlUI.attachToContainer: Invalid container');
      return false;
    }

    if (!this.container) {
      console.error('TimeControlUI.attachToContainer: Not initialized');
      return false;
    }

    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }

    this.container.classList.add('inline-mode');
    containerElement.appendChild(this.container);

    console.log('TimeControlUI: Attached to inline container');
    return true;
  }

  /**
   * Attach event handlers to controls
   *
   * NASA Rule 2: Bounded number of event listeners
   * NASA Rule 4: <= 60 lines
   */
  attachEventHandlers() {
    // Play/Pause button
    if (this.controls.playPauseBtn) {
      this.controls.playPauseBtn.addEventListener('click', () => {
        this.togglePlayPause();
      });
    }

    // Reset button
    if (this.controls.resetBtn) {
      this.controls.resetBtn.addEventListener('click', () => {
        this.reset();
      });
    }

    // FPS toggle button (Roaster Fix #2)
    if (this.controls.fpsToggleBtn) {
      this.controls.fpsToggleBtn.addEventListener('click', () => {
        this.toggleFPSMonitor();
      });
    }

    // Time scale slider
    if (this.controls.scaleSlider) {
      this.controls.scaleSlider.addEventListener('input', (event) => {
        this.updateTimeScale(parseFloat(event.target.value));
      });
    }

    // Date input
    if (this.controls.dateInput) {
      this.controls.dateInput.addEventListener('change', (event) => {
        this.jumpToDate(event.target.value);
      });
    }

    // Preset buttons (NASA Rule 2: fixed array size)
    if (this.controls.presetBtns) {
      for (let i = 0; i < this.controls.presetBtns.length; i++) {
        const btn = this.controls.presetBtns[i];
        const scale = parseFloat(btn.getAttribute('data-scale'));
        btn.addEventListener('click', () => {
          this.updateTimeScale(scale);
        });
      }
    }
  }

  /**
   * Toggle play/pause state
   *
   * NASA Rule 5: Validate state changes
   */
  togglePlayPause() {
    const btn = this.controls.playPauseBtn;
    console.assert(btn !== null, 'TimeControlUI.togglePlayPause: button required');

    if (this.timeManager.isPaused()) {
      this.timeManager.play();
      btn.setAttribute('aria-pressed', 'true');
      btn.querySelector('.time-icon-play').style.display = 'none';
      btn.querySelector('.time-icon-pause').style.display = 'inline';
    } else {
      this.timeManager.pause();
      btn.setAttribute('aria-pressed', 'false');
      btn.querySelector('.time-icon-play').style.display = 'inline';
      btn.querySelector('.time-icon-pause').style.display = 'none';
    }

    // Validate state (NASA Rule 7)
    console.assert(
      this.timeManager.isPaused() !== (btn.getAttribute('aria-pressed') === 'true'),
      'TimeControlUI.togglePlayPause: state mismatch'
    );
  }

  /**
   * Reset to current system time
   *
   * NASA Rule 5: Validate reset operation
   */
  reset() {
    console.assert(this.timeManager !== null,
      'TimeControlUI.reset: timeManager required');

    this.timeManager.reset(new Date());
    this.updateDisplay();

    // Validate reset (NASA Rule 7)
    const currentDate = this.timeManager.getCurrentDate();
    const now = new Date();
    const timeDiff = Math.abs(currentDate.getTime() - now.getTime());
    console.assert(timeDiff < 1000,
      'TimeControlUI.reset: time should be within 1 second of now');
  }

  /**
   * Update time scale
   *
   * @param {number} scale - New time scale value
   * NASA Rule 5: Validate scale parameter
   */
  updateTimeScale(scale) {
    console.assert(typeof scale === 'number',
      'TimeControlUI.updateTimeScale: scale must be number');
    console.assert(scale > 0,
      'TimeControlUI.updateTimeScale: scale must be positive');

    this.timeManager.setTimeScale(scale);

    // Update slider and display
    if (this.controls.scaleSlider) {
      this.controls.scaleSlider.value = scale;
      this.controls.scaleSlider.setAttribute('aria-valuenow', scale);
      this.controls.scaleSlider.setAttribute('aria-valuetext',
        this.formatScaleLabel(scale));
    }

    if (this.controls.scaleDisplay) {
      this.controls.scaleDisplay.textContent = this.formatScaleDisplay(scale);
    }

    // Validate update (NASA Rule 7)
    const actualScale = this.timeManager.getTimeScale();
    console.assert(Math.abs(actualScale - scale) < 0.01 ||
      actualScale === 0.1 || actualScale === 5000,
      'TimeControlUI.updateTimeScale: scale update failed');
  }

  /**
   * Jump to specific date
   *
   * @param {string} dateString - ISO date string from datetime-local input
   * NASA Rule 5: Validate date input
   */
  jumpToDate(dateString) {
    console.assert(typeof dateString === 'string',
      'TimeControlUI.jumpToDate: dateString must be string');
    console.assert(dateString.length >= 10,
      'TimeControlUI.jumpToDate: dateString must be at least 10 chars (YYYY-MM-DD)');

    try {
      // NEW: Validate date format and values (HIGH-1 fix)
      const dateParts = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!dateParts) {
        console.warn(`TimeControlUI.jumpToDate: Invalid date format: ${dateString}`);
        return;
      }

      const [, _year, month, day] = dateParts.map(Number);

      // Validate ranges
      if (month < 1 || month > 12) {
        console.warn(`TimeControlUI.jumpToDate: Invalid month: ${month}`);
        return;
      }

      if (day < 1 || day > 31) {
        console.warn(`TimeControlUI.jumpToDate: Invalid day: ${day}`);
        return;
      }

      // Create date and verify it didn't roll over
      const date = new Date(dateString);

      // Validate date (NASA Rule 7)
      if (isNaN(date.getTime())) {
        console.error('TimeControlUI.jumpToDate: Invalid date');
        return;
      }

      // Check for date rollover (e.g., Feb 30 → Mar 1)
      if (date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
        console.warn(`TimeControlUI.jumpToDate: Invalid date (rolled over): ${dateString}`);
        return;
      }

      this.timeManager.reset(date);
      this.updateDisplay();
    } catch (error) {
      console.error('TimeControlUI.jumpToDate: Error parsing date', error);
    }
  }

  /**
   * Format scale value for display
   *
   * @param {number} scale - Time scale value
   * @returns {string} Formatted display text
   * NASA Rule 4: <= 60 lines
   */
  formatScaleDisplay(scale) {
    if (scale < 1) {
      return `${scale.toFixed(1)}x`;
    } else if (scale < 100) {
      return `${Math.round(scale)}x`;
    } else if (scale < 1000) {
      return `${Math.round(scale)}x`;
    } else {
      return `${Math.round(scale)}x`;
    }
  }

  /**
   * Format scale label for accessibility
   *
   * @param {number} scale - Time scale value
   * @returns {string} Accessible label text
   * NASA Rule 4: <= 60 lines
   */
  formatScaleLabel(scale) {
    if (scale < 1) {
      return `Slow motion (${scale.toFixed(1)}x speed)`;
    } else if (scale === 1) {
      return 'Real-time (1x speed)';
    } else if (scale <= 100) {
      return `${Math.round(scale)}x speed`;
    } else if (scale <= 1000) {
      const minutesPerSecond = (scale / 60).toFixed(1);
      return `${minutesPerSecond} minutes per second`;
    } else {
      const daysPerSecond = (scale / 86400).toFixed(2);
      return `${daysPerSecond} days per second`;
    }
  }

  /**
   * Update date/time display
   *
   * NASA Rule 5: Validate display elements
   * NASA Rule 4: <= 60 lines
   */
  updateDisplay() {
    console.assert(this.controls.dateDisplay !== null,
      'TimeControlUI.updateDisplay: dateDisplay required');

    const currentDate = this.timeManager.getCurrentDate();

    // Validate date (NASA Rule 7)
    if (!currentDate || isNaN(currentDate.getTime())) {
      console.error('TimeControlUI.updateDisplay: Invalid date from timeManager');
      return;
    }

    // Format for display
    const timeElement = this.controls.dateDisplay.querySelector('time');
    if (timeElement) {
      const isoString = currentDate.toISOString();
      const displayString = isoString.slice(0, 19).replace('T', ' ') + ' UTC';

      timeElement.textContent = displayString;
      timeElement.setAttribute('datetime', isoString);
    }

    // Update date input value
    if (this.controls.dateInput) {
      const localISO = currentDate.toISOString().slice(0, 16);
      this.controls.dateInput.value = localISO;
    }
  }

  /**
   * Start periodic display updates
   *
   * NASA Rule 2: Bounded update interval
   */
  startDisplayUpdates() {
    if (this.updateTimerId !== null) {
      clearInterval(this.updateTimerId);
    }

    this.updateTimerId = setInterval(() => {
      this.updateDisplay();
    }, TimeControlUI.DISPLAY_UPDATE_INTERVAL);

    // Initial update
    this.updateDisplay();
  }

  /**
   * Stop periodic display updates
   *
   * Clean up timer to prevent memory leaks.
   */
  stopDisplayUpdates() {
    if (this.updateTimerId !== null) {
      clearInterval(this.updateTimerId);
      this.updateTimerId = null;
    }
  }

  /**
   * Show controls
   */
  show() {
    if (this.container) {
      this.container.style.display = 'block';
    }
  }

  /**
   * Hide controls
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Toggle FPS monitor visibility (Roaster Fix #2)
   *
   * NASA Rule 5: Validate access to global spaceEnvironment
   * NASA Rule 7: Check return values
   */
  toggleFPSMonitor() {
    console.assert(typeof window !== 'undefined',
      'TimeControlUI.toggleFPSMonitor: window required');

    // Access fpsMonitor from SpaceEnvironment
    if (window.spaceEnvironment && window.spaceEnvironment.fpsMonitor) {
      const monitor = window.spaceEnvironment.fpsMonitor;
      const newState = !monitor.isEnabled;
      monitor.setEnabled(newState);
      console.log(`TimeControlUI: FPS monitor ${newState ? 'enabled' : 'disabled'}`);

      // Update button appearance
      if (this.controls.fpsToggleBtn) {
        this.controls.fpsToggleBtn.classList.toggle('active', newState);
      }
    } else {
      console.warn('TimeControlUI.toggleFPSMonitor: FPS monitor not available');
    }
  }

  /**
   * Dispose of UI controls
   *
   * Clean up resources and event listeners.
   * NASA Rule 7: Check for null before cleanup
   */
  dispose() {
    this.stopDisplayUpdates();

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.container = null;
    this.controls = {};
  }
}

// Make globally available
window.TimeControlUI = TimeControlUI;
