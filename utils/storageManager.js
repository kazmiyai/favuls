// Storage Manager - Centralized Chrome Storage Operations
// Handles all chrome.storage.sync operations with chunked storage format

/**
 * Generates array of storage keys for groups
 * @returns {Array<string>} Array of group keys (group00-group31)
 */
function generateGroupKeys() {
    const keys = [];
    for (let i = 0; i < 32; i++) {
        keys.push(`group${i.toString().padStart(2, '0')}`);
    }
    return keys;
}

/**
 * Generates array of storage keys for URLs
 * @returns {Array<string>} Array of URL keys (url000-url399)
 */
function generateURLKeys() {
    const keys = [];
    for (let i = 0; i < 400; i++) {
        keys.push(`url${i.toString().padStart(3, '0')}`);
    }
    return keys;
}

/**
 * Generates all storage keys needed for data loading
 * @returns {Array<string>} Complete array of all storage keys
 */
function generateAllStorageKeys() {
    return [
        'groupCount',
        'urlCount',
        'dataModelVersion',
        'startPageEnabled',
        'openInNewTab',
        'colorTheme',  // Color customization
        'urls',      // Legacy format
        'groups',    // Legacy format
        ...generateGroupKeys(),
        ...generateURLKeys()
    ];
}

/**
 * Loads data from chrome.storage.sync with support for both chunked and legacy formats
 * @returns {Promise<Object>} Object containing groups, urls, and metadata
 */
async function loadDataFromStorage() {
    try {
        const keys = generateAllStorageKeys();
        const result = await chrome.storage.sync.get(keys);

        const data = {
            groups: [],
            urls: [],
            metadata: {
                groupCount: result.groupCount || 0,
                urlCount: result.urlCount || 0,
                dataModelVersion: result.dataModelVersion,
                startPageEnabled: result.startPageEnabled !== undefined ? result.startPageEnabled : true,
                openInNewTab: result.openInNewTab !== undefined ? result.openInNewTab : true,
                colorTheme: result.colorTheme || getDefaultColorTheme(),
                version: result.version,
                lastUpdated: result.lastUpdated
            }
        };

        // Load groups from chunked storage or legacy format
        if (result.groupCount || result.group00) {
            // New chunked format
            const groupCount = result.groupCount || 1; // At least 1 for ungrouped
            for (let i = 0; i < groupCount && i < 32; i++) {
                const key = `group${i.toString().padStart(2, '0')}`;
                if (result[key]) {
                    data.groups.push(result[key]);
                }
            }
            console.log(`Loaded ${data.groups.length} groups from chunked storage`);
        } else if (result.groups && Array.isArray(result.groups)) {
            // Legacy format
            data.groups = result.groups;
            console.log(`Loaded ${data.groups.length} groups from legacy storage`);
        }

        // Load URLs from chunked storage or legacy format
        if (result.urlCount || result.url000) {
            // New chunked format
            const urlCount = result.urlCount || 0;
            for (let i = 0; i < urlCount && i < 400; i++) {
                const key = `url${i.toString().padStart(3, '0')}`;
                if (result[key]) {
                    data.urls.push(result[key]);
                }
            }
            console.log(`Loaded ${data.urls.length} URLs from chunked storage`);
        } else if (result.urls && Array.isArray(result.urls)) {
            // Legacy format
            data.urls = result.urls;
            console.log(`Loaded ${data.urls.length} URLs from legacy storage`);
        }

        return data;
    } catch (error) {
        console.error('Error loading data from storage:', error);
        throw error;
    }
}

/**
 * Saves data to chrome.storage.sync using chunked format
 * @param {Array} groups - Array of group objects (can be plain objects or GroupDataModel instances)
 * @param {Array} urls - Array of URL objects (can be plain objects or URLDataModel instances)
 * @param {Object} metadata - Additional metadata to save
 * @returns {Promise<void>}
 */
async function saveDataToStorage(groups, urls, metadata = {}) {
    try {
        // Prepare storage data object with metadata
        const storageData = {
            lastUpdated: new Date().toISOString(),
            version: metadata.version || '1.0',
            dataModelVersion: metadata.dataModelVersion || '1.0',
            startPageEnabled: metadata.startPageEnabled !== undefined ? metadata.startPageEnabled : true,
            openInNewTab: metadata.openInNewTab !== undefined ? metadata.openInNewTab : true,
            colorTheme: metadata.colorTheme || getDefaultColorTheme()
        };

        // Convert data models to JSON if needed
        const groupsJSON = groups.map(g => g.toJSON ? g.toJSON() : g);
        const urlsJSON = urls.map(u => u.toJSON ? u.toJSON() : u);

        // Ensure Ungrouped group is first in the list
        const ungroupedGroup = groupsJSON.find(g => g.id === 'ungrouped');
        const otherGroups = groupsJSON.filter(g => g.id !== 'ungrouped');

        // Save groups in chunked format (group00-group31)
        if (ungroupedGroup) {
            storageData['group00'] = ungroupedGroup;
        }

        // Save other groups (maximum 31 additional groups)
        for (let i = 0; i < otherGroups.length && i < 31; i++) {
            storageData[`group${(i + 1).toString().padStart(2, '0')}`] = otherGroups[i];
        }
        storageData.groupCount = Math.min(groupsJSON.length, 32);

        // Save URLs in chunked format (url000-url399)
        for (let i = 0; i < urlsJSON.length && i < 400; i++) {
            storageData[`url${i.toString().padStart(3, '0')}`] = urlsJSON[i];
        }
        storageData.urlCount = Math.min(urlsJSON.length, 400);

        // Clean up old format data if it exists
        const keysToRemove = ['urls', 'groups'];
        await chrome.storage.sync.remove(keysToRemove);

        // Clean up unused chunk keys
        const currentGroupCount = storageData.groupCount || 0;
        const currentUrlCount = storageData.urlCount || 0;

        const cleanupKeys = [];
        for (let i = currentGroupCount; i < 32; i++) {
            cleanupKeys.push(`group${i.toString().padStart(2, '0')}`);
        }
        for (let i = currentUrlCount; i < 400; i++) {
            cleanupKeys.push(`url${i.toString().padStart(3, '0')}`);
        }

        if (cleanupKeys.length > 0) {
            await chrome.storage.sync.remove(cleanupKeys);
        }

        // Save data to storage
        await chrome.storage.sync.set(storageData);

        console.log('Data saved successfully to chrome.storage.sync using chunked format');
        console.log(`Saved ${storageData.groupCount} groups and ${storageData.urlCount} URLs`);
    } catch (error) {
        console.error('Error saving data to storage:', error);
        if (error.message && error.message.includes('quota')) {
            throw new Error('Storage limit reached. Consider deleting old bookmarks.');
        }
        throw error;
    }
}

/**
 * Gets storage usage information
 * @returns {Promise<Object>} Storage usage stats
 */
async function getStorageUsage() {
    try {
        const bytesInUse = await chrome.storage.sync.getBytesInUse();
        const maxBytes = chrome.storage.sync.QUOTA_BYTES || 102400; // 100KB default
        const percentUsed = Math.round((bytesInUse / maxBytes) * 100);

        return {
            bytesInUse,
            maxBytes,
            percentUsed,
            remainingBytes: maxBytes - bytesInUse,
            formatted: `${Math.round(bytesInUse / 1024 * 100) / 100}KB / ${Math.round(maxBytes / 1024)}KB (${percentUsed}%)`
        };
    } catch (error) {
        console.error('Error getting storage usage:', error);
        return {
            bytesInUse: 0,
            maxBytes: 102400,
            percentUsed: 0,
            remainingBytes: 102400,
            formatted: 'Unknown'
        };
    }
}

/**
 * Clears all storage data (use with caution)
 * @returns {Promise<void>}
 */
async function clearAllStorage() {
    try {
        await chrome.storage.sync.clear();
        console.log('All storage data cleared');
    } catch (error) {
        console.error('Error clearing storage:', error);
        throw error;
    }
}

/**
 * Removes specific keys from storage
 * @param {Array<string>} keys - Array of keys to remove
 * @returns {Promise<void>}
 */
async function removeStorageKeys(keys) {
    try {
        await chrome.storage.sync.remove(keys);
        console.log(`Removed ${keys.length} keys from storage`);
    } catch (error) {
        console.error('Error removing storage keys:', error);
        throw error;
    }
}

/**
 * Gets the default color theme
 * @returns {Object} Default color theme object
 */
function getDefaultColorTheme() {
    return {
        pageBackground: '#f5f5f5',
        groupHeaderBackground: '#fafafa',
        urlItemBackground: '#ffffff'
    };
}

/**
 * Loads the color theme from storage
 * @returns {Promise<Object>} Color theme object
 */
async function loadColorTheme() {
    try {
        const result = await chrome.storage.sync.get('colorTheme');
        return result.colorTheme || getDefaultColorTheme();
    } catch (error) {
        console.error('Error loading color theme:', error);
        return getDefaultColorTheme();
    }
}

/**
 * Saves the color theme to storage
 * @param {Object} colorTheme - Color theme object with pageBackground, groupHeaderBackground, urlItemBackground
 * @returns {Promise<void>}
 */
async function saveColorTheme(colorTheme) {
    try {
        // Validate color theme structure
        const validatedTheme = {
            pageBackground: colorTheme.pageBackground || getDefaultColorTheme().pageBackground,
            groupHeaderBackground: colorTheme.groupHeaderBackground || getDefaultColorTheme().groupHeaderBackground,
            urlItemBackground: colorTheme.urlItemBackground || getDefaultColorTheme().urlItemBackground
        };

        await chrome.storage.sync.set({ colorTheme: validatedTheme });
        console.log('Color theme saved successfully');
    } catch (error) {
        console.error('Error saving color theme:', error);
        throw error;
    }
}

/**
 * Resets the color theme to defaults
 * @returns {Promise<void>}
 */
async function resetColorTheme() {
    try {
        await saveColorTheme(getDefaultColorTheme());
        console.log('Color theme reset to defaults');
    } catch (error) {
        console.error('Error resetting color theme:', error);
        throw error;
    }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
        generateGroupKeys,
        generateURLKeys,
        generateAllStorageKeys,
        loadDataFromStorage,
        saveDataToStorage,
        getStorageUsage,
        clearAllStorage,
        removeStorageKeys,
        getDefaultColorTheme,
        loadColorTheme,
        saveColorTheme,
        resetColorTheme
    };
} else if (typeof self !== 'undefined') {
    // Service Worker or Web Worker environment - attach to self (global scope)
    self.StorageManager = {
        generateGroupKeys,
        generateURLKeys,
        generateAllStorageKeys,
        loadDataFromStorage,
        saveDataToStorage,
        getStorageUsage,
        clearAllStorage,
        removeStorageKeys,
        getDefaultColorTheme,
        loadColorTheme,
        saveColorTheme,
        resetColorTheme
    };
} else if (typeof window !== 'undefined') {
    // Browser environment - attach to window
    window.StorageManager = {
        generateGroupKeys,
        generateURLKeys,
        generateAllStorageKeys,
        loadDataFromStorage,
        saveDataToStorage,
        getStorageUsage,
        clearAllStorage,
        removeStorageKeys,
        getDefaultColorTheme,
        loadColorTheme,
        saveColorTheme,
        resetColorTheme
    };
}