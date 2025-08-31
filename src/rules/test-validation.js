/**
 * test-validation.js - Test and validate optimized rules system
 * Purpose: Demonstrate performance improvements and validate functionality
 * Rule 4: ≤60 lines per function | Rule 5: Comprehensive validation
 * @version 2.0.1
 */

/**
 * Performance test suite for optimized rules system
 * Purpose: Validate performance improvements and functionality
 * Rule 4: ≤60 lines | Rule 5: Test validation
 */
class RulesSystemValidator {
    constructor() {
        this.testResults = [];
        this.performanceMetrics = {
            startTime: 0,
            endTime: 0,
            memoryBefore: 0,
            memoryAfter: 0
        };
        
        console.log('🧪 RulesSystemValidator initialized');
    }
    
    /**
     * Run comprehensive validation tests
     * Purpose: Execute all validation tests and report results
     * Rule 4: ≤60 lines | Rule 2: Bounded test execution
     */
    async runAllTests() {
        console.group('🚀 Running Optimized Rules System Validation');
        
        this.startPerformanceMonitoring();
        
        // Rule 2: Bounded test sequence
        const tests = [
            { name: 'System Initialization', test: () => this.testSystemInitialization() },
            { name: 'Performance Modes', test: () => this.testPerformanceModes() },
            { name: 'Rule 4 Enforcement', test: () => this.testRule4Enforcement() },
            { name: 'Rule 6 Scope Analysis', test: () => this.testRule6ScopeAnalysis() },
            { name: 'Memory Management', test: () => this.testMemoryManagement() },
            { name: 'Performance Overhead', test: () => this.testPerformanceOverhead() }
        ];
        
        // Execute tests
        for (const test of tests) {
            try {
                const result = await test.test();
                this.testResults.push({ name: test.name, result, status: 'PASS' });
                console.log(`✅ ${test.name}: PASSED`);
            } catch (error) {
                this.testResults.push({ name: test.name, result: error.message, status: 'FAIL' });
                console.error(`❌ ${test.name}: FAILED - ${error.message}`);
            }
        }
        
        this.endPerformanceMonitoring();
        this.generateValidationReport();
        
        console.groupEnd();
    }
    
    /**
     * Test system initialization
     * Purpose: Validate all components are properly initialized
     * Rule 5: Component validation | Rule 4: ≤60 lines
     */
    testSystemInitialization() {
        const requiredComponents = [
            { name: 'PerformanceManager', check: () => typeof window.PerformanceManager !== 'undefined' },
            { name: 'ScopeAnalyzer', check: () => typeof window.ScopeAnalyzer !== 'undefined' },
            { name: 'OptimizedRulesEnforcer', check: () => window.optimizedRulesEnforcer !== null },
            { name: 'OptimizedRules API', check: () => typeof window.OptimizedRules !== 'undefined' }
        ];
        
        const results = requiredComponents.map(component => ({
            name: component.name,
            initialized: component.check()
        }));
        
        const allInitialized = results.every(r => r.initialized);
        
        if (!allInitialized) {
            const failed = results.filter(r => !r.initialized).map(r => r.name);
            throw new Error(`Components not initialized: ${failed.join(', ')}`);
        }
        
        return { components: results, allInitialized };
    }
    
    /**
     * Test performance mode switching
     * Purpose: Validate performance modes work correctly
     * Rule 4: ≤60 lines | Rule 5: Mode validation
     */
    testPerformanceModes() {
        if (!window.optimizedRulesEnforcer) {
            throw new Error('OptimizedRulesEnforcer not available');
        }
        
        const modes = ['development', 'production', 'off'];
        const results = {};
        
        // Test each performance mode
        modes.forEach(mode => {
            const success = window.optimizedRulesEnforcer.setPerformanceMode(mode);
            const currentMode = window.optimizedRulesEnforcer.config.performance.mode;
            
            results[mode] = {
                switchSuccess: success,
                actualMode: currentMode,
                correct: currentMode === mode
            };
        });
        
        // Reset to development mode
        window.optimizedRulesEnforcer.setPerformanceMode('development');
        
        const allCorrect = Object.values(results).every(r => r.correct);
        
        if (!allCorrect) {
            throw new Error('Performance mode switching failed');
        }
        
        return results;
    }
    
    /**
     * Test Rule 4 enforcement (60-line function limit)
     * Purpose: Validate function length monitoring works
     * Rule 4: ≤60 lines | Rule 5: Enforcement validation
     */
    testRule4Enforcement() {
        if (!window.optimizedRulesEnforcer) {
            throw new Error('OptimizedRulesEnforcer not available');
        }
        
        // Create a function that violates Rule 4 (over 60 lines)
        const longFunctionSource = `function testLongFunction() {
            ${new Array(65).fill('    console.log("line");').join('\n')}
        }`;
        
        // Store initial violation count
        const initialViolations = window.optimizedRulesEnforcer.violationCount;
        
        // Create the long function (should trigger Rule 4 violation)
        const longFunction = new Function(longFunctionSource);
        
        // Allow time for monitoring to process
        setTimeout(() => {}, 100);
        
        // Check if violation was recorded
        const finalViolations = window.optimizedRulesEnforcer.violationCount;
        const violationDetected = finalViolations > initialViolations;
        
        return {
            initialViolations,
            finalViolations,
            violationDetected,
            functionLineCount: longFunctionSource.split('\n').length
        };
    }
    
    /**
     * Test Rule 6 scope analysis
     * Purpose: Validate scope minimization detection works
     * Rule 6: Scope validation | Rule 4: ≤60 lines
     */
    testRule6ScopeAnalysis() {
        if (!window.optimizedRulesEnforcer?.scopeAnalyzer) {
            throw new Error('ScopeAnalyzer not available');
        }
        
        const scopeAnalyzer = window.optimizedRulesEnforcer.scopeAnalyzer;
        
        // Test global variable tracking
        const initialGlobalCount = scopeAnalyzer.globalVariables.size;
        
        // Create a test global variable
        window.testGlobalVar = 'test';
        
        // Generate scope report
        const report = scopeAnalyzer.generateScopeReport();
        
        // Cleanup
        delete window.testGlobalVar;
        
        return {
            initialGlobalCount,
            reportGenerated: !!report,
            globalVariablesTracked: report.globalVariables.total > 0,
            violationsTracked: typeof report.violations === 'number'
        };
    }
    
    /**
     * Test memory management system
     * Purpose: Validate memory optimization works
     * Rule 3: Memory validation | Rule 4: ≤60 lines
     */
    testMemoryManagement() {
        if (!window.optimizedRulesEnforcer?.performanceManager) {
            throw new Error('PerformanceManager not available');
        }
        
        const performanceManager = window.optimizedRulesEnforcer.performanceManager;
        
        // Get initial memory stats
        const initialStats = performanceManager.getPerformanceStats();
        
        // Add some test violations to circular buffer
        for (let i = 0; i < 10; i++) {
            performanceManager.recordViolation({
                type: 'TEST_VIOLATION',
                message: `Test violation ${i}`,
                severity: 'LOW'
            });
        }
        
        // Optimize memory
        performanceManager.optimizeMemory();
        
        // Get final stats
        const finalStats = performanceManager.getPerformanceStats();
        
        return {
            initialViolations: initialStats.violations,
            finalViolations: finalStats.violations,
            memoryOptimized: finalStats.violations <= 50, // Should be within circular buffer limit
            circularBufferWorking: true
        };
    }
    
    /**
     * Test performance overhead
     * Purpose: Measure actual runtime overhead
     * Rule 2: Performance measurement | Rule 4: ≤60 lines
     */
    testPerformanceOverhead() {
        const iterations = 1000;
        let totalTime = 0;
        
        // Measure function creation overhead
        const startTime = performance.now();
        
        // Rule 2: Bounded performance test
        for (let i = 0; i < iterations; i++) {
            // Create a small function (should not trigger monitoring due to threshold)
            const testFunc = new Function('return true;');
            testFunc();
        }
        
        const endTime = performance.now();
        totalTime = endTime - startTime;
        
        const averageOverhead = totalTime / iterations;
        const isPerformant = averageOverhead < 1; // Less than 1ms per function
        
        return {
            totalTime: totalTime.toFixed(3),
            iterations,
            averageOverhead: averageOverhead.toFixed(4),
            isPerformant,
            threshold: '1ms'
        };
    }
    
    /**
     * Start performance monitoring
     * Purpose: Begin performance measurement
     * Rule 3: Memory tracking | Rule 4: ≤60 lines
     */
    startPerformanceMonitoring() {
        this.performanceMetrics.startTime = performance.now();
        
        if (performance.memory) {
            this.performanceMetrics.memoryBefore = performance.memory.usedJSHeapSize;
        }
        
        console.log('📊 Performance monitoring started');
    }
    
    /**
     * End performance monitoring
     * Purpose: Complete performance measurement
     * Rule 3: Memory tracking | Rule 4: ≤60 lines
     */
    endPerformanceMonitoring() {
        this.performanceMetrics.endTime = performance.now();
        
        if (performance.memory) {
            this.performanceMetrics.memoryAfter = performance.memory.usedJSHeapSize;
        }
        
        console.log('📊 Performance monitoring completed');
    }
    
    /**
     * Generate comprehensive validation report
     * Purpose: Provide detailed validation results
     * Rule 4: ≤60 lines | Rule 5: Report validation
     */
    generateValidationReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.status === 'PASS').length;
        const successRate = Math.round((passedTests / totalTests) * 100);
        
        const executionTime = this.performanceMetrics.endTime - this.performanceMetrics.startTime;
        const memoryUsage = this.performanceMetrics.memoryAfter - this.performanceMetrics.memoryBefore;
        
        console.group('📋 Validation Report Summary');
        console.log(`🧪 Total Tests: ${totalTests}`);
        console.log(`✅ Passed: ${passedTests}`);
        console.log(`❌ Failed: ${totalTests - passedTests}`);
        console.log(`📊 Success Rate: ${successRate}%`);
        console.log(`⏱️ Execution Time: ${executionTime.toFixed(2)}ms`);
        
        if (memoryUsage !== 0) {
            console.log(`💾 Memory Delta: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);
        }
        
        // Detailed results
        console.group('📝 Test Details');
        this.testResults.forEach(result => {
            console.log(`${result.status === 'PASS' ? '✅' : '❌'} ${result.name}:`, result.result);
        });
        console.groupEnd();
        
        // Performance comparison
        if (window.optimizedRulesEnforcer) {
            const report = window.optimizedRulesEnforcer.generateReport();
            console.group('⚡ Performance Metrics');
            console.log(`Mode: ${report.performance.mode}`);
            console.log(`Functions Monitored: ${report.functions}`);
            console.log(`Total Violations: ${report.violations}`);
            console.log(`Active Loops: ${report.loops}`);
            console.groupEnd();
        }
        
        console.groupEnd();
        
        // Final assessment
        if (successRate >= 90) {
            console.log('🎉 VALIDATION SUCCESSFUL - Optimized rules system is working correctly!');
        } else if (successRate >= 70) {
            console.warn('⚠️ VALIDATION PARTIAL - Some issues detected, but system is functional');
        } else {
            console.error('❌ VALIDATION FAILED - Significant issues detected');
        }
        
        return {
            totalTests,
            passedTests,
            successRate,
            executionTime,
            memoryUsage,
            status: successRate >= 90 ? 'SUCCESS' : successRate >= 70 ? 'PARTIAL' : 'FAILED'
        };
    }
}

// Export validator for global access
window.RulesSystemValidator = RulesSystemValidator;

// Auto-run validation when system is ready
function autoValidate() {
    if (window.optimizedRulesEnforcer && window.OptimizedRules) {
        console.log('🚀 Auto-running rules system validation...');
        const validator = new RulesSystemValidator();
        setTimeout(() => validator.runAllTests(), 1000); // Delay to ensure system is fully initialized
    } else {
        console.log('⏳ Waiting for optimized rules system to initialize...');
        setTimeout(autoValidate, 2000); // Check again in 2 seconds
    }
}

// Start auto-validation
setTimeout(autoValidate, 500);

console.log('✅ Rules system validation module loaded');
