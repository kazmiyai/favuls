// Chrome Extension Popup JavaScript
// Task 2.3: Current Tab URL Capture functionality
// Task 2.4: In-Memory URL Display

class BookmarkManager {
    constructor() {
        this.urls = [];
        this.groups = [];
        // Task 2.4: In-memory mode for this phase (will be disabled in Phase 3)
        this.inMemoryMode = false; // Set to true for Task 2.4 testing
        this.init();
    }

    async init() {
        // Initialize default group for in-memory mode
        this.initializeDefaultGroup();

        if (!this.inMemoryMode) {
            await this.loadData();
        }

        this.setupEventListeners();
        this.renderURLs();
    }

    // Initialize default group (Task 2.4: in-memory setup)
    initializeDefaultGroup() {
        if (!this.groups.find(g => g.id === 'ungrouped')) {
            this.groups.push({
                id: 'ungrouped',
                name: 'Ungrouped',
                created: new Date().toISOString()
            });
        }
    }

    // Data Management (Task 2.3: persistent storage)
    async loadData() {
        try {
            const result = await chrome.storage.sync.get(['urls', 'groups']);
            this.urls = result.urls || [];
            this.groups = result.groups || [];

            // Ensure default "Ungrouped" group exists
            this.initializeDefaultGroup();

            if (this.groups.some(g => g.id === 'ungrouped' && !result.groups)) {
                await this.saveData();
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load bookmarks');
            // Fallback to in-memory mode
            this.inMemoryMode = true;
            this.initializeDefaultGroup();
        }
    }

    async saveData() {
        if (this.inMemoryMode) {
            console.log('In-memory mode: Data not persisted to storage');
            return;
        }

        try {
            await chrome.storage.sync.set({
                urls: this.urls,
                groups: this.groups
            });
        } catch (error) {
            console.error('Error saving data:', error);
            this.showError('Failed to save bookmarks');
        }
    }

    // Event Listeners
    setupEventListeners() {
        // Save Current Tab button
        const saveCurrentBtn = document.querySelector('.add-current-url');
        if (saveCurrentBtn) {
            saveCurrentBtn.addEventListener('click', () => this.captureCurrentTab());
        }

        // URL list click handler for opening URLs
        const urlList = document.getElementById('urlList');
        if (urlList) {
            urlList.addEventListener('click', (e) => this.handleURLClick(e));
        }
    }

    // Current Tab URL Capture (Task 2.3 core functionality)
    async captureCurrentTab() {
        try {
            this.showLoading('Capturing current tab...');

            // Get current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) {
                throw new Error('No active tab found');
            }

            // Extract URL and title
            const url = tab.url;
            const title = tab.title || url;

            // Validate URL
            if (!this.isValidURL(url)) {
                throw new Error('Invalid URL detected');
            }

            // Check for duplicates
            const existingURL = this.urls.find(u => u.url === url);
            if (existingURL) {
                this.showMessage('URL already saved!');
                this.hideLoading();
                return;
            }

            // Create new URL object
            const newURL = {
                id: this.generateUniqueId(),
                url: url,
                title: title,
                timestamp: new Date().toISOString(),
                groupId: 'ungrouped' // Default to ungrouped
            };

            // Add to URLs array (Task 2.4: in-memory display)
            this.urls.unshift(newURL); // Add to beginning for most recent first

            // Save to storage (if not in memory-only mode)
            await this.saveData();

            // Update UI (Task 2.4: display captured URLs)
            this.renderURLs();

            // Show appropriate success message
            const message = this.inMemoryMode
                ? 'URL saved (in-memory only)!'
                : 'URL saved successfully!';
            this.showMessage(message);

            this.hideLoading();
        } catch (error) {
            console.error('Error capturing tab:', error);
            this.showError(error.message || 'Failed to capture current tab');
            this.hideLoading();
        }
    }

    // URL Validation
    isValidURL(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    // Generate unique ID
    generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // URL List Rendering
    renderURLs() {
        const urlList = document.getElementById('urlList');
        const emptyState = document.getElementById('emptyState');

        if (!urlList) return;

        // Clear existing content
        urlList.innerHTML = '';

        if (this.urls.length === 0) {
            // Show empty state
            urlList.appendChild(emptyState);
            return;
        }

        // Hide empty state and render URLs
        if (emptyState && emptyState.parentNode) {
            emptyState.style.display = 'none';
        }

        // Group URLs by groupId
        const groupedURLs = this.groupURLsByGroup();

        // Render each group
        Object.entries(groupedURLs).forEach(([groupId, urls]) => {
            const group = this.groups.find(g => g.id === groupId) || { id: groupId, name: 'Unknown Group' };

            // Create group header (for future implementation)
            if (Object.keys(groupedURLs).length > 1) {
                const groupHeader = this.createGroupHeader(group, urls.length);
                urlList.appendChild(groupHeader);
            }

            // Render URLs in this group
            urls.forEach(url => {
                const urlElement = this.createURLElement(url);
                urlList.appendChild(urlElement);
            });
        });
    }

    groupURLsByGroup() {
        const grouped = {};
        this.urls.forEach(url => {
            const groupId = url.groupId || 'ungrouped';
            if (!grouped[groupId]) {
                grouped[groupId] = [];
            }
            grouped[groupId].push(url);
        });
        return grouped;
    }

    createGroupHeader(group, count) {
        const header = document.createElement('div');
        header.className = 'group-header';
        header.innerHTML = `
            <span>${group.name}</span>
            <span class="group-count">${count}</span>
        `;
        return header;
    }

    createURLElement(urlData) {
        const urlElement = document.createElement('div');
        urlElement.className = 'url-item';
        urlElement.setAttribute('data-url-id', urlData.id);
        urlElement.setAttribute('tabindex', '0');
        urlElement.setAttribute('role', 'listitem');
        urlElement.setAttribute('aria-label', `Bookmark: ${urlData.title}`);

        // Task 2.4: Simple list display with URL and title
        // Get domain for favicon
        const domain = this.extractDomain(urlData.url);
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;

        // Create simplified display for Task 2.4 requirements
        urlElement.innerHTML = `
            <img class="url-favicon"
                 src="${faviconUrl}"
                 alt="Favicon for ${domain}"
                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjZjBmMGYwIi8+CjxwYXRoIGQ9Ik0zIDRoMTB2OEgzeiIgZmlsbD0iIzk5OSIvPgo8L3N2Zz4='">
            <div class="url-content">
                <div class="url-title">${this.escapeHtml(urlData.title)}</div>
                <div class="url-address">${this.escapeHtml(urlData.url)}</div>
                ${this.inMemoryMode ? '<div class="url-memory-tag">In-Memory</div>' : ''}
            </div>
            <div class="url-actions">
                <button class="url-action-btn" data-action="edit" aria-label="Edit bookmark" title="Edit">
                    ✏️
                </button>
                <button class="url-action-btn" data-action="delete" aria-label="Delete bookmark" title="Delete">
                    🗑️
                </button>
            </div>
        `;

        // Add click handler for opening URL
        urlElement.addEventListener('click', (e) => {
            if (!e.target.closest('.url-actions')) {
                this.openURL(urlData.url);
            }
        });

        // Add keyboard navigation
        urlElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!e.target.closest('.url-actions')) {
                    this.openURL(urlData.url);
                }
            }
        });

        return urlElement;
    }

    // URL Click Handler
    handleURLClick(e) {
        const urlItem = e.target.closest('.url-item');
        if (!urlItem) return;

        const action = e.target.getAttribute('data-action');
        const urlId = urlItem.getAttribute('data-url-id');

        if (action === 'edit') {
            this.editURL(urlId);
        } else if (action === 'delete') {
            this.deleteURL(urlId);
        }
    }

    // Open URL in new tab
    async openURL(url) {
        try {
            await chrome.tabs.create({ url: url });
            window.close(); // Close popup after opening URL
        } catch (error) {
            console.error('Error opening URL:', error);
            this.showError('Failed to open URL');
        }
    }

    // Placeholder methods for future implementation
    editURL(urlId) {
        console.log('Edit URL:', urlId);
        this.showMessage('Edit functionality coming in next phase');
    }

    deleteURL(urlId) {
        console.log('Delete URL:', urlId);
        this.showMessage('Delete functionality coming in next phase');
    }

    // Utility Methods
    extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch (e) {
            return 'unknown';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // UI Feedback Methods
    showLoading(message = 'Loading...') {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = document.querySelector('.loading-text');

        if (loadingOverlay && loadingText) {
            loadingText.textContent = message;
            loadingOverlay.style.display = 'flex';
            loadingOverlay.setAttribute('aria-hidden', 'false');
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
            loadingOverlay.setAttribute('aria-hidden', 'true');
        }
    }

    showMessage(message) {
        // Simple toast notification (will be enhanced in later phases)
        console.log('Message:', message);

        // Create temporary toast element
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #4CAF50;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    showError(message) {
        console.error('Error:', message);

        // Create temporary error toast
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #f44336;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }
}

// Initialize the bookmark manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BookmarkManager();
});

// Handle storage changes from other instances
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && (changes.urls || changes.groups)) {
        // Reload data if it changed in another instance
        window.location.reload();
    }
});