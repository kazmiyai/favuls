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
 * Generates a favicon URL using Chrome's Manifest V3 favicon API
 * @param {string} urlOrDomain - The full URL or domain to get favicon for
 * @returns {string} Chrome extension favicon URL
 */
function generateFaviconUrl(urlOrDomain) {
    // Ensure we have a full URL
    const pageUrl = urlOrDomain.startsWith('http') ? urlOrDomain : `https://${urlOrDomain}`;

    // Use Chrome's official Manifest V3 favicon API
    // Format: chrome-extension://EXTENSION_ID/_favicon/?pageUrl=URL&size=SIZE
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        const faviconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
        faviconUrl.searchParams.set("pageUrl", pageUrl);
        faviconUrl.searchParams.set("size", "16");
        return faviconUrl.toString();
    }

    // Fallback for contexts where chrome.runtime is not available
    // This shouldn't happen in normal extension contexts, but provides safety
    return `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjZjBmMGYwIi8+CjxwYXRoIGQ9Ik0zIDRoMTB2OEgzeiIgZmlsbD0iIzk5OSIvPgo8L3N2Zz4=`;
}

/**
 * Asynchronously fetches the direct favicon from a website's /favicon.ico
 * @param {string} url - The full URL of the website
 * @returns {Promise<string|null>} The favicon URL if found, null otherwise
 */
async function fetchDirectFavicon(url) {
    try {
        // Parse the URL to get the base domain
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        const faviconUrl = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;

        // Try to fetch the favicon with a HEAD request to check if it exists
        const response = await fetch(faviconUrl, {
            method: 'HEAD',
            mode: 'no-cors', // Avoid CORS issues
            cache: 'no-cache'
        });

        // For no-cors mode, we can't check response.ok, so we just return the URL
        // The browser will handle loading it, and if it fails, the onerror handler will catch it
        return faviconUrl;
    } catch (error) {
        console.debug('Failed to fetch direct favicon:', error);
        return null;
    }
}

/**
 * Attempts to update an image element's favicon by trying direct fetch
 * @param {HTMLImageElement} imgElement - The image element to update
 * @param {string} url - The URL to fetch favicon for
 */
async function updateFaviconAsync(imgElement, url) {
    const directFavicon = await fetchDirectFavicon(url);
    if (directFavicon && imgElement) {
        // Store the original src as fallback
        const originalSrc = imgElement.src;

        // Try to load the direct favicon
        imgElement.src = directFavicon;

        // If direct favicon fails to load, revert to original
        imgElement.onerror = () => {
            imgElement.src = originalSrc;
        };
    }
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

/**
 * Gets the storage key name for a group index
 * @param {number} index - The group index (0-31)
 * @returns {string} The storage key name (e.g., "urls0", "urls1")
 */
function getURLStorageKey(index) {
    if (index < 0 || index > 31) {
        throw new Error(`Invalid storage index: ${index}. Must be between 0 and 31.`);
    }
    return `urls${index}`;
}

/**
 * Gets the storage index for a group ID
 * @param {string} groupId - The group ID
 * @param {Array} groups - Array of group objects
 * @returns {number} The storage index (0-31)
 */
function getStorageIndexForGroup(groupId, groups) {
    // Ungrouped always uses index 0
    if (groupId === 'ungrouped') {
        return 0;
    }

    // Find the group and use its position in the array (+ 1 to account for ungrouped at 0)
    const groupIndex = groups.findIndex(group => group.id === groupId);
    if (groupIndex === -1) {
        console.warn(`Group not found: ${groupId}, defaulting to ungrouped`);
        return 0; // Default to ungrouped
    }

    // If this is the ungrouped group, return 0
    if (groups[groupIndex].id === 'ungrouped') {
        return 0;
    }

    // Calculate index: ungrouped groups get filtered out, then add 1 for the ungrouped slot
    const nonUngroupedGroups = groups.filter(g => g.id !== 'ungrouped');
    const nonUngroupedIndex = nonUngroupedGroups.findIndex(group => group.id === groupId);

    if (nonUngroupedIndex === -1) {
        console.warn(`Non-ungrouped group not found: ${groupId}, defaulting to ungrouped`);
        return 0;
    }

    const storageIndex = nonUngroupedIndex + 1; // Add 1 because ungrouped uses index 0

    if (storageIndex > 31) {
        console.warn(`Storage index ${storageIndex} exceeds limit, defaulting to ungrouped`);
        return 0;
    }

    return storageIndex;
}

/**
 * Gets all URL storage keys (urls0 through urls31)
 * @returns {Array<string>} Array of all URL storage key names
 */
function getAllURLStorageKeys() {
    const keys = [];
    for (let i = 0; i <= 31; i++) {
        keys.push(getURLStorageKey(i));
    }
    return keys;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
        generateUniqueId,
        extractDomain,
        generateFaviconUrl,
        fetchDirectFavicon,
        updateFaviconAsync,
        escapeHtml,
        isValidURL,
        getURLStorageKey,
        getStorageIndexForGroup,
        getAllURLStorageKeys
    };
} else {
    // Browser environment - attach to window
    window.FavURLUtils = {
        generateUniqueId,
        extractDomain,
        generateFaviconUrl,
        fetchDirectFavicon,
        updateFaviconAsync,
        escapeHtml,
        isValidURL,
        getURLStorageKey,
        getStorageIndexForGroup,
        getAllURLStorageKeys
    };
}