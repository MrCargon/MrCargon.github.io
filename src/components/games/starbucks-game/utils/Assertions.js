/**
 * Assertions.js - Debug assertion helpers
 * NASA Rule 5 compliant assertion functions
 */

/**
 * Assert value is not null or undefined
 * @param {*} value - Value to check
 * @param {string} message - Error message if assertion fails
 * @throws {Error} If value is null or undefined
 */
export function assertNotNull(value, message) {
    if (value === null || value === undefined) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

/**
 * Assert value has expected type
 * @param {*} value - Value to check
 * @param {string} expectedType - Expected type name
 * @param {string} fieldName - Field name for error message
 * @throws {Error} If type doesn't match
 */
export function assertType(value, expectedType, fieldName) {
    const actualType = typeof value;
    if (actualType !== expectedType) {
        throw new Error(`Assertion failed: ${fieldName} must be ${expectedType}, got ${actualType}`);
    }
}

/**
 * Assert value is within range
 * @param {number} value - Value to check
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @param {string} fieldName - Field name for error message
 * @throws {Error} If value is out of range
 */
export function assertRange(value, min, max, fieldName) {
    if (typeof value !== 'number' || value < min || value > max) {
        throw new Error(`Assertion failed: ${fieldName} must be between ${min} and ${max}, got ${value}`);
    }
}

/**
 * Assert boolean condition is true
 * @param {boolean} condition - Condition to check
 * @param {string} message - Error message if assertion fails
 * @throws {Error} If condition is false
 */
export function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}
