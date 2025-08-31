/**
 * init.js - Rules system initialization  
 * Purpose: Initialize all rule enforcement components with performance optimization
 * Rule 4: ≤60 lines per function | Rule 5: Proper initialization sequence
 * @version 2.0.1
 */

console.log('🚀 Starting rules system v2.0.1...');

// Disable old rules system to prevent conflicts
if (typeof initializeRulesEnforcement !== 'undefined') {
    console.log('🚫 Disabling old RulesEnforcer to prevent conflicts');
    window.initializeRulesEnforcement = () => {
        console.log('⚠️ Old RulesEnforcer disabled - using OptimizedRulesEnforcer v2.0');
        return false;
    };
}

/**
 * Safe execution wrapper for initialization
 * Purpose: Handle initialization errors gracefully
 * Rule 5: Error validation | Rule 4: ≤60 lines
 */
function safeInit(initFunction, componentName) {
    try {
        const result = initFunction();
        console.log(`✅ ${componentName} initialized successfully`);
        return result;
    } catch (error) {
        console.error(`❌ ${componentName} initialization failed:`, error.message);
        return false;
    }
}

/**
 * Initialize optimized rules system components in dependency order
 * Purpose: Ensure all components load in correct sequence with performance optimization
 * Rule 5: Dependency validation | Rule 2: Bounded initialization
 */
function initializeOptimizedRulesSystem() {
    console.log('🚀 Initializing Optimized Rules System...');
    
    const results = {
        assert: false,
        boundedUtilities: false,
        performanceManager: false,
        scopeAnalyzer: false,
        optimizedEnforcer: false,
        total: 0,
        success: 0
    };
    
    // Rule 2: Fixed initialization sequence (bounded)
    const initSequence = [
        { 
            name: 'Assert', 
            check: () => typeof Assert !== 'undefined',
            init: () => true 
        },
        { 
            name: 'BoundedUtilities', 
            check: () => typeof BoundedUtilities !== 'undefined',
            init: () => true 
        },
        { 
            name: 'PerformanceManager', 
            check: () => typeof window.PerformanceManager !== 'undefined',
            init: () => typeof window.PerformanceManager !== 'undefined'
        },
        { 
            name: 'ScopeAnalyzer', 
            check: () => typeof window.ScopeAnalyzer !== 'undefined',
            init: () => typeof window.ScopeAnalyzer !== 'undefined'
        },
        { 
            name: 'OptimizedEnforcer', 
            check: () => typeof window.optimizedRulesEnforcer !== 'undefined' && window.optimizedRulesEnforcer !== null,
            init: () => {
                if (typeof initializeOptimizedRulesEnforcement === 'function') {
                    return initializeOptimizedRulesEnforcement();
                }
                return window.optimizedRulesEnforcer !== null;
            }
        }
    ];
    
    // Execute initialization sequence
    initSequence.forEach(component => {
        results.total++;
        
        if (component.check()) {
            console.log(`✅ ${component.name} already available`);
            results[component.name.toLowerCase().replace('optimized', '').replace('enforcer', 'optimizedEnforcer')] = true;
            results.success++;
        } else {
            const success = safeInit(component.init, component.name);
            results[component.name.toLowerCase().replace('optimized', '').replace('enforcer', 'optimizedEnforcer')] = success;
            if (success) results.success++;
        }
    });
    
    // Summary
    const successRate = Math.round((results.success / results.total) * 100);
    console.log(`📊 Optimized Rules System Initialization Complete: ${results.success}/${results.total} (${successRate}%)`);
    
    if (successRate >= 80) {
        console.log('🎉 Optimized rules components initialized successfully');
        setupPerformanceMonitoring();
        addOptimizedStatusIndicator();
        createOptimizedRulesAPI();
        return true;
    } else {
        console.error('❌ Optimized rules system initialization failed');
        return false;
    }
}

/**
 * Setup performance monitoring system
 * Purpose: Initialize performance tracking and optimization
 * Rule 4: ≤60 lines | Rule 5: Performance validation
 */
function setupPerformanceMonitoring() {
    // Rule 5: Validate performance components
    if (!window.optimizedRulesEnforcer) {
        console.warn('⚠️ OptimizedRulesEnforcer not available for performance monitoring');
        return false;
    }
    
    try {
        // Setup global error handling for optimized rule violations
        window.addEventListener('error', handleOptimizedRuleViolation);
        window.addEventListener('unhandledrejection', handleOptimizedAsyncRuleViolation);
        
        // Setup periodic performance optimization
        setInterval(() => {
            if (window.optimizedRulesEnforcer && window.optimizedRulesEnforcer.performanceManager) {
                window.optimizedRulesEnforcer.performanceManager.optimizeMemory();
            }
        }, 60000); // Every minute
        
        console.log('✅ Performance monitoring active');
        return true;
        
    } catch (error) {
        console.error('❌ Failed to setup performance monitoring:', error.message);
        return false;
    }
}

/**
 * Handle optimized rule violations from errors
 * Purpose: Process and log rule violations with performance optimization
 * Rule 4: ≤60 lines | Rule 5: Error validation
 */
function handleOptimizedRuleViolation(event) {
    // Rule 5: Validate error event
    if (!event || typeof event !== 'object' || !event.message) {
        return;
    }
    
    // Check if this is a rule-related error
    const message = event.message.toString();
    const isRuleViolation = message.includes('RULE_') ||
                           message.includes('violation') ||
                           message.includes('bound exceeded') ||
                           message.includes('compliance error');
    
    if (isRuleViolation && window.optimizedRulesEnforcer) {
        window.optimizedRulesEnforcer.recordViolation({
            type: 'ERROR_VIOLATION',
            message: message,
            severity: 'MEDIUM',
            context: { filename: event.filename, line: event.lineno }
        });
    }
}

/**
 * Handle async optimized rule violations
 * Purpose: Process unhandled promise rejections for rule violations
 * Rule 4: ≤60 lines | Rule 5: Promise validation
 */
function handleOptimizedAsyncRuleViolation(event) {
    // Rule 5: Validate promise rejection event
    if (!event || typeof event !== 'object' || !event.reason) {
        return;
    }
    
    const reason = event.reason.toString();
    const isRuleViolation = reason.includes('RULE_') ||
                           reason.includes('violation') ||
                           reason.includes('bound exceeded');
    
    if (isRuleViolation && window.optimizedRulesEnforcer) {
        window.optimizedRulesEnforcer.recordViolation({
            type: 'ASYNC_VIOLATION',
            message: reason,
            severity: 'MEDIUM',
            context: { source: 'async' }
        });
    }
}

/**
 * Add optimized visual status indicator
 * Purpose: Show system status with performance information
 * Rule 4: ≤60 lines | Rule 5: DOM validation
 */
function addOptimizedStatusIndicator() {
    // Rule 5: Validate DOM availability
    if (!document || !document.body) {
        console.warn('⚠️ DOM not available for status indicator');
        return;
    }
    
    if (document.getElementById('optimized-rules-status')) {
        console.log('Optimized status indicator already exists');
        return;
    }
    
    try {
        // Create optimized status indicator
        const indicator = document.createElement('div');
        indicator.id = 'optimized-rules-status';
        
        // Get performance mode
        const performanceMode = window.optimizedRulesEnforcer?.config?.performance?.mode || 'unknown';
        indicator.innerHTML = `⚡ Rules v2.0 (${performanceMode})`;
        
        // Rule 3: Pre-defined styles (no dynamic allocation)
        indicator.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: rgba(40, 40, 40, 0.9);
            color: #00E676;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-family: 'Courier New', monospace;
            z-index: 9999;
            opacity: 0.8;
            cursor: pointer;
            border: 1px solid rgba(0, 230, 118, 0.4);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            transition: opacity 0.3s ease;
        `;
        
        // Add click handler to show optimized compliance report
        indicator.addEventListener('click', showOptimizedComplianceReport);
        
        // Hover effects
        indicator.addEventListener('mouseenter', () => indicator.style.opacity = '1');
        indicator.addEventListener('mouseleave', () => indicator.style.opacity = '0.8');
        
        document.body.appendChild(indicator);
        
        // Fade out after 5 seconds
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.style.opacity = '0.5';
            }
        }, 5000);
        
    } catch (error) {
        console.warn('⚠️ Failed to add optimized status indicator:', error.message);
    }
}

/**
 * Show optimized compliance report
 * Purpose: Display current system compliance status with performance metrics
 * Rule 4: ≤60 lines | Rule 5: System validation
 */
function showOptimizedComplianceReport() {
    // Rule 5: Validate system components
    if (!window.optimizedRulesEnforcer) {
        console.warn('⚠️ Optimized rules system not initialized');
        return;
    }
    
    console.group('⚡ Optimized Rules Compliance Report v2.0');
    
    try {
        // Generate comprehensive report
        const report = window.optimizedRulesEnforcer.generateReport();
        
        console.log(`📊 System Version: ${report.version}`);
        console.log(`⚡ Performance Mode: ${report.performance.mode}`);
        console.log(`🔧 Runtime Monitoring: ${report.performance.runtimeMonitoring ? 'Enabled' : 'Disabled'}`);
        console.log(`🧠 Memory Tracking: ${report.performance.memoryTracking ? 'Enabled' : 'Disabled'}`);
        console.log(`🚨 Total Violations: ${report.violations}`);
        console.log(`📝 Functions Monitored: ${report.functions}`);
        console.log(`🔁 Active Loops: ${report.loops}`);
        
        // Memory information
        if (report.performance.memory) {
            console.log(`💾 Memory Used: ${report.performance.memory.used}MB`);
            console.log(`💾 Memory Total: ${report.performance.memory.total}MB`);
        }
        
        // Scope analysis
        if (report.scope) {
            console.log(`🌍 Global Variables: ${report.scope.globalVariables.variables}/${report.scope.globalVariables.limit}`);
            console.log(`📊 Scope Violations: ${report.scope.violations}`);
        }
        
        console.log(`⏰ Timestamp: ${new Date(report.timestamp).toISOString()}`);
        
    } catch (error) {
        console.error('❌ Failed to generate optimized report:', error.message);
    }
    
    console.groupEnd();
}

/**
 * Create optimized Rules API
 * Purpose: Provide external access to optimized rules system
 * Rule 4: ≤60 lines | Rule 5: API validation
 */
function createOptimizedRulesAPI() {
    // Rule 5: Validate window object
    if (typeof window === 'undefined') {
        console.error('❌ Cannot create API - window not available');
        return;
    }
    
    // Rule 3: Pre-allocated API object with performance features
    window.OptimizedRules = {
        version: '2.0.1',
        initialized: () => !!(window.optimizedRulesEnforcer),
        showReport: showOptimizedComplianceReport,
        setPerformanceMode: (mode) => {
            if (window.optimizedRulesEnforcer) {
                return window.optimizedRulesEnforcer.setPerformanceMode(mode);
            }
            return false;
        },
        getPerformanceStats: () => {
            if (window.optimizedRulesEnforcer) {
                return window.optimizedRulesEnforcer.generateReport();
            }
            return null;
        },
        getStatus: () => ({
            initialized: !!(window.optimizedRulesEnforcer),
            performanceManagerLoaded: typeof window.PerformanceManager !== 'undefined',
            scopeAnalyzerLoaded: typeof window.ScopeAnalyzer !== 'undefined',
            enforcerActive: !!(window.optimizedRulesEnforcer),
            mode: window.optimizedRulesEnforcer?.config?.performance?.mode || 'unknown'
        })
    };
    
    // Backward compatibility
    window.Rules = window.OptimizedRules;
    
    console.log('✅ Optimized Rules API created');
}

// Initialize immediately if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeOptimizedRulesSystem);
} else {
    // DOM already ready - initialize with small delay to ensure scripts loaded
    setTimeout(initializeOptimizedRulesSystem, 100);
}

console.log('✅ Optimized rules initialization system loaded');
