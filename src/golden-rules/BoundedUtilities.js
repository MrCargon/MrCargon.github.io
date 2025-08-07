/**
 * BoundedUtilities.js - Safe, bounded utility functions
 * Purpose: Provide Power of Ten compliant alternatives to common operations
 * @module BoundedUtilities
 * @version 1.0.0
 */

// Use global Assert system (avoid redeclaration)
const Assert = window.Assert || {
    assert: (condition) => condition === true,
    assertType: () => true,
    assertRange: () => true,
    assertNotNull: (value) => value != null,
    assertLoopBound: () => true
};

/**
 * Bounded loop operations
 * Purpose: Replace unbounded forEach, map, filter with bounded versions
 */
class BoundedLoop {
    /**
     * Bounded forEach
     * Purpose: Execute callback for each element with bounds checking
     * @param {Array} array - Array to iterate
     * @param {Function} callback - Callback function
     * @param {number} maxIterations - Maximum iterations allowed
     * @returns {boolean} - True if completed successfully
     */
    static forEach(array, callback, maxIterations = 1000) {
        // Preconditions
        Assert.assert(Array.isArray(array), 'First parameter must be array');
        Assert.assertType(callback, 'function', 'callback');
        Assert.assertRange(maxIterations, 1, 10000, 'maxIterations');
        
        // Bounded iteration
        const limit = Math.min(array.length, maxIterations);
        let i = 0;
        
        while (i < limit) {
            // Safety check
            if (!Assert.assertLoopBound(i, maxIterations)) {
                return false; // Loop bound exceeded
            }
            
            // Execute callback with error handling
            try {
                callback(array[i], i, array);
            } catch (error) {
                console.error(`Error in bounded forEach at index ${i}:`, error);
                return false; // Allow recovery (Rule 6)
            }
            
            i++;
        }
        
        // Postcondition
        Assert.assert(i <= maxIterations, 'Loop completed within bounds');
        return true;
    }
    
    /**
     * Bounded map
     * Purpose: Transform array with bounds checking
     * @param {Array} array - Array to transform
     * @param {Function} callback - Transform function
     * @param {number} maxIterations - Maximum iterations allowed
     * @returns {Array} - Transformed array
     */
    static map(array, callback, maxIterations = 1000) {
        // Preconditions
        Assert.assert(Array.isArray(array), 'First parameter must be array');
        Assert.assertType(callback, 'function', 'callback');
        Assert.assertRange(maxIterations, 1, 10000, 'maxIterations');
        
        // Pre-allocate result array
        const limit = Math.min(array.length, maxIterations);
        const result = new Array(limit);
        let i = 0;
        
        while (i < limit) {
            // Safety check
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
        
        // Postcondition
        Assert.assert(result.length <= maxIterations, 'Result within bounds');
        return result;
    }
    
    /**
     * Bounded filter
     * Purpose: Filter array with bounds checking
     * @param {Array} array - Array to filter
     * @param {Function} predicate - Filter function
     * @param {number} maxIterations - Maximum iterations allowed
     * @returns {Array} - Filtered array
     */
    static filter(array, predicate, maxIterations = 1000) {
        // Preconditions
        Assert.assert(Array.isArray(array), 'First parameter must be array');
        Assert.assertType(predicate, 'function', 'predicate');
        Assert.assertRange(maxIterations, 1, 10000, 'maxIterations');
        
        // Pre-allocate maximum result size
        const limit = Math.min(array.length, maxIterations);
        const result = [];
        let i = 0;
        
        while (i < limit && result.length < maxIterations) {
            // Safety check
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
        
        // Postcondition
        Assert.assert(result.length <= maxIterations, 'Result within bounds');
        return result;
    }
    
    /**
     * Bounded find
     * Purpose: Find element with bounds checking
     * @param {Array} array - Array to search
     * @param {Function} predicate - Search function
     * @param {number} maxIterations - Maximum iterations allowed
     * @returns {*} - Found element or undefined
     */
    static find(array, predicate, maxIterations = 1000) {
        // Preconditions
        Assert.assert(Array.isArray(array), 'First parameter must be array');
        Assert.assertType(predicate, 'function', 'predicate');
        
        const limit = Math.min(array.length, maxIterations);
        let i = 0;
        
        while (i < limit) {
            // Safety check
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
     * Safe substring
     * Purpose: Extract substring with bounds checking
     * @param {string} str - Source string
     * @param {number} start - Start index
     * @param {number} length - Substring length
     * @returns {string} - Extracted substring
     */
    static substring(str, start, length) {
        // Preconditions
        Assert.assertType(str, 'string', 'str');
        Assert.assertType(start, 'number', 'start');
        Assert.assertType(length, 'number', 'length');
        
        // Bounds checking
        const safeStart = Math.max(0, Math.min(start, str.length));
        const safeLength = Math.min(length, str.length - safeStart, 1000); // Max 1000 chars
        
        // Extract substring
        const result = str.substr(safeStart, safeLength);
        
        // Postcondition
        Assert.assert(result.length <= 1000, 'Result within bounds');
        return result;
    }
    
    /**
     * Safe split
     * Purpose: Split string with bounds checking
     * @param {string} str - String to split
     * @param {string} separator - Separator
     * @param {number} maxParts - Maximum parts to return
     * @returns {Array} - Split parts
     */
    static split(str, separator, maxParts = 100) {
        // Preconditions
        Assert.assertType(str, 'string', 'str');
        Assert.assertType(separator, 'string', 'separator');
        Assert.assertRange(maxParts, 1, 1000, 'maxParts');
        
        // Perform bounded split
        const parts = str.split(separator, maxParts);
        
        // Postcondition
        Assert.assert(parts.length <= maxParts, 'Parts within bounds');
        return parts;
    }
}

/**
 * Safe DOM operations
 * Purpose: Provide bounded DOM manipulation
 */
class SafeDOM {
    /**
     * Safe querySelector
     * Purpose: Query DOM with error handling
     * @param {string} selector - CSS selector
     * @param {Element} context - Context element
     * @returns {Element|null} - Found element or null
     */
    static querySelector(selector, context = document) {
        // Preconditions
        Assert.assertType(selector, 'string', 'selector');
        Assert.assertNotNull(context, 'context');
        
        try {
            const element = context.querySelector(selector);
            return element;
        } catch (error) {
            console.error(`Invalid selector: ${selector}`, error);
            return null; // Safe default
        }
    }
    
    /**
     * Safe querySelectorAll with limit
     * Purpose: Query multiple elements with bounds
     * @param {string} selector - CSS selector
     * @param {Element} context - Context element
     * @param {number} maxElements - Maximum elements to return
     * @returns {Array} - Array of elements
     */
    static querySelectorAll(selector, context = document, maxElements = 100) {
        // Preconditions
        Assert.assertType(selector, 'string', 'selector');
        Assert.assertNotNull(context, 'context');
        Assert.assertRange(maxElements, 1, 1000, 'maxElements');
        
        try {
            const nodeList = context.querySelectorAll(selector);
            const result = [];
            let i = 0;
            
            // Bounded conversion to array
            while (i < nodeList.length && i < maxElements) {
                result.push(nodeList[i]);
                i++;
            }
            
            // Postcondition
            Assert.assert(result.length <= maxElements, 'Result within bounds');
            return result;
        } catch (error) {
            console.error(`Invalid selector: ${selector}`, error);
            return []; // Safe default
        }
    }
    
    /**
     * Safe attribute access
     * Purpose: Get/set attributes with validation
     * @param {Element} element - Target element
     * @param {string} name - Attribute name
     * @param {string} value - Attribute value (optional)
     * @returns {string|boolean} - Attribute value or success status
     */
    static attribute(element, name, value = undefined) {
        // Preconditions
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
            return value === undefined ? null : false;
        }
    }
}

/**
 * Safe async operations
 * Purpose: Provide bounded async utilities
 */
class SafeAsync {
    /**
     * Bounded timeout
     * Purpose: Set timeout with maximum delay
     * @param {Function} callback - Callback function
     * @param {number} delay - Delay in milliseconds
     * @returns {number} - Timer ID
     */
    static setTimeout(callback, delay) {
        // Preconditions
        Assert.assertType(callback, 'function', 'callback');
        Assert.assertType(delay, 'number', 'delay');
        
        // Bound delay to reasonable maximum (30 seconds)
        const maxDelay = 30000;
        const boundedDelay = Math.min(Math.max(0, delay), maxDelay);
        
        // Wrap callback with error handling
        const safeCallback = function() {
            try {
                callback();
            } catch (error) {
                console.error('Timeout callback error:', error);
                // Allow recovery (Rule 6)
            }
        };
        
        return setTimeout(safeCallback, boundedDelay);
    }
    
    /**
     * Bounded interval
     * Purpose: Set interval with maximum iterations
     * @param {Function} callback - Callback function
     * @param {number} delay - Delay between calls
     * @param {number} maxCalls - Maximum number of calls
     * @returns {Object} - Interval controller
     */
    static setInterval(callback, delay, maxCalls = 1000) {
        // Preconditions
        Assert.assertType(callback, 'function', 'callback');
        Assert.assertType(delay, 'number', 'delay');
        Assert.assertRange(maxCalls, 1, 10000, 'maxCalls');
        
        let callCount = 0;
        const boundedDelay = Math.min(Math.max(100, delay), 30000); // Min 100ms, max 30s
        
        const intervalId = setInterval(() => {
            callCount++;
            
            // Check bounds
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
                // Continue execution (Rule 6)
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
     * Safe property access
     * Purpose: Access nested properties safely
     * @param {Object} obj - Source object
     * @param {string} path - Property path (e.g., 'a.b.c')
     * @param {*} defaultValue - Default if not found
     * @returns {*} - Property value or default
     */
    static get(obj, path, defaultValue = undefined) {
        // Preconditions
        Assert.assertNotNull(obj, 'obj');
        Assert.assertType(path, 'string', 'path');
        
        const parts = SafeString.split(path, '.', 10); // Max 10 levels deep
        let current = obj;
        let i = 0;
        
        while (i < parts.length) {
            if (current == null || typeof current !== 'object') {
                return defaultValue;
            }
            
            current = current[parts[i]];
            i++;
        }
        
        return current !== undefined ? current : defaultValue;
    }
    
    /**
     * Safe object keys iteration
     * Purpose: Get object keys with limit
     * @param {Object} obj - Source object
     * @param {number} maxKeys - Maximum keys to return
     * @returns {Array} - Object keys
     */
    static keys(obj, maxKeys = 100) {
        // Preconditions
        Assert.assertNotNull(obj, 'obj');
        Assert.assertRange(maxKeys, 1, 1000, 'maxKeys');
        
        try {
            const allKeys = Object.keys(obj);
            return allKeys.slice(0, maxKeys);
        } catch (error) {
            console.error('Failed to get object keys:', error);
            return [];
        }
    }
}

// Export utilities
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BoundedLoop,
        SafeString,
        SafeDOM,
        SafeAsync,
        SafeObject
    };
} else {
    window.BoundedUtilities = {
        BoundedLoop,
        SafeString,
        SafeDOM,
        SafeAsync,
        SafeObject
    };
}
