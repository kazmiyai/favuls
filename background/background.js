// Background script for FavURL Chrome Extension
// Manifest V3 Service Worker

// Extension installation and updates
chrome.runtime.onInstalled.addListener((details) => {
    console.log('FavURL extension installed/updated:', details.reason);

    // Initialize default data if needed
    if (details.reason === 'install') {
        initializeExtension();
    }
});

// Initialize extension with default data (Task 3.1: Enhanced storage initialization)
async function initializeExtension() {
    try {
        // Get existing data - check both legacy and new structure
        const legacyResult = await chrome.storage.sync.get(['groups', 'urls', 'version', 'lastUpdated']);

        // Check if we have legacy URL storage
        const hasLegacyUrls = legacyResult.urls && Array.isArray(legacyResult.urls) && legacyResult.urls.length > 0;

        // Initialize groups
        const groups = legacyResult.groups || [];

        // Create default "Ungrouped" group if it doesn't exist (Task 3.2: Enhanced default group)
        let defaultGroup = groups.find(g => g.id === 'ungrouped');
        if (!defaultGroup) {
            defaultGroup = {
                id: 'ungrouped',
                name: 'Ungrouped',
                created: new Date().toISOString(),
                isDefault: true,
                protected: true
            };
            groups.unshift(defaultGroup); // Add at beginning for UI priority
            console.log('Default "Ungrouped" group created in background');
        } else {
            // Ensure default group has proper metadata
            let updated = false;
            if (!defaultGroup.isDefault) {
                defaultGroup.isDefault = true;
                updated = true;
            }
            if (!defaultGroup.protected) {
                defaultGroup.protected = true;
                updated = true;
            }
            if (!defaultGroup.name || defaultGroup.name !== 'Ungrouped') {
                defaultGroup.name = 'Ungrouped';
                updated = true;
            }
            if (updated) {
                console.log('Default group metadata updated in background');
            }
        }

        let urls = [];
        let fixedUrlCount = 0;

        if (hasLegacyUrls) {
            console.log('Legacy URLs detected in background, will be migrated on first popup load');
            urls = legacyResult.urls;
        } else {
            // Load URLs from new 32-key structure
            console.log('Loading URLs from 32-key storage structure in background...');
            const urlKeys = [];
            for (let i = 0; i <= 31; i++) {
                urlKeys.push(`urls${i}`);
            }
            const urlsResult = await chrome.storage.sync.get(urlKeys);

            // Combine URLs from all keys
            for (const key of urlKeys) {
                if (urlsResult[key] && Array.isArray(urlsResult[key])) {
                    urls.push(...urlsResult[key]);
                }
            }
            console.log(`Loaded ${urls.length} URLs from 32-key storage structure in background`);
        }

        // Validate and fix URL group assignments
        urls.forEach(url => {
            if (!url.groupId || !groups.find(g => g.id === url.groupId)) {
                url.groupId = 'ungrouped';
                fixedUrlCount++;
            }
        });

        if (fixedUrlCount > 0) {
            console.log(`Fixed ${fixedUrlCount} URLs with invalid group assignments in background`);
        }

        // Save data using appropriate structure
        if (hasLegacyUrls || urls.length === 0) {
            // For new installs or legacy data, save metadata only
            // URLs will be migrated/saved by popup.js when first opened
            await chrome.storage.sync.set({
                groups: groups,
                version: '1.0',
                lastUpdated: new Date().toISOString()
            });

            if (hasLegacyUrls) {
                console.log('Legacy URL storage detected, migration will occur on first popup open');
            }
        } else {
            // Initialize 32-key storage structure with empty arrays
            const storageData = {
                groups: groups,
                version: '1.0',
                lastUpdated: new Date().toISOString()
            };

            // Initialize all URL storage keys as empty arrays
            for (let i = 0; i <= 31; i++) {
                storageData[`urls${i}`] = [];
            }

            await chrome.storage.sync.set(storageData);
            console.log('32-key storage structure initialized in background');
        }

        // Log storage usage
        const usage = await chrome.storage.sync.getBytesInUse();
        console.log(`Extension initialized. Storage usage: ${usage} bytes (${Math.round(usage/1024 * 100)/100}KB)`);

    } catch (error) {
        console.error('Error initializing extension:', error);

        // Fallback: try to clear storage and reinitialize
        try {
            await chrome.storage.sync.clear();
            console.log('Storage cleared, reinitializing with minimal data...');

            // Create minimal initialization
            await chrome.storage.sync.set({
                groups: [{
                    id: 'ungrouped',
                    name: 'Ungrouped',
                    created: new Date().toISOString(),
                    isDefault: true,
                    protected: true
                }],
                version: '1.0',
                lastUpdated: new Date().toISOString()
            });

            // Initialize empty URL storage keys
            const emptyUrlStorage = {};
            for (let i = 0; i <= 31; i++) {
                emptyUrlStorage[`urls${i}`] = [];
            }
            await chrome.storage.sync.set(emptyUrlStorage);

            console.log('Fallback initialization completed');

            const usage = await chrome.storage.sync.getBytesInUse();
            console.log(`Fallback storage usage: ${usage} bytes (${Math.round(usage/1024 * 100)/100}KB)`);
        } catch (fallbackError) {
            console.error('Fallback initialization failed:', fallbackError);
        }
    }
}

// Handle extension icon click (optional, as popup is already configured)
chrome.action.onClicked.addListener((tab) => {
    // This won't be called if popup is configured, but kept for completeness
    console.log('Extension icon clicked for tab:', tab.url);
});

// Handle storage changes and sync across devices (Task 3.1: Enhanced sync handling)
chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'sync') {
        console.log('Storage sync changes detected:', changes);

        // Log detailed change information
        for (const [key, change] of Object.entries(changes)) {
            if (change.oldValue !== undefined && change.newValue !== undefined) {
                console.log(`${key} updated:`, {
                    oldSize: JSON.stringify(change.oldValue).length,
                    newSize: JSON.stringify(change.newValue).length
                });
            } else if (change.newValue !== undefined) {
                console.log(`${key} created:`, {
                    size: JSON.stringify(change.newValue).length
                });
            } else {
                console.log(`${key} deleted`);
            }
        }

        // Update storage usage tracking
        try {
            const usage = await chrome.storage.sync.getBytesInUse();
            console.log(`Current storage usage: ${usage} bytes (${Math.round(usage/1024 * 100)/100}KB)`);
        } catch (error) {
            console.warn('Could not get storage usage:', error);
        }

        // Notify any open popups about data changes
        chrome.runtime.sendMessage({
            type: 'storage_changed',
            changes: changes,
            timestamp: new Date().toISOString()
        }).catch(() => {
            // Ignore errors if no popup is open
        });
    }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);

    switch (message.type) {
        case 'get_current_tab':
            getCurrentTab().then(sendResponse);
            return true; // Indicates async response

        case 'open_url':
            openURL(message.url).then(sendResponse);
            return true;

        default:
            console.log('Unknown message type:', message.type);
    }
});

// Helper function to get current active tab
async function getCurrentTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return { success: true, tab: tab };
    } catch (error) {
        console.error('Error getting current tab:', error);
        return { success: false, error: error.message };
    }
}

// Helper function to open URL in new tab
async function openURL(url) {
    try {
        const tab = await chrome.tabs.create({ url: url });
        return { success: true, tab: tab };
    } catch (error) {
        console.error('Error opening URL:', error);
        return { success: false, error: error.message };
    }
}

// Handle tab updates for potential future features
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Currently not used, but available for future enhancements
    if (changeInfo.status === 'complete' && tab.url) {
        // Could be used for auto-suggestions or other features
    }
});

console.log('FavURL background script loaded');