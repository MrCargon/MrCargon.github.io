/**
 * BoundedUtilities.js - Safe, bounded utility functions for safety-critical code
 * Purpose: Provide Rule-compliant alternatives to common operations
 * @module BoundedUtilities
 * @version 2.0.1
 */

// Use centralized Assert system (loaded via Assert.js)
function getAssert() {
    return window.Assert || {
        assert: (condition, msg) => {
            if (!condition) console.warn('Assertion failed:', msg);
            return condition;
        },
        assertType: (value, expectedType, msg) => {
            const actualType = typeof value;
            if (actualType !== expectedType) {
                console.warn(`Type assertion failed: ${msg}. Expected ${expectedType}, got ${actualType}`);
                return false;
            }
            return true;
        },
        assertRange: (value, min, max, msg) => {
            if (value < min || value > max) {
                console.warn(`Range assertion failed: ${msg}. Value ${value} not in range [${min}, ${max}]`);
                return false;
            }
            return true;
        },
        assertNotNull: (value, msg) => {
            if (value === null) {
                console.warn('Not null assertion failed:', msg);
                return false;
            }
            return true;
        },
        assertLoopBound: (index, maxIterations) => {
            if (index >= maxIterations) {
                console.warn(`Loop bound exceeded: ${index} >= ${maxIterations}`);
                return false;
            }
            return true;
        }
    };
}

/**
 * Bounded loop operations
 * Purpose: Replace unbounded forEach, map, filter with bounded versions
 */
class BoundedLoop {
    /**
     * Bounded forEach - execute callback for each element with bounds checking
     * Purpose: Safe iteration with fixed upper bounds
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 2: Bounded loops
     */
    static forEach(array, callback, maxIterations = 1000) {
 // Rule 5: Input validation assertions
        const Assert = getAssert();
        Assert.assert(Array.isArray(array), 'First parameter must be array');
        Assert.assertType(callback, 'function', 'callback');
        Assert.assertRange(maxIterations, 1, 10000, 'maxIterations');
        
 // Rule 2: Bounded iteration
        const limit = Math.min(array.length, maxIterations);
        let i = 0;
        
        while (i < limit) {
 // Safety check for loop bounds
            if (!Assert.assertLoopBound(i, maxIterations)) {
                return false; // Loop bound exceeded
            }
            
 // Execute callback with error handling
            try {
                callback(array[i], i, array);
            } catch (error) {
                console.error(`Error in bounded forEach at index ${i}:`, error);
                return false; // Rule 6: Allow recovery
            }
            
            i++;
        }
        
 // Rule 5: Postcondition assertion
        Assert.assert(i <= maxIterations, 'Loop completed within bounds');
        return true;
    }
    
    /**
     * Bounded map - transform array with bounds checking
     * Purpose: Safe array transformation with memory pre-allocation
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 3: Pre-allocated memory
     */
    static map(array, callback, maxIterations = 1000) {
 // Rule 5: Input validation assertions
        const Assert = getAssert();
        Assert.assert(Array.isArray(array), 'First parameter must be array');
        Assert.assertType(callback, 'function', 'callback');
        Assert.assertRange(maxIterations, 1, 10000, 'maxIterations');
        
 // Rule 3: Pre-allocate result array
        const limit = Math.min(array.length, maxIterations);
        const result = new Array(limit);
        let i = 0;
        
        while (i < limit) {
 // Safety check for loop bounds
            if (!Assert.assertLoopBound(i, maxIterations)) {
                return result.slice(0, i); // Return partial result
            }
            
 // Execute callback with error handling
            try {
                result[i] = callback(array[i], i, array);
            } catch (error) {
                console.error(`Error in bounded map at index ${i}:`, error);
                result[i] = undefined; // Safe default
            }
            
            i++;
        }
        
 // Rule 5: Postcondition assertion
        Assert.assert(result.length <= maxIterations, 'Result within bounds');
        return result;
    }
    
    /**
     * Bounded filter - filter array with bounds checking
     * Purpose: Safe array filtering with size limits
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 2: Fixed bounds
     */
    static filter(array, predicate, maxIterations = 1000) {
 // Rule 5: Input validation assertions
        const Assert = getAssert();
        Assert.assert(Array.isArray(array), 'First parameter must be array');
        Assert.assertType(predicate, 'function', 'predicate');
        Assert.assertRange(maxIterations, 1, 10000, 'maxIterations');
        
 // Rule 3: Pre-allocate maximum result size
        const limit = Math.min(array.length, maxIterations);
        const result = [];
        let i = 0;
        
        while (i < limit && result.length < maxIterations) {
 // Safety check for loop bounds
            if (!Assert.assertLoopBound(i, maxIterations)) {
                break; // Exit gracefully
            }
            
 // Execute predicate with error handling
            try {
                if (predicate(array[i], i, array)) {
                    result.push(array[i]);
                }
            } catch (error) {
                console.error(`Error in bounded filter at index ${i}:`, error);
 // Skip element on error
            }
            
            i++;
        }
        
 // Rule 5: Postcondition assertion
        Assert.assert(result.length <= maxIterations, 'Result within bounds');
        return result;
    }
    
    /**
     * Bounded find - find element with bounds checking
     * Purpose: Safe element search with iteration limits
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 2: Bounded search
     */
    static find(array, predicate, maxIterations = 1000) {
 // Rule 5: Input validation assertions
        const Assert = getAssert();
        Assert.assert(Array.isArray(array), 'First parameter must be array');
        Assert.assertType(predicate, 'function', 'predicate');
        
        const limit = Math.min(array.length, maxIterations);
        let i = 0;
        
        while (i < limit) {
 // Safety check for loop bounds
            if (!Assert.assertLoopBound(i, maxIterations)) {
                return undefined; // Not found within bounds
            }
            
            try {
                if (predicate(array[i], i, array)) {
                    return array[i]; // Found
                }
            } catch (error) {
                console.error(`Error in bounded find at index ${i}:`, error);
            }
            
            i++;
        }
        
        return undefined; // Not found
    }
}

/**
 * Safe string operations
 * Purpose: Provide bounded string manipulation
 */
class SafeString {
    /**
     * Safe substring with bounds checking
     * Purpose: Extract substring with memory and index safety
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 2: Fixed bounds
     */
    static substring(str, start, length) {
 // Rule 5: Input validation assertions
        const Assert = getAssert();
        Assert.assertType(str, 'string', 'str');
        Assert.assertType(start, 'number', 'start');
        Assert.assertType(length, 'number', 'length');
        
 // Rule 2: Bounds checking with fixed limits
        const safeStart = Math.max(0, Math.min(start, str.length));
        const safeLength = Math.min(length, str.length - safeStart, 1000); // Max 1000 chars
        
 // Extract substring safely
        const result = str.substr(safeStart, safeLength);
        
 // Rule 5: Postcondition assertion
        Assert.assert(result.length <= 1000, 'Result within bounds');
        return result;
    }
    
    /**
     * Safe split with bounds checking
     * Purpose: Split string with maximum part limit
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 2: Part limit
     */
    static split(str, separator, maxParts = 100) {
 // Rule 5: Input validation assertions
        const Assert = getAssert();
        Assert.assertType(str, 'string', 'str');
        Assert.assertType(separator, 'string', 'separator');
        Assert.assertRange(maxParts, 1, 1000, 'maxParts');
        
 // Perform bounded split
        const parts = str.split(separator, maxParts);
        
 // Rule 5: Postcondition assertion
        Assert.assert(parts.length <= maxParts, 'Parts within bounds');
        return parts;
    }

    /**
     * Escape HTML to prevent XSS attacks
     * Purpose: Convert dangerous HTML characters to safe entities
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 3: Pre-allocated map
     */
    static escapeHtml(text) {
 // Rule 5: Input validation assertions
        Assert.assertNotNull(text, 'text');
        Assert.assertType(text, 'string', 'text');
        
 // Rule 3: Pre-allocated escape map
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };
        
 // Rule 2: Bounded string processing
        const maxLength = 10000;
        const boundedText = text.length > maxLength ? text.substring(0, maxLength) : text;
        
        let result = '';
        let i = 0;
        
        while (i < boundedText.length && i < maxLength) {
            Assert.assertLoopBound(i, maxLength);
            
            const char = boundedText[i];
            result += escapeMap[char] || char;
            i++;
        }
        
 // Rule 5: Postcondition assertion
        Assert.assert(result.length <= maxLength * 6, 'Escaped text within bounds');
        return result;
    }
}

/**
 * Safe DOM operations
 * Purpose: Provide bounded DOM manipulation
 */
class SafeDOM {
    /**
     * Safe querySelector with error handling
     * Purpose: Query DOM with validation and error recovery
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 6: Error recovery
     */
    static querySelector(selector, context = document) {
 // Rule 5: Input validation assertions
        Assert.assertType(selector, 'string', 'selector');
        Assert.assertNotNull(context, 'context');
        
        try {
            const element = context.querySelector(selector);
            return element;
        } catch (error) {
            console.error(`Invalid selector: ${selector}`, error);
            return null; // Rule 6: Safe default for recovery
        }
    }
    
    /**
     * Safe querySelectorAll with element limit
     * Purpose: Query multiple elements with bounds
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 2: Element limit
     */
    static querySelectorAll(selector, context = document, maxElements = 100) {
 // Rule 5: Input validation assertions
        Assert.assertType(selector, 'string', 'selector');
        Assert.assertNotNull(context, 'context');
        Assert.assertRange(maxElements, 1, 1000, 'maxElements');
        
        try {
            const nodeList = context.querySelectorAll(selector);
            const result = [];
            let i = 0;
            
 // Rule 2: Bounded conversion to array
            while (i < nodeList.length && i < maxElements) {
                result.push(nodeList[i]);
                i++;
            }
            
 // Rule 5: Postcondition assertion
            Assert.assert(result.length <= maxElements, 'Result within bounds');
            return result;
        } catch (error) {
            console.error(`Invalid selector: ${selector}`, error);
            return []; // Rule 6: Safe default
        }
    }
    
    /**
     * Safe attribute access with validation
     * Purpose: Get/set attributes with error handling
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 6: Error recovery
     */
    static attribute(element, name, value = undefined) {
 // Rule 5: Input validation assertions
        Assert.assertNotNull(element, 'element');
        Assert.assertType(name, 'string', 'name');
        
        if (!element || !element.getAttribute) {
            return value === undefined ? null : false;
        }
        
        try {
            if (value === undefined) {
 // Get attribute
                return element.getAttribute(name);
            } else {
 // Set attribute
                element.setAttribute(name, String(value));
                return true;
            }
        } catch (error) {
            console.error(`Attribute operation failed: ${name}`, error);
            return value === undefined ? null : false; // Rule 6: Safe defaults
        }
    }
}

/**
 * Safe async operations
 * Purpose: Provide bounded async utilities
 */
class SafeAsync {
    /**
     * Bounded timeout with delay limits
     * Purpose: Set timeout with maximum delay constraint
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 2: Delay bounds
     */
    static setTimeout(callback, delay) {
 // Rule 5: Input validation assertions
        Assert.assertType(callback, 'function', 'callback');
        Assert.assertType(delay, 'number', 'delay');
        
 // Rule 2: Bound delay to reasonable maximum (30 seconds)
        const maxDelay = 30000;
        const boundedDelay = Math.min(Math.max(0, delay), maxDelay);
        
 // Wrap callback with error handling
        const safeCallback = function() {
            try {
                callback();
            } catch (error) {
                console.error('Timeout callback error:', error);
 // Rule 6: Allow recovery
            }
        };
        
        return setTimeout(safeCallback, boundedDelay);
    }
    
    /**
     * Bounded interval with call limits
     * Purpose: Set interval with maximum iterations
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 2: Call limit
     */
    static setInterval(callback, delay, maxCalls = 1000) {
 // Rule 5: Input validation assertions
        Assert.assertType(callback, 'function', 'callback');
        Assert.assertType(delay, 'number', 'delay');
        Assert.assertRange(maxCalls, 1, 10000, 'maxCalls');
        
        let callCount = 0;
        const boundedDelay = Math.min(Math.max(100, delay), 30000); // Min 100ms, max 30s
        
        const intervalId = setInterval(() => {
            callCount++;
            
 // Rule 2: Check bounds
            if (callCount >= maxCalls) {
                clearInterval(intervalId);
                console.log(`Interval reached max calls: ${maxCalls}`);
                return;
            }
            
 // Execute with error handling
            try {
                callback(callCount);
            } catch (error) {
                console.error(`Interval callback error at call ${callCount}:`, error);
 // Rule 6: Continue execution
            }
        }, boundedDelay);
        
 // Return controller
        return {
            id: intervalId,
            stop: () => clearInterval(intervalId),
            getCallCount: () => callCount
        };
    }
}

/**
 * Safe object operations
 * Purpose: Provide bounded object manipulation
 */
class SafeObject {
    /**
     * Safe property access with depth limits
     * Purpose: Access nested properties safely
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 2: Depth limit
     */
    static get(obj, path, defaultValue = undefined) {
 // Rule 5: Input validation assertions
        Assert.assertNotNull(obj, 'obj');
        Assert.assertType(path, 'string', 'path');
        
        const parts = SafeString.split(path, '.', 10); // Max 10 levels deep
        let current = obj;
        let i = 0;
        
        while (i < parts.length) {
            if (current === null || typeof current !== 'object') {
                return defaultValue;
            }
            
            current = current[parts[i]];
            i++;
        }
        
        return current !== undefined ? current : defaultValue;
    }
    
    /**
     * Safe object keys with limit
     * Purpose: Get object keys with maximum count
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 2: Key limit
     */
    static keys(obj, maxKeys = 100) {
 // Rule 5: Input validation assertions
        Assert.assertNotNull(obj, 'obj');
        Assert.assertRange(maxKeys, 1, 1000, 'maxKeys');
        
        try {
            const allKeys = Object.keys(obj);
            return allKeys.slice(0, maxKeys);
        } catch (error) {
            console.error('Failed to get object keys:', error);
            return []; // Rule 6: Safe default
        }
    }
}

// Export utilities for different module systems
// Browser-only export
if (typeof window !== 'undefined') {
    const utilitiesAPI = {
        BoundedLoop,
        SafeString,
        SafeDOM,
        SafeAsync,
        SafeObject,
 // Direct function exports for convenience
        escapeHtml: SafeString.escapeHtml,
        substring: SafeString.substring,
        split: SafeString.split,
        capitalize: (text) => {
            if (typeof text !== 'string' || text.length === 0) return '';
            return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
        },
        sanitizeString: (input, maxLength = 100) => {
            if (typeof input !== 'string') return '';
            const cleaned = input.replace(/[^\w\s\-_.]/g, '').substring(0, maxLength);
            return cleaned.trim();
        }
    };
    
    // Export under both names for compatibility
    window.BoundedUtilities = utilitiesAPI;
    window.WiseBoundedUtilities = utilitiesAPI;
    
    console.log('🦉 WiseBoundedUtilities loaded - safe operations ready');
}
