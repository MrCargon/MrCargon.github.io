/**
 * ScopeAnalyzer.js - Analyze variable scope and data minimization
 * Purpose: Detect violations of Rule 6 (data scope minimization)
 * Performance: overhead reduction vs original implementation
 * @version 2.0.1
 */

// Use centralized Assert system (loaded via Assert.js)
// All assertions now use window.Assert directly for consistency

/**
 * ScopeAnalyzer - Monitor variable scope and detect Rule 6 violations
 * Purpose: Ensure data objects declared at smallest possible scope
 * Rule 6: Data scope minimization | Rule 4: ≤60 lines
 */
class ScopeAnalyzer {
    /**
     * Initialize scope analysis with pre-allocated structures
     * Purpose: Setup scope monitoring with fixed memory allocation
     * Rule 3: Pre-allocated memory | Rule 5: Input validation
     */
    constructor(config = {}) {
        // Rule 5: Validate configuration
        if (window.Assert) {
            window.Assert.assertType(config, 'object', 'Configuration object required');
        }
        
        // Rule 3: Pre-allocated monitoring structures (fixed sizes)
        this.globalVariables = new Map(); // Global variable tracking
        this.scopeViolations = []; // Fixed violation array
        this.functionScopes = new Map(); // Function-level scope tracking
        
        // Rule 2: Configuration with bounds
        this.maxGlobalVars = config.maxGlobalVars || 5;
        this.maxViolations = config.maxViolations || 50;
        this.requiresJustification = config.requiresJustification || true;
        
        // Initialize monitoring
        this.violationCount = 0;
        this.monitoringActive = true;
        
        // Setup scope monitoring hooks
        this.initializeScopeMonitoring();
        
        console.log('✅ ScopeAnalyzer initialized - Rule 6 compliance active');
    }
    
    /**
     * Initialize scope monitoring systems
     * Purpose: Setup variable declaration monitoring
     * Rule 2: Bounded operations | Rule 4: ≤60 lines
     */
    initializeScopeMonitoring() {
        // Rule 5: Validate monitoring setup
        if (window.Assert) {
            window.Assert.assertType(this.globalVariables, 'object', 'Global variables map required');
        }
        
        try {
            // Monitor global variable assignments
            this.setupGlobalVariableMonitoring();
            
            // Monitor function-level scope usage
            this.setupFunctionScopeMonitoring();
            
            // Analyze existing global variables
            this.analyzeExistingGlobals();
            
            console.log('📊 Scope monitoring systems initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize scope monitoring:', error.message);
            this.monitoringActive = false;
        }
    }
    
    /**
     * Setup global variable monitoring
     * Purpose: Track and limit global variable creation
     * Rule 6: Global restrictions | Rule 5: Validation
     */
    setupGlobalVariableMonitoring() {
        // Rule 5: Validate monitoring capability
        if (window.Assert) {
            window.Assert.assertType(window, 'object', 'Window object required');
        }
        
        // Store reference to original window behavior
        const originalDefineProperty = Object.defineProperty;
        const analyzer = this;
        
        // Override property definition to monitor globals
        Object.defineProperty = function(obj, prop, descriptor) {
            // Check if this is a global variable assignment
            if (obj === window && typeof prop === 'string') {
                analyzer.checkGlobalVariableDeclaration(prop, descriptor);
            }
            
            return originalDefineProperty.call(this, obj, prop, descriptor);
        };
        
        console.log('🌍 Global variable monitoring active');
    }
    
    /**
     * Check global variable declaration against Rule 6
     * Purpose: Validate global variable usage and limits
     * Rule 6: Global limits | Rule 5: Input validation
     */
    checkGlobalVariableDeclaration(variableName, descriptor) {
        // Rule 5: Validate inputs
        if (window.Assert) {
            window.Assert.assertType(variableName, 'string', 'Variable name required');
            window.Assert.assertType(descriptor, 'object', 'Property descriptor required');
        }
        
        // Skip if monitoring disabled
        if (!this.monitoringActive) return;
        
        // Check if it's a constant (allowed)
        const isConstant = descriptor.writable === false || 
                          descriptor.configurable === false ||
                          variableName.toUpperCase() === variableName;
        
        if (isConstant) {
            this.globalVariables.set(variableName, {
                type: 'constant',
                declared: Date.now(),
                justified: true
            });
            return;
        }
        
        // Check global variable limit (Rule 6)
        const nonConstantGlobals = Array.from(this.globalVariables.values())
            .filter(info => info.type !== 'constant').length;
            
        if (nonConstantGlobals >= this.maxGlobalVars) {
            this.recordScopeViolation('RULE_6_GLOBAL_LIMIT', 
                `Global variable limit exceeded: ${nonConstantGlobals}/${this.maxGlobalVars}`,
                { variableName, limit: this.maxGlobalVars });
        }
        
        // Record global variable
        this.globalVariables.set(variableName, {
            type: 'variable',
            declared: Date.now(),
            justified: false
        });
        
        console.warn(`⚠️ Global variable declared: ${variableName} (${nonConstantGlobals + 1}/${this.maxGlobalVars})`);
    }
    
    /**
     * Setup function-level scope monitoring
     * Purpose: Monitor variable scope within functions
     * Rule 6: Scope minimization | Rule 4: ≤60 lines
     */
    setupFunctionScopeMonitoring() {
        // Rule 5: Validate function monitoring setup
        if (window.Assert) {
            window.Assert.assertType(this.functionScopes, 'object', 'Function scopes map required');
        }
        
        // Monitor function creation to analyze scope usage
        const originalFunction = Function;
        const analyzer = this;
        
        window.Function = function(...args) {
            const func = originalFunction.apply(this, args);
            
            // Analyze function for scope violations
            analyzer.analyzeFunctionScope(func, args);
            
            return func;
        };
        
        console.log('🔍 Function scope monitoring active');
    }
    
    /**
     * Analyze function for scope optimization opportunities
     * Purpose: Identify variables that could have smaller scope
     * Rule 6: Scope minimization | Rule 5: Analysis validation
     */
    analyzeFunctionScope(func, args) {
        // Rule 5: Validate function analysis
        if (window.Assert) {
            window.Assert.assertType(func, 'function', 'Function required for analysis');
        }
        
        try {
            // Get function source code
            const source = func.toString();
            const functionId = this.getFunctionIdentifier(func);
            
            // Analyze variable declarations and usage
            const scopeAnalysis = this.performScopeAnalysis(source);
            
            // Store analysis results
            this.functionScopes.set(functionId, {
                analysis: scopeAnalysis,
                analyzedAt: Date.now(),
                violations: scopeAnalysis.violations || []
            });
            
            // Report scope violations
            if (scopeAnalysis.violations && scopeAnalysis.violations.length > 0) {
                scopeAnalysis.violations.forEach(violation => {
                    this.recordScopeViolation('RULE_6_SCOPE_VIOLATION', violation.message, {
                        functionId,
                        variable: violation.variable,
                        suggestion: violation.suggestion
                    });
                });
            }
            
        } catch (error) {
            console.debug('Scope analysis failed:', error.message);
        }
    }
    
    /**
     * Perform scope analysis on function source code
     * Purpose: Identify scope optimization opportunities
     * Rule 6: Scope analysis | Rule 4: ≤60 lines
     */
    performScopeAnalysis(source) {
        // Rule 5: Validate source code
        if (window.Assert) {
            window.Assert.assertType(source, 'string', 'Function source code required');
        }
        
        const analysis = {
            variables: [],
            violations: [],
            suggestions: []
        };
        
        // Rule 2: Bounded analysis (limit source size)
        const maxSourceLength = 10000;
        if (source.length > maxSourceLength) {
            analysis.violations.push({
                variable: 'function',
                message: 'Function too large for scope analysis',
                suggestion: 'Break into smaller functions'
            });
            return analysis;
        }
        
        // Simple pattern matching for variable declarations
        const varPatterns = [
            /var\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
            /let\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
            /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g
        ];
        
        varPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(source)) !== null) {
                const variableName = match[1];
                
                // Analyze variable usage scope
                const usageAnalysis = this.analyzeVariableUsage(source, variableName);
                
                analysis.variables.push({
                    name: variableName,
                    declaredAt: match.index,
                    usage: usageAnalysis
                });
                
                // Check for scope violations
                if (usageAnalysis.canBeMoreLocal) {
                    analysis.violations.push({
                        variable: variableName,
                        message: `Variable '${variableName}' could be declared in smaller scope`,
                        suggestion: `Move declaration closer to first usage`
                    });
                }
            }
        });
        
        return analysis;
    }
    
    /**
     * Analyze variable usage patterns in source code
     * Purpose: Determine if variable scope can be minimized
     * Rule 6: Usage analysis | Rule 5: Input validation
     */
    analyzeVariableUsage(source, variableName) {
        // Rule 5: Validate inputs
        if (window.Assert) {
            window.Assert.assertType(source, 'string', 'Source code required');
            window.Assert.assertType(variableName, 'string', 'Variable name required');
        }
        
        // Find all usages of the variable
        const usagePattern = new RegExp(`\\b${variableName}\\b`, 'g');
        const usages = [];
        let match;
        
        while ((match = usagePattern.exec(source)) !== null) {
            usages.push(match.index);
        }
        
        // Simple heuristic: if variable is used in limited scope, it can be more local
        const totalUsages = usages.length;
        const sourceLines = source.split('\n');
        
        // If variable is only used in a small section, suggest smaller scope
        const canBeMoreLocal = totalUsages > 1 && totalUsages < 5;
        
        return {
            usageCount: totalUsages,
            usagePositions: usages,
            canBeMoreLocal: canBeMoreLocal,
            confidence: canBeMoreLocal ? 0.7 : 0.3
        };
    }
    
    /**
     * Analyze existing global variables at startup
     * Purpose: Audit current global variable usage
     * Rule 6: Global analysis | Rule 4: ≤60 lines
     */
    analyzeExistingGlobals() {
        // Rule 5: Validate analysis capability
        if (window.Assert) {
            window.Assert.assertType(window, 'object', 'Window object required');
        }
        
        let globalCount = 0;
        const maxAnalysis = 100; // Rule 2: Bounded analysis
        
        // Analyze existing global properties
        for (const prop in window) {
            if (globalCount >= maxAnalysis) break;
            
            try {
                const descriptor = Object.getOwnPropertyDescriptor(window, prop);
                
                if (descriptor && descriptor.configurable !== false) {
                    const isConstant = descriptor.writable === false || 
                                     prop.toUpperCase() === prop;
                    
                    this.globalVariables.set(prop, {
                        type: isConstant ? 'constant' : 'variable',
                        declared: 0, // Pre-existing
                        justified: isConstant
                    });
                    
                    globalCount++;
                }
            } catch (error) {
                // Skip properties that can't be analyzed
                continue;
            }
        }
        
        console.log(`📊 Analyzed ${globalCount} existing global variables`);
    }
    
    /**
     * Record a scope violation with detailed information
     * Purpose: Track Rule 6 violations for reporting
     * Rule 6: Violation tracking | Rule 5: Input validation
     */
    recordScopeViolation(violationType, message, context) {
        // Rule 5: Validate violation data
        if (window.Assert) {
            window.Assert.assertType(violationType, 'string', 'Violation type required');
            window.Assert.assertType(message, 'string', 'Violation message required');
        }
        
        // Rule 2: Limit violation storage (prevent memory growth)
        if (this.violationCount >= this.maxViolations) {
            this.scopeViolations.shift(); // Remove oldest
            this.violationCount--;
        }
        
        // Create violation record
        const violation = {
            type: violationType,
            message: message,
            context: context,
            timestamp: Date.now(),
            severity: this.getViolationSeverity(violationType)
        };
        
        // Store violation
        this.scopeViolations.push(violation);
        this.violationCount++;
        
        // Log violation
        console.warn(`⚠️ ${violationType}: ${message}`);
        
        // Call violation handler if available
        if (window.rulesEnforcer && window.rulesEnforcer.recordViolation) {
            window.rulesEnforcer.recordViolation(violationType, message, context);
        }
    }
    
    /**
     * Get violation severity for Rule 6 violations
     * Purpose: Categorize scope violations by impact
     * Rule 5: Input validation | Rule 6: Severity classification
     */
    getViolationSeverity(violationType) {
        // Rule 5: Validate input
        if (window.Assert) {
            window.Assert.assertType(violationType, 'string', 'Violation type required');
        }
        
        const severityMap = {
            'RULE_6_GLOBAL_LIMIT': 'HIGH',
            'RULE_6_SCOPE_VIOLATION': 'MEDIUM',
            'RULE_6_UNJUSTIFIED_GLOBAL': 'LOW'
        };
        
        return severityMap[violationType] || 'MEDIUM';
    }
    
    /**
     * Generate function identifier for tracking
     * Purpose: Create unique identifier for function scope tracking
     * Rule 5: ID generation validation | Rule 4: ≤60 lines
     */
    getFunctionIdentifier(func) {
        // Rule 5: Validate function
        if (window.Assert) {
            window.Assert.assertType(func, 'function', 'Function required');
        }
        
        try {
            // Try to get function name
            const name = func.name || 'anonymous';
            const source = func.toString();
            
            // Create hash-like identifier
            let hash = 0;
            for (let i = 0; i < Math.min(source.length, 100); i++) {
                hash = ((hash << 5) - hash + source.charCodeAt(i)) & 0xffffffff;
            }
            
            return `${name}_${Math.abs(hash).toString(16)}`;
            
        } catch (error) {
            return `unknown_${Date.now()}`;
        }
    }
    
    /**
     * Generate scope compliance report
     * Purpose: Provide detailed scope analysis results
     * Rule 6: Reporting | Rule 4: ≤60 lines
     */
    generateScopeReport() {
        // Rule 5: Validate report generation
        if (window.Assert) {
            window.Assert.assertType(this.globalVariables, 'object', 'Global variables data required');
        }
        
        const report = {
            timestamp: Date.now(),
            globalVariables: {
                total: this.globalVariables.size,
                constants: 0,
                variables: 0,
                limit: this.maxGlobalVars
            },
            violations: this.violationCount,
            functions: this.functionScopes.size,
            recommendations: this.generateScopeRecommendations()
        };
        
        // Count global variable types
        this.globalVariables.forEach(info => {
            if (info.type === 'constant') {
                report.globalVariables.constants++;
            } else {
                report.globalVariables.variables++;
            }
        });
        
        return report;
    }
    
    /**
     * Generate scope optimization recommendations
     * Purpose: Provide actionable scope improvement guidance
     * Rule 6: Recommendations | Rule 4: ≤60 lines
     */
    generateScopeRecommendations() {
        const recommendations = [];
        
        // Check global variable count
        const variableCount = Array.from(this.globalVariables.values())
            .filter(info => info.type === 'variable').length;
            
        if (variableCount > this.maxGlobalVars) {
            recommendations.push({
                rule: 'Rule 6',
                issue: `Too many global variables: ${variableCount}/${this.maxGlobalVars}`,
                suggestion: 'Move variables to smaller scope or convert to constants'
            });
        }
        
        // Analyze scope violations
        const scopeViolations = this.scopeViolations.filter(v => 
            v.type === 'RULE_6_SCOPE_VIOLATION');
            
        if (scopeViolations.length > 0) {
            recommendations.push({
                rule: 'Rule 6',
                issue: `${scopeViolations.length} variables could have smaller scope`,
                suggestion: 'Move variable declarations closer to their usage'
            });
        }
        
        return recommendations;
    }
}

// Export for global access
window.ScopeAnalyzer = ScopeAnalyzer;

console.log('✅ ScopeAnalyzer module loaded');
