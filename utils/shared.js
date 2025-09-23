// Shared utility functions for FavURL Chrome Extension

/**
 * Generates a unique ID with timestamp and random components
 * @param {string} prefix - The prefix for the ID (e.g., 'url_', 'group_')
 * @returns {string} A unique ID
 */
function generateUniqueId(prefix = '') {
    return prefix + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 11);
}

/**
 * Extracts domain from a URL
 * @param {string} url - The URL to extract domain from
 * @returns {string} The domain or 'unknown' if invalid
 */
function extractDomain(url) {
    try {
        return new URL(url).hostname;
    } catch (e) {
        return 'unknown';
    }
}

/**
 * Generates a favicon URL for a given domain
 * @param {string} domain - The domain to get favicon for
 * @returns {string} Google Favicon API URL
 */
function generateFaviconUrl(domain) {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
}

/**
 * Escapes HTML characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} HTML-escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Checks if a string is a valid URL
 * @param {string} string - The string to validate
 * @returns {boolean} True if valid URL
 */
function isValidURL(string) {
    try {
        const url = new URL(string);
        return ['http:', 'https:'].includes(url.protocol);
    } catch (_) {
        return false;
    }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
        generateUniqueId,
        extractDomain,
        generateFaviconUrl,
        escapeHtml,
        isValidURL
    };
} else {
    // Browser environment - attach to window
    window.FavURLUtils = {
        generateUniqueId,
        extractDomain,
        generateFaviconUrl,
        escapeHtml,
        isValidURL
    };
}