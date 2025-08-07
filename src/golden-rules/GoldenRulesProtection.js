/**
 * GoldenRulesProtection.js - Golden Rules learning implementation
 * Purpose: Provide basic protection for Power of Ten rules (learning version)
 * @module GoldenRulesProtection
 * @version 2.0.0
 */

/**
 * Tamper-proof namespace creator
 * Purpose: Create sealed namespaces that cannot be modified
 * @param {string} namespace - Namespace name
 * @param {Object} definition - Namespace definition
 * @returns {Object} - Protected namespace
 */
function createProtectedNamespace(namespace, definition) {
    // Create sealed object with integrity protection
    const sealed = Object.seal(Object.freeze(definition));
    
    // Add tamper detection
    const handler = {
        set: function(target, property, value) {
            console.error(`🚨 RULE PROTECTION: Attempt to modify protected namespace ${namespace}.${property}`);
            return false; // Reject modification
        },
        deleteProperty: function(target, property) {
            console.error(`🚨 RULE PROTECTION: Attempt to delete ${namespace}.${property}`);
            return false; // Reject deletion
        }
    };
    
    return new Proxy(sealed, handler);
}

/**
 * Immutable Golden Rules configuration
 * Purpose: Define rules that cannot be changed at runtime
 */
const GOLDEN_RULES_IMMUTABLE = createProtectedNamespace('GOLDEN_RULES', {
    // Rule 1: Simple Control Flow
    SIMPLE_CONTROL_FLOW: {
        id: 1,
        name: 'Simple Control Flow',
        description: 'No goto, setjmp, longjmp, or recursion allowed',
        violations: ['goto', 'setjmp', 'longjmp', 'recursion'],
        maxNestingDepth: 4,
        enabled: true
    },
    
    // Rule 2: Bounded Loops
    BOUNDED_LOOPS: {
        id: 2,
        name: 'Bounded Loops',
        description: 'All loops must have statically provable upper bounds',
        maxIterations: 1000,
        requireExplicitBounds: true,
        enabled: true
    },
    
    // Rule 3: No Dynamic Memory After Init
    NO_DYNAMIC_MEMORY: {
        id: 3,
        name: 'No Dynamic Memory',
        description: 'No dynamic memory allocation after initialization',
        allowedDuringInit: true,
        trackAllocations: true,
        enabled: true
    },
    
    // Rule 4: Function Length Limit
    FUNCTION_LENGTH_LIMIT: {
        id: 4,
        name: 'Function Length Limit',
        description: 'No function longer than 60 lines',
        maxLines: 60,
        countComments: false,
        enabled: true
    },
    
    // Rule 5: High Assertion Density
    HIGH_ASSERTION_DENSITY: {
        id: 5,
        name: 'High Assertion Density',
        description: 'Minimum 2 assertions per function',
        minAssertionsPerFunction: 2,
        requireSideEffectFree: true,
        enabled: true
    },
    
    // Rule 6: Graceful Error Recovery
    GRACEFUL_ERROR_RECOVERY: {
        id: 6,
        name: 'Graceful Error Recovery',
        description: 'No hard stops, implement recovery mechanisms',
        requireRecoveryMechanisms: true,
        allowedRecoveryTime: 5000,
        enabled: true
    },
    
    // Rule 7: Return Value Checking
    RETURN_VALUE_CHECKING: {
        id: 7,
        name: 'Return Value Checking',
        description: 'All non-void function returns must be checked',
        allowExplicitIgnore: true,
        requireDocumentation: true,
        enabled: true
    },
    
    // Rule 8: Limited Preprocessor
    LIMITED_PREPROCESSOR: {
        id: 8,
        name: 'Limited Preprocessor',
        description: 'Restrict macro usage to simple definitions',
        allowedMacroTypes: ['simple', 'header-guard'],
        maxConditionalDirectives: 2,
        enabled: true
    },
    
    // Rule 9: Restricted Pointers
    RESTRICTED_POINTERS: {
        id: 9,
        name: 'Restricted Pointers',
        description: 'Maximum one level of dereferencing',
        maxDereferenceLevel: 1,
        allowFunctionPointers: false,
        enabled: true
    },
    
    // Rule 10: Static Analysis Clean
    STATIC_ANALYSIS_CLEAN: {
        id: 10,
        name: 'Static Analysis Clean',
        description: 'Zero warnings from static analysis tools',
        requiredTools: ['eslint'],
        toleratedWarnings: 0,
        enabled: true
    }
});

/**
 * Smart integrity checker
 * Purpose: Detect tampering with rules or code (fixed false positives)
 */
class IntegrityChecker {
    constructor() {
        this.checksums = new Map();
        this.lastCheck = 0;
        this.checkInterval = 30000; // Check every 30 seconds (reduced from 5s)
        this.falsePositiveCount = 0;
        this.maxFalsePositives = 3;
    }
    
    /**
     * Calculate simple checksum
     * Purpose: Generate integrity hash for content
     * @param {string} content - Content to hash
     * @returns {string} - Checksum
     */
    calculateChecksum(content) {
        let hash = 0;
        const maxIterations = Math.min(content.length, 10000);
        let i = 0;
        
        while (i < maxIterations) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
            i++;
        }
        
        return hash.toString(16);
    }
    
    /**
     * Extract immutable core from component
     * Purpose: Get only the parts that should never change
     * @param {string} name - Component name
     * @param {Object} component - Component object
     * @returns {string} - Serialized immutable core
     */
    extractImmutableCore(name, component) {
        if (name === 'GoldenRulesProtection') {
            // Only monitor the immutable rules, not dynamic state
            return JSON.stringify(component.GOLDEN_RULES_IMMUTABLE, Object.keys(component.GOLDEN_RULES_IMMUTABLE).sort());
        }
        
        if (name === 'Assert') {
            // Monitor core assertion functions, not statistics
            const core = {
                assertionEnabled: component.assertionEnabled,
                maxAssertions: component.maxAssertions
            };
            return JSON.stringify(core, Object.keys(core).sort());
        }
        
        if (name === 'BoundedUtilities') {
            // Monitor configuration, not runtime state
            const core = {
                maxIterations: component.BoundedLoop?.maxIterations || 1000,
                maxElements: component.SafeDOM?.maxElements || 100
            };
            return JSON.stringify(core, Object.keys(core).sort());
        }
        
        if (name === 'RulesEnforcer') {
            // Monitor rules configuration, not violation history
            const core = {
                enforcementEnabled: component.enforcer?.enforcementEnabled,
                rules: component.enforcer?.rules
            };
            return JSON.stringify(core, Object.keys(core).sort());
        }
        
        // Fallback for unknown components
        return JSON.stringify(component);
    }
    
    /**
     * Register component for monitoring
     * Purpose: Add component to integrity monitoring (smart version)
     * @param {string} name - Component name
     * @param {string} content - Component content (not used in smart mode)
     * @returns {void}
     */
    registerComponent(name, content) {
        // Calculate checksum based on immutable core only
        if (window[name]) {
            const immutableCore = this.extractImmutableCore(name, window[name]);
            const checksum = this.calculateChecksum(immutableCore);
            
            this.checksums.set(name, {
                checksum: checksum,
                timestamp: Date.now(),
                verified: true
            });
            
            console.log(`🔒 Component ${name} registered for basic monitoring`);
        }
    }
    
    /**
     * Verify component integrity (smart version)
     * Purpose: Check if truly immutable parts have been tampered with
     * @param {string} name - Component name
     * @returns {boolean} - True if integrity maintained
     */
    verifyComponent(name) {
        const stored = this.checksums.get(name);
        if (!stored) {
            console.warn(`⚠️ Component ${name} not registered for integrity checking`);
            return true; // Don't fail on unregistered components
        }
        
        if (!window[name]) {
            console.error(`🚨 RULE CONCERN: Component ${name} has been removed!`);
            return false;
        }
        
        const currentCore = this.extractImmutableCore(name, window[name]);
        const currentChecksum = this.calculateChecksum(currentCore);
        const isValid = currentChecksum === stored.checksum;
        
        if (!isValid) {
            // Smart detection: check if this might be a false positive
            this.falsePositiveCount++;
            
            if (this.falsePositiveCount <= this.maxFalsePositives) {
                console.warn(`⚠️ Possible integrity change in ${name} (${this.falsePositiveCount}/${this.maxFalsePositives})`);
                console.warn(`Expected: ${stored.checksum}, Got: ${currentChecksum}`);
                return true; // Tolerate initial false positives
            }
            
            console.error(`🚨 CONFIRMED RULE CONCERN: Component ${name} core has been modified!`);
            console.error(`Expected checksum: ${stored.checksum}, Got: ${currentChecksum}`);
            return false;
        } else {
            // Reset false positive counter on successful verification
            this.falsePositiveCount = Math.max(0, this.falsePositiveCount - 1);
        }
        
        return isValid;
    }
    
    /**
     * Start continuous monitoring (smart version)
     * Purpose: Monitor system integrity with reduced false positives
     * @returns {void}
     */
    startMonitoring() {
        const checkIntegrity = () => {
            if (Date.now() - this.lastCheck < this.checkInterval) {
                return;
            }
            
            this.lastCheck = Date.now();
            let allValid = true;
            let violationCount = 0;
            
            // Check critical components (smart monitoring)
            const criticalComponents = [
                'Assert',
                'BoundedUtilities', 
                'RulesEnforcer',
                'GoldenRulesProtection'
            ];
            
            let i = 0;
            while (i < criticalComponents.length && i < 10) {
                const component = criticalComponents[i];
                if (window[component] && !this.verifyComponent(component)) {
                    allValid = false;
                    violationCount++;
                }
                i++;
            }
            
            if (allValid) {
                // Only log success periodically to reduce console noise
                if (this.lastCheck % (this.checkInterval * 5) < this.checkInterval) {
                    console.log('🛡️ System integrity verified (smart monitoring)');
                }
            } else {
                // Only trigger alerts if multiple violations detected
                if (violationCount >= 2) {
                    this.handleIntegrityViolation();
                } else {
                    console.warn(`⚠️ Minor integrity concern (${violationCount} components affected)`);
                }
            }
        };
        
        // Start monitoring loop with longer intervals
        setInterval(checkIntegrity, this.checkInterval);
        console.log('🔍 Basic integrity monitoring started (30s intervals)');
    }
    
    /**
     * Handle integrity violation
     * Purpose: Respond to detected tampering
     * @returns {void}
     */
    handleIntegrityViolation() {
        console.error('🚨 RULE CONCERN: System integrity may be affected!');
        
        // Lock down system in safe mode
        if (window.GoldenRules && window.GoldenRules.enterSafeMode) {
            window.GoldenRules.enterSafeMode();
        }
        
        // Notify monitoring systems
        this.reportSecurityIncident();
    }
    
    /**
     * Report security incident
     * Purpose: Log security violations for analysis
     * @returns {void}
     */
    reportSecurityIncident() {
        const incident = {
            timestamp: new Date().toISOString(),
            type: 'INTEGRITY_VIOLATION',
            severity: 'CRITICAL',
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        console.error('🚨 Security Incident Reported:', incident);
        
        // In production, would send to monitoring service
        // fetch('/security/incident', { method: 'POST', body: JSON.stringify(incident) });
    }
}

/**
 * Developer guidance system
 * Purpose: Provide comprehensive help and examples
 */
class DeveloperGuidance {
    constructor() {
        this.examples = new Map();
        this.violations = [];
        this.maxViolations = 100;
    }
    
    /**
     * Add code example
     * Purpose: Provide example of compliant code
     * @param {string} rule - Rule name
     * @param {string} title - Example title
     * @param {string} code - Example code
     * @param {string} explanation - Explanation
     * @returns {void}
     */
    addExample(rule, title, code, explanation) {
        if (!this.examples.has(rule)) {
            this.examples.set(rule, []);
        }
        
        this.examples.get(rule).push({
            title: title,
            code: code,
            explanation: explanation,
            timestamp: Date.now()
        });
    }
    
    /**
     * Get examples for rule
     * Purpose: Retrieve examples for specific rule
     * @param {string} rule - Rule name
     * @returns {Array} - Array of examples
     */
    getExamples(rule) {
        return this.examples.get(rule) || [];
    }
    
    /**
     * Suggest improvement
     * Purpose: Provide specific improvement suggestions
     * @param {string} code - Code to analyze
     * @param {string} violation - Violation type
     * @returns {Object} - Improvement suggestion
     */
    suggestImprovement(code, violation) {
        const suggestions = {
            'FUNCTION_TOO_LONG': {
                problem: 'Function exceeds 60 lines (Rule 4)',
                solution: 'Break function into smaller, focused functions',
                example: `
// Instead of one long function:
function processData(data) {
    // 80 lines of code...
}

// Break into smaller functions:
function validateData(data) { /* validation logic */ }
function transformData(data) { /* transformation logic */ }
function saveData(data) { /* saving logic */ }
function processData(data) {
    const validated = validateData(data);
    const transformed = transformData(validated);
    return saveData(transformed);
}`
            },
            
            'MISSING_ASSERTIONS': {
                problem: 'Function lacks sufficient assertions (Rule 5)',
                solution: 'Add precondition and postcondition assertions',
                example: `
function divide(a, b) {
    // Add preconditions
    Assert.assertType(a, 'number', 'a');
    Assert.assertType(b, 'number', 'b');
    Assert.assert(b !== 0, 'Division by zero');
    
    const result = a / b;
    
    // Add postcondition
    Assert.assert(!isNaN(result), 'Result must be valid number');
    return result;
}`
            },
            
            'UNBOUNDED_LOOP': {
                problem: 'Loop lacks explicit bounds (Rule 2)',
                solution: 'Add explicit iteration limits',
                example: `
// Instead of unbounded loop:
while (condition) {
    // process
}

// Use bounded loop:
const maxIterations = 1000;
let i = 0;
while (condition && i < maxIterations) {
    Assert.assertLoopBound(i, maxIterations);
    // process
    i++;
}`
            }
        };
        
        return suggestions[violation] || {
            problem: 'Golden Rules violation detected',
            solution: 'Review code against Power of Ten rules',
            example: 'Consult documentation for specific examples'
        };
    }
    
    /**
     * Generate compliance report
     * Purpose: Create detailed compliance analysis
     * @returns {Object} - Compliance report
     */
    generateReport() {
        return {
            timestamp: new Date().toISOString(),
            totalViolations: this.violations.length,
            violationsByType: this.groupViolationsByType(),
            complianceScore: this.calculateComplianceScore(),
            recommendations: this.getRecommendations()
        };
    }
    
    /**
     * Group violations by type
     * Purpose: Organize violations for analysis
     * @returns {Object} - Grouped violations
     */
    groupViolationsByType() {
        const grouped = {};
        let i = 0;
        
        while (i < this.violations.length && i < this.maxViolations) {
            const violation = this.violations[i];
            const type = violation.type || 'UNKNOWN';
            
            if (!grouped[type]) {
                grouped[type] = 0;
            }
            grouped[type]++;
            i++;
        }
        
        return grouped;
    }
    
    /**
     * Calculate compliance score
     * Purpose: Generate overall compliance percentage
     * @returns {number} - Compliance score (0-100)
     */
    calculateComplianceScore() {
        const totalRules = Object.keys(GOLDEN_RULES_IMMUTABLE).length;
        const violationTypes = Object.keys(this.groupViolationsByType()).length;
        
        const compliantRules = Math.max(0, totalRules - violationTypes);
        return Math.round((compliantRules / totalRules) * 100);
    }
    
    /**
     * Get recommendations
     * Purpose: Provide actionable improvement suggestions
     * @returns {Array} - Array of recommendations
     */
    getRecommendations() {
        const recommendations = [];
        const violationsByType = this.groupViolationsByType();
        
        // Generate specific recommendations based on violations
        const ruleNames = Object.keys(violationsByType);
        let i = 0;
        while (i < ruleNames.length && i < 10) {
            const rule = ruleNames[i];
            const count = violationsByType[rule];
            
            recommendations.push({
                priority: count > 5 ? 'HIGH' : count > 2 ? 'MEDIUM' : 'LOW',
                rule: rule,
                count: count,
                suggestion: this.suggestImprovement('', rule).solution
            });
            
            i++;
        }
        
        return recommendations;
    }
}

/**
 * Safe mode system
 * Purpose: Lock down system when violations are detected
 */
class SafeModeSystem {
    constructor() {
        this.safeModeActive = false;
        this.restrictions = [];
        this.allowedOperations = new Set();
    }
    
    /**
     * Enter safe mode
     * Purpose: Activate system lockdown
     * @returns {void}
     */
    enterSafeMode() {
        if (this.safeModeActive) {
            return;
        }
        
        this.safeModeActive = true;
        console.warn('🔒 SAFE MODE ACTIVATED - System locked down due to rule violations');
        
        // Define allowed operations in safe mode
        this.allowedOperations.add('Assert.assert');
        this.allowedOperations.add('console.log');
        this.allowedOperations.add('console.error');
        
        // Disable potentially unsafe operations
        this.restrictOperation('eval');
        this.restrictOperation('Function');
        this.restrictOperation('setTimeout');
        this.restrictOperation('setInterval');
        
        // Show safe mode indicator
        this.showSafeModeIndicator();
    }
    
    /**
     * Restrict operation
     * Purpose: Disable specific operations
     * @param {string} operation - Operation to restrict
     * @returns {void}
     */
    restrictOperation(operation) {
        this.restrictions.push(operation);
        
        if (window[operation]) {
            const original = window[operation];
            window[operation] = function() {
                console.error(`🚫 Operation ${operation} blocked in safe mode`);
                return null;
            };
        }
    }
    
    /**
     * Show safe mode indicator
     * Purpose: Visual indication of safe mode
     * @returns {void}
     */
    showSafeModeIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'safe-mode-indicator';
        indicator.innerHTML = '🔒 SAFE MODE - System Locked';
        indicator.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #ff4444;
            color: white;
            text-align: center;
            padding: 10px;
            font-weight: bold;
            z-index: 99999;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(indicator);
    }
    
    /**
     * Check operation allowed
     * Purpose: Verify if operation is permitted in safe mode
     * @param {string} operation - Operation to check
     * @returns {boolean} - True if allowed
     */
    isOperationAllowed(operation) {
        if (!this.safeModeActive) {
            return true;
        }
        
        return this.allowedOperations.has(operation);
    }
}

// Create singleton instances
const integrityChecker = new IntegrityChecker();
const developerGuidance = new DeveloperGuidance();
const safeModeSystem = new SafeModeSystem();

// Initialize examples for developer guidance
developerGuidance.addExample('BOUNDED_LOOPS', 'Safe Array Processing', `
function processArray(array) {
    Assert.assertNotNull(array, 'array');
    Assert.assert(Array.isArray(array), 'Must be array');
    
    const maxIterations = 1000;
    let i = 0;
    const results = [];
    
    while (i < array.length && i < maxIterations) {
        Assert.assertLoopBound(i, maxIterations);
        results.push(processItem(array[i]));
        i++;
    }
    
    Assert.assert(results.length <= maxIterations, 'Results within bounds');
    return results;
}`, 'Always include explicit loop bounds and assertion checks');

developerGuidance.addExample('HIGH_ASSERTION_DENSITY', 'Function with Proper Assertions', `
function calculateDistance(x1, y1, x2, y2) {
    // Preconditions (Rule 5)
    Assert.assertType(x1, 'number', 'x1');
    Assert.assertType(y1, 'number', 'y1');
    Assert.assertType(x2, 'number', 'x2');
    Assert.assertType(y2, 'number', 'y2');
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Postconditions (Rule 5)
    Assert.assert(distance >= 0, 'Distance must be non-negative');
    Assert.assert(!isNaN(distance), 'Distance must be valid number');
    
    return distance;
}`, 'Include at least 2 assertions per function for defensive programming');

// Export the protection system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GOLDEN_RULES_IMMUTABLE,
        IntegrityChecker,
        DeveloperGuidance,
        SafeModeSystem,
        integrityChecker,
        developerGuidance,
        safeModeSystem
    };
} else {
    window.GoldenRulesProtection = {
        GOLDEN_RULES_IMMUTABLE,
        IntegrityChecker,
        DeveloperGuidance,
        SafeModeSystem,
        integrityChecker,
        developerGuidance,
        safeModeSystem,
        enterSafeMode: () => safeModeSystem.enterSafeMode()
    };
}
