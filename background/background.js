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
        // Get existing data
        const result = await chrome.storage.sync.get(['groups', 'urls', 'version', 'lastUpdated']);

        // Initialize empty arrays if data doesn't exist
        const groups = result.groups || [];
        const urls = result.urls || [];

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

        // Validate and fix URL group assignments
        let fixedUrlCount = 0;
        urls.forEach(url => {
            if (!url.groupId || !groups.find(g => g.id === url.groupId)) {
                url.groupId = 'ungrouped';
                fixedUrlCount++;
            }
        });

        if (fixedUrlCount > 0) {
            console.log(`Fixed ${fixedUrlCount} URLs with invalid group assignments in background`);
        }

        // Set initial data with version tracking
        await chrome.storage.sync.set({
            groups: groups,
            urls: urls,
            version: '1.0',
            lastUpdated: new Date().toISOString()
        });

        // Log storage usage
        const usage = await chrome.storage.sync.getBytesInUse();
        console.log(`Extension initialized. Storage usage: ${usage} bytes (${Math.round(usage/1024 * 100)/100}KB)`);

    } catch (error) {
        console.error('Error initializing extension:', error);

        // Fallback: try to clear storage and reinitialize
        try {
            await chrome.storage.sync.clear();
            await initializeExtension();
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