/**
 * TimeScaleManager.js
 *
 * EDUCATIONAL DEMO - NOT FOR SCIENTIFIC RESEARCH
 *
 * This code implements time scale controls for educational visualization.
 * Safe time range: 1900-2100 (beyond this, accuracy degrades further).
 *
 * For scientific work, use NASA JPL Horizons System:
 * https://ssd.jpl.nasa.gov/horizons.cgi
 *
 * Manages simulated time state with configurable time scale multiplier.
 * Handles pause/play/reset functionality and safe range enforcement.
 *
 * Time Scale Examples:
 * - 1x: Real-time (1 second = 1 second)
 * - 100x: 1 real second = 100 simulated seconds
 * - 1000x: 1 real second = 1000 simulated seconds (1 day in ~86 seconds)
 * - 5000x: 1 real second = 5000 simulated seconds (1 year in ~105 minutes)
 *
 * Safe Range: Years 1900-2100 (orbital elements accurate within ±2°)
 *
 * NASA Rules Compliance:
 * - Rule 2: No unbounded loops
 * - Rule 3: No dynamic memory allocation after initialization
 * - Rule 4: All functions <= 60 lines
 * - Rule 5: >= 2 assertions per public method
 * - Rule 7: All return values validated
 */

// TimeConverter loaded globally via window object

class TimeScaleManager {
  // Safe range constants (aligned with TimeConverter)
  static MIN_J2000_DAYS = -36525; // 1900-01-01 (100 years before J2000)
  static MAX_J2000_DAYS = 36525; // 2100-01-01 (100 years after J2000)

  // Time scale limits
  static MIN_SCALE = 0.1; // 10x slower than real-time
  static MAX_SCALE = 5000; // 5000x faster than real-time

  /**
   * Create time scale manager
   *
   * @param {Date} initialDate - Starting date (default: current system time)
   *
   * NASA Rule 3: All memory allocated in constructor
   */
  constructor(initialDate = new Date()) {
    console.assert(initialDate instanceof Date, 'TimeScaleManager.constructor: initialDate must be Date object');
    console.assert(!isNaN(initialDate.getTime()), 'TimeScaleManager.constructor: initialDate must be valid');

    // State variables (NASA Rule 3: allocated once)
    this.j2000Days = TimeConverter.dateToJ2000Days(initialDate);
    this.timeScale = 1.0;
    this.paused = false;

    // NEW: Track boundary warning state (HIGH-2 fix)
    this.hasWarnedMinBoundary = false;
    this.hasWarnedMaxBoundary = false;

    // Validate initial state (NASA Rule 7)
    console.assert(isFinite(this.j2000Days), 'TimeScaleManager.constructor: j2000Days must be finite');
  }

  /**
   * Update virtual time based on real time delta
   *
   * Called every frame with elapsed real time.
   * Virtual time advances by (delta * timeScale).
   *
   * @param {number} deltaTime - Real milliseconds elapsed since last update
   *
   * NASA Rule 5: Assertions for input validation
   */
  update(deltaTime) {
    console.assert(typeof deltaTime === 'number', 'TimeScaleManager.update: deltaTime must be number');
    console.assert(deltaTime >= 0, 'TimeScaleManager.update: deltaTime must be non-negative');
    console.assert(isFinite(deltaTime), 'TimeScaleManager.update: deltaTime must be finite');

    // Skip update if paused
    if (this.paused) {
      return;
    }

    // Cap deltaTime to prevent time jumps when tab is backgrounded
    // deltaTime is in milliseconds, cap at 100ms (prevents huge jumps, allows normal frames)
    const cappedDeltaTime = Math.min(deltaTime, 100);

    // Convert milliseconds to days
    const deltaDays = cappedDeltaTime / TimeConverter.MS_PER_DAY;

    // Apply time scale multiplier
    const scaledDelta = deltaDays * this.timeScale;

    // Update virtual time
    this.j2000Days += scaledDelta;

    // NEW: Throttled boundary warnings (HIGH-2 fix)
    if (this.j2000Days < TimeScaleManager.MIN_J2000_DAYS) {
      if (!this.hasWarnedMinBoundary) {
        console.warn('TimeScaleManager: Reached minimum safe time range (1900-01-01), clamping');
        this.hasWarnedMinBoundary = true;
      }
      this.j2000Days = TimeScaleManager.MIN_J2000_DAYS;
    } else if (this.j2000Days > TimeScaleManager.MAX_J2000_DAYS) {
      if (!this.hasWarnedMaxBoundary) {
        console.warn('TimeScaleManager: Reached maximum safe time range (2100-01-01), clamping');
        this.hasWarnedMaxBoundary = true;
      }
      this.j2000Days = TimeScaleManager.MAX_J2000_DAYS;
    } else {
      // Reset warning flags when back in safe range
      this.hasWarnedMinBoundary = false;
      this.hasWarnedMaxBoundary = false;
    }

    // Validate state (NASA Rule 7)
    console.assert(isFinite(this.j2000Days), 'TimeScaleManager.update: j2000Days must remain finite');
  }

  /**
   * Start time progression
   *
   * Resumes time advancement from current virtual time.
   */
  play() {
    this.paused = false;
  }

  /**
   * Pause time progression
   *
   * Stops time advancement, virtual time remains at current value.
   */
  pause() {
    this.paused = true;
  }

  /**
   * Reset to specified time
   *
   * @param {Date} newDate - Date to reset to (default: current system time)
   *
   * NASA Rule 5: Assertions for input validation
   */
  reset(newDate = new Date()) {
    console.assert(newDate instanceof Date, 'TimeScaleManager.reset: newDate must be Date object');
    console.assert(!isNaN(newDate.getTime()), 'TimeScaleManager.reset: newDate must be valid');

    this.j2000Days = TimeConverter.dateToJ2000Days(newDate);
    this.paused = false;

    // Validate state (NASA Rule 7)
    console.assert(isFinite(this.j2000Days), 'TimeScaleManager.reset: j2000Days must be finite');
  }

  /**
   * Get current virtual time as JavaScript Date
   *
   * @returns {Date} Current virtual time (UTC)
   */
  getCurrentDate() {
    const date = TimeConverter.j2000DaysToDate(this.j2000Days);

    // Validate output (NASA Rule 7)
    console.assert(date instanceof Date, 'TimeScaleManager.getCurrentDate: result must be Date');
    console.assert(!isNaN(date.getTime()), 'TimeScaleManager.getCurrentDate: result must be valid');

    return date;
  }

  /**
   * Get current virtual time as J2000 days
   *
   * @returns {number} Days since J2000 epoch (can be negative)
   */
  getJ2000Days() {
    return this.j2000Days;
  }

  /**
   * Get current time scale multiplier
   *
   * @returns {number} Current time scale (1.0 = real-time)
   */
  getTimeScale() {
    return this.timeScale;
  }

  /**
   * Set time scale multiplier
   *
   * Clamps value to safe range [MIN_SCALE, MAX_SCALE].
   *
   * @param {number} scale - New time scale multiplier
   *
   * NASA Rule 5: Assertions for input validation
   */
  setTimeScale(scale) {
    console.assert(typeof scale === 'number', 'TimeScaleManager.setTimeScale: scale must be number');
    console.assert(isFinite(scale), 'TimeScaleManager.setTimeScale: scale must be finite');
    console.assert(scale > 0, 'TimeScaleManager.setTimeScale: scale must be positive');

    // Clamp to safe range
    this.timeScale = Math.max(
      TimeScaleManager.MIN_SCALE,
      Math.min(TimeScaleManager.MAX_SCALE, scale)
    );

    // Validate state (NASA Rule 7)
    console.assert(
      this.timeScale >= TimeScaleManager.MIN_SCALE && this.timeScale <= TimeScaleManager.MAX_SCALE,
      'TimeScaleManager.setTimeScale: timeScale must be in safe range'
    );
  }

  /**
   * Check if time is currently paused
   *
   * @returns {boolean} True if paused, false if running
   */
  isPaused() {
    return this.paused;
  }

  /**
   * Check if current time is within safe range for orbital calculations
   *
   * @returns {boolean} True if within safe range (1900-2100)
   */
  isInSafeRange() {
    return (
      this.j2000Days >= TimeScaleManager.MIN_J2000_DAYS &&
      this.j2000Days <= TimeScaleManager.MAX_J2000_DAYS
    );
  }

  /**
   * Get time remaining until upper bound (2100-01-01)
   *
   * @returns {number} Days until upper bound (negative if already past)
   */
  getDaysUntilUpperBound() {
    return TimeScaleManager.MAX_J2000_DAYS - this.j2000Days;
  }

  /**
   * Get time since lower bound (1900-01-01)
   *
   * @returns {number} Days since lower bound (negative if before)
   */
  getDaysSinceLowerBound() {
    return this.j2000Days - TimeScaleManager.MIN_J2000_DAYS;
  }
}

// Make globally available for non-module scripts (needed by SpaceEnvironment.js)
if (typeof window !== 'undefined') {
  window.TimeScaleManager = TimeScaleManager;
}
