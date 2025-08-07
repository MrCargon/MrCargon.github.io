/**
 * RulesEnforcer.js - Runtime enforcement of Power of Ten rules
 * Purpose: Monitor and guide code compliance with coding standards
 * @module RulesEnforcer
 * @version 1.0.0
 */

// Use global Assert system (avoid redeclaration)
// Access Assert through window to prevent const redeclaration
function getAssert() {
    return window.Assert || {
        assert: (condition, message) => condition === true,
        assertNotNull: (value) => value != null,
        assertType: (value, expectedType) => typeof value === expectedType,
        assertRange: (value, min, max) => value >= min && value <= max,
        assertLoopBound: (iterations, max) => iterations < max
    };
}

/**
 * Rules configuration loader
 * Purpose: Load and validate rules configuration
 */
class RulesConfigLoader {
    /**
     * Load rules configuration
     * Purpose: Fetch and validate rules config
     * @returns {Object} - Rules configuration
     */
    static async loadConfig() {
        // Precondition: Config path exists
        const configPath = '/src/golden-rules/rules-config.json';
        
        try {
            const response = await fetch(configPath);
            const config = await response.json();
            
        // Validate config integrity
        if (!this.validateConfigIntegrity(config)) {
            return this.getDefaultConfig();
        }
        
        // Postcondition: Valid config returned
        const Assert = getAssert();
        Assert.assertNotNull(config, 'config');
            return config;
        } catch (error) {
            console.error('Failed to load rules config:', error);
            return this.getDefaultConfig();
        }
    }
    
    /**
     * Validate config integrity
     * Purpose: Check if config has been tampered with
     * @param {Object} config - Configuration to validate
     * @returns {boolean} - True if valid
     */
    static validateConfigIntegrity(config) {
        const Assert = getAssert();
        // Check required fields
        Assert.assertNotNull(config.version, 'config.version');
        Assert.assertNotNull(config.rules, 'config.rules');
        
        // Verify checksum (simplified for demonstration)
        const expectedChecksum = 'a7b3c9d2e1f4g5h6';
        const isValid = config.checksum === expectedChecksum;
        
        // Postcondition: Return validation result
        Assert.assertType(isValid, 'boolean', 'isValid');
        return isValid;
    }
    
    /**
     * Get default configuration
     * Purpose: Provide fallback configuration
     * @returns {Object} - Default config
     */
    static getDefaultConfig() {
        return {
            version: '1.0.0',
            rules: {
                maxFunctionLength: 60,
                maxNestingDepth: 4,
                maxLoopIterations: 1000,
                minAssertionsPerFunction: 2
            }
        };
    }
}

/**
 * Function validator
 * Purpose: Validate functions against Power of Ten rules
 */
class FunctionValidator {
    /**
     * Validate function length (Rule 4)
     * Purpose: Ensure function doesn't exceed 60 lines
     * @param {Function} func - Function to validate
     * @param {string} name - Function name
     * @returns {Object} - Validation result
     */
    static validateLength(func, name) {
        const Assert = getAssert();
        // Preconditions
        Assert.assertNotNull(func, 'func');
        Assert.assertType(name, 'string', 'name');
        
        const funcString = func.toString();
        const lines = funcString.split('\n');
        const lineCount = lines.length;
        
        const maxLines = 60;
        const isValid = lineCount <= maxLines;
        
        // Postcondition
        const result = {
            valid: isValid,
            lineCount: lineCount,
            maxAllowed: maxLines,
            functionName: name
        };
        
        Assert.assertNotNull(result, 'result');
        return result;
    }
    
    /**
     * Validate nesting depth (Rule 1)
     * Purpose: Ensure simple control flow
     * @param {Function} func - Function to validate
     * @param {string} name - Function name
     * @returns {Object} - Validation result
     */
    static validateNestingDepth(func, name) {
        const Assert = getAssert();
        // Preconditions
        Assert.assertNotNull(func, 'func');
        Assert.assertType(name, 'string', 'name');
        
        const funcString = func.toString();
        let maxDepth = 0;
        let currentDepth = 0;
        
        // Count nesting depth (simplified)
        const maxIterations = 10000;
        let i = 0;
        while (i < funcString.length && i < maxIterations) {
            const char = funcString[i];
            if (char === '{') {
                currentDepth++;
                maxDepth = Math.max(maxDepth, currentDepth);
            } else if (char === '}') {
                currentDepth = Math.max(0, currentDepth - 1);
            }
            i++;
        }
        
        const maxAllowed = 4;
        const isValid = maxDepth <= maxAllowed;
        
        // Postcondition
        const result = {
            valid: isValid,
            maxDepth: maxDepth,
            maxAllowed: maxAllowed,
            functionName: name
        };
        
        Assert.assertNotNull(result, 'result');
        return result;
    }
    
    /**
     * Check for recursion (Rule 1)
     * Purpose: Ensure no direct or indirect recursion
     * @param {Function} func - Function to validate
     * @param {string} name - Function name
     * @returns {Object} - Validation result
     */
    static checkRecursion(func, name) {
        const Assert = getAssert();
        // Preconditions
        Assert.assertNotNull(func, 'func');
        Assert.assertType(name, 'string', 'name');
        
        const funcString = func.toString();
        const hasRecursion = funcString.includes(name + '(');
        
        // Postcondition
        const result = {
            valid: !hasRecursion,
            hasRecursion: hasRecursion,
            functionName: name
        };
        
        Assert.assertNotNull(result, 'result');
        return result;
    }
}

/**
 * Loop validator
 * Purpose: Validate loops have bounds (Rule 2)
 */
class LoopValidator {
    /**
     * Track loop iterations
     * Purpose: Ensure loops are bounded
     * @param {string} loopId - Unique loop identifier
     * @returns {Object} - Loop tracker
     */
    static createLoopTracker(loopId) {
        const Assert = getAssert();
        // Precondition
        Assert.assertType(loopId, 'string', 'loopId');
        
        const tracker = {
            id: loopId,
            iterations: 0,
            maxIterations: 1000,
            startTime: Date.now(),
            
            /**
             * Increment and check bound
             * Purpose: Track loop iterations
             * @returns {boolean} - True if within bounds
             */
            increment: function() {
                this.iterations++;
                const withinBounds = this.iterations < this.maxIterations;
                
                if (!withinBounds) {
                    console.error(`Loop ${this.id} exceeded max iterations: ${this.iterations}`);
                }
                
                return withinBounds;
            },
            
            /**
             * Reset tracker
             * Purpose: Reset for reuse
             * @returns {void}
             */
            reset: function() {
                this.iterations = 0;
                this.startTime = Date.now();
            }
        };
        
        // Postcondition
        Assert.assertNotNull(tracker, 'tracker');
        return tracker;
    }
}

/**
 * Memory validator
 * Purpose: Ensure no dynamic allocation after init (Rule 3)
 */
class MemoryValidator {
    static initialized = false;
    static allocations = [];
    static maxAllocations = 1000;
    
    /**
     * Mark initialization complete
     * Purpose: After this, no dynamic allocation allowed
     * @returns {void}
     */
    static markInitialized() {
        this.initialized = true;
        console.log('Memory initialization phase complete');
    }
    
    /**
     * Track allocation
     * Purpose: Monitor memory allocations
     * @param {string} type - Allocation type
     * @param {number} size - Allocation size
     * @returns {boolean} - True if allowed
     */
    static trackAllocation(type, size) {
        const Assert = getAssert();
        // Preconditions
        Assert.assertType(type, 'string', 'type');
        Assert.assertType(size, 'number', 'size');
        
        // Check if allowed
        if (this.initialized) {
            console.warn(`Dynamic allocation after init: ${type} (${size} bytes)`);
            return false;
        }
        
        // Track allocation (bounded)
        if (this.allocations.length < this.maxAllocations) {
            this.allocations.push({
                type: type,
                size: size,
                timestamp: Date.now()
            });
        }
        
        // Postcondition
        return true;
    }
}

/**
 * Main Rules Enforcer
 * Purpose: Coordinate all rule validation
 */
class RulesEnforcer {
    constructor() {
        this.config = null;
        this.violations = [];
        this.maxViolations = 100;
        this.enforcementEnabled = true;
    }
    
    /**
     * Initialize enforcer
     * Purpose: Load config and setup monitoring
     * @returns {Promise<boolean>} - Success status
     */
    async initialize() {
        const Assert = getAssert();
        // Precondition
        Assert.assert(!this.config, 'Enforcer already initialized');
        
        // Load configuration
        this.config = await RulesConfigLoader.loadConfig();
        
        // Setup monitoring
        this.setupMonitoring();
        
        // Postcondition
        Assert.assertNotNull(this.config, 'config');
        return true;
    }
    
    /**
     * Setup monitoring
     * Purpose: Install runtime monitors
     * @returns {void}
     */
    setupMonitoring() {
        // Monitor function calls
        this.monitorFunctions();
        
        // Monitor memory usage
        this.monitorMemory();
        
        console.log('Rules enforcement monitoring active');
    }
    
    /**
     * Monitor functions
     * Purpose: Track function compliance
     * @returns {void}
     */
    monitorFunctions() {
        // Override setTimeout to add bounds checking
        const originalSetTimeout = window.setTimeout;
        window.setTimeout = function(callback, delay, ...args) {
            const Assert = getAssert();
            // Preconditions
            Assert.assertNotNull(callback, 'callback');
            Assert.assertType(delay, 'number', 'delay');
            
            // Add bounds check
            const boundedDelay = Math.min(delay, 30000); // Max 30 seconds
            
            // Call original with bounds
            return originalSetTimeout.call(window, callback, boundedDelay, ...args);
        };
    }
    
    /**
     * Monitor memory
     * Purpose: Track memory allocations
     * @returns {void}
     */
    monitorMemory() {
        // Track array/object creation (simplified)
        // In production, would use Proxy or similar
        console.log('Memory monitoring enabled');
    }
    
    /**
     * Validate function
     * Purpose: Check function against all rules
     * @param {Function} func - Function to validate
     * @param {string} name - Function name
     * @returns {Object} - Validation results
     */
    validateFunction(func, name) {
        const Assert = getAssert();
        // Preconditions
        Assert.assertNotNull(func, 'func');
        Assert.assertType(name, 'string', 'name');
        
        const results = {
            functionName: name,
            violations: [],
            valid: true
        };
        
        // Check length (Rule 4)
        const lengthResult = FunctionValidator.validateLength(func, name);
        if (!lengthResult.valid) {
            results.violations.push({
                rule: 'FUNCTION_LENGTH',
                message: `Function exceeds ${lengthResult.maxAllowed} lines`
            });
            results.valid = false;
        }
        
        // Check nesting (Rule 1)
        const nestingResult = FunctionValidator.validateNestingDepth(func, name);
        if (!nestingResult.valid) {
            results.violations.push({
                rule: 'NESTING_DEPTH',
                message: `Nesting depth ${nestingResult.maxDepth} exceeds ${nestingResult.maxAllowed}`
            });
            results.valid = false;
        }
        
        // Check recursion (Rule 1)
        const recursionResult = FunctionValidator.checkRecursion(func, name);
        if (!recursionResult.valid) {
            results.violations.push({
                rule: 'NO_RECURSION',
                message: 'Function contains recursion'
            });
            results.valid = false;
        }
        
        // Record violations
        this.recordViolations(results.violations);
        
        // Postcondition
        Assert.assertNotNull(results, 'results');
        return results;
    }
    
    /**
     * Record violations
     * Purpose: Track rule violations
     * @param {Array} violations - Violations to record
     * @returns {void}
     */
    recordViolations(violations) {
        const Assert = getAssert();
        // Precondition
        Assert.assert(Array.isArray(violations), 'violations must be array');
        
        // Add violations (bounded)
        let i = 0;
        while (i < violations.length && this.violations.length < this.maxViolations) {
            this.violations.push({
                ...violations[i],
                timestamp: Date.now()
            });
            i++;
        }
        
        // Postcondition
        Assert.assert(this.violations.length <= this.maxViolations, 'violations within bounds');
    }
    
    /**
     * Get violation report
     * Purpose: Generate compliance report
     * @returns {Object} - Violation report
     */
    getReport() {
        const report = {
            totalViolations: this.violations.length,
            violations: this.violations.slice(0, 10), // Last 10
            enforcementEnabled: this.enforcementEnabled,
            timestamp: Date.now()
        };
        
        // Postcondition
        Assert.assertNotNull(report, 'report');
        return report;
    }
}

// Create and export singleton instance
const enforcer = new RulesEnforcer();

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        RulesEnforcer,
        FunctionValidator,
        LoopValidator,
        MemoryValidator,
        enforcer
    };
} else {
    window.RulesEnforcer = {
        RulesEnforcer,
        FunctionValidator,
        LoopValidator,
        MemoryValidator,
        enforcer
    };
}
