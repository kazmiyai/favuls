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

// Initialize extension with default data
async function initializeExtension() {
    try {
        // Create default "Ungrouped" group if it doesn't exist
        const result = await chrome.storage.sync.get(['groups']);
        if (!result.groups || !result.groups.find(g => g.id === 'ungrouped')) {
            const defaultGroup = {
                id: 'ungrouped',
                name: 'Ungrouped',
                created: new Date().toISOString()
            };

            await chrome.storage.sync.set({
                groups: [defaultGroup],
                urls: []
            });

            console.log('Default group created');
        }
    } catch (error) {
        console.error('Error initializing extension:', error);
    }
}

// Handle extension icon click (optional, as popup is already configured)
chrome.action.onClicked.addListener((tab) => {
    // This won't be called if popup is configured, but kept for completeness
    console.log('Extension icon clicked for tab:', tab.url);
});

// Handle storage changes and sync across devices
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
        console.log('Storage sync changes detected:', changes);

        // Notify any open popups about data changes
        chrome.runtime.sendMessage({
            type: 'storage_changed',
            changes: changes
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