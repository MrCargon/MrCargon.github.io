/**
 * OrbitalCalculator.js
 *
 * EDUCATIONAL DEMO - NOT FOR SCIENTIFIC RESEARCH
 *
 * This code implements simplified Newtonian orbital mechanics for
 * educational visualization. Position accuracy: ±2,600 km for Earth orbit.
 *
 * For scientific work, use NASA JPL Horizons System:
 * https://ssd.jpl.nasa.gov/horizons.cgi
 *
 * Calculates orbital positions and rotations using simplified Keplerian mechanics.
 * Uses mean anomaly approximation for real-time performance.
 *
 * Key formulas:
 * - Mean Anomaly: M = (j2000Days / orbitalPeriod) * 2π + epochAnomaly
 * - Rotation Angle: θ = (j2000Days / rotationPeriod) * 2π
 * - Kepler's 3rd Law: T² = a³ (period in years, semi-major axis in AU)
 *
 * NASA Rules Compliance:
 * - Rule 1: No recursion (iterative calculations only)
 * - Rule 2: All loops have fixed bounds
 * - Rule 4: All functions <= 60 lines
 * - Rule 5: >= 2 assertions per public method
 * - Rule 7: All return values validated
 */

class OrbitalCalculator {
  // Mathematical constants
  static TWO_PI = 2 * Math.PI;
  static DEG_TO_RAD = Math.PI / 180;
  static RAD_TO_DEG = 180 / Math.PI;

  // Physical constants
  static EARTH_ORBITAL_PERIOD_DAYS = 365.25; // Earth's sidereal year
  static EARTH_ROTATION_PERIOD_HOURS = 24.0; // Earth's sidereal day
  static DAYS_PER_YEAR = 365.25; // Julian year

  /**
   * Calculate mean anomaly from time and orbital period
   *
   * Mean anomaly increases linearly with time (simplified Kepler).
   * M = (t / T) * 2π + M₀
   * where t = time since epoch, T = orbital period, M₀ = epoch anomaly
   *
   * @param {number} j2000Days - Days since J2000 epoch
   * @param {number} orbitalPeriodDays - Orbital period in days
   * @param {number} epochAnomaly - Mean anomaly at J2000 (radians, default 0)
   * @returns {number} Mean anomaly in radians, normalized to [0, 2π)
   *
   * NASA Rule 5: Assertions for input validation
   */
  static calculateMeanAnomaly(j2000Days, orbitalPeriodDays, epochAnomaly = 0) {
    console.assert(typeof j2000Days === 'number', 'OrbitalCalculator.calculateMeanAnomaly: j2000Days must be number');
    console.assert(typeof orbitalPeriodDays === 'number', 'OrbitalCalculator.calculateMeanAnomaly: orbitalPeriodDays must be number');
    console.assert(orbitalPeriodDays > 0, 'OrbitalCalculator.calculateMeanAnomaly: orbitalPeriodDays must be positive');
    console.assert(isFinite(j2000Days), 'OrbitalCalculator.calculateMeanAnomaly: j2000Days must be finite');

    // Calculate cycles completed since epoch
    const cycles = j2000Days / orbitalPeriodDays;

    // Mean anomaly = cycles * 2π + epoch offset
    const meanAnomaly = (cycles * this.TWO_PI) + epochAnomaly;

    // Normalize to [0, 2π) - NASA Rule 2: no unbounded loop
    const normalized = this.normalizeAngle(meanAnomaly);

    // Validate output (NASA Rule 7)
    console.assert(isFinite(normalized), 'OrbitalCalculator.calculateMeanAnomaly: result must be finite');
    console.assert(normalized >= 0 && normalized < this.TWO_PI, 'OrbitalCalculator.calculateMeanAnomaly: result must be in [0, 2π)');

    return normalized;
  }

  /**
   * Calculate rotation angle from time and rotation period
   *
   * For planetary rotation (day/night cycle):
   * θ = (t / T_rot) * 2π
   * where t = time elapsed, T_rot = rotation period
   *
   * @param {number} j2000Days - Days since J2000 epoch
   * @param {number} rotationPeriodHours - Rotation period in hours
   * @returns {number} Rotation angle in radians, normalized to [0, 2π)
   *
   * NASA Rule 5: Assertions for input validation
   */
  static calculateRotationAngle(j2000Days, rotationPeriodHours) {
    console.assert(typeof j2000Days === 'number', 'OrbitalCalculator.calculateRotationAngle: j2000Days must be number');
    console.assert(typeof rotationPeriodHours === 'number', 'OrbitalCalculator.calculateRotationAngle: rotationPeriodHours must be number');
    console.assert(rotationPeriodHours > 0, 'OrbitalCalculator.calculateRotationAngle: rotationPeriodHours must be positive');
    console.assert(isFinite(j2000Days), 'OrbitalCalculator.calculateRotationAngle: j2000Days must be finite');

    // Convert rotation period to days
    const rotationPeriodDays = rotationPeriodHours / 24.0;

    // Calculate rotations completed since epoch
    const rotations = j2000Days / rotationPeriodDays;

    // Rotation angle = rotations * 2π
    const angle = rotations * this.TWO_PI;

    // Normalize to [0, 2π) - NASA Rule 2: no unbounded loop
    const normalized = this.normalizeAngle(angle);

    // Validate output (NASA Rule 7)
    console.assert(isFinite(normalized), 'OrbitalCalculator.calculateRotationAngle: result must be finite');
    console.assert(normalized >= 0 && normalized < this.TWO_PI, 'OrbitalCalculator.calculateRotationAngle: result must be in [0, 2π)');

    return normalized;
  }

  /**
   * Calculate orbital period from semi-major axis using Kepler's 3rd Law
   *
   * Kepler's 3rd Law: T² = a³
   * where T = period in years, a = semi-major axis in AU (for Sun-centered orbits)
   *
   * @param {number} semiMajorAxisAU - Semi-major axis in Astronomical Units
   * @returns {number} Orbital period in days
   *
   * NASA Rule 5: Assertions for input validation
   */
  static calculateOrbitalPeriod(semiMajorAxisAU) {
    console.assert(typeof semiMajorAxisAU === 'number', 'OrbitalCalculator.calculateOrbitalPeriod: semiMajorAxisAU must be number');
    console.assert(semiMajorAxisAU > 0, 'OrbitalCalculator.calculateOrbitalPeriod: semiMajorAxisAU must be positive');

    // T = a^(3/2) (in years)
    const periodYears = Math.pow(semiMajorAxisAU, 1.5);

    // Convert to days
    const periodDays = periodYears * this.DAYS_PER_YEAR;

    // Validate output (NASA Rule 7)
    console.assert(isFinite(periodDays), 'OrbitalCalculator.calculateOrbitalPeriod: result must be finite');
    console.assert(periodDays > 0, 'OrbitalCalculator.calculateOrbitalPeriod: result must be positive');

    return periodDays;
  }

  /**
   * Normalize angle to [0, 2π) radians
   *
   * Uses modulo operation (not unbounded while loop).
   * Handles both positive and negative angles.
   *
   * NASA Rule 2: Fixed-bound operation (no loops)
   *
   * @param {number} angleRadians - Angle in radians (any value)
   * @returns {number} Normalized angle in [0, 2π) radians
   */
  static normalizeAngle(angleRadians) {
    console.assert(typeof angleRadians === 'number', 'OrbitalCalculator.normalizeAngle: angleRadians must be number');
    console.assert(isFinite(angleRadians), 'OrbitalCalculator.normalizeAngle: angleRadians must be finite');

    // Modulo operation to wrap angle
    // For negative angles: ((x % m) + m) % m ensures positive result
    const normalized = ((angleRadians % this.TWO_PI) + this.TWO_PI) % this.TWO_PI;

    // Validate output (NASA Rule 7)
    console.assert(normalized >= 0 && normalized < this.TWO_PI, 'OrbitalCalculator.normalizeAngle: result must be in [0, 2π)');

    return normalized;
  }

  /**
   * Convert degrees to radians
   *
   * @param {number} degrees - Angle in degrees
   * @returns {number} Angle in radians
   */
  static degreesToRadians(degrees) {
    console.assert(typeof degrees === 'number', 'OrbitalCalculator.degreesToRadians: degrees must be number');
    console.assert(isFinite(degrees), 'OrbitalCalculator.degreesToRadians: degrees must be finite');

    return degrees * this.DEG_TO_RAD;
  }

  /**
   * Convert radians to degrees
   *
   * @param {number} radians - Angle in radians
   * @returns {number} Angle in degrees
   */
  static radiansToDegrees(radians) {
    console.assert(typeof radians === 'number', 'OrbitalCalculator.radiansToDegrees: radians must be number');
    console.assert(isFinite(radians), 'OrbitalCalculator.radiansToDegrees: radians must be finite');

    return radians * this.RAD_TO_DEG;
  }

  /**
   * Validate orbital parameters
   *
   * Checks if orbital parameters are physically valid:
   * - Semi-major axis > 0
   * - Eccentricity in [0, 1) (parabolic/hyperbolic orbits excluded)
   * - Periods > 0
   *
   * @param {Object} params - Orbital parameters to validate
   * @param {number} params.semiMajorAxisAU - Semi-major axis (AU)
   * @param {number} params.eccentricity - Eccentricity (dimensionless)
   * @param {number} params.orbitalPeriodDays - Orbital period (days)
   * @returns {boolean} True if all parameters valid
   */
  static validateOrbitalParameters(params) {
    console.assert(typeof params === 'object', 'OrbitalCalculator.validateOrbitalParameters: params must be object');
    console.assert(params !== null, 'OrbitalCalculator.validateOrbitalParameters: params must not be null');

    const validSemiMajorAxis = params.semiMajorAxisAU > 0;
    const validEccentricity = params.eccentricity >= 0 && params.eccentricity < 1;
    const validPeriod = params.orbitalPeriodDays > 0;

    return validSemiMajorAxis && validEccentricity && validPeriod;
  }

  /**
   * Calculate eccentric anomaly from mean anomaly (1st-order approximation)
   *
   * Eccentric anomaly E relates to mean anomaly M via Kepler's equation:
   * M = E - (e * sin(E))
   *
   * For small eccentricity (e < 0.1), first-order approximation:
   * E ≈ M + (e * sin(M))
   *
   * NASA Rule 1: No recursion (no iterative Kepler solver)
   * NASA Rule 2: Fixed calculation (no unbounded loops)
   *
   * @param {number} meanAnomalyRadians - Mean anomaly (radians)
   * @param {number} eccentricity - Orbital eccentricity (dimensionless)
   * @returns {number} Eccentric anomaly (radians)
   */
  static calculateEccentricAnomaly(meanAnomalyRadians, eccentricity) {
    console.assert(typeof meanAnomalyRadians === 'number', 'OrbitalCalculator.calculateEccentricAnomaly: meanAnomalyRadians must be number');
    console.assert(typeof eccentricity === 'number', 'OrbitalCalculator.calculateEccentricAnomaly: eccentricity must be number');
    console.assert(eccentricity >= 0 && eccentricity < 1, 'OrbitalCalculator.calculateEccentricAnomaly: eccentricity must be in [0, 1)');
    console.assert(isFinite(meanAnomalyRadians), 'OrbitalCalculator.calculateEccentricAnomaly: meanAnomalyRadians must be finite');

    // First-order approximation: E = M + (e * sin(M))
    const eccentricAnomaly = meanAnomalyRadians + (eccentricity * Math.sin(meanAnomalyRadians));

    // Validate output (NASA Rule 7)
    console.assert(isFinite(eccentricAnomaly), 'OrbitalCalculator.calculateEccentricAnomaly: result must be finite');

    return eccentricAnomaly;
  }

  // ---------------------------------------------------------------------------
  // Low-precision ephemeris: where the Sun, the Moon and Earth's spin really are.
  //
  // All of these take days since J2000.0 (2000-01-01 12:00 UT), the same number
  // TimeScaleManager.getJ2000Days() gives, so ONE clock drives the whole sky.
  // Formulas: Astronomical Almanac "low precision" series (also Meeus ch. 12, 25, 47).
  // Accuracy: Sun ~0.01 deg, GMST ~0.001 deg, Moon ~0.3 deg in longitude - far
  // below a pixel at any zoom the site draws. Checked against JPL Horizons in
  // tests/verify-astro.cjs and tests/e2e/earth-astro.spec.js.
  //
  // Scene frame (shared by every caller): ecliptic longitude 0 (the vernal equinox)
  // = world +x, ecliptic north = world +y, longitude 90 deg = world -z. So prograde
  // motion is counter-clockwise seen from +y, the same sense as Earth's spin
  // (rotation.y increasing = eastward, GlobeMath's lng 90E = local -z).
  // ---------------------------------------------------------------------------

  /** @param {number} deg @returns {number} angle in degrees wrapped to [0, 360) */
  static wrapDeg(deg) {
    console.assert(typeof deg === 'number', 'OrbitalCalculator.wrapDeg: number required');
    const w = deg % 360;
    return w < 0 ? w + 360 : w;
  }

  /**
   * Greenwich mean sidereal time: the angle from the vernal equinox to the
   * Greenwich meridian, measured eastward. Earth's rotation.y IS this angle.
   * @param {number} d - days since J2000.0 (UT)
   * @returns {number} degrees in [0, 360)
   */
  static gmstDeg(d) {
    console.assert(typeof d === 'number' && isFinite(d), 'OrbitalCalculator.gmstDeg: finite days required');
    const g = this.wrapDeg(280.46061837 + (360.98564736629 * d));
    console.assert(g >= 0 && g < 360, 'OrbitalCalculator.gmstDeg: result in range');
    return g;
  }

  /** @param {number} d - days since J2000.0 @returns {number} obliquity of the ecliptic, degrees */
  static obliquityDeg(d) {
    console.assert(typeof d === 'number' && isFinite(d), 'OrbitalCalculator.obliquityDeg: finite days required');
    return 23.439 - (0.0000004 * d);
  }

  /**
   * Apparent geocentric ecliptic longitude of the Sun (Earth's heliocentric
   * longitude is this + 180).
   * @param {number} d - days since J2000.0
   * @returns {number} degrees in [0, 360)
   */
  static sunEclipticLonDeg(d) {
    console.assert(typeof d === 'number' && isFinite(d), 'OrbitalCalculator.sunEclipticLonDeg: finite days required');
    const L = 280.460 + (0.9856474 * d);                       // mean longitude
    const g = (357.528 + (0.9856003 * d)) * this.DEG_TO_RAD;   // mean anomaly
    const lon = this.wrapDeg(L + (1.915 * Math.sin(g)) + (0.020 * Math.sin(2 * g)));
    console.assert(isFinite(lon), 'OrbitalCalculator.sunEclipticLonDeg: result finite');
    return lon;
  }

  /**
   * The point on Earth where the Sun is overhead.
   * @param {number} d - days since J2000.0
   * @returns {{lat:number, lng:number}} degrees, lng in [-180, 180)
   */
  static subsolarPoint(d) {
    console.assert(typeof d === 'number' && isFinite(d), 'OrbitalCalculator.subsolarPoint: finite days required');
    const lam = this.sunEclipticLonDeg(d) * this.DEG_TO_RAD;
    const eps = this.obliquityDeg(d) * this.DEG_TO_RAD;
    const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) * this.RAD_TO_DEG;
    const lng = this.wrapDeg(ra - this.gmstDeg(d) + 180) - 180;
    console.assert(lng >= -180 && lng < 180, 'OrbitalCalculator.subsolarPoint: lng in range');
    return { lat: dec * this.RAD_TO_DEG, lng: lng };
  }

  /**
   * Geocentric ecliptic longitude/latitude of the Moon (main periodic terms).
   * Mean motion 13.176 deg/day = one sidereal month of 27.32 days.
   * @param {number} d - days since J2000.0
   * @returns {{lon:number, lat:number}} degrees, lon in [0, 360)
   */
  static moonEcliptic(d) {
    console.assert(typeof d === 'number' && isFinite(d), 'OrbitalCalculator.moonEcliptic: finite days required');
    const T = d / 36525;
    const s = (a, b) => Math.sin((a + (b * T)) * this.DEG_TO_RAD);
    const lon = 218.32 + (481267.881 * T)
        + (6.29 * s(134.9, 477198.85)) - (1.27 * s(259.2, -413335.38))
        + (0.66 * s(235.7, 890534.23)) + (0.21 * s(269.9, 954397.70))
        - (0.19 * s(357.5, 35999.05)) - (0.11 * s(186.6, 966404.05));
    const lat = (5.13 * s(93.3, 483202.03)) + (0.28 * s(228.2, 960400.87))
        - (0.28 * s(318.3, 6003.18)) - (0.17 * s(217.6, -407332.20));
    console.assert(isFinite(lon) && isFinite(lat), 'OrbitalCalculator.moonEcliptic: result finite');
    return { lon: this.wrapDeg(lon), lat: lat };
  }
}

// Make globally available for non-module scripts
if (typeof window !== 'undefined') {
  window.OrbitalCalculator = OrbitalCalculator;
}
