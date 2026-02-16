/**
 * BoundedUtilities.js - HTML escaping and sanitization helpers
 * Bounded utility functions for safe string manipulation
 */

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
    if (typeof text !== 'string') return '';

    return text.replace(/[&<>"']/g, (match) => {
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;'
        };
        return escapeMap[match] || match;
    });
}

/**
 * Capitalize first letter of string
 * @param {string} text - Text to capitalize
 * @returns {string} Capitalized text
 */
export function capitalize(text) {
    if (typeof text !== 'string' || text.length === 0) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Sanitize user input string
 * Supports international characters (Latin extended, CJK)
 * @param {string} input - Input to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} Sanitized string
 */
export function sanitizeString(input, maxLength = 100) {
    if (typeof input !== 'string') return '';
    if (maxLength < 1 || maxLength > 1000) {
        maxLength = 100;
    }

    // Allow alphanumeric, spaces, hyphens, underscores, periods, Latin extended, and CJK
    const cleaned = input.replace(/[^a-zA-Z0-9\s\-_.À-ÿ\u4E00-\u9FFF]/g, '').substring(0, maxLength);
    return cleaned.trim();
}

/**
 * Format category name for display
 * @param {string} category - Category key
 * @returns {string} Formatted category name
 */
export function formatCategoryName(category) {
    if (typeof category !== 'string') return '';

    switch(category) {
        case 'hotDrinks': return 'Hot Drinks';
        case 'icedDrinks': return 'Iced Drinks';
        case 'frappuccinos': return 'Frappuccinos';
        case 'refreshers': return 'Refreshers';
        default: return category;
    }
}

/**
 * Get category icon emoji
 * @param {string} category - Category key
 * @returns {string} Category emoji icon
 */
export function getCategoryIcon(category) {
    if (typeof category !== 'string') return '☕';

    switch(category) {
        case 'hotDrinks': return '☕';
        case 'icedDrinks': return '🧊';
        case 'frappuccinos': return '🥤';
        case 'refreshers': return '🍓';
        default: return '☕';
    }
}
