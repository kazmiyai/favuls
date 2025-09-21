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
        return 'url_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 11);
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
        return 'group_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 11);
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
        // Task 4.2: Group display state management
        this.groupExpandedState = {}; // Track which groups are expanded/collapsed
        this.init();
    }

    async init() {
        // Initialize default group for in-memory mode
        this.initializeDefaultGroup();

        await this.loadData();
        await this.loadGroupExpandedState();
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

        // Create Group button
        const createGroupBtn = document.querySelector('.create-group-btn');
        if (createGroupBtn) {
            createGroupBtn.addEventListener('click', () => this.openCreateGroupModal());
        }

        // Add URL button
        const addURLBtn = document.querySelector('.add-manual-url');
        if (addURLBtn) {
            addURLBtn.addEventListener('click', () => this.openAddURLModal());
        }

        // Modal close button
        const modalClose = document.querySelector('.modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => this.closeModal());
        }

        // Modal overlay click to close
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    this.closeModal();
                }
            });
        }

        // Keyboard navigation for modal and groups
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isModalOpen()) {
                this.closeModal();
            }

            // Group navigation with arrow keys
            if (e.target.classList.contains('group-header')) {
                this.handleGroupHeaderKeyNavigation(e);
            }
        });

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
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
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

    // URL List Rendering (Task 4.2: Enhanced group display)
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

        // Sort groups to show ungrouped first, then others alphabetically
        const sortedGroupIds = Object.keys(groupedURLs).sort((a, b) => {
            if (a === 'ungrouped') return -1;
            if (b === 'ungrouped') return 1;
            const groupA = this.groups.find(g => g.id === a);
            const groupB = this.groups.find(g => g.id === b);
            const nameA = groupA ? groupA.name : 'Unknown';
            const nameB = groupB ? groupB.name : 'Unknown';
            return nameA.localeCompare(nameB);
        });

        // Render each group
        sortedGroupIds.forEach(groupId => {
            const urls = groupedURLs[groupId];
            const group = this.groups.find(g => g.id === groupId) || {
                id: groupId,
                name: 'Unknown Group',
                color: '#6c757d'
            };

            // Always create group header now (Task 4.2: Group headers)
            const groupHeader = this.createGroupHeader(group, urls.length);
            urlList.appendChild(groupHeader);

            // Create group container for URLs
            const groupContainer = this.createGroupContainer(groupId, urls);
            urlList.appendChild(groupContainer);
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
        header.setAttribute('id', `group-header-${group.id}`);
        header.setAttribute('data-group-id', group.id);
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', this.isGroupExpanded(group.id).toString());
        header.setAttribute('aria-label', `Toggle ${group.name} group with ${count} bookmark${count !== 1 ? 's' : ''}`);

        const isExpanded = this.isGroupExpanded(group.id);
        const chevronIcon = isExpanded ? '▼' : '▶';

        header.innerHTML = `
            <div class="group-header-content">
                <span class="group-chevron" aria-hidden="true">${chevronIcon}</span>
                <span class="group-name" style="color: ${group.color || '#2196f3'}">${this.escapeHtml(group.name)}</span>
                <span class="group-count">${count}</span>
            </div>
        `;

        // Add click handler for expand/collapse
        header.addEventListener('click', () => {
            this.toggleGroupExpanded(group.id);
        });

        // Add keyboard handler
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleGroupExpanded(group.id);
            }
        });

        // Task 4.3: Add drag-and-drop support for group headers
        header.addEventListener('dragover', (e) => {
            this.handleGroupDragOver(e, group.id);
        });

        header.addEventListener('drop', (e) => {
            this.handleGroupDrop(e, group.id);
        });

        header.addEventListener('dragenter', (e) => {
            this.handleGroupDragEnter(e, group.id);
        });

        header.addEventListener('dragleave', (e) => {
            this.handleGroupDragLeave(e);
        });

        return header;
    }

    createGroupContainer(groupId, urls) {
        const container = document.createElement('div');
        container.className = 'group-container';
        container.setAttribute('data-group-container-id', groupId);
        container.setAttribute('role', 'group');
        container.setAttribute('aria-labelledby', `group-header-${groupId}`);

        const isExpanded = this.isGroupExpanded(groupId);
        container.classList.add(isExpanded ? 'group-expanded' : 'group-collapsed');

        // Add URLs to container
        urls.forEach(url => {
            const urlElement = this.createURLElement(url);
            container.appendChild(urlElement);
        });

        return container;
    }

    createURLElement(urlData) {
        const urlElement = document.createElement('div');
        urlElement.className = 'url-item';
        urlElement.setAttribute('data-url-id', urlData.id);
        urlElement.setAttribute('tabindex', '0');
        urlElement.setAttribute('role', 'listitem');
        urlElement.setAttribute('aria-label', `Bookmark: ${urlData.title}`);

        // Task 4.3: Make URLs draggable for group assignment
        urlElement.setAttribute('draggable', 'true');
        urlElement.setAttribute('data-group-id', urlData.groupId);

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

        // Task 4.3: Add drag-and-drop event listeners
        urlElement.addEventListener('dragstart', (e) => {
            this.handleURLDragStart(e, urlData);
        });

        urlElement.addEventListener('dragend', (e) => {
            this.handleURLDragEnd(e);
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

    // Modal System Methods (Task 4.1: Group Creation)
    isModalOpen() {
        const modal = document.getElementById('modalOverlay');
        return modal && modal.style.display !== 'none';
    }

    openModal(title, bodyContent, footerContent) {
        const modal = document.getElementById('modalOverlay');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modalFooter = document.getElementById('modalFooter');

        if (!modal || !modalTitle || !modalBody || !modalFooter) {
            console.error('Modal elements not found');
            return;
        }

        modalTitle.textContent = title;
        modalBody.innerHTML = '';
        modalFooter.innerHTML = '';

        if (bodyContent) {
            modalBody.appendChild(bodyContent);
        }

        if (footerContent) {
            modalFooter.appendChild(footerContent);
        }

        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');

        // Focus on first focusable element
        const firstFocusable = modal.querySelector('input, button, select, textarea');
        if (firstFocusable) {
            setTimeout(() => firstFocusable.focus(), 100);
        }
    }

    closeModal() {
        const modal = document.getElementById('modalOverlay');
        if (modal) {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
        }
    }

    // Group Creation Methods (Task 4.1)
    openCreateGroupModal() {
        try {
            // Check group limit before opening modal
            if (this.groups.length >= 50) {
                this.showError('Maximum number of groups (50) reached. Please delete a group before creating a new one.');
                return;
            }

            // Clone template content
            const template = document.getElementById('createGroupModalTemplate');
            const footerTemplate = document.getElementById('createGroupModalFooterTemplate');

            if (!template || !footerTemplate) {
                console.error('Group creation modal templates not found');
                return;
            }

            const modalBody = template.content.cloneNode(true);
            const modalFooter = footerTemplate.content.cloneNode(true);

            // Set up event listeners for the form
            this.setupGroupModalEventListeners(modalBody, modalFooter);

            // Open modal
            this.openModal('Create New Group', modalBody, modalFooter);

        } catch (error) {
            console.error('Error opening create group modal:', error);
            this.showError('Failed to open group creation dialog');
        }
    }

    setupGroupModalEventListeners(modalBody, modalFooter) {
        // Handle form submission
        const form = modalBody.querySelector('#createGroupForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreateGroup(form);
            });
        }

        // Handle cancel button
        const cancelBtn = modalFooter.querySelector('#cancelCreateGroup');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeModal());
        }

        // Handle color picker preview
        const colorInput = modalBody.querySelector('#groupColor');
        const colorPreview = modalBody.querySelector('#colorPreview');
        if (colorInput && colorPreview) {
            const updatePreview = () => {
                colorPreview.style.backgroundColor = colorInput.value;
            };
            colorInput.addEventListener('input', updatePreview);
            updatePreview(); // Initial preview
        }

        // Handle real-time validation
        const nameInput = modalBody.querySelector('#groupName');
        if (nameInput) {
            nameInput.addEventListener('input', () => this.validateGroupName(nameInput));
            nameInput.addEventListener('blur', () => this.validateGroupName(nameInput));
        }
    }

    validateGroupName(nameInput) {
        const name = nameInput.value.trim();
        const errorElement = document.getElementById('groupNameError');

        if (!errorElement) return true;

        let errorMessage = '';

        if (!name) {
            errorMessage = 'Group name is required';
        } else if (name.length > 50) {
            errorMessage = 'Group name must be 50 characters or less';
        } else if (this.groups.some(g => g.name.toLowerCase() === name.toLowerCase())) {
            errorMessage = 'A group with this name already exists';
        }

        errorElement.textContent = errorMessage;
        nameInput.setAttribute('aria-invalid', errorMessage ? 'true' : 'false');

        return !errorMessage;
    }

    async handleCreateGroup(form) {
        try {
            this.showLoading('Creating group...');

            // Get form data
            const formData = new FormData(form);
            const groupName = formData.get('groupName').trim();
            const groupColor = formData.get('groupColor');
            const groupDescription = formData.get('groupDescription').trim();

            // Validate group name
            const nameInput = form.querySelector('#groupName');
            if (!this.validateGroupName(nameInput)) {
                this.hideLoading();
                return;
            }

            // Check group limit
            if (this.groups.length >= 50) {
                throw new Error('Maximum number of groups (50) reached');
            }

            // Create new group using data model
            const newGroup = new GroupDataModel({
                name: groupName,
                color: groupColor,
                description: groupDescription
            });

            // Validate the new group
            const validation = newGroup.validate();
            if (!validation.isValid) {
                throw new Error(`Invalid group data: ${validation.errors.join(', ')}`);
            }

            // Add to groups array
            this.groups.push(newGroup);

            // Save to storage
            await this.saveData();

            // Update UI
            this.renderURLs();

            // Close modal and show success
            this.closeModal();
            this.showMessage(`Group "${groupName}" created successfully!`);

            this.hideLoading();

        } catch (error) {
            console.error('Error creating group:', error);
            this.showError(error.message || 'Failed to create group');
            this.hideLoading();
        }
    }

    // Group Management Utility Methods
    getGroupById(groupId) {
        return this.groups.find(g => g.id === groupId);
    }

    getGroupByName(name) {
        return this.groups.find(g => g.name.toLowerCase() === name.toLowerCase());
    }

    canCreateMoreGroups() {
        return this.groups.length < 50;
    }

    // URL Management Methods (Task 4.3: URL Group Assignment)
    openAddURLModal() {
        try {
            // Clone template content
            const template = document.getElementById('addURLModalTemplate');
            const footerTemplate = document.getElementById('addURLModalFooterTemplate');

            if (!template || !footerTemplate) {
                console.error('Add URL modal templates not found');
                return;
            }

            const modalBody = template.content.cloneNode(true);
            const modalFooter = footerTemplate.content.cloneNode(true);

            // Populate groups dropdown
            this.populateGroupSelect(modalBody.querySelector('#urlGroup'));

            // Set up event listeners for the form
            this.setupAddURLModalEventListeners(modalBody, modalFooter);

            // Open modal
            this.openModal('Add New URL', modalBody, modalFooter);

        } catch (error) {
            console.error('Error opening add URL modal:', error);
            this.showError('Failed to open add URL dialog');
        }
    }

    openEditURLModal(urlId) {
        try {
            const url = this.urls.find(u => u.id === urlId);
            if (!url) {
                console.error('URL not found:', urlId);
                return;
            }

            // Clone template content
            const template = document.getElementById('editURLModalTemplate');
            const footerTemplate = document.getElementById('editURLModalFooterTemplate');

            if (!template || !footerTemplate) {
                console.error('Edit URL modal templates not found');
                return;
            }

            const modalBody = template.content.cloneNode(true);
            const modalFooter = footerTemplate.content.cloneNode(true);

            // Populate form with existing data
            modalBody.querySelector('#editUrlAddress').value = url.url;
            modalBody.querySelector('#editUrlTitle').value = url.title;
            modalBody.querySelector('#editUrlId').value = url.id;

            // Populate groups dropdown
            this.populateGroupSelect(modalBody.querySelector('#editUrlGroup'), url.groupId);

            // Set up event listeners for the form
            this.setupEditURLModalEventListeners(modalBody, modalFooter);

            // Open modal
            this.openModal('Edit URL', modalBody, modalFooter);

        } catch (error) {
            console.error('Error opening edit URL modal:', error);
            this.showError('Failed to open edit URL dialog');
        }
    }

    populateGroupSelect(selectElement, selectedGroupId = null) {
        if (!selectElement) return;

        // Clear existing options
        selectElement.innerHTML = '';

        // Sort groups with ungrouped first
        const sortedGroups = [...this.groups].sort((a, b) => {
            if (a.id === 'ungrouped') return -1;
            if (b.id === 'ungrouped') return 1;
            return a.name.localeCompare(b.name);
        });

        // Add options for each group
        sortedGroups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            option.style.color = group.color || '#2196f3';

            if (selectedGroupId && group.id === selectedGroupId) {
                option.selected = true;
            } else if (!selectedGroupId && group.id === 'ungrouped') {
                option.selected = true; // Default to ungrouped
            }

            selectElement.appendChild(option);
        });
    }

    setupAddURLModalEventListeners(modalBody, modalFooter) {
        // Handle form submission
        const form = modalBody.querySelector('#addURLForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddURL(form);
            });
        }

        // Handle cancel button
        const cancelBtn = modalFooter.querySelector('#cancelAddURL');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeModal());
        }

        // Handle real-time validation
        const urlInput = modalBody.querySelector('#urlAddress');
        const titleInput = modalBody.querySelector('#urlTitle');

        if (urlInput) {
            urlInput.addEventListener('input', () => this.validateURLInput(urlInput));
            urlInput.addEventListener('blur', () => this.validateURLInput(urlInput));
        }

        if (titleInput) {
            titleInput.addEventListener('input', () => this.validateTitleInput(titleInput));
            titleInput.addEventListener('blur', () => this.validateTitleInput(titleInput));
        }
    }

    setupEditURLModalEventListeners(modalBody, modalFooter) {
        // Handle form submission
        const form = modalBody.querySelector('#editURLForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEditURL(form);
            });
        }

        // Handle cancel button
        const cancelBtn = modalFooter.querySelector('#cancelEditURL');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeModal());
        }

        // Handle delete button
        const deleteBtn = modalFooter.querySelector('#deleteEditURL');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const urlId = modalBody.querySelector('#editUrlId').value;
                this.handleDeleteURL(urlId);
            });
        }

        // Handle real-time validation
        const urlInput = modalBody.querySelector('#editUrlAddress');
        const titleInput = modalBody.querySelector('#editUrlTitle');

        if (urlInput) {
            urlInput.addEventListener('input', () => this.validateURLInput(urlInput, 'editUrlAddressError'));
            urlInput.addEventListener('blur', () => this.validateURLInput(urlInput, 'editUrlAddressError'));
        }

        if (titleInput) {
            titleInput.addEventListener('input', () => this.validateTitleInput(titleInput, 'editUrlTitleError'));
            titleInput.addEventListener('blur', () => this.validateTitleInput(titleInput, 'editUrlTitleError'));
        }
    }

    // URL Form Validation Methods (Task 4.3)
    validateURLInput(urlInput, errorElementId = 'urlAddressError') {
        const url = urlInput.value.trim();
        const errorElement = document.getElementById(errorElementId);

        if (!errorElement) return true;

        let errorMessage = '';

        if (!url) {
            errorMessage = 'URL is required';
        } else if (!this.isValidURL(url)) {
            errorMessage = 'Please enter a valid URL (e.g., https://example.com)';
        } else if (this.urls.some(u => u.url === url && u.id !== document.getElementById('editUrlId')?.value)) {
            errorMessage = 'This URL is already saved';
        }

        errorElement.textContent = errorMessage;
        urlInput.setAttribute('aria-invalid', errorMessage ? 'true' : 'false');

        return !errorMessage;
    }

    validateTitleInput(titleInput, errorElementId = 'urlTitleError') {
        const title = titleInput.value.trim();
        const errorElement = document.getElementById(errorElementId);

        if (!errorElement) return true;

        let errorMessage = '';

        if (!title) {
            errorMessage = 'Title is required';
        } else if (title.length > 200) {
            errorMessage = 'Title must be 200 characters or less';
        }

        errorElement.textContent = errorMessage;
        titleInput.setAttribute('aria-invalid', errorMessage ? 'true' : 'false');

        return !errorMessage;
    }

    // URL CRUD Operations (Task 4.3)
    async handleAddURL(form) {
        try {
            this.showLoading('Adding URL...');

            // Get form data
            const formData = new FormData(form);
            const url = formData.get('urlAddress').trim();
            const title = formData.get('urlTitle').trim();
            const groupId = formData.get('urlGroup');

            // Validate inputs
            const urlInput = form.querySelector('#urlAddress');
            const titleInput = form.querySelector('#urlTitle');

            const isURLValid = this.validateURLInput(urlInput);
            const isTitleValid = this.validateTitleInput(titleInput);

            if (!isURLValid || !isTitleValid) {
                this.hideLoading();
                return;
            }

            // Create new URL using data model
            const newURL = new URLDataModel({
                url: url,
                title: title,
                groupId: groupId
            });

            // Validate the new URL
            const validation = newURL.validate();
            if (!validation.isValid) {
                throw new Error(`Invalid URL data: ${validation.errors.join(', ')}`);
            }

            // Add to URLs array
            this.urls.unshift(newURL); // Add to beginning for most recent first

            // Save to storage
            await this.saveData();

            // Update UI
            this.renderURLs();

            // Close modal and show success
            this.closeModal();
            this.showMessage(`URL "${title}" saved successfully to ${this.getGroupById(groupId)?.name || 'Unknown Group'}!`);

            this.hideLoading();

        } catch (error) {
            console.error('Error adding URL:', error);
            this.showError(error.message || 'Failed to add URL');
            this.hideLoading();
        }
    }

    async handleEditURL(form) {
        try {
            this.showLoading('Updating URL...');

            // Get form data
            const formData = new FormData(form);
            const urlId = formData.get('editUrlId');
            const url = formData.get('editUrlAddress').trim();
            const title = formData.get('editUrlTitle').trim();
            const groupId = formData.get('editUrlGroup');

            // Find existing URL
            const existingURL = this.urls.find(u => u.id === urlId);
            if (!existingURL) {
                throw new Error('URL not found');
            }

            // Validate inputs
            const urlInput = form.querySelector('#editUrlAddress');
            const titleInput = form.querySelector('#editUrlTitle');

            const isURLValid = this.validateURLInput(urlInput, 'editUrlAddressError');
            const isTitleValid = this.validateTitleInput(titleInput, 'editUrlTitleError');

            if (!isURLValid || !isTitleValid) {
                this.hideLoading();
                return;
            }

            // Update URL properties
            existingURL.url = url;
            existingURL.title = title;
            existingURL.groupId = groupId;
            existingURL.lastModified = new Date().toISOString();

            // Update domain and favicon if URL changed
            existingURL.domain = existingURL.extractDomain(url);
            existingURL.favicon = existingURL.generateFaviconUrl(existingURL.domain);

            // Validate the updated URL
            const validation = existingURL.validate();
            if (!validation.isValid) {
                throw new Error(`Invalid URL data: ${validation.errors.join(', ')}`);
            }

            // Save to storage
            await this.saveData();

            // Update UI
            this.renderURLs();

            // Close modal and show success
            this.closeModal();
            this.showMessage(`URL "${title}" updated successfully!`);

            this.hideLoading();

        } catch (error) {
            console.error('Error updating URL:', error);
            this.showError(error.message || 'Failed to update URL');
            this.hideLoading();
        }
    }

    async handleDeleteURL(urlId) {
        try {
            const url = this.urls.find(u => u.id === urlId);
            if (!url) {
                throw new Error('URL not found');
            }

            // Show confirmation dialog
            if (!confirm(`Are you sure you want to delete "${url.title}"?`)) {
                return;
            }

            this.showLoading('Deleting URL...');

            // Remove from URLs array
            this.urls = this.urls.filter(u => u.id !== urlId);

            // Save to storage
            await this.saveData();

            // Update UI
            this.renderURLs();

            // Close modal and show success
            this.closeModal();
            this.showMessage(`URL "${url.title}" deleted successfully!`);

            this.hideLoading();

        } catch (error) {
            console.error('Error deleting URL:', error);
            this.showError(error.message || 'Failed to delete URL');
            this.hideLoading();
        }
    }

    // Drag and Drop Functionality (Task 4.3)
    handleURLDragStart(e, urlData) {
        // Store the URL data in the drag event
        e.dataTransfer.setData('text/plain', urlData.id);
        e.dataTransfer.setData('application/json', JSON.stringify({
            id: urlData.id,
            title: urlData.title,
            url: urlData.url,
            groupId: urlData.groupId
        }));

        // Set drag effect
        e.dataTransfer.effectAllowed = 'move';

        // Add visual feedback
        e.target.classList.add('dragging');

        // Store dragged URL for reference
        this.draggedURL = urlData;

        console.log('Drag started for URL:', urlData.title);
    }

    handleURLDragEnd(e) {
        // Remove visual feedback
        e.target.classList.remove('dragging');

        // Clear all group drag states
        document.querySelectorAll('.group-header').forEach(header => {
            header.classList.remove('drag-over');
        });

        // Clear reference
        this.draggedURL = null;

        console.log('Drag ended');
    }

    handleGroupDragOver(e, targetGroupId) {
        e.preventDefault(); // Allow drop

        // Only allow drop if we have a dragged URL and it's not the same group
        if (this.draggedURL && this.draggedURL.groupId !== targetGroupId) {
            e.dataTransfer.dropEffect = 'move';
        } else {
            e.dataTransfer.dropEffect = 'none';
        }
    }

    handleGroupDragEnter(e, targetGroupId) {
        e.preventDefault();

        // Add visual feedback if valid drop target
        if (this.draggedURL && this.draggedURL.groupId !== targetGroupId) {
            e.currentTarget.classList.add('drag-over');
        }
    }

    handleGroupDragLeave(e) {
        // Remove visual feedback only if leaving the header element itself
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('drag-over');
        }
    }

    async handleGroupDrop(e, targetGroupId) {
        e.preventDefault();

        try {
            // Remove visual feedback
            e.currentTarget.classList.remove('drag-over');

            // Get the dragged URL data
            const urlId = e.dataTransfer.getData('text/plain');
            const url = this.urls.find(u => u.id === urlId);

            if (!url) {
                console.error('Dragged URL not found:', urlId);
                return;
            }

            // Don't move if it's the same group
            if (url.groupId === targetGroupId) {
                return;
            }

            const sourceGroup = this.getGroupById(url.groupId);
            const targetGroup = this.getGroupById(targetGroupId);

            this.showLoading(`Moving "${url.title}" to ${targetGroup?.name || 'Unknown Group'}...`);

            // Update the URL's group
            url.groupId = targetGroupId;
            url.lastModified = new Date().toISOString();

            // Save to storage
            await this.saveData();

            // Update UI
            this.renderURLs();

            // Show success message
            this.showMessage(`"${url.title}" moved to ${targetGroup?.name || 'Unknown Group'} successfully!`);

            this.hideLoading();

            console.log(`URL "${url.title}" moved from ${sourceGroup?.name} to ${targetGroup?.name}`);

        } catch (error) {
            console.error('Error moving URL:', error);
            this.showError('Failed to move URL to group');
            this.hideLoading();
        }
    }

    // Group Display State Management (Task 4.2)
    isGroupExpanded(groupId) {
        // Default to expanded for ungrouped, collapsed for others
        if (this.groupExpandedState.hasOwnProperty(groupId)) {
            return this.groupExpandedState[groupId];
        }
        return groupId === 'ungrouped'; // Default ungrouped to expanded
    }

    toggleGroupExpanded(groupId) {
        const currentState = this.isGroupExpanded(groupId);
        this.groupExpandedState[groupId] = !currentState;

        // Update the UI
        this.updateGroupDisplayState(groupId);

        // Save state to local storage for persistence
        this.saveGroupExpandedState();
    }

    updateGroupDisplayState(groupId) {
        const header = document.querySelector(`[data-group-id="${groupId}"]`);
        const groupContainer = document.querySelector(`[data-group-container-id="${groupId}"]`);

        if (!header || !groupContainer) return;

        const isExpanded = this.isGroupExpanded(groupId);
        const chevron = header.querySelector('.group-chevron');

        // Update header
        header.setAttribute('aria-expanded', isExpanded.toString());
        if (chevron) {
            chevron.textContent = isExpanded ? '▼' : '▶';
        }

        // Update container visibility
        if (isExpanded) {
            groupContainer.classList.remove('group-collapsed');
            groupContainer.classList.add('group-expanded');
        } else {
            groupContainer.classList.remove('group-expanded');
            groupContainer.classList.add('group-collapsed');
        }
    }

    async loadGroupExpandedState() {
        try {
            const result = await chrome.storage.local.get(['groupExpandedState']);
            this.groupExpandedState = result.groupExpandedState || {};
        } catch (error) {
            console.warn('Could not load group expanded state:', error);
            this.groupExpandedState = {};
        }
    }

    async saveGroupExpandedState() {
        try {
            await chrome.storage.local.set({ groupExpandedState: this.groupExpandedState });
        } catch (error) {
            console.warn('Could not save group expanded state:', error);
        }
    }

    // Group Navigation Accessibility (Task 4.2)
    handleGroupHeaderKeyNavigation(e) {
        const currentHeader = e.target;
        const allHeaders = Array.from(document.querySelectorAll('.group-header'));
        const currentIndex = allHeaders.indexOf(currentHeader);

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                const nextIndex = (currentIndex + 1) % allHeaders.length;
                allHeaders[nextIndex].focus();
                break;

            case 'ArrowUp':
                e.preventDefault();
                const prevIndex = currentIndex === 0 ? allHeaders.length - 1 : currentIndex - 1;
                allHeaders[prevIndex].focus();
                break;

            case 'Home':
                e.preventDefault();
                allHeaders[0].focus();
                break;

            case 'End':
                e.preventDefault();
                allHeaders[allHeaders.length - 1].focus();
                break;

            case 'ArrowRight':
                // Expand if collapsed
                const groupId = currentHeader.getAttribute('data-group-id');
                if (!this.isGroupExpanded(groupId)) {
                    e.preventDefault();
                    this.toggleGroupExpanded(groupId);
                }
                break;

            case 'ArrowLeft':
                // Collapse if expanded
                const groupIdLeft = currentHeader.getAttribute('data-group-id');
                if (this.isGroupExpanded(groupIdLeft)) {
                    e.preventDefault();
                    this.toggleGroupExpanded(groupIdLeft);
                }
                break;
        }
    }

    // URL Action Methods (Task 4.3: Implemented)
    editURL(urlId) {
        this.openEditURLModal(urlId);
    }

    deleteURL(urlId) {
        this.handleDeleteURL(urlId);
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