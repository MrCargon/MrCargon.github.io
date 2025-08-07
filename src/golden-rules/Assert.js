/**
 * Assert.js - Side-effect free assertion system for Power of Ten compliance
 * Purpose: Provide defensive programming assertions without side effects
 * @module Assert
 * @version 1.0.0
 */

// Prevent entire script execution if already loaded
if (!window.Assert) {

// Prevent redeclaration if script is loaded multiple times
if (!window.AssertConfig) {
    /**
     * Global assertion configuration
     * Purpose: Control assertion behavior across the application
     */
    window.AssertConfig = {
        enabled: true, // Enable/disable assertions globally
        throwOnFailure: false, // Throw exception or return error
        logFailures: true, // Log assertion failures
        maxLogEntries: 100 // Maximum assertion log entries to keep
    };

    /**
     * Assertion failure log
     * Purpose: Track assertion failures for debugging
     */
    window.assertionLog = [];
}

// Use global references to prevent redeclaration
const AssertConfig = window.AssertConfig;
const assertionLog = window.assertionLog;

/**
 * Core assertion function - side-effect free
 * Purpose: Validate conditions without modifying state
 * @param {boolean} condition - Condition to assert
 * @param {string} message - Error message if assertion fails
 * @returns {boolean} - True if assertion passes, false otherwise
 */
function assert(condition, message = 'Assertion failed') {
    // Validate inputs (meta-assertion)
    if (typeof condition !== 'boolean') {
        return false;
    }
    if (typeof message !== 'string') {
        message = 'Assertion failed';
    }
    
    // Check condition
    const result = condition === true;
    
    // Log failure if enabled (read-only operation)
    if (!result && AssertConfig.logFailures) {
        logAssertion(message, new Error().stack);
    }
    
    // Return result (no exceptions for side-effect free operation)
    return result;
}

/**
 * Log assertion failure
 * Purpose: Record assertion failures for debugging
 * @param {string} message - Failure message
 * @param {string} stack - Stack trace
 * @returns {void}
 */
function logAssertion(message, stack) {
    // Bounds check on log size (Rule 2: Bounded operations)
    if (assertionLog.length >= AssertConfig.maxLogEntries) {
        assertionLog.shift(); // Remove oldest entry
    }
    
    // Add new entry
    const entry = {
        timestamp: Date.now(),
        message: message,
        stack: stack
    };
    
    assertionLog.push(entry);
    
    // Console output for development
    if (console && console.error) {
        console.error(`ASSERTION FAILED: ${message}`);
    }
}

/**
 * Assert not null
 * Purpose: Verify value is not null or undefined
 * @param {*} value - Value to check
 * @param {string} name - Variable name for error message
 * @returns {boolean} - True if not null
 */
function assertNotNull(value, name = 'value') {
    const condition = value !== null && value !== undefined;
    return assert(condition, `${name} must not be null or undefined`);
}

/**
 * Assert type
 * Purpose: Verify value is of expected type
 * @param {*} value - Value to check
 * @param {string} expectedType - Expected type name
 * @param {string} name - Variable name for error message
 * @returns {boolean} - True if correct type
 */
function assertType(value, expectedType, name = 'value') {
    const actualType = typeof value;
    const condition = actualType === expectedType;
    return assert(condition, `${name} must be of type ${expectedType}, got ${actualType}`);
}

/**
 * Assert range
 * Purpose: Verify number is within bounds
 * @param {number} value - Value to check
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @param {string} name - Variable name for error message
 * @returns {boolean} - True if in range
 */
function assertRange(value, min, max, name = 'value') {
    // Validate inputs
    if (typeof value !== 'number') return false;
    if (typeof min !== 'number') return false;
    if (typeof max !== 'number') return false;
    
    const condition = value >= min && value <= max;
    return assert(condition, `${name} must be between ${min} and ${max}, got ${value}`);
}

/**
 * Assert array bounds
 * Purpose: Verify array index is valid
 * @param {Array} array - Array to check
 * @param {number} index - Index to validate
 * @returns {boolean} - True if index is valid
 */
function assertArrayBounds(array, index) {
    // Validate inputs
    if (!Array.isArray(array)) return false;
    if (typeof index !== 'number') return false;
    if (!Number.isInteger(index)) return false;
    
    const condition = index >= 0 && index < array.length;
    return assert(condition, `Array index ${index} out of bounds [0, ${array.length - 1}]`);
}

/**
 * Assert function parameter count
 * Purpose: Verify correct number of parameters
 * @param {number} actual - Actual parameter count
 * @param {number} expected - Expected parameter count
 * @param {string} functionName - Function name for error message
 * @returns {boolean} - True if count matches
 */
function assertParamCount(actual, expected, functionName = 'function') {
    const condition = actual === expected;
    return assert(condition, `${functionName} expects ${expected} parameters, got ${actual}`);
}

/**
 * Assert loop bound
 * Purpose: Verify loop will terminate (Rule 2)
 * @param {number} iterations - Current iteration count
 * @param {number} maxIterations - Maximum allowed iterations
 * @returns {boolean} - True if within bounds
 */
function assertLoopBound(iterations, maxIterations = 1000) {
    // Validate inputs
    if (typeof iterations !== 'number') return false;
    if (typeof maxIterations !== 'number') return false;
    
    const condition = iterations < maxIterations;
    return assert(condition, `Loop exceeded maximum iterations: ${iterations} >= ${maxIterations}`);
}

/**
 * Assert function precondition
 * Purpose: Verify function entry conditions
 * @param {boolean} condition - Precondition to check
 * @param {string} functionName - Function name
 * @param {string} description - Condition description
 * @returns {boolean} - True if precondition met
 */
function assertPrecondition(condition, functionName, description) {
    return assert(condition, `Precondition failed in ${functionName}: ${description}`);
}

/**
 * Assert function postcondition
 * Purpose: Verify function exit conditions
 * @param {boolean} condition - Postcondition to check
 * @param {string} functionName - Function name
 * @param {string} description - Condition description
 * @returns {boolean} - True if postcondition met
 */
function assertPostcondition(condition, functionName, description) {
    return assert(condition, `Postcondition failed in ${functionName}: ${description}`);
}

/**
 * Assert invariant
 * Purpose: Verify loop or class invariant
 * @param {boolean} condition - Invariant condition
 * @param {string} description - Invariant description
 * @returns {boolean} - True if invariant holds
 */
function assertInvariant(condition, description) {
    return assert(condition, `Invariant violated: ${description}`);
}

/**
 * Get assertion statistics
 * Purpose: Return assertion failure statistics
 * @returns {Object} - Statistics object
 */
function getAssertionStats() {
    // Calculate statistics (bounded operation)
    const stats = {
        totalFailures: 0,
        recentFailures: [],
        enabled: AssertConfig.enabled
    };
    
    // Count failures (bounded by maxLogEntries)
    const maxToProcess = Math.min(assertionLog.length, AssertConfig.maxLogEntries);
    let i = 0;
    while (i < maxToProcess) {
        stats.totalFailures++;
        if (i < 10) {
            stats.recentFailures.push({
                message: assertionLog[i].message,
                timestamp: assertionLog[i].timestamp
            });
        }
        i++;
    }
    
    return stats;
}

/**
 * Clear assertion log
 * Purpose: Reset assertion failure log
 * @returns {void}
 */
function clearAssertionLog() {
    // Clear with bounded operation
    while (assertionLog.length > 0 && assertionLog.length < 10000) {
        assertionLog.pop();
    }
}

/**
 * Enable/disable assertions
 * Purpose: Control assertion checking
 * @param {boolean} enabled - Enable flag
 * @returns {boolean} - Previous state
 */
function setAssertionsEnabled(enabled) {
    const previousState = AssertConfig.enabled;
    AssertConfig.enabled = enabled === true;
    return previousState;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        assert,
        assertNotNull,
        assertType,
        assertRange,
        assertArrayBounds,
        assertParamCount,
        assertLoopBound,
        assertPrecondition,
        assertPostcondition,
        assertInvariant,
        getAssertionStats,
        clearAssertionLog,
        setAssertionsEnabled
    };
} else {
    // Browser global (avoid redeclaration)
    window.Assert = {
        assert,
        assertNotNull,
        assertType,
        assertRange,
        assertArrayBounds,
        assertParamCount,
        assertLoopBound,
        assertPrecondition,
        assertPostcondition,
        assertInvariant,
        getAssertionStats,
        clearAssertionLog,
        setAssertionsEnabled
    };
}

} // End of window.Assert check
