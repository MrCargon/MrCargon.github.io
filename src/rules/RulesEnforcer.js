/**
 * RulesEnforcer.js - Rule compliance system  
 * Purpose: Lightweight rule enforcement with minimal runtime overhead
 * Performance: overhead reduction vs original implementation
 * @version 2.0.1
 */

// Use centralized Assert system (loaded via Assert.js)

/**
 * RulesEnforcer - Lightweight rule compliance monitoring
 * Purpose: Enforce safety-critical Ten Rules with minimal performance impact
 * Rule 4: ≤60 lines per method | Rule 3: Fixed memory allocation
 */
class RulesEnforcer {
    /**
     * Initialize enforcement system
     * Purpose: Setup high-performance rule monitoring
     * Rule 3: Pre-allocated structures | Rule 5: Validation
     */
    constructor(config = {}) {
        // Rule 5: Validate configuration
        if (window.Assert) {
            window.Assert.assertType(config, 'object', 'Configuration object required');
        }
        
        // Load configuration from rules-config.json or use defaults
        this.config = this.loadConfiguration(config);
        
        // Rule 3: Pre-allocated performance structures
        this.performanceManager = new window.PerformanceManager(this.config.performance);
        this.scopeAnalyzer = this.config.performance.mode !== 'off' ? 
            new window.ScopeAnalyzer(this.config.rules.rule6) : null;
        
        // Rule 2: Bounded monitoring structures
        this.functionRegistry = new Map(); // Limit: 200 functions
        this.loopCounters = new Map(); // Active loop tracking
        this.violationCount = 0;
        
        // Performance optimization flags
        this.isMonitoringActive = this.performanceManager.enableRuntimeMonitoring;
        
        // Initialize selective monitoring
        if (this.isMonitoringActive) {
            this.initializeMonitoring();
        }
        
        console.log(`✅ RulesEnforcer v2.0.1 - ${this.config.performance.mode} mode`);
    }
    
    /**
     * Load and validate configuration
     * Purpose: Setup configuration with performance optimizations
     * Rule 5: Configuration validation | Rule 4: ≤60 lines
     */
    loadConfiguration(userConfig) {
        // Default high-performance configuration
        const defaultConfig = {
            rules: {
                rule6: { maxGlobalVars: 5, maxViolations: 50 }
            },
            performance: {
                mode: 'development',
                enableRuntimeMonitoring: true,
                enableMemoryTracking: true,
                maxViolationBuffer: 50,
                batchSize: 10,
                monitoringThreshold: 10
            }
        };
        
        // Merge with user configuration
        return this.deepMerge(defaultConfig, userConfig);
    }
    
    /**
     * Deep merge configuration objects
     * Purpose: Combine default and user configurations
     * Rule 2: Bounded merge depth | Rule 4: ≤60 lines
     */
    deepMerge(defaults, overrides) {
        const result = { ...defaults };
        
        Object.keys(overrides).forEach(key => {
            if (overrides[key] && typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
                result[key] = this.deepMerge(defaults[key] || {}, overrides[key]);
            } else {
                result[key] = overrides[key];
            }
        });
        
        return result;
    }
    
    /**
     * Initialize selective monitoring systems
     * Purpose: Setup monitoring with performance optimization
     * Rule 2: Selective activation | Rule 4: ≤60 lines
     */
    initializeMonitoring() {
        try {
            // Setup function monitoring (Rule 4: 60-line limit)
            this.setupFunctionMonitoring();
            
            // Setup loop monitoring (Rule 2: Fixed bounds)
            this.setupLoopMonitoring();
            
            // Memory optimization timer
            this.setupMemoryOptimization();
            
            console.log('📊 Selective monitoring initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize monitoring:', error.message);
            this.isMonitoringActive = false;
        }
    }
    
    /**
     * Setup lightweight function monitoring
     * Purpose: Monitor only functions above size threshold
     * Rule 4: Function length limits | Rule 2: Selective monitoring
     */
    setupFunctionMonitoring() {
        if (!this.isMonitoringActive) return;
        
        const enforcer = this;
        const originalFunction = window.Function;
        
        // Lightweight function wrapper with threshold checking
        window.Function = function(...args) {
            const func = originalFunction.apply(this, args);
            
            // Only monitor if performance manager says to (threshold-based)
            if (enforcer.performanceManager.shouldMonitor(func)) {
                enforcer.registerFunction(func);
            }
            
            return func;
        };
        
        console.log('⚡ Lightweight function monitoring active');
    }
    
    /**
     * Register function for monitoring with performance optimization
     * Purpose: Efficient function registration with Rule 4 checking
     * Rule 4: 60-line limit | Rule 2: Bounded registry size
     */
    registerFunction(func) {
        // Rule 2: Limit function registry size to prevent memory growth
        if (this.functionRegistry.size >= 200) {
            // Remove oldest entries (LRU-style)
            const oldestKey = this.functionRegistry.keys().next().value;
            this.functionRegistry.delete(oldestKey);
        }
        
        try {
            const source = func.toString();
            const lineCount = (source.match(/\n/g) || []).length + 1;
            
            // Rule 4: Check 60-line limit
            if (lineCount > 60) {
                this.recordViolation({
                    type: 'RULE_4_VIOLATION',
                    message: `Function exceeds 60 lines: ${lineCount}`,
                    severity: 'MEDIUM',
                    context: { lineCount, limit: 60 }
                });
            }
            
            // Store in registry with minimal data
            this.functionRegistry.set(func, {
                lines: lineCount,
                registered: Date.now()
            });
            
        } catch (error) {
            console.debug('Function registration failed:', error.message);
        }
    }
    
    /**
     * Setup loop monitoring
     * Purpose: Track loop bounds with minimal overhead
     * Rule 2: Fixed upper bounds | Rule 4: ≤60 lines
     */
    setupLoopMonitoring() {
        if (!this.isMonitoringActive) return;
        
        // Lightweight loop counter with automatic cleanup
        this.loopCleanupInterval = setInterval(() => {
            this.cleanupLoopCounters();
        }, 5000); // Clean every 5 seconds
        
        console.log('🔁 loop monitoring active');
    }
    
    /**
     * Setup memory optimization system
     * Purpose: Periodic memory cleanup and optimization
     * Rule 3: Memory management | Rule 2: Bounded intervals
     */
    setupMemoryOptimization() {
        if (this.config.performance.mode === 'off') return;
        
        // Periodic memory optimization
        this.memoryOptimizationInterval = setInterval(() => {
            this.performanceManager.optimizeMemory();
            this.cleanupFunctionRegistry();
        }, 30000); // Every 30 seconds
        
        console.log('🧠 Memory optimization active');
    }
    
    /**
     * Register loop with bounds checking
     * Purpose: Public API for loop registration
     * Rule 2: Fixed bounds | Rule 5: Input validation
     */
    registerLoop(loopId, maxIterations = 1000) {
        if (!this.isMonitoringActive) return loopId;
        
        // Rule 5: Validate loop parameters
        if (window.Assert) {
            window.Assert.assertType(loopId, 'string', 'Loop ID required');
            window.Assert.assertType(maxIterations, 'number', 'Max iterations must be number');
        }
        
        this.loopCounters.set(loopId, {
            iterations: 0,
            maxIterations: maxIterations,
            startTime: Date.now()
        });
        
        return loopId;
    }
    
    /**
     * Check loop iteration with performance optimization
     * Purpose: Efficient loop bounds checking
     * Rule 2: Bounds verification | Rule 4: ≤60 lines
     */
    checkLoopIteration(loopId) {
        if (!this.isMonitoringActive || !this.loopCounters.has(loopId)) {
            return true; // Allow if monitoring disabled or unregistered
        }
        
        const loopData = this.loopCounters.get(loopId);
        loopData.iterations++;
        
        // Rule 2: Check iteration bounds
        if (loopData.iterations > loopData.maxIterations) {
            this.recordViolation({
                type: 'RULE_2_VIOLATION',
                message: `Loop exceeded bounds: ${loopData.iterations}/${loopData.maxIterations}`,
                severity: 'HIGH',
                context: { loopId, iterations: loopData.iterations, limit: loopData.maxIterations }
            });
            return false;
        }
        
        return true;
    }
    
    /**
     * Record violation with performance optimization
     * Purpose: Efficient violation recording
     * Rule 3: Fixed memory | Rule 5: Violation validation
     */
    recordViolation(violation) {
        if (this.config.performance.mode === 'off') return;
        
        // Rule 5: Validate violation
        if (window.Assert) {
            window.Assert.assertType(violation, 'object', 'Violation object required');
            window.Assert.assertType(violation.type, 'string', 'Violation type required');
            window.Assert.assertType(violation.message, 'string', 'Violation message required');
        }
        
        // Use performance manager for efficient storage
        this.performanceManager.recordViolation(violation);
        this.violationCount++;
        
        // Log based on severity (performance)
        if (violation.severity === 'HIGH') {
            console.error(`🚨 ${violation.type}: ${violation.message}`);
        } else if (this.config.performance.mode === 'development') {
            console.warn(`⚠️ ${violation.type}: ${violation.message}`);
        }
    }
    
    /**
     * Cleanup old loop counters
     * Purpose: Prevent memory growth from stale loop data
     * Rule 3: Memory management | Rule 2: Bounded cleanup
     */
    cleanupLoopCounters() {
        const now = Date.now();
        const maxAge = 60000; // 1 minute
        let cleaned = 0;
        
        // Rule 2: Bounded cleanup loop
        for (const [loopId, loopData] of this.loopCounters.entries()) {
            if (now - loopData.startTime > maxAge) {
                this.loopCounters.delete(loopId);
                cleaned++;
                if (cleaned >= 50) break; // Prevent excessive cleanup in one cycle
            }
        }
        
        if (cleaned > 0) {
            console.debug(`🧹 Cleaned ${cleaned} old loop counters`);
        }
    }
    
    /**
     * Cleanup old function registry entries
     * Purpose: Manage function registry memory usage
     * Rule 3: Memory management | Rule 2: Bounded cleanup
     */
    cleanupFunctionRegistry() {
        if (this.functionRegistry.size <= 150) return; // Only cleanup when approaching limit
        
        const now = Date.now();
        const maxAge = 300000; // 5 minutes
        let cleaned = 0;
        
        // Rule 2: Bounded cleanup
        for (const [func, data] of this.functionRegistry.entries()) {
            if (now - data.registered > maxAge) {
                this.functionRegistry.delete(func);
                cleaned++;
                if (cleaned >= 50) break;
            }
        }
        
        if (cleaned > 0) {
            console.debug(`🧹 Cleaned ${cleaned} old function entries`);
        }
    }
    
    /**
     * Generate compliance report with performance optimization
     * Purpose: Efficient reporting system
     * Rule 4: ≤60 lines | Rule 2: Bounded processing
     */
    generateReport() {
        const report = {
            timestamp: Date.now(),
            version: '2.0.1',
            performance: this.performanceManager.getPerformanceStats(),
            violations: this.violationCount,
            functions: this.functionRegistry.size,
            loops: this.loopCounters.size,
            scope: this.scopeAnalyzer ? this.scopeAnalyzer.generateScopeReport() : null
        };
        
        console.log('📊 Performance compliance report generated');
        return report;
    }
    
    /**
     * Set performance mode dynamically
     * Purpose: Runtime performance mode switching
     * Rule 5: Mode validation | Rule 4: ≤60 lines
     */
    setPerformanceMode(mode) {
        if (this.performanceManager.setPerformanceMode(mode)) {
            this.config.performance.mode = mode;
            this.isMonitoringActive = this.performanceManager.enableRuntimeMonitoring;
            
            // Reinitialize monitoring based on new mode
            if (mode === 'off') {
                this.shutdownMonitoring();
            } else if (!this.isMonitoringActive) {
                this.initializeMonitoring();
            }
            
            return true;
        }
        return false;
    }
    
    /**
     * Shutdown monitoring systems
     * Purpose: Clean shutdown for performance optimization
     * Rule 3: Resource cleanup | Rule 4: ≤60 lines
     */
    shutdownMonitoring() {
        // Clear intervals
        if (this.loopCleanupInterval) {
            clearInterval(this.loopCleanupInterval);
            this.loopCleanupInterval = null;
        }
        
        if (this.memoryOptimizationInterval) {
            clearInterval(this.memoryOptimizationInterval);
            this.memoryOptimizationInterval = null;
        }
        
        // Clear data structures
        this.functionRegistry.clear();
        this.loopCounters.clear();
        
        console.log('🛑 Monitoring systems shutdown');
    }
    
    /**
     * Cleanup resources on destruction
     * Purpose: Proper resource cleanup
     * Rule 3: Memory management
     */
    destroy() {
        this.shutdownMonitoring();
        
        if (this.performanceManager) {
            this.performanceManager.optimizeMemory();
        }
        
        console.log('🗑️ RulesEnforcer destroyed');
    }
}

// Global instance management
window.RulesEnforcer = null;

/**
 * Initialize rules enforcement system
 * Purpose: Setup global rule monitoring
 * Rule 4: ≤60 lines | Rule 5: System validation
 */
function initializeRulesEnforcement(config = {}) {
    try {
        // Check for required dependencies
        if (typeof window.PerformanceManager === 'undefined') {
            console.error('❌ PerformanceManager required for enforcement');
            return false;
        }
        
        if (typeof window.ScopeAnalyzer === 'undefined') {
            console.warn('⚠️ ScopeAnalyzer not available, Rule 6 disabled');
        }
        
        // Create enforcer instance
        window.RulesEnforcer = new RulesEnforcer(config);
        
        console.log('✅ rules enforcement system active');
        return true;
        
    } catch (error) {
        console.error('❌ Failed to initialize  rules enforcement:', error.message);
        return false;
    }
}

/**
 * Create minimal PerformanceManager fallback
 * Purpose: Ensure RulesEnforcer can function without full PerformanceManager
 * Rule 4: ≤60 lines | Rule 5: Fallback validation
 */
function createPerformanceManagerFallback() {
    // Only create fallback if truly missing
    if (typeof window.PerformanceManager === 'undefined') {
        // Minimal PerformanceManager implementation
        window.PerformanceManager = class FallbackPerformanceManager {
            constructor(config = {}) {
                this.mode = config.mode || 'development';
                this.enableRuntimeMonitoring = config.enableRuntimeMonitoring !== false;
                this.enableMemoryTracking = false; // Disabled in fallback
            }
            
            shouldMonitor() { return this.enableRuntimeMonitoring; }
            recordMetric() { /* No-op in fallback */ }
            recordViolation(violation) { 
                // Only log high-severity violations to reduce noise
                if (violation && violation.severity === 'HIGH') {
                    console.warn(`🚨 Rule Violation: ${violation.message}`);
                }
            }
            getPerformanceStats() { 
                return {
                    mode: this.mode,
                    runtimeMonitoring: this.enableRuntimeMonitoring,
                    memoryTracking: false,
                    violations: 0,
                    batchSize: 0,
                    metrics: 0
                };
            }
            optimizeMemory() { /* No-op in fallback */ }
            setPerformanceMode(mode) { 
                this.mode = mode; 
                return true; 
            }
        };
    }
}

// Export for use by init.js - no auto-initialization
window.createPerformanceManagerFallback = createPerformanceManagerFallback;

console.log('✅ RulesEnforcer system loaded');
