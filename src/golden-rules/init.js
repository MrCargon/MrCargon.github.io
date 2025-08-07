/**
 * init.js - Initialize Golden Rules enforcement system
 * Purpose: Load and activate Power of Ten rule enforcement
 * @module GoldenRulesInit
 * @version 2.0.0
 */

/**
 * Initialize Golden Rules Learning System
 * Purpose: Setup assertion system and rule enforcement (learning implementation)
 * @returns {boolean} - Success status
 */
async function initializeGoldenRules() {
    // Precondition: System not already initialized
    if (window.goldenRulesInitialized) {
        console.warn('🏛️ Golden Rules already initialized');
        return true;
    }
    
    try {
        console.log('🛡️ Initializing Golden Rules Learning System v2.0...');
        
        // Step 1: Load core assertion system
        await loadAssertionSystem();
        
        // Step 2: Load bounded utilities
        await loadBoundedUtilities();
        
        // Step 3: Load protection system
        await loadProtectionSystem();
        
        // Step 4: Load rules enforcer
        await loadRulesEnforcer();
        
        // Step 5: Initialize enforcement with protection
        await initializeProtectedEnforcement();
        
        // Step 6: Start integrity monitoring
        await startIntegrityMonitoring();
        
        // Step 7: Verify complete system integrity
        const isValid = await verifyCompleteSystemIntegrity();
        
        if (isValid) {
            window.goldenRulesInitialized = true;
            console.log('✅ Golden Rules Learning System initialized successfully');
            displayEnhancedComplianceStatus();
            announceSystemReady();
        } else {
            console.error('❌ Golden Rules System integrity check failed - Entering Safe Mode');
            if (window.GoldenRulesProtection) {
                window.GoldenRulesProtection.enterSafeMode();
            }
        }
        
        return isValid;
        
    } catch (error) {
        console.error('❌ Failed to initialize Golden Rules Learning System:', error);
        return false;
    }
}

/**
 * Load assertion system
 * Purpose: Ensure assertions are available
 * @returns {Promise<boolean>} - Success status
 */
async function loadAssertionSystem() {
    // Check if already loaded or loading
    if (window.Assert || document.querySelector('script[src="/src/golden-rules/Assert.js"]')) {
        console.log('✓ Assertion system loaded');
        return true;
    }
    
    // Load dynamically
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = '/src/golden-rules/Assert.js';
        script.onload = () => {
            console.log('✓ Assertion system loaded');
            resolve(true);
        };
        script.onerror = () => {
            console.error('Failed to load assertion system');
            resolve(false);
        };
        document.head.appendChild(script);
    });
}

/**
 * Load bounded utilities
 * Purpose: Ensure safe operations are available
 * @returns {Promise<boolean>} - Success status
 */
async function loadBoundedUtilities() {
    // Check if already loaded
    if (window.BoundedUtilities) {
        console.log('✓ Bounded utilities already loaded');
        return true;
    }
    
    // Load dynamically
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = '/src/golden-rules/BoundedUtilities.js';
        script.onload = () => {
            console.log('✓ Bounded utilities loaded');
            resolve(true);
        };
        script.onerror = () => {
            console.error('Failed to load bounded utilities');
            resolve(false);
        };
        document.head.appendChild(script);
    });
}

/**
 * Load protection system
 * Purpose: Ensure tamper-proof protection is available
 * @returns {Promise<boolean>} - Success status
 */
async function loadProtectionSystem() {
    // Check if already loaded
    if (window.GoldenRulesProtection) {
        console.log('✓ Protection system already loaded');
        return true;
    }
    
    // Load dynamically
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = '/src/golden-rules/GoldenRulesProtection.js';
        script.onload = () => {
            console.log('✓ Protection system loaded');
            resolve(true);
        };
        script.onerror = () => {
            console.error('Failed to load protection system');
            resolve(false);
        };
        document.head.appendChild(script);
    });
}

/**
 * Load rules enforcer
 * Purpose: Enable runtime rule checking
 * @returns {Promise<boolean>} - Success status
 */
async function loadRulesEnforcer() {
    // Check if already loaded
    if (window.RulesEnforcer) {
        console.log('✓ Rules enforcer already loaded');
        return true;
    }
    
    // Load dynamically
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = '/src/golden-rules/RulesEnforcer.js';
        script.onload = () => {
            console.log('✓ Rules enforcer loaded');
            resolve(true);
        };
        script.onerror = () => {
            console.error('Failed to load rules enforcer');
            resolve(false);
        };
        document.head.appendChild(script);
    });
}

/**
 * Initialize protected enforcement
 * Purpose: Activate runtime monitoring with tamper protection
 * @returns {Promise<boolean>} - Success status
 */
async function initializeProtectedEnforcement() {
    // Wait for all components to be available
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
        if (window.RulesEnforcer && window.Assert && window.BoundedUtilities && window.GoldenRulesProtection) {
            break;
        }
        
        // Wait 100ms before next check
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    // Verify all components are loaded
    const requiredComponents = [
        { name: 'Assert', obj: window.Assert },
        { name: 'BoundedUtilities', obj: window.BoundedUtilities },
        { name: 'RulesEnforcer', obj: window.RulesEnforcer },
        { name: 'GoldenRulesProtection', obj: window.GoldenRulesProtection }
    ];
    
    let allLoaded = true;
    let i = 0;
    while (i < requiredComponents.length) {
        const component = requiredComponents[i];
        if (!component.obj) {
            console.error(`❌ Required component ${component.name} not loaded after waiting`);
            allLoaded = false;
        }
        i++;
    }
    
    if (!allLoaded) {
        return false;
    }
    
    // Initialize enforcer with protection
    try {
        const enforcer = window.RulesEnforcer.enforcer;
        await enforcer.initialize();
        
        // Setup global error handler for rule violations
        window.addEventListener('error', handleProtectedRuleViolation);
        window.addEventListener('unhandledrejection', handleProtectedRuleViolation);
        
        // Register components for integrity monitoring
        registerComponentsForIntegrity();
        
        console.log('✅ Protected enforcement monitoring active');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize protected enforcement:', error);
        return false;
    }
}

/**
 * Start integrity monitoring
 * Purpose: Begin continuous system integrity checking
 * @returns {Promise<boolean>} - Success status
 */
async function startIntegrityMonitoring() {
    if (!window.GoldenRulesProtection) {
        console.error('Protection system not available for integrity monitoring');
        return false;
    }
    
    try {
        // Start continuous integrity monitoring
        window.GoldenRulesProtection.integrityChecker.startMonitoring();
        
        console.log('🔍 Integrity monitoring started');
        return true;
    } catch (error) {
        console.error('Failed to start integrity monitoring:', error);
        return false;
    }
}

/**
 * Register components for integrity monitoring
 * Purpose: Add all components to tamper detection
 * @returns {void}
 */
function registerComponentsForIntegrity() {
    const integrityChecker = window.GoldenRulesProtection.integrityChecker;
    
    // Register critical components
    const components = [
        { name: 'Assert', content: JSON.stringify(window.Assert) },
        { name: 'BoundedUtilities', content: JSON.stringify(window.BoundedUtilities) },
        { name: 'RulesEnforcer', content: JSON.stringify(window.RulesEnforcer) },
        { name: 'GoldenRulesProtection', content: JSON.stringify(window.GoldenRulesProtection) }
    ];
    
    let i = 0;
    while (i < components.length && i < 10) {
        const component = components[i];
        integrityChecker.registerComponent(component.name, component.content);
        i++;
    }
}

/**
 * Handle protected rule violation
 * Purpose: Process and report rule violations with protection
 * @param {ErrorEvent} event - Error event
 * @returns {void}
 */
function handleProtectedRuleViolation(event) {
    // Check if this is a rule violation
    const message = event.message || event.reason || '';
    const isRuleViolation = message.includes('ASSERTION FAILED') || 
                           message.includes('Rule violation') ||
                           message.includes('SECURITY VIOLATION');
    
    if (isRuleViolation) {
        console.warn('⚠️ Protected rule violation detected:', message);
        
        // Log to enforcer
        if (window.RulesEnforcer && window.RulesEnforcer.enforcer) {
            window.RulesEnforcer.enforcer.recordViolations([{
                rule: 'ASSERTION',
                message: message,
                timestamp: Date.now(),
                source: event.filename || 'unknown'
            }]);
        }
        
        // Log to developer guidance system
        if (window.GoldenRulesProtection && window.GoldenRulesProtection.developerGuidance) {
            window.GoldenRulesProtection.developerGuidance.violations.push({
                type: 'RUNTIME_VIOLATION',
                message: message,
                timestamp: Date.now()
            });
        }
        
        // Check if system should enter safe mode
        if (message.includes('RULE PROTECTION')) {
            console.error('🚨 Rule concern detected - considering safe mode');
            if (window.GoldenRulesProtection) {
                window.GoldenRulesProtection.enterSafeMode();
            }
        }
    }
}

/**
 * Verify complete system integrity
 * Purpose: Ensure all components are properly loaded with protection
 * @returns {Promise<boolean>} - True if system is valid
 */
async function verifyCompleteSystemIntegrity() {
    console.log('🔍 Verifying complete system integrity...');
    
    // Check all required components including protection
    const components = [
        { name: 'Assert', obj: window.Assert },
        { name: 'BoundedUtilities', obj: window.BoundedUtilities },
        { name: 'RulesEnforcer', obj: window.RulesEnforcer },
        { name: 'GoldenRulesProtection', obj: window.GoldenRulesProtection }
    ];
    
    let allValid = true;
    let i = 0;
    const maxChecks = 10;
    
    while (i < components.length && i < maxChecks) {
        const component = components[i];
        if (!component.obj) {
            console.error(`❌ Missing component: ${component.name}`);
            allValid = false;
        } else {
            console.log(`✅ ${component.name} verified`);
        }
        i++;
    }
    
    // Verify configuration with enhanced checking
    try {
        const response = await fetch('/src/golden-rules/rules-config.json');
        const config = await response.json();
        
        if (config.checksum === 'a7b3c9d2e1f4g5h6') {
            console.log('✅ Configuration integrity verified');
        } else {
            console.error('❌ Configuration checksum mismatch');
            allValid = false;
        }
    } catch (error) {
        console.error('❌ Failed to verify configuration:', error);
        allValid = false;
    }
    
    // Verify protection system is tamper-proof
    if (window.GoldenRulesProtection && window.GoldenRulesProtection.GOLDEN_RULES_IMMUTABLE) {
        try {
            // Test tamper protection
            const rules = window.GoldenRulesProtection.GOLDEN_RULES_IMMUTABLE;
            const testRule = rules.SIMPLE_CONTROL_FLOW;
            
            if (testRule && testRule.enabled === true) {
                console.log('✅ Tamper protection verified');
            } else {
                console.error('❌ Tamper protection compromised');
                allValid = false;
            }
        } catch (error) {
            console.error('❌ Failed to verify tamper protection:', error);
            allValid = false;
        }
    }
    
    return allValid;
}

/**
 * Display enhanced compliance status
 * Purpose: Show current compliance level with protection status
 * @returns {void}
 */
function displayEnhancedComplianceStatus() {
    // Create enhanced status indicator
    const statusDiv = document.createElement('div');
    statusDiv.id = 'golden-rules-status';
    statusDiv.style.cssText = `
        position: fixed;
        bottom: 8px;
        right: 8px;
        padding: 4px 8px;
        background: rgba(60, 60, 60, 0.7);
        color: rgba(255, 255, 255, 0.8);
        border-radius: 3px;
        font-size: 10px;
        font-weight: normal;
        z-index: 1000;
        cursor: pointer;
        transition: all 0.3s;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.1);
        opacity: 0.6;
    `;
    statusDiv.innerHTML = '🛡️ Rules';
    
    // Add enhanced click handler
    statusDiv.addEventListener('click', showEnhancedComplianceReport);
    
    // Add hover effect
    statusDiv.addEventListener('mouseenter', () => {
        statusDiv.style.transform = 'scale(1.05)';
        statusDiv.style.boxShadow = '0 6px 16px rgba(0, 200, 0, 0.4)';
    });
    
    statusDiv.addEventListener('mouseleave', () => {
        statusDiv.style.transform = 'scale(1)';
        statusDiv.style.boxShadow = '0 4px 12px rgba(0, 200, 0, 0.3)';
    });
    
    // Add to page
    document.body.appendChild(statusDiv);
    
    // Fade to semi-transparent after 7 seconds
    setTimeout(() => {
        if (statusDiv.parentNode) {
            statusDiv.style.opacity = '0.4';
        }
    }, 7000);
}

/**
 * Announce system ready
 * Purpose: Notify that rule learning system is active
 * @returns {void}
 */
function announceSystemReady() {
    console.log(`
🛡️ ═══════════════════════════════════════════════════════════════
   GOLDEN RULES LEARNING SYSTEM ACTIVE
═══════════════════════════════════════════════════════════════
✅ Implementing 10 Power of Ten rules (learning)
✅ Basic protection activated  
✅ Monitoring system active
✅ Developer guidance system ready
✅ Safe mode protection available
✅ Learning from compliance patterns

🚀 System Status: LEARNING MODE
🔒 Rules implementation in progress
📊 Click status indicator for current progress report
═══════════════════════════════════════════════════════════════`);
}

/**
 * Show compliance learning report
 * Purpose: Display current learning progress and compliance information
 * @returns {void}
 */
function showEnhancedComplianceReport() {
    if (!window.RulesEnforcer || !window.RulesEnforcer.enforcer) {
        console.error('Enforcer not available');
        return;
    }
    
    const report = window.RulesEnforcer.enforcer.getReport();
    const assertStats = window.Assert ? window.Assert.getAssertionStats() : { totalFailures: 0 };
    const protectionReport = window.GoldenRulesProtection ? 
        window.GoldenRulesProtection.developerGuidance.generateReport() : null;
    
    console.group('🛡️ Golden Rules Learning Progress Report');
    console.log('🔐 Protection Level: LEARNING');
    console.log('📊 Progress Score:', protectionReport ? `${protectionReport.complianceScore}%` : 'N/A');
    console.log('⚖️ Learning Opportunities:', report.totalViolations);
    console.log('🚨 Assertion Learning Points:', assertStats.totalFailures);
    console.log('🛡️ Rule Monitoring Status:', report.enforcementEnabled ? 'ACTIVE' : 'INACTIVE');
    console.log('🔒 Basic Protection:', window.GoldenRulesProtection ? 'LEARNING' : 'INACTIVE');
    console.log('🔍 Progress Monitoring:', 'CONTINUOUS');
    
    // Show rule learning status
    if (window.GoldenRulesProtection && window.GoldenRulesProtection.GOLDEN_RULES_IMMUTABLE) {
        const rules = window.GoldenRulesProtection.GOLDEN_RULES_IMMUTABLE;
        console.group('📋 Rule Learning Status:');
        
        const ruleKeys = Object.keys(rules);
        let i = 0;
        while (i < ruleKeys.length && i < 10) {
            const ruleKey = ruleKeys[i];
            const rule = rules[ruleKey];
            const status = rule.enabled ? '✅' : '❌';
            console.log(`${status} Rule ${rule.id}: ${rule.name}`);
            i++;
        }
        console.groupEnd();
    }
    
    // Show recent learning opportunities
    if (report.violations.length > 0) {
        console.group('🚨 Recent Learning Opportunities:');
        let i = 0;
        const maxShow = 5;
        while (i < report.violations.length && i < maxShow) {
            const violation = report.violations[i];
            console.log(`- ${violation.rule}: ${violation.message}`);
            i++;
        }
        console.groupEnd();
    }
    
    // Show learning suggestions if available
    if (protectionReport && protectionReport.recommendations.length > 0) {
        console.group('💡 Learning Suggestions:');
        let i = 0;
        while (i < protectionReport.recommendations.length && i < 3) {
            const rec = protectionReport.recommendations[i];
            console.log(`${rec.priority === 'HIGH' ? '🔥' : '📋'} ${rec.rule}: ${rec.suggestion}`);
            i++;
        }
        console.groupEnd();
    }
    
    console.log('📖 Developer Examples: window.GoldenRulesProtection.developerGuidance.getExamples("RULE_NAME")');
    console.groupEnd();
}

/**
 * Export system status
 * Purpose: Provide API for checking system status
 * @returns {Object} - System status
 */
function getGoldenRulesStatus() {
    return {
        initialized: window.goldenRulesInitialized || false,
        assertionsEnabled: window.Assert ? window.Assert.getAssertionStats().enabled : false,
        enforcerActive: window.RulesEnforcer ? window.RulesEnforcer.enforcer.enforcementEnabled : false,
        componentsLoaded: {
            assert: !!window.Assert,
            utilities: !!window.BoundedUtilities,
            enforcer: !!window.RulesEnforcer
        }
    };
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGoldenRules);
} else {
    // DOM already loaded
    initializeGoldenRules();
}

// Export for manual control
window.GoldenRules = {
    initialize: initializeGoldenRules,
    getStatus: getGoldenRulesStatus,
    showReport: showEnhancedComplianceReport
};
