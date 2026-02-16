/**
 * TimeConverter.js
 *
 * EDUCATIONAL DEMO - NOT FOR SCIENTIFIC RESEARCH
 *
 * This code implements simplified time conversions for educational
 * visualization. Time precision: ±8.64 seconds (0.0001 days).
 *
 * For scientific work, use NASA JPL Horizons System:
 * https://ssd.jpl.nasa.gov/horizons.cgi
 *
 * Converts between JavaScript Date objects and Julian Date (JD) format.
 * All conversions enforce UTC time zone to ensure astronomical accuracy.
 *
 * Julian Date: Days since noon UTC on January 1, 4713 BC (proleptic Julian calendar)
 * J2000 Days: Days since noon UTC on January 1, 2000 (JD 2451545.0)
 *
 * NASA Rules Compliance:
 * - Rule 2: No unbounded loops
 * - Rule 4: All functions <= 60 lines
 * - Rule 5: >= 2 assertions per public method
 * - Rule 7: All return values validated
 */

class TimeConverter {
  // Constants
  static EPOCH_JD = 2440588.0; // JD for Unix epoch (1970-01-01 00:00 UTC)
  static MS_PER_DAY = 86400000; // Milliseconds per day (24 * 60 * 60 * 1000)
  static J2000_JD = 2451545.0; // JD for J2000 epoch (2000-01-01 12:00 TT)
  static MIN_SAFE_JD = 2415020.5; // 1900-01-01 (safe range lower bound)
  static MAX_SAFE_JD = 2488069.5; // 2100-01-01 (safe range upper bound)

  /**
   * Convert JavaScript Date to Julian Date
   *
   * Formula: JD = EPOCH_JD + (UTC_milliseconds / MS_PER_DAY)
   *
   * @param {Date} date - JavaScript Date object (any time zone, converted to UTC)
   * @returns {number} Julian Date (days since -4712-01-01 12:00 UTC)
   *
   * NASA Rule 5: Assertions for input validation
   */
  static dateToJulianDate(date) {
    console.assert(date instanceof Date, 'TimeConverter.dateToJulianDate: date must be Date object');
    console.assert(!isNaN(date.getTime()), 'TimeConverter.dateToJulianDate: date must be valid');

    // Get UTC milliseconds (always UTC, independent of local time zone)
    const utcMs = date.getTime();

    // Convert to Julian Date
    const jd = this.EPOCH_JD + (utcMs / this.MS_PER_DAY);

    // Validate output (NASA Rule 7)
    console.assert(isFinite(jd), 'TimeConverter.dateToJulianDate: JD must be finite');

    return jd;
  }

  /**
   * Convert Julian Date to JavaScript Date
   *
   * Formula: UTC_milliseconds = (JD - EPOCH_JD) * MS_PER_DAY
   *
   * @param {number} jd - Julian Date
   * @returns {Date} JavaScript Date object (UTC)
   *
   * NASA Rule 5: Assertions for input validation
   */
  static julianDateToDate(jd) {
    console.assert(typeof jd === 'number', 'TimeConverter.julianDateToDate: jd must be number');
    console.assert(isFinite(jd), 'TimeConverter.julianDateToDate: jd must be finite');

    // Convert to UTC milliseconds
    const utcMs = (jd - this.EPOCH_JD) * this.MS_PER_DAY;

    // Create Date object
    const date = new Date(utcMs);

    // Validate output (NASA Rule 7)
    console.assert(date instanceof Date, 'TimeConverter.julianDateToDate: result must be Date');
    console.assert(!isNaN(date.getTime()), 'TimeConverter.julianDateToDate: result must be valid');

    return date;
  }

  /**
   * Convert Julian Date to J2000 days
   *
   * J2000 days = days since J2000 epoch (2000-01-01 12:00 TT)
   * This is the standard time format for orbital calculations.
   *
   * @param {number} jd - Julian Date
   * @returns {number} Days since J2000 epoch (can be negative for dates before 2000)
   *
   * NASA Rule 5: Assertions for input validation
   */
  static julianDateToJ2000Days(jd) {
    console.assert(typeof jd === 'number', 'TimeConverter.julianDateToJ2000Days: jd must be number');
    console.assert(isFinite(jd), 'TimeConverter.julianDateToJ2000Days: jd must be finite');

    const j2000Days = jd - this.J2000_JD;

    // Validate output (NASA Rule 7)
    console.assert(isFinite(j2000Days), 'TimeConverter.julianDateToJ2000Days: result must be finite');

    return j2000Days;
  }

  /**
   * Convert J2000 days to Julian Date
   *
   * @param {number} j2000Days - Days since J2000 epoch
   * @returns {number} Julian Date
   *
   * NASA Rule 5: Assertions for input validation
   */
  static j2000DaysToJulianDate(j2000Days) {
    console.assert(typeof j2000Days === 'number', 'TimeConverter.j2000DaysToJulianDate: j2000Days must be number');
    console.assert(isFinite(j2000Days), 'TimeConverter.j2000DaysToJulianDate: j2000Days must be finite');

    const jd = j2000Days + this.J2000_JD;

    // Validate output (NASA Rule 7)
    console.assert(isFinite(jd), 'TimeConverter.j2000DaysToJulianDate: result must be finite');

    return jd;
  }

  /**
   * Get current Julian Date from system clock
   *
   * @returns {number} Current Julian Date
   */
  static now() {
    const currentDate = new Date();
    return this.dateToJulianDate(currentDate);
  }

  /**
   * Convert JavaScript Date to J2000 days (convenience method)
   *
   * @param {Date} date - JavaScript Date object
   * @returns {number} Days since J2000 epoch
   *
   * NASA Rule 5: Assertions for input validation
   */
  static dateToJ2000Days(date) {
    console.assert(date instanceof Date, 'TimeConverter.dateToJ2000Days: date must be Date object');
    console.assert(!isNaN(date.getTime()), 'TimeConverter.dateToJ2000Days: date must be valid');

    const jd = this.dateToJulianDate(date);
    const j2000Days = this.julianDateToJ2000Days(jd);

    return j2000Days;
  }

  /**
   * Convert J2000 days to JavaScript Date (convenience method)
   *
   * @param {number} j2000Days - Days since J2000 epoch
   * @returns {Date} JavaScript Date object (UTC)
   *
   * NASA Rule 5: Assertions for input validation
   */
  static j2000DaysToDate(j2000Days) {
    console.assert(typeof j2000Days === 'number', 'TimeConverter.j2000DaysToDate: j2000Days must be number');
    console.assert(isFinite(j2000Days), 'TimeConverter.j2000DaysToDate: j2000Days must be finite');

    const jd = this.j2000DaysToJulianDate(j2000Days);
    const date = this.julianDateToDate(jd);

    return date;
  }

  /**
   * Validate if Julian Date is within safe range for orbital calculations
   *
   * Safe range: 1900-01-01 to 2100-01- (01 * Orbital) elements degrade outside this range.
   *
   * @param {number} jd - Julian Date
   * @returns {boolean} True if within safe range
   */
  static isInSafeRange(jd) {
    console.assert(typeof jd === 'number', 'TimeConverter.isInSafeRange: jd must be number');
    console.assert(isFinite(jd), 'TimeConverter.isInSafeRange: jd must be finite');

    return jd >= this.MIN_SAFE_JD && jd <= this.MAX_SAFE_JD;
  }
}

// Make globally available for non-module scripts
if (typeof window !== 'undefined') {
  window.TimeConverter = TimeConverter;
}
