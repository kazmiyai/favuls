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

/**
 * Loads URLs from all storage keys and combines them
 * @returns {Promise<Array>} Combined array of all URLs
 */
async function loadAllURLsFromStorage() {
    try {
        const allKeys = getAllURLStorageKeys();
        const result = await chrome.storage.sync.get(allKeys);

        const allUrls = [];
        for (const key of allKeys) {
            if (result[key] && Array.isArray(result[key])) {
                allUrls.push(...result[key]);
            }
        }

        return allUrls;
    } catch (error) {
        console.error('Error loading URLs from storage:', error);
        return [];
    }
}

/**
 * Saves URLs to their appropriate storage keys based on group assignment
 * @param {Array} urls - Array of URL objects
 * @param {Array} groups - Array of group objects
 * @returns {Promise<void>}
 */
async function saveURLsToStorage(urls, groups) {
    try {
        // Create storage data object with all URL keys initialized as empty arrays
        const storageData = {};
        for (let i = 0; i <= 31; i++) {
            storageData[getURLStorageKey(i)] = [];
        }

        // Distribute URLs to their appropriate storage keys
        for (const url of urls) {
            const storageIndex = getStorageIndexForGroup(url.groupId, groups);
            const storageKey = getURLStorageKey(storageIndex);
            storageData[storageKey].push(url);
        }

        // Save to chrome.storage.sync
        await chrome.storage.sync.set(storageData);

        console.log('URLs saved to storage with new 32-key structure');
    } catch (error) {
        console.error('Error saving URLs to storage:', error);
        throw error;
    }
}

/**
 * Moves a URL from one storage key to another when group changes
 * @param {string} urlId - The URL ID to move
 * @param {string} fromGroupId - The source group ID
 * @param {string} toGroupId - The destination group ID
 * @param {Array} groups - Array of group objects
 * @returns {Promise<void>}
 */
async function moveURLBetweenStorageKeys(urlId, fromGroupId, toGroupId, groups) {
    try {
        const fromIndex = getStorageIndexForGroup(fromGroupId, groups);
        const toIndex = getStorageIndexForGroup(toGroupId, groups);

        // If moving to the same storage key, no storage operation needed
        if (fromIndex === toIndex) {
            return;
        }

        const fromKey = getURLStorageKey(fromIndex);
        const toKey = getURLStorageKey(toIndex);

        // Load both storage keys
        const result = await chrome.storage.sync.get([fromKey, toKey]);
        const fromUrls = result[fromKey] || [];
        const toUrls = result[toKey] || [];

        // Find and remove URL from source
        const urlIndex = fromUrls.findIndex(url => url.id === urlId);
        if (urlIndex === -1) {
            console.warn(`URL ${urlId} not found in storage key ${fromKey}`);
            return;
        }

        const urlToMove = fromUrls.splice(urlIndex, 1)[0];

        // Update the URL's groupId
        urlToMove.groupId = toGroupId;
        urlToMove.lastModified = new Date().toISOString();

        // Add URL to destination
        toUrls.push(urlToMove);

        // Save both keys
        const updateData = {};
        updateData[fromKey] = fromUrls;
        updateData[toKey] = toUrls;

        await chrome.storage.sync.set(updateData);

        console.log(`URL ${urlId} moved from ${fromKey} to ${toKey}`);
    } catch (error) {
        console.error('Error moving URL between storage keys:', error);
        throw error;
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
        isValidURL,
        getURLStorageKey,
        getStorageIndexForGroup,
        getAllURLStorageKeys,
        loadAllURLsFromStorage,
        saveURLsToStorage,
        moveURLBetweenStorageKeys
    };
} else {
    // Browser environment - attach to window
    window.FavURLUtils = {
        generateUniqueId,
        extractDomain,
        generateFaviconUrl,
        escapeHtml,
        isValidURL,
        getURLStorageKey,
        getStorageIndexForGroup,
        getAllURLStorageKeys,
        loadAllURLsFromStorage,
        saveURLsToStorage,
        moveURLBetweenStorageKeys
    };
}