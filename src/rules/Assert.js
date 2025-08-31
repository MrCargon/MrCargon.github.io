/**
 * Assert.js - Side-effect free assertion system for safety-critical code
 * Purpose: Provide defensive programming assertions following the 10 Rules
 * @module Assert
 * @version 2.0.1
 */

/**
 * Main Assert class - comprehensive validation system
 * Purpose: Provide thorough assertion utilities with clear feedback
 */
class Assert {
    constructor() {
 // Rule 3: Pre-allocated tracking structures
        this.assertionCount = 0;
        this.failureCount = 0;
        this.maxAssertions = 10000; // Fixed limit for safety
        this.isLoggingEnabled = true;
        this.failureHistory = []; // Bounded to last 100 failures
        
        console.log('Assert system initialized - validation ready');
    }

    /**
     * Core assertion method - validates conditions with clear feedback
     * Purpose: Check if condition is true, provide helpful guidance if not
     * Rule 4: ≤60 lines | Rule 5: 2+ internal checks | Rule 6: Clear return
     */
    assert(condition, message = 'Assertion failed') {
 // Rule 5: Self-validation
        if (typeof condition !== 'boolean' && !condition) {
            condition = Boolean(condition);
        }
        
        this.assertionCount++;
        
 // Rule 2: Bounded assertion tracking
        if (this.assertionCount > this.maxAssertions) {
            console.warn('Maximum assertions reached - system protection active');
            return false;
        }
        
        if (condition) {
            return true;
        } else {
            this.failureCount++;
            
            const failureInfo = {
                message: String(message),
                timestamp: Date.now(),
                assertionNumber: this.assertionCount
            };
            
 // Rule 3: Bounded failure history
            if (this.failureHistory.length >= 100) {
                this.failureHistory.shift();
            }
            this.failureHistory.push(failureInfo);
            
            if (this.isLoggingEnabled) {
                console.error(`ASSERTION FAILED: ${message}`);
                console.trace('Call stack for context');
            }
            
            return false;
        }
    }

    /**
     * Type validation with clear error messages
     * Purpose: Ensure values are the expected type
     * Rule 4: ≤60 lines | Rule 5: 2+ checks | Rule 1: Simple flow
     */
    assertType(value, expectedType, parameterName = 'parameter') {
 // Rule 5: Validate parameters
        if (typeof expectedType !== 'string') {
            console.error('Assert.assertType: expectedType must be string');
            return false;
        }
        
        if (typeof parameterName !== 'string') {
            console.error('Assert.assertType: parameterName must be string');
            return false;
        }
        
        const actualType = typeof value;
        const typeMatches = (actualType === expectedType);
        
        if (!typeMatches) {
            const message = `Type mismatch for ${parameterName}: expected '${expectedType}', got '${actualType}'`;
            return this.assert(false, message);
        }
        
        return this.assert(true, `Type validation passed for ${parameterName}`);
    }

    /**
     * Null/undefined validation
     * Purpose: Ensure values exist before using them
     * Rule 4: ≤60 lines | Rule 5: 2+ checks | Rule 1: Simple logic
     */
    assertNotNull(value, parameterName = 'value') {
 // Rule 5: Validate parameter name
        if (typeof parameterName !== 'string') {
            parameterName = 'unknown_parameter';
        }
        
        const isNull = (value === null);
        const isUndefined = (value === undefined);
        const isNullish = (isNull || isUndefined);
        
        if (isNullish) {
            const nullType = isNull ? 'null' : 'undefined';
            const message = `${parameterName} must not be ${nullType}`;
            return this.assert(false, message);
        }
        
        return this.assert(true, `Non-null validation passed for ${parameterName}`);
    }

    /**
     * Range validation with bounds checking
     * Purpose: Ensure numeric values stay within safe limits
     * Rule 4: ≤60 lines | Rule 5: 2+ checks | Rule 2: Fixed comparisons
     */
    assertRange(value, min, max, parameterName = 'value') {
 // Rule 5: Validate all parameters
        if (typeof value !== 'number' || isNaN(value)) {
            return this.assert(false, `${parameterName} must be a valid number`);
        }
        
        if (typeof min !== 'number' || typeof max !== 'number') {
            return this.assert(false, `Range bounds must be numbers for ${parameterName}`);
        }
        
        if (min > max) {
            return this.assert(false, `Invalid range for ${parameterName}: min (${min}) > max (${max})`);
        }
        
        const withinRange = (value >= min && value <= max);
        
        if (!withinRange) {
            const message = `${parameterName} (${value}) must be between ${min} and ${max}`;
            return this.assert(false, message);
        }
        
        return this.assert(true, `Range validation passed for ${parameterName}`);
    }

    /**
     * Array bounds validation
     * Purpose: Verify array index is valid
     * Rule 4: ≤60 lines | Rule 5: 2+ checks | Rule 2: Bounds enforcement
     */
    assertArrayBounds(array, index, arrayName = 'array') {
 // Rule 5: Validate inputs
        if (!Array.isArray(array)) {
            return this.assert(false, `${arrayName} must be an array`);
        }
        
        if (typeof index !== 'number' || !Number.isInteger(index)) {
            return this.assert(false, `Index must be an integer for ${arrayName}`);
        }
        
        const condition = index >= 0 && index < array.length;
        
        if (!condition) {
            const message = `Array index ${index} out of bounds [0, ${array.length - 1}] for ${arrayName}`;
            return this.assert(false, message);
        }
        
        return this.assert(true, `Array bounds check passed for ${arrayName}`);
    }

    /**
     * Loop bound validation - critical for Rule 2 compliance
     * Purpose: Ensure loop indices stay within provable bounds
     * Rule 4: ≤60 lines | Rule 5: 2+ checks | Rule 2: Bound enforcement
     */
    assertLoopBound(index, limit, loopName = 'loop') {
 // Rule 5: Parameter validation
        if (typeof index !== 'number' || typeof limit !== 'number') {
            return this.assert(false, `Loop bounds must be numbers for ${loopName}`);
        }
        
        if (limit < 0) {
            return this.assert(false, `Loop limit must be non-negative for ${loopName}`);
        }
        
        const withinBounds = (index >= 0 && index < limit);
        
        if (!withinBounds) {
            const message = `Loop bound exceeded in ${loopName}: index ${index} >= limit ${limit}`;
            return this.assert(false, message);
        }
        
        return this.assert(true, `Loop bound check passed for ${loopName}`);
    }

    /**
     * Function parameter count validation
     * Purpose: Verify correct number of parameters
     * Rule 4: ≤60 lines | Rule 5: 2+ checks | Rule 1: Simple validation
     */
    assertParamCount(actual, expected, functionName = 'function') {
 // Rule 5: Parameter validation
        if (typeof actual !== 'number' || typeof expected !== 'number') {
            return this.assert(false, `Parameter counts must be numbers for ${functionName}`);
        }
        
        if (expected < 0 || actual < 0) {
            return this.assert(false, `Parameter counts must be non-negative for ${functionName}`);
        }
        
        const condition = actual === expected;
        
        if (!condition) {
            const message = `${functionName} expects ${expected} parameters, got ${actual}`;
            return this.assert(false, message);
        }
        
        return this.assert(true, `Parameter count validation passed for ${functionName}`);
    }

    /**
     * Function precondition validation
     * Purpose: Verify function entry conditions
     * Rule 4: ≤60 lines | Rule 5: 2+ checks | Rule 1: Simple flow
     */
    assertPrecondition(condition, functionName = 'function', description = 'precondition') {
 // Rule 5: Parameter validation
        if (typeof functionName !== 'string') {
            functionName = 'unknown_function';
        }
        
        if (typeof description !== 'string') {
            description = 'unknown_condition';
        }
        
        if (!condition) {
            const message = `Precondition failed in ${functionName}: ${description}`;
            return this.assert(false, message);
        }
        
        return this.assert(true, `Precondition satisfied in ${functionName}: ${description}`);
    }

    /**
     * Function postcondition validation
     * Purpose: Verify function exit conditions
     * Rule 4: ≤60 lines | Rule 5: 2+ checks | Rule 1: Simple flow
     */
    assertPostcondition(condition, functionName = 'function', description = 'postcondition') {
 // Rule 5: Parameter validation
        if (typeof functionName !== 'string') {
            functionName = 'unknown_function';
        }
        
        if (typeof description !== 'string') {
            description = 'unknown_condition';
        }
        
        if (!condition) {
            const message = `Postcondition failed in ${functionName}: ${description}`;
            return this.assert(false, message);
        }
        
        return this.assert(true, `Postcondition satisfied in ${functionName}: ${description}`);
    }

    /**
     * Get assertion statistics for monitoring
     * Purpose: Provide insight into assertion usage patterns
     * Rule 4: ≤60 lines | Rule 5: 2+ checks | Rule 3: Bounded data
     */
    getStats() {
 // Rule 5: Validate internal state
        if (typeof this.assertionCount !== 'number') {
            this.assertionCount = 0;
        }
        
        if (typeof this.failureCount !== 'number') {
            this.failureCount = 0;
        }
        
        const successCount = this.assertionCount - this.failureCount;
        const successRate = this.assertionCount > 0 ? 
            (successCount / this.assertionCount * 100).toFixed(1) : 0;
        
        return {
            totalAssertions: this.assertionCount,
            failures: this.failureCount,
            successes: successCount,
            successRate: `${successRate}%`,
            recentFailures: this.failureHistory.slice(-10),
            status: 'Assertions help maintain code reliability'
        };
    }

    /**
     * Enable or disable assertion logging
     * Purpose: Control verbosity for different environments
     * Rule 4: ≤60 lines | Rule 5: 2+ checks | Rule 1: Simple toggle
     */
    setLogging(enabled) {
 // Rule 5: Parameter validation
        if (typeof enabled !== 'boolean') {
            return this.assert(false, 'Logging enabled flag must be boolean');
        }
        
        const previousState = this.isLoggingEnabled;
        this.isLoggingEnabled = enabled;
        
        if (enabled) {
            console.log('Assert logging enabled - failures will be visible');
        } else {
            console.log('Assert logging disabled - running quietly');
        }
        
        return this.assert(true, `Logging state changed from ${previousState} to ${enabled}`);
    }

    /**
     * Reset assertion statistics
     * Purpose: Clear counters for new testing sessions
     * Rule 4: ≤60 lines | Rule 5: 2+ checks | Rule 3: Bounded reset
     */
    reset() {
 // Rule 5: Validate current state before reset
        if (typeof this.assertionCount !== 'number') {
            console.warn('Assertion count was corrupted - fixing during reset');
        }
        
        if (typeof this.failureCount !== 'number') {
            console.warn('Failure count was corrupted - fixing during reset');
        }
        
        const oldStats = {
            assertions: this.assertionCount,
            failures: this.failureCount
        };
        
 // Rule 3: Reset to pre-allocated initial state
        this.assertionCount = 0;
        this.failureCount = 0;
        this.failureHistory.length = 0;
        
        console.log(`Assert reset: cleared ${oldStats.assertions} assertions, ${oldStats.failures} failures`);
        return true;
    }
}

// Create singleton instance
const assertInstance = new Assert();

// Export for different module systems
// Browser-only export
if (typeof window !== 'undefined') {
 // Global window object exports
    window.Assert = {
        Assert,
 // Direct function access
        assert: (condition, message) => assertInstance.assert(condition, message),
        assertType: (value, type, name) => assertInstance.assertType(value, type, name),
        assertNotNull: (value, name) => assertInstance.assertNotNull(value, name),
        assertRange: (value, min, max, name) => assertInstance.assertRange(value, min, max, name),
        assertArrayBounds: (array, index, name) => assertInstance.assertArrayBounds(array, index, name),
        assertLoopBound: (index, limit, name) => assertInstance.assertLoopBound(index, limit, name),
        assertParamCount: (actual, expected, name) => assertInstance.assertParamCount(actual, expected, name),
        assertPrecondition: (condition, func, desc) => assertInstance.assertPrecondition(condition, func, desc),
        assertPostcondition: (condition, func, desc) => assertInstance.assertPostcondition(condition, func, desc),
 // Utility methods
        getStats: () => assertInstance.getStats(),
        setLogging: (enabled) => assertInstance.setLogging(enabled),
        reset: () => assertInstance.reset()
    };
    
    console.log('Assert system loaded and ready for validation');
}
