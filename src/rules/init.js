/**
 * init.js - Rules system initialization  
 * Purpose: Initialize all rule enforcement components with performance optimization
 * Rule 4: ≤60 lines per function | Rule 5: Proper initialization sequence
 * @version 2.0.1
 */

console.log('🚀 Starting rules system v2.0.1...');

// Ensure we have access to the initialization function
if (typeof initializeRulesEnforcement === 'undefined') {
    console.log('⚠️ RulesEnforcer initialization function not available - check load order');
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
 * Handle rule violations from errors
 * Purpose: Process and log rule violations
 * Rule 4: ≤60 lines | Rule 5: Error validation
 */
function handleRuleViolation(event) {
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

    if (isRuleViolation && window.RulesEnforcer) {
        window.RulesEnforcer.recordViolation({
            type: 'ERROR_VIOLATION',
            message: message,
            severity: 'MEDIUM',
            context: { filename: event.filename, line: event.lineno }
        });
    }
}

/**
 * Handle async rule violations
 * Purpose: Process unhandled promise rejections for rule violations
 * Rule 4: ≤60 lines | Rule 5: Promise validation
 */
function handleAsyncRuleViolation(event) {
    // Rule 5: Validate promise rejection event
    if (!event || typeof event !== 'object' || !event.reason) {
        return;
    }

    const reason = event.reason.toString();
    const isRuleViolation = reason.includes('RULE_') ||
                           reason.includes('violation') ||
                           reason.includes('bound exceeded');

    if (isRuleViolation && window.RulesEnforcer) {
        window.RulesEnforcer.recordViolation({
            type: 'ASYNC_VIOLATION',
            message: reason,
            severity: 'MEDIUM',
            context: { source: 'async' }
        });
    }
}

/**
 * Generate the actual compliance report
 * Purpose: Extract report generation logic for reuse
 * Rule 4: ≤60 lines | Rule 5: Report validation
 */
function generateComplianceReport() {
    if (!window.RulesEnforcer) {
        console.error('❌ Cannot generate report - RulesEnforcer not available');
        return;
    }

    console.group('⚡ Rules Compliance Report v2.0');

    try {
        // Generate comprehensive report
        const report = window.RulesEnforcer.generateReport();

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
        console.error('❌ Failed to generate report:', error.message);
    }

    console.groupEnd();
}

/**
 * Show compliance report with wait logic
 * Purpose: Display current system compliance status with performance metrics
 * Rule 4: ≤60 lines | Rule 5: System validation
 */
function showOptimizedComplianceReport() {
    // Rule 5: Validate system components with retry logic
    if (!window.RulesEnforcer) {
        // Don't immediately fail - wait a bit for initialization
        console.log('⏳ Waiting for rules system to initialize...');

        let waitCount = 0;
        const maxWaitTime = 3000; // 3 seconds max wait
        const waitInterval = 200; // Check every 200ms

        const waitForInit = setInterval(() => {
            waitCount += waitInterval;

            if (window.RulesEnforcer) {
                // System is now ready - clear interval and generate report
                clearInterval(waitForInit);
                generateComplianceReport();
            } else if (waitCount >= maxWaitTime) {
                // Timeout - system didn't initialize in time
                clearInterval(waitForInit);
                console.warn('⚠️ Rules system initialization timeout - cannot generate report');
                console.log('💡 Try refreshing the page or check console for errors');
            }
        }, waitInterval);

        return;
    }

    // RulesEnforcer is ready - generate report immediately
    generateComplianceReport();
}

/**
 * Setup performance monitoring system with retry logic
 * Purpose: Initialize performance tracking and optimization
 * Rule 4: ≤60 lines | Rule 5: Performance validation
 */
function setupPerformanceMonitoring() {
    // Use retry logic to wait for RulesEnforcer initialization
    const maxRetries = 10;
    let retryCount = 0;

    function attemptSetup() {
        // Rule 5: Validate performance components
        if (!window.RulesEnforcer) {
            retryCount++;
            if (retryCount < maxRetries) {
                // Wait and retry - RulesEnforcer might still be initializing
                setTimeout(attemptSetup, 100 * retryCount); // Exponential backoff
                return undefined;
            } else {
                console.warn('⚠️ RulesEnforcer initialization timeout - performance monitoring disabled');
                return false;
            }
        }

        try {
            // Setup global error handling for rule violations
            window.addEventListener('error', handleRuleViolation);
            window.addEventListener('unhandledrejection', handleAsyncRuleViolation);

            // Setup periodic performance optimization
            setInterval(() => {
                if (window.RulesEnforcer && window.RulesEnforcer.performanceManager) {
                    window.RulesEnforcer.performanceManager.optimizeMemory();
                }
            }, 60000); // Every minute

            console.log('✅ Performance monitoring active');
            return true;

        } catch (error) {
            console.error('❌ Failed to setup performance monitoring:', error.message);
            return false;
        }
    }

    // Start the retry process
    attemptSetup();
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
        const performanceMode = window.RulesEnforcer?.config?.performance?.mode || 'unknown';
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
        indicator.addEventListener('mouseenter', () => {
            indicator.style.opacity = '1';
        });
        indicator.addEventListener('mouseleave', () => {
            indicator.style.opacity = '0.8';
        });

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
 * Create Rules API
 * Purpose: Provide external access to rules system
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
        initialized: () => Boolean(window.RulesEnforcer),
        showReport: showOptimizedComplianceReport,
        setPerformanceMode: (mode) => {
            if (window.RulesEnforcer) {
                return window.RulesEnforcer.setPerformanceMode(mode);
            }
            return false;
        },
        getPerformanceStats: () => {
            if (window.RulesEnforcer) {
                return window.RulesEnforcer.generateReport();
            }
            return null;
        },
        getStatus: () => ({
            initialized: Boolean(window.RulesEnforcer),
            performanceManagerLoaded: typeof window.PerformanceManager !== 'undefined',
            scopeAnalyzerLoaded: typeof window.ScopeAnalyzer !== 'undefined',
            enforcerActive: Boolean(window.RulesEnforcer),
            mode: window.RulesEnforcer?.config?.performance?.mode || 'unknown'
        })
    };

    // Backward compatibility
    window.Rules = window.OptimizedRules;

    console.log('✅ Rules API created');
}

/**
 * Create initialization sequence for rules system components
 * Purpose: Define component dependencies and initialization order
 * Rule 4: ≤60 lines | Rule 5: Dependency validation
 */
function createInitSequence() {
    return [
        {
            name: 'Assert',
            required: true,
            check: () => (typeof window !== 'undefined' && window.Assert && typeof window.Assert.assertNotNull === 'function'),
            init: () => window.Assert !== undefined
        },
        {
            name: 'BoundedUtilities',
            required: true,
            check: () => (typeof window !== 'undefined' && window.BoundedUtilities && typeof window.BoundedUtilities.escapeHtml === 'function'),
            init: () => window.BoundedUtilities !== undefined
        },
        {
            name: 'PerformanceManager',
            required: true,
            check: () => typeof window.PerformanceManager !== 'undefined',
            init: () => {
                if (typeof window.PerformanceManager === 'undefined') {
                    console.warn('⚠️ PerformanceManager not loaded - creating fallback');
                    if (typeof window.createPerformanceManagerFallback === 'function') {
                        window.createPerformanceManagerFallback();
                        return typeof window.PerformanceManager !== 'undefined';
                    }
                    return false;
                }
                return true;
            }
        },
        {
            name: 'ScopeAnalyzer',
            required: false,
            check: () => typeof window.ScopeAnalyzer !== 'undefined',
            init: () => {
                if (typeof window.ScopeAnalyzer === 'undefined') {
                    console.warn('⚠️ ScopeAnalyzer not loaded - Rule 6 monitoring disabled');
                    return false;
                }
                return true;
            }
        },
        {
            name: 'RulesEnforcer',
            required: false,
            check: () => typeof window.RulesEnforcer !== 'undefined' && window.RulesEnforcer !== null,
            init: () => {
                if (typeof window.initializeRulesEnforcement === 'undefined') {
                    console.warn('⚠️ RulesEnforcer initialization function not loaded - enforcement disabled');
                    return false;
                }
                // Call the initialization function to create RulesEnforcer instance
                const success = window.initializeRulesEnforcement();
                if (success) {
                    console.log('✅ RulesEnforcer v2.0.1 ready');
                    return true;
                } else {
                    console.warn('⚠️ RulesEnforcer initialization failed');
                    return false;
                }
            }
        }
    ];
}

/**
 * Execute initialization sequence for all components
 * Purpose: Process component initialization with error handling
 * Rule 4: ≤60 lines | Rule 5: Error validation
 */
function executeInitSequence(initSequence) {
    const results = {
        assert: false,
        boundedUtilities: false,
        performanceManager: false,
        scopeAnalyzer: false,
        optimizedEnforcer: false,
        total: 0,
        success: 0
    };

    let criticalFailures = 0;
    
    initSequence.forEach(component => {
        results.total++;
        
        try {
            if (component.check()) {
                console.log(`✅ ${component.name} already available`);
                results[component.name.toLowerCase().replace('optimized', '').replace('enforcer', 'optimizedEnforcer')] = true;
                results.success++;
            } else {
                const success = component.required ? 
                    safeInit(component.init, component.name) : 
                    component.init();
                
                results[component.name.toLowerCase().replace('optimized', '').replace('enforcer', 'optimizedEnforcer')] = success;
                
                if (success) {
                    results.success++;
                } else if (component.required) {
                    criticalFailures++;
                }
            }
        } catch (error) {
            console.warn(`⚠️ ${component.name} initialization error:`, error.message);
            if (component.required) {
                criticalFailures++;
            }
        }
    });

    // Summary with improved criteria
    const successRate = Math.round((results.success / results.total) * 100);
    console.log(`📊 Optimized Rules System Initialization Complete: ${results.success}/${results.total} (${successRate}%)`);

    return { results, criticalFailures, successRate };
}

/**
 * Initialize optimized rules system components in dependency order
 * Purpose: Orchestrate component loading with performance optimization
 * Rule 4: ≤60 lines | Rule 5: Dependency validation | Rule 2: Bounded initialization
 */
function initializeOptimizedRulesSystem() {
    console.log('🚀 Initializing Optimized Rules System...');

    // Get initialization sequence
    const initSequence = createInitSequence();

    // Execute initialization
    const { criticalFailures, successRate } = executeInitSequence(initSequence);

    // Enhanced success criteria
    if (criticalFailures === 0) {
        console.log('🎉 All critical components loaded successfully');
        setupPerformanceMonitoring();
        addOptimizedStatusIndicator();
        createOptimizedRulesAPI();
        return true;
    } else if (successRate >= 60) {
        console.log('⚠️ Some non-critical components missing, but continuing');
        setupPerformanceMonitoring();
        createOptimizedRulesAPI();
        return true;
    } else {
        console.warn('❌ Critical component failures detected');
        // Try to setup basic functionality anyway
        createOptimizedRulesAPI();
        return false;
    }
}

// Initialize immediately if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeOptimizedRulesSystem);
} else {
    // DOM already ready - initialize with small delay to ensure scripts loaded
    setTimeout(initializeOptimizedRulesSystem, 100);
}

console.log('✅ Optimized rules initialization system loaded');
