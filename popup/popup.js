// Chrome Extension Popup JavaScript
// Task 2.3: Current Tab URL Capture functionality
// Task 2.4: In-Memory URL Display
// Task 3.3: Complete Data Model Implementation

// Data Model Classes (Task 3.3)
class URLDataModel {
    constructor(data = {}) {
        this.id = data.id || this.generateUniqueId();
        this.url = data.url || '';
        this.title = data.title || '';
        this.timestamp = data.timestamp || new Date().toISOString();
        this.groupId = data.groupId || 'ungrouped';
        this.created = data.created || new Date().toISOString();
        this.lastModified = data.lastModified || new Date().toISOString();
        this.domain = data.domain || this.extractDomain(this.url);
        this.favicon = data.favicon || this.generateFaviconUrl(this.domain);
        this.tags = data.tags || [];
        this.isValidated = false;
    }

    generateUniqueId() {
        return 'url_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }

    extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch (e) {
            return 'unknown';
        }
    }

    generateFaviconUrl(domain) {
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    }

    validate() {
        const errors = [];

        if (!this.url || typeof this.url !== 'string') {
            errors.push('URL is required and must be a string');
        } else {
            try {
                const urlObj = new URL(this.url);
                if (!['http:', 'https:'].includes(urlObj.protocol)) {
                    errors.push('URL must use HTTP or HTTPS protocol');
                }
            } catch (e) {
                errors.push('URL format is invalid');
            }
        }

        if (!this.title || typeof this.title !== 'string') {
            errors.push('Title is required and must be a string');
        }

        if (!this.id || typeof this.id !== 'string') {
            errors.push('ID is required and must be a string');
        }

        if (!this.groupId || typeof this.groupId !== 'string') {
            errors.push('Group ID is required and must be a string');
        }

        this.isValidated = errors.length === 0;
        return { isValid: this.isValidated, errors };
    }

    toJSON() {
        return {
            id: this.id,
            url: this.url,
            title: this.title,
            timestamp: this.timestamp,
            groupId: this.groupId,
            created: this.created,
            lastModified: this.lastModified,
            domain: this.domain,
            favicon: this.favicon,
            tags: this.tags
        };
    }

    static fromJSON(data) {
        return new URLDataModel(data);
    }
}

class GroupDataModel {
    constructor(data = {}) {
        this.id = data.id || this.generateUniqueId();
        this.name = data.name || '';
        this.created = data.created || new Date().toISOString();
        this.lastModified = data.lastModified || new Date().toISOString();
        this.isDefault = data.isDefault || false;
        this.protected = data.protected || false;
        this.color = data.color || '#2196f3';
        this.description = data.description || '';
        this.urlCount = data.urlCount || 0;
        this.isValidated = false;
    }

    generateUniqueId() {
        return 'group_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }

    validate() {
        const errors = [];

        if (!this.name || typeof this.name !== 'string') {
            errors.push('Group name is required and must be a string');
        } else if (this.name.length > 50) {
            errors.push('Group name must be 50 characters or less');
        }

        if (!this.id || typeof this.id !== 'string') {
            errors.push('Group ID is required and must be a string');
        }

        if (this.color && !/^#[0-9A-F]{6}$/i.test(this.color)) {
            errors.push('Color must be a valid hex color code');
        }

        this.isValidated = errors.length === 0;
        return { isValid: this.isValidated, errors };
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            created: this.created,
            lastModified: this.lastModified,
            isDefault: this.isDefault,
            protected: this.protected,
            color: this.color,
            description: this.description,
            urlCount: this.urlCount
        };
    }

    static fromJSON(data) {
        return new GroupDataModel(data);
    }

    static createDefault() {
        return new GroupDataModel({
            id: 'ungrouped',
            name: 'Ungrouped',
            isDefault: true,
            protected: true,
            color: '#9e9e9e',
            description: 'Default group for uncategorized bookmarks'
        });
    }
}

class BookmarkManager {
    constructor() {
        // Task 3.3: Complete data model implementation
        this.urls = []; // Array of URLDataModel instances
        this.groups = []; // Array of GroupDataModel instances
        // Task 3.1: Full persistent storage with chrome.storage.sync
        this.storageQuotaUsed = 0;
        this.storageQuotaLimit = 100 * 1024; // 100KB limit for chrome.storage.sync
        // Task 3.3: Data validation and integrity
        this.dataModelVersion = '1.0';
        this.lastDataValidation = null;
        this.init();
    }

    async init() {
        // Initialize default group for in-memory mode
        this.initializeDefaultGroup();

        await this.loadData();
        await this.updateStorageQuota();

        this.setupEventListeners();
        this.renderURLs();
    }

    // Initialize default group (Task 3.3: Enhanced with data models)
    initializeDefaultGroup() {
        const defaultGroup = this.getDefaultGroup();
        if (!defaultGroup) {
            const newDefaultGroup = GroupDataModel.createDefault();
            this.groups.unshift(newDefaultGroup); // Add at beginning for UI priority
            console.log('Default "Ungrouped" group created with data model');
        } else {
            // Ensure default group has proper metadata and convert to model if needed
            this.ensureDefaultGroupMetadata(defaultGroup);
        }
    }

    // Get the default "Ungrouped" group
    getDefaultGroup() {
        return this.groups.find(g => g.id === 'ungrouped');
    }

    // Ensure default group has correct metadata
    ensureDefaultGroupMetadata(defaultGroup) {
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
            console.log('Default group metadata updated');
        }
    }

    // Data Management (Task 3.3: Enhanced with data models)
    async loadData() {
        try {
            const result = await chrome.storage.sync.get(['urls', 'groups', 'dataModelVersion']);

            // Convert loaded data to data model instances
            this.urls = (result.urls || []).map(urlData => URLDataModel.fromJSON(urlData));
            this.groups = (result.groups || []).map(groupData => GroupDataModel.fromJSON(groupData));

            // Check for data model version compatibility
            if (result.dataModelVersion && result.dataModelVersion !== this.dataModelVersion) {
                console.log(`Data model migration needed: ${result.dataModelVersion} -> ${this.dataModelVersion}`);
                await this.migrateDataModel(result.dataModelVersion);
            }

            // Ensure default "Ungrouped" group exists
            this.initializeDefaultGroup();

            // Validate data integrity and fix issues
            await this.validateAndFixDataIntegrity();

            // Update URL counts in groups
            this.updateGroupUrlCounts();

            // Save if we made any fixes or if this is first time setup
            if (this.lastDataValidation && this.lastDataValidation.hasChanges) {
                await this.saveData();
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load bookmarks');
            // Initialize with empty data if storage fails
            this.urls = [];
            this.groups = [];
            this.initializeDefaultGroup();
            await this.saveData(); // Save initial state
        }
    }

    async saveData() {
        try {
            // Check storage quota before saving
            const dataSize = this.calculateDataSize();
            if (dataSize > this.storageQuotaLimit) {
                throw new Error(`Storage quota exceeded. Data size: ${Math.round(dataSize/1024)}KB, Limit: ${Math.round(this.storageQuotaLimit/1024)}KB`);
            }

            // Save data with storage quota management (Task 3.3: Serialize data models)
            const serializedData = {
                urls: this.urls.map(url => url.toJSON()),
                groups: this.groups.map(group => group.toJSON()),
                lastUpdated: new Date().toISOString(),
                version: '1.0',
                dataModelVersion: this.dataModelVersion
            };

            await chrome.storage.sync.set(serializedData);

            // Update storage quota tracking
            await this.updateStorageQuota();

            console.log('Data saved successfully to chrome.storage.sync');
        } catch (error) {
            console.error('Error saving data:', error);
            if (error.message.includes('quota')) {
                this.showError('Storage limit reached. Consider deleting old bookmarks.');
            } else {
                this.showError('Failed to save bookmarks: ' + error.message);
            }
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

            // Create new URL object with data model (Task 3.3)
            const defaultGroupId = this.getDefaultGroupId();
            const newURL = new URLDataModel({
                url: url,
                title: title,
                groupId: defaultGroupId
            });

            // Validate the new URL data
            const validation = newURL.validate();
            if (!validation.isValid) {
                throw new Error(`Invalid URL data: ${validation.errors.join(', ')}`);
            }

            // Add to URLs array (Task 2.4: in-memory display)
            this.urls.unshift(newURL); // Add to beginning for most recent first

            // Save to storage (if not in memory-only mode)
            await this.saveData();

            // Update UI (Task 2.4: display captured URLs)
            this.renderURLs();

            // Show success message with storage info
            const storageInfo = await this.getStorageInfo();
            this.showMessage(`URL saved successfully! (Storage: ${storageInfo})`);

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

    // Get default group ID (Task 3.2: Default assignment for new URLs)
    getDefaultGroupId() {
        const defaultGroup = this.getDefaultGroup();
        if (!defaultGroup) {
            // Ensure default group exists
            this.initializeDefaultGroup();
            return 'ungrouped';
        }
        return defaultGroup.id;
    }

    // Data Model Management (Task 3.3)
    async validateAndFixDataIntegrity() {
        const result = {
            hasChanges: false,
            urlsFixed: 0,
            groupsFixed: 0,
            validationErrors: []
        };

        // Validate and fix URL data
        result.urlsFixed = this.validateAndFixURLs();

        // Validate and fix group data
        result.groupsFixed = this.validateAndFixGroups();

        // Update group URL counts
        this.updateGroupUrlCounts();

        result.hasChanges = result.urlsFixed > 0 || result.groupsFixed > 0;
        this.lastDataValidation = result;

        if (result.hasChanges) {
            console.log(`Data integrity check: Fixed ${result.urlsFixed} URLs and ${result.groupsFixed} groups`);
        }

        return result;
    }

    validateAndFixURLs() {
        let fixedCount = 0;
        const defaultGroupId = this.getDefaultGroupId();

        this.urls.forEach((url, index) => {
            // Convert plain objects to URLDataModel instances if needed
            if (!(url instanceof URLDataModel)) {
                this.urls[index] = URLDataModel.fromJSON(url);
                fixedCount++;
            }

            // Check if URL has a valid group assignment
            if (!url.groupId || !this.groups.find(g => g.id === url.groupId)) {
                url.groupId = defaultGroupId;
                url.lastModified = new Date().toISOString();
                fixedCount++;
            }

            // Validate URL data integrity
            const validation = url.validate();
            if (!validation.isValid) {
                console.warn(`URL validation failed for ${url.id}:`, validation.errors);
            }
        });

        return fixedCount;
    }

    validateAndFixGroups() {
        let fixedCount = 0;

        this.groups.forEach((group, index) => {
            // Convert plain objects to GroupDataModel instances if needed
            if (!(group instanceof GroupDataModel)) {
                this.groups[index] = GroupDataModel.fromJSON(group);
                fixedCount++;
            }

            // Validate group data integrity
            const validation = group.validate();
            if (!validation.isValid) {
                console.warn(`Group validation failed for ${group.id}:`, validation.errors);
            }
        });

        return fixedCount;
    }

    updateGroupUrlCounts() {
        // Reset all counts
        this.groups.forEach(group => {
            group.urlCount = 0;
        });

        // Count URLs in each group
        this.urls.forEach(url => {
            const group = this.groups.find(g => g.id === url.groupId);
            if (group) {
                group.urlCount++;
            }
        });
    }

    async migrateDataModel(fromVersion) {
        console.log(`Migrating data model from version ${fromVersion} to ${this.dataModelVersion}`);

        // Future migration logic would go here
        // For now, just update the version

        return true;
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

    // Group Protection (Task 3.2: Default group protection)
    canDeleteGroup(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return false;

        // Cannot delete the default "Ungrouped" group
        if (group.id === 'ungrouped' || group.isDefault || group.protected) {
            return false;
        }

        return true;
    }

    // Move URLs from deleted group to default group
    moveURLsToDefaultGroup(fromGroupId) {
        const defaultGroupId = this.getDefaultGroupId();
        let movedCount = 0;

        this.urls.forEach(url => {
            if (url.groupId === fromGroupId) {
                url.groupId = defaultGroupId;
                movedCount++;
            }
        });

        console.log(`Moved ${movedCount} URLs from group ${fromGroupId} to default group`);
        return movedCount;
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

    // Storage Quota Management (Task 3.3: Updated for data models)
    calculateDataSize() {
        const data = {
            urls: this.urls.map(url => url.toJSON()),
            groups: this.groups.map(group => group.toJSON()),
            lastUpdated: new Date().toISOString(),
            version: '1.0',
            dataModelVersion: this.dataModelVersion
        };
        return new Blob([JSON.stringify(data)]).size;
    }

    async updateStorageQuota() {
        try {
            const usage = await chrome.storage.sync.getBytesInUse();
            this.storageQuotaUsed = usage;
            console.log(`Storage usage: ${usage} bytes (${Math.round(usage/1024 * 100)/100}KB)`);
        } catch (error) {
            console.warn('Could not get storage usage:', error);
        }
    }

    async getStorageInfo() {
        const usageKB = Math.round(this.storageQuotaUsed / 1024 * 100) / 100;
        const limitKB = Math.round(this.storageQuotaLimit / 1024);
        const percentage = Math.round((this.storageQuotaUsed / this.storageQuotaLimit) * 100);
        return `${usageKB}KB/${limitKB}KB (${percentage}%)`;
    }

    async optimizeStorage() {
        // Remove oldest URLs if storage is getting full
        if (this.storageQuotaUsed > this.storageQuotaLimit * 0.9) {
            const urlsToRemove = Math.ceil(this.urls.length * 0.1); // Remove 10% oldest
            this.urls.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            this.urls.splice(0, urlsToRemove);

            await this.saveData();
            this.showMessage(`Storage optimized: removed ${urlsToRemove} oldest bookmarks`);
        }
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