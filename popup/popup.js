// Chrome Extension Popup JavaScript
// Task 2.3: Current Tab URL Capture functionality
// Task 2.4: In-Memory URL Display
// Task 3.3: Complete Data Model Implementation

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
        // Start page toggle state
        this.startPageEnabled = true; // Default to enabled
        this.openInNewTab = true; // Default to opening in new tab
        // Color theme state
        this.colorTheme = null; // Will be loaded from storage
        // Font settings state
        this.fontSettings = null; // Will be loaded from storage
        this.init();
    }

    async init() {
        // Initialize default group for in-memory mode
        this.initializeDefaultGroup();

        await this.loadData();
        await this.loadGroupExpandedState();
        await this.updateStorageQuota();
        await this.loadAndApplyColorTheme();

        this.setupEventListeners();
        this.initializeToggle();
        this.renderURLs();
        this.displayVersion();
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
            // Use StorageManager to load data
            const data = await StorageManager.loadDataFromStorage();

            // Convert raw data to model instances
            this.groups = data.groups.map(groupData => GroupDataModel.fromJSON(groupData));
            this.urls = data.urls.map(urlData => URLDataModel.fromJSON(urlData));

            // Load metadata
            this.startPageEnabled = data.metadata.startPageEnabled;
            this.openInNewTab = data.metadata.openInNewTab;
            this.colorTheme = data.metadata.colorTheme;
            this.fontSettings = data.metadata.fontSettings;

            // Check for data model version compatibility
            if (data.metadata.dataModelVersion && data.metadata.dataModelVersion !== this.dataModelVersion) {
                console.log(`Data model migration needed: ${data.metadata.dataModelVersion} -> ${this.dataModelVersion}`);
                await this.migrateDataModel(data.metadata.dataModelVersion);
            }

            // Validate data integrity and fix issues
            this.lastDataValidation = DataValidator.validateAndFixDataIntegrity(
                this.groups,
                this.urls,
                this.getDefaultGroupId()
            );

            // Initialize group orders for existing groups
            this.initializeGroupOrders();

            // Initialize URL orders for existing URLs
            this.initializeURLOrders();

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
            // Prepare metadata
            const metadata = {
                version: '1.0',
                dataModelVersion: this.dataModelVersion,
                startPageEnabled: this.startPageEnabled,
                openInNewTab: this.openInNewTab,
                colorTheme: this.colorTheme,
                fontSettings: this.fontSettings
            };

            // Use StorageManager to save data
            await StorageManager.saveDataToStorage(this.groups, this.urls, metadata);

            // Update storage quota tracking
            await this.updateStorageQuota();

            console.log('Data saved successfully using StorageManager');
        } catch (error) {
            console.error('Error saving data:', error);
            if (error.message.includes('quota') || error.message.includes('Storage limit')) {
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

        // Menu button and dropdown
        const menuButton = document.getElementById('menuButton');
        const menuDropdown = document.getElementById('menuDropdown');
        if (menuButton && menuDropdown) {
            menuButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMenu();
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!menuButton.contains(e.target) && !menuDropdown.contains(e.target)) {
                    this.closeMenu();
                }
            });

            // Menu keyboard navigation
            menuButton.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggleMenu();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.openMenu();
                    const firstItem = menuDropdown.querySelector('.menu-item');
                    if (firstItem) firstItem.focus();
                }
            });

            // Menu item navigation
            menuDropdown.addEventListener('keydown', (e) => {
                const menuItems = menuDropdown.querySelectorAll('.menu-item');
                const currentIndex = Array.from(menuItems).indexOf(e.target);

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const nextIndex = (currentIndex + 1) % menuItems.length;
                    menuItems[nextIndex].focus();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prevIndex = currentIndex === 0 ? menuItems.length - 1 : currentIndex - 1;
                    menuItems[prevIndex].focus();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeMenu();
                    menuButton.focus();
                }
            });
        }

        // Export data button
        const exportDataBtn = document.getElementById('exportData');
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', () => {
                this.closeMenu();
                this.exportData();
            });
        }

        // Import data button
        const importDataBtn = document.getElementById('importData');
        if (importDataBtn) {
            importDataBtn.addEventListener('click', () => {
                this.closeMenu();
                this.importData();
            });
        }

        // Color settings button
        const colorSettingsBtn = document.getElementById('colorSettings');
        if (colorSettingsBtn) {
            colorSettingsBtn.addEventListener('click', () => {
                this.closeMenu();
                this.openColorSettingsModal();
            });
        }

        // Font settings button
        const fontSettingsBtn = document.getElementById('fontSettings');
        if (fontSettingsBtn) {
            fontSettingsBtn.addEventListener('click', () => {
                this.closeMenu();
                this.openFontSettingsModal();
            });
        }

        // File input for import
        const importFileInput = document.getElementById('importFileInput');
        if (importFileInput) {
            importFileInput.addEventListener('change', (e) => {
                this.handleImportFile(e.target.files[0]);
            });
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

        // Start page toggle event listener
        const startPageToggle = document.getElementById('startPageToggle');
        if (startPageToggle) {
            startPageToggle.addEventListener('change', (e) => this.handleStartPageToggle(e));
        }

        const openNewTabToggle = document.getElementById('openNewTabToggle');
        if (openNewTabToggle) {
            openNewTabToggle.addEventListener('change', (e) => this.handleOpenNewTabToggle(e));
        }
    }

    // Initialize Start Page Toggle
    initializeToggle() {
        const startPageToggle = document.getElementById('startPageToggle');
        if (startPageToggle) {
            // Set the toggle state based on loaded data
            startPageToggle.checked = this.startPageEnabled;
        }

        const openNewTabToggle = document.getElementById('openNewTabToggle');
        if (openNewTabToggle) {
            // Set the toggle state based on loaded data
            openNewTabToggle.checked = this.openInNewTab;
        }
    }

    // Handle Start Page Toggle Change
    async handleStartPageToggle(e) {
        try {
            this.startPageEnabled = e.target.checked;

            // Save the new state
            await this.saveData();

            // Show feedback message
            const message = this.startPageEnabled
                ? 'Start page enabled - bookmarks will be shown on new tabs'
                : 'Start page disabled - new tabs will show a blank page';
            this.showMessage(message);

            console.log('Start page toggle changed:', this.startPageEnabled);
        } catch (error) {
            console.error('Error saving start page toggle state:', error);
            this.showError('Failed to save start page setting');
            // Revert the toggle state on error
            e.target.checked = this.startPageEnabled;
        }
    }

    // Handle Open New Tab Toggle Change
    async handleOpenNewTabToggle(e) {
        try {
            this.openInNewTab = e.target.checked;

            // Save the new state
            await this.saveData();

            // Show feedback message
            const message = this.openInNewTab
                ? 'URLs will open in new tabs'
                : 'URLs will open in current tab';
            this.showMessage(message);

            console.log('Open new tab toggle changed:', this.openInNewTab);
        } catch (error) {
            console.error('Error saving open new tab toggle state:', error);
            this.showError('Failed to save open new tab setting');
            // Revert the toggle state on error
            e.target.checked = this.openInNewTab;
        }
    }

    // Current Tab URL Capture (Task 2.3 core functionality)
    async captureCurrentTab() {
        try {
            // Check URL limit before capturing
            if (!this.checkURLLimit()) {
                return;
            }

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
        return FavURLUtils.isValidURL(string);
    }

    // Generate unique ID
    generateUniqueId() {
        return FavURLUtils.generateUniqueId('url_');
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
    // Data validation methods moved to DataValidator utility

    initializeGroupOrders() {
        let hasChanges = false;
        let nextOrder = 1; // Start from 1, ungrouped stays at 0

        // First pass: set order for ungrouped group to 0
        const ungroupedGroup = this.groups.find(g => g.id === 'ungrouped');
        if (ungroupedGroup && ungroupedGroup.order === undefined) {
            ungroupedGroup.order = 0;
            hasChanges = true;
        }

        // Second pass: assign orders to groups that don't have them
        this.groups.forEach(group => {
            if (group.id !== 'ungrouped' && (group.order === undefined || group.order === null)) {
                group.order = nextOrder;
                nextOrder++;
                hasChanges = true;
            }
        });

        if (hasChanges) {
            console.log('Initialized group orders for existing groups');
            // Mark that we have changes that need to be saved
            if (!this.lastDataValidation) {
                this.lastDataValidation = { hasChanges: false };
            }
            this.lastDataValidation.hasChanges = true;
        }
    }

    initializeURLOrders() {
        let hasChanges = false;

        // Group URLs by groupId for processing
        const urlsByGroup = {};
        this.urls.forEach(url => {
            if (!urlsByGroup[url.groupId]) {
                urlsByGroup[url.groupId] = [];
            }
            urlsByGroup[url.groupId].push(url);
        });

        // Process each group separately
        Object.keys(urlsByGroup).forEach(groupId => {
            const groupUrls = urlsByGroup[groupId];
            let orderAssigned = false;

            // Check if any URLs in this group lack order
            groupUrls.forEach((url, index) => {
                if (url.order === undefined || url.order === null) {
                    // Assign order based on creation time, with small increments for same timestamp
                    const baseTime = new Date(url.created || url.timestamp).getTime();
                    url.order = baseTime + index; // Add index to prevent collisions
                    hasChanges = true;
                    orderAssigned = true;
                }
            });

            if (orderAssigned) {
                console.log(`Initialized URL orders for group ${groupId}: ${groupUrls.length} URLs`);
            }
        });

        if (hasChanges) {
            console.log('Initialized URL orders for existing URLs');
            // Mark that we have changes that need to be saved
            if (!this.lastDataValidation) {
                this.lastDataValidation = { hasChanges: false };
            }
            this.lastDataValidation.hasChanges = true;
        }
    }

    getNextGroupOrder() {
        if (this.groups.length === 0) {
            return 1; // First non-ungrouped group gets order 1
        }

        const maxOrder = Math.max(...this.groups.map(g => g.order || 0));
        return maxOrder + 1;
    }

    async migrateDataModel(fromVersion) {
        console.log(`Migrating data model from version ${fromVersion} to ${this.dataModelVersion}`);

        // Future migration logic would go here
        // For now, just update the version

        return true;
    }

    // Migration function for legacy single-key storage to new 32-key structure
    async migrateLegacyStorageToNewStructure() {
        try {
            console.log('Starting migration from legacy single-key storage to 32-key structure...');

            // Use the new utility function to save URLs to the 32-key structure
            const urlsData = this.urls.map(url => url.toJSON());
            const groupsData = this.groups.map(group => group.toJSON());

            await FavURLUtils.saveURLsToStorage(urlsData, groupsData);

            // After successfully saving to new structure, remove legacy 'urls' key
            await chrome.storage.sync.remove(['urls']);

            console.log('Legacy storage migration completed successfully');
            console.log(`Migrated ${this.urls.length} URLs to new 32-key storage structure`);

            return true;
        } catch (error) {
            console.error('Error during legacy storage migration:', error);
            throw error;
        }
    }

    // URL List Rendering (Task 4.2: Enhanced group display)
    renderURLs() {
        const urlList = document.getElementById('urlList');
        const emptyState = document.getElementById('emptyState');

        if (!urlList) return;

        // Clone empty state before clearing (to preserve the element)
        const emptyStateClone = emptyState ? emptyState.cloneNode(true) : null;

        // Clear existing content
        urlList.innerHTML = '';

        if (this.urls.length === 0) {
            // Show empty state
            if (emptyStateClone) {
                urlList.appendChild(emptyStateClone);
            }
            return;
        }

        // Hide empty state and render URLs
        if (emptyState && emptyState.parentNode) {
            emptyState.style.display = 'none';
        }

        // Group URLs by groupId
        const groupedURLs = this.groupURLsByGroup();

        // Sort groups by order, with ungrouped first regardless of order
        const sortedGroupIds = Object.keys(groupedURLs).sort((a, b) => {
            if (a === 'ungrouped') return -1;
            if (b === 'ungrouped') return 1;
            const groupA = this.groups.find(g => g.id === a);
            const groupB = this.groups.find(g => g.id === b);
            const orderA = groupA ? (groupA.order || 0) : 999;
            const orderB = groupB ? (groupB.order || 0) : 999;
            return orderA - orderB;
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
        const reorderHint = !group.protected ? '. Use Ctrl+Shift+Arrow keys to reorder, or drag to reorder' : '';
        header.setAttribute('aria-label', `Toggle ${group.name} group with ${count} bookmark${count !== 1 ? 's' : ''}${reorderHint}`);

        const isExpanded = this.isGroupExpanded(group.id);
        const chevronIcon = isExpanded ? '▼' : '▶';
        const isDraggable = !group.protected; // Don't allow dragging protected groups like "Ungrouped"

        // Make header draggable if allowed
        if (isDraggable) {
            header.setAttribute('draggable', 'true');
            header.classList.add('draggable');
        }

        header.innerHTML = `
            ${isDraggable ? '<div class="group-drag-handle" title="Drag to reorder"></div>' : ''}
            <div class="group-header-content">
                <span class="group-chevron" aria-hidden="true">${chevronIcon}</span>
                <span class="group-name" style="color: ${group.color || '#2196f3'}">${this.escapeHtml(group.name)}</span>
                <span class="group-count">${count}</span>
                ${!group.protected ? `
                <div class="group-actions">
                    <button class="group-action-btn" data-action="edit" data-group-id="${group.id}" aria-label="Edit group" title="Edit group">
                        ✏️
                    </button>
                    <button class="group-action-btn" data-action="delete" data-group-id="${group.id}" aria-label="Delete group" title="Delete group">
                        🗑️
                    </button>
                </div>
                ` : ''}
            </div>
        `;

        // Add click handler for expand/collapse and group actions
        header.addEventListener('click', (e) => {
            // Don't trigger expand/collapse if clicking on drag handle
            if (e.target.closest('.group-drag-handle')) {
                e.preventDefault();
                return;
            }

            const action = e.target.getAttribute('data-action');
            const groupId = e.target.getAttribute('data-group-id');

            if (action === 'edit') {
                e.stopPropagation();
                this.editGroup(groupId);
            } else if (action === 'delete') {
                e.stopPropagation();
                this.deleteGroup(groupId);
            } else if (!e.target.closest('.group-actions')) {
                this.toggleGroupExpanded(group.id);
            }
        });

        // Add keyboard handler
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleGroupExpanded(group.id);
            }
        });

        // Group reordering drag events (only for draggable groups)
        if (isDraggable) {
            header.addEventListener('dragstart', (e) => {
                this.handleGroupDragStart(e, group);
            });

            header.addEventListener('dragend', (e) => {
                this.handleGroupDragEnd(e);
            });
        }

        // Unified drag and drop support (handles both group reordering and URL-to-group assignment)
        header.addEventListener('dragover', (e) => {
            this.handleUnifiedDragOver(e, group.id);
        });

        header.addEventListener('drop', (e) => {
            this.handleUnifiedDrop(e, group.id);
        });

        header.addEventListener('dragenter', (e) => {
            this.handleUnifiedDragEnter(e, group.id);
        });

        header.addEventListener('dragleave', (e) => {
            this.handleUnifiedDragLeave(e);
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

        // Sort URLs by order within the group
        const sortedUrls = urls.sort((a, b) => (a.order || 0) - (b.order || 0));

        // Add URLs to container
        sortedUrls.forEach(url => {
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
        urlElement.setAttribute('aria-label', `Bookmark: ${urlData.title}. Use Ctrl+Shift+Arrow keys to reorder or move between groups`);

        // Task 4.3: Make URLs draggable for group assignment
        urlElement.setAttribute('draggable', 'true');
        urlElement.setAttribute('data-group-id', urlData.groupId);

        // Task 2.4: Simple list display with URL and title
        // Use Chrome's favicon service with full URL for better quality
        const faviconUrl = FavURLUtils.generateFaviconUrl(urlData.url);
        const domain = this.extractDomain(urlData.url);

        // Create simplified display for Task 2.4 requirements
        urlElement.innerHTML = `
            <div class="url-drag-handle" title="Drag to reorder"></div>
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

        // Asynchronously fetch and update with direct favicon from website
        const faviconImg = urlElement.querySelector('.url-favicon');
        if (faviconImg) {
            FavURLUtils.updateFaviconAsync(faviconImg, urlData.url);
        }

        // Add click handler for opening URL
        urlElement.addEventListener('click', (e) => {
            if (!e.target.closest('.url-actions')) {
                this.openURL(urlData.url);
            }
        });

        // Add keyboard navigation and reordering shortcuts
        urlElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!e.target.closest('.url-actions')) {
                    this.openURL(urlData.url);
                }
            } else if (e.ctrlKey && e.shiftKey) {
                // URL reordering keyboard shortcuts
                switch (e.key) {
                    case 'ArrowUp':
                        e.preventDefault();
                        this.moveURLUp(urlData.id);
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        this.moveURLDown(urlData.id);
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        this.moveURLToPreviousGroup(urlData.id);
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        this.moveURLToNextGroup(urlData.id);
                        break;
                }
            }
        });

        // Add drag-and-drop event listeners for both group assignment and URL reordering
        urlElement.addEventListener('dragstart', (e) => {
            this.handleURLDragStart(e, urlData);
        });

        urlElement.addEventListener('dragend', (e) => {
            this.handleURLDragEnd(e);
        });

        // Add URL-to-URL reordering support
        urlElement.addEventListener('dragover', (e) => {
            this.handleURLReorderDragOver(e, urlData);
        });

        urlElement.addEventListener('drop', (e) => {
            this.handleURLReorderDrop(e, urlData);
        });

        urlElement.addEventListener('dragenter', (e) => {
            this.handleURLReorderDragEnter(e, urlData);
        });

        urlElement.addEventListener('dragleave', (e) => {
            this.handleURLReorderDragLeave(e);
        });

        // Prevent drag handle clicks from opening URL
        const dragHandle = urlElement.querySelector('.url-drag-handle');
        if (dragHandle) {
            dragHandle.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

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

    // Open URL in new tab or current tab based on toggle setting
    async openURL(url) {
        try {
            if (this.openInNewTab) {
                // Open in new tab
                await chrome.tabs.create({ url: url });
            } else {
                // Open in current tab
                const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                await chrome.tabs.update(currentTab.id, { url: url });
            }
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

    // Delete Group with confirmation
    async deleteGroup(groupId) {
        try {
            const group = this.groups.find(g => g.id === groupId);
            if (!group) {
                this.showError('Group not found');
                return;
            }

            // Check if group can be deleted
            if (!this.canDeleteGroup(groupId)) {
                this.showError('Cannot delete this group. It is protected.');
                return;
            }

            // Count URLs in this group
            const urlsInGroup = this.urls.filter(u => u.groupId === groupId);
            const urlCount = urlsInGroup.length;

            // Show confirmation dialog
            const confirmMessage = urlCount > 0
                ? `Are you sure you want to delete the group "${group.name}"? This will also delete ${urlCount} bookmark${urlCount !== 1 ? 's' : ''} in this group.`
                : `Are you sure you want to delete the group "${group.name}"?`;

            if (!confirm(confirmMessage)) {
                return;
            }

            this.showLoading('Deleting group...');

            // Remove all URLs in this group
            this.urls = this.urls.filter(u => u.groupId !== groupId);

            // Remove the group
            this.groups = this.groups.filter(g => g.id !== groupId);

            // Save to storage
            await this.saveData();

            // Update UI
            this.renderURLs();

            // Show success message
            this.showMessage(`Group "${group.name}" and ${urlCount} bookmark${urlCount !== 1 ? 's' : ''} deleted successfully!`);

            this.hideLoading();

        } catch (error) {
            console.error('Error deleting group:', error);
            this.showError(error.message || 'Failed to delete group');
            this.hideLoading();
        }
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
            if (!this.checkGroupLimit()) {
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
            if (!this.checkGroupLimit()) {
                throw new Error('Maximum number of groups (32) reached');
            }

            // Create new group using data model
            const newGroup = new GroupDataModel({
                name: groupName,
                color: groupColor,
                description: groupDescription,
                order: this.getNextGroupOrder()
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

    // Edit Group Methods
    editGroup(groupId) {
        try {
            const group = this.groups.find(g => g.id === groupId);
            if (!group) {
                this.showError('Group not found');
                return;
            }

            // Check if group can be edited
            if (group.protected) {
                this.showError('Cannot edit this group. It is protected.');
                return;
            }

            // Clone template content
            const template = document.getElementById('editGroupModalTemplate');
            const footerTemplate = document.getElementById('editGroupModalFooterTemplate');

            if (!template || !footerTemplate) {
                console.error('Edit group modal templates not found');
                return;
            }

            const modalBody = template.content.cloneNode(true);
            const modalFooter = footerTemplate.content.cloneNode(true);

            // Populate form with existing data
            modalBody.querySelector('#editGroupName').value = group.name;
            modalBody.querySelector('#editGroupId').value = group.id;

            // Set up event listeners for the form
            this.setupEditGroupModalEventListeners(modalBody, modalFooter);

            // Open modal
            this.openModal('Edit Group', modalBody, modalFooter);

        } catch (error) {
            console.error('Error opening edit group modal:', error);
            this.showError('Failed to open edit group dialog');
        }
    }

    setupEditGroupModalEventListeners(modalBody, modalFooter) {
        // Handle form submission
        const form = modalBody.querySelector('#editGroupForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEditGroup(form);
            });
        }

        // Handle cancel button
        const cancelBtn = modalFooter.querySelector('#cancelEditGroup');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeModal());
        }

        // Handle real-time validation
        const nameInput = modalBody.querySelector('#editGroupName');
        if (nameInput) {
            nameInput.addEventListener('input', () => this.validateEditGroupName(nameInput));
            nameInput.addEventListener('blur', () => this.validateEditGroupName(nameInput));
        }
    }

    validateEditGroupName(nameInput) {
        const name = nameInput.value.trim();
        const errorElement = document.getElementById('editGroupNameError');
        const currentGroupId = document.getElementById('editGroupId').value;

        if (!errorElement) return true;

        let errorMessage = '';

        if (!name) {
            errorMessage = 'Group name is required';
        } else if (name.length > 50) {
            errorMessage = 'Group name must be 50 characters or less';
        } else {
            // Check for duplicate names (excluding current group)
            const existingGroup = this.groups.find(g =>
                g.name.toLowerCase() === name.toLowerCase() && g.id !== currentGroupId
            );
            if (existingGroup) {
                errorMessage = 'A group with this name already exists';
            }
        }

        errorElement.textContent = errorMessage;
        nameInput.setAttribute('aria-invalid', errorMessage ? 'true' : 'false');

        return !errorMessage;
    }

    async handleEditGroup(form) {
        try {
            this.showLoading('Updating group...');

            // Get form data
            const formData = new FormData(form);
            const groupId = formData.get('editGroupId');
            const groupName = formData.get('editGroupName').trim();

            // Find existing group
            const existingGroup = this.groups.find(g => g.id === groupId);
            if (!existingGroup) {
                throw new Error('Group not found');
            }

            // Validate group name
            const nameInput = form.querySelector('#editGroupName');
            if (!this.validateEditGroupName(nameInput)) {
                this.hideLoading();
                return;
            }

            // Update group properties
            existingGroup.name = groupName;
            existingGroup.lastModified = new Date().toISOString();

            // Validate the updated group
            const validation = existingGroup.validate();
            if (!validation.isValid) {
                throw new Error(`Invalid group data: ${validation.errors.join(', ')}`);
            }

            // Save to storage
            await this.saveData();

            // Update UI
            this.renderURLs();

            // Close modal and show success
            this.closeModal();
            this.showMessage(`Group "${groupName}" updated successfully!`);

            this.hideLoading();

        } catch (error) {
            console.error('Error updating group:', error);
            this.showError(error.message || 'Failed to update group');
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
        return this.groups.length < 32;
    }

    canAddMoreURLs() {
        return this.urls.length < 400;
    }

    checkGroupLimit() {
        if (this.groups.length >= 32) {
            this.showError('Maximum number of groups (32) reached. Please delete a group before creating a new one.');
            return false;
        }
        return true;
    }

    checkURLLimit() {
        if (this.urls.length >= 400) {
            this.showError('Maximum number of URLs (400) reached. Please delete some URLs before adding new ones.');
            return false;
        }
        return true;
    }

    // URL Management Methods (Task 4.3: URL Group Assignment)
    openAddURLModal() {
        try {
            // Check URL limit before opening modal
            if (!this.checkURLLimit()) {
                return;
            }

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

        // Sort groups by order, with ungrouped first
        const sortedGroups = [...this.groups].sort((a, b) => {
            if (a.id === 'ungrouped') return -1;
            if (b.id === 'ungrouped') return 1;
            return (a.order || 0) - (b.order || 0);
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
            // Check URL limit before adding
            if (!this.checkURLLimit()) {
                this.hideLoading();
                return;
            }

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
            existingURL.domain = FavURLUtils.extractDomain(url);
            existingURL.favicon = FavURLUtils.generateFaviconUrl(url);

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

        // Clear all URL drag states
        document.querySelectorAll('.url-item').forEach(item => {
            item.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        // Clear reference
        this.draggedURL = null;

        console.log('Drag ended');
    }

    // URL-to-URL Reordering Drag and Drop Methods
    handleURLReorderDragOver(e, targetURLData) {
        e.preventDefault();

        // Only handle URL reordering, not URL-to-group assignment
        if (!this.draggedURL || this.draggedURL.id === targetURLData.id) {
            return;
        }

        // Only allow reordering within the same group
        if (this.draggedURL.groupId !== targetURLData.groupId) {
            return;
        }

        e.dataTransfer.dropEffect = 'move';

        // Determine drop position based on mouse position
        const rect = e.currentTarget.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const isTopHalf = e.clientY < midpoint;

        console.log('URL reorder dragover:', {
            draggedURL: this.draggedURL.title,
            targetURL: targetURLData.title,
            isTopHalf,
            mouseY: e.clientY,
            midpoint
        });

        // Clear previous drop indicators from all URL items
        document.querySelectorAll('.url-item').forEach(item => {
            item.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        // Add appropriate drop indicator
        if (isTopHalf) {
            e.currentTarget.classList.add('drag-over-top');
        } else {
            e.currentTarget.classList.add('drag-over-bottom');
        }
    }

    handleURLReorderDragEnter(e) {
        e.preventDefault();
        // Visual feedback is handled in dragover
    }

    handleURLReorderDragLeave(e) {
        // Remove drop indicators when leaving
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');
        }
    }

    async handleURLReorderDrop(e, targetURLData) {
        e.preventDefault();

        console.log('URL reorder drop started:', {
            draggedURL: this.draggedURL?.title,
            targetURL: targetURLData.title,
            sameURL: this.draggedURL?.id === targetURLData.id,
            sameGroup: this.draggedURL?.groupId === targetURLData.groupId
        });

        if (!this.draggedURL || this.draggedURL.id === targetURLData.id) {
            console.log('URL reorder drop: skipping - no dragged URL or same URL');
            return;
        }

        // Only allow reordering within the same group
        if (this.draggedURL.groupId !== targetURLData.groupId) {
            console.log('URL reorder drop: skipping - different groups');
            return;
        }

        // Store dragged URL title for error handling
        const draggedURLTitle = this.draggedURL.title;

        try {
            // Remove visual feedback from all URL items
            document.querySelectorAll('.url-item').forEach(item => {
                item.classList.remove('drag-over-top', 'drag-over-bottom');
            });

            // Determine drop position
            const rect = e.currentTarget.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const isTopHalf = e.clientY < midpoint;

            console.log('URL reorder drop: positioning', {
                targetURL: targetURLData.title,
                targetOrder: targetURLData.order,
                isTopHalf,
                mouseY: e.clientY,
                midpoint
            });

            // Calculate new order
            let newOrder;
            if (isTopHalf) {
                // Drop above target
                newOrder = targetURLData.order - 0.5;
            } else {
                // Drop below target
                newOrder = targetURLData.order + 0.5;
            }

            console.log('URL reorder drop: executing', {
                draggedURL: draggedURLTitle,
                oldOrder: this.draggedURL.order,
                newOrder
            });

            this.showLoading(`Moving "${draggedURLTitle}"...`);

            // Update the dragged URL's order
            this.draggedURL.order = newOrder;
            this.draggedURL.lastModified = new Date().toISOString();

            // Normalize URL orders within the group
            this.normalizeURLOrdersInGroup(this.draggedURL.groupId);

            // Save to storage
            await this.saveData();

            // Update UI
            this.renderURLs();

            // Show success message
            this.showMessage(`"${draggedURLTitle}" moved successfully!`);

            this.hideLoading();

            console.log(`URL "${draggedURLTitle}" moved to position ${newOrder} successfully`);

        } catch (error) {
            console.error('Error reordering URL:', error);
            this.showError('Failed to reorder URL');
            this.hideLoading();
        }
    }

    normalizeURLOrdersInGroup(groupId) {
        // Get all URLs in the group and sort by current order
        const groupURLs = this.urls.filter(url => url.groupId === groupId).sort((a, b) => (a.order || 0) - (b.order || 0));

        // Reassign orders starting from 1
        groupURLs.forEach((url, index) => {
            url.order = index + 1;
        });

        console.log(`Normalized URL orders in group ${groupId}: ${groupURLs.length} URLs`);
    }

    // Keyboard URL Reordering Methods
    async moveURLUp(urlId) {
        const url = this.urls.find(u => u.id === urlId);
        if (!url) return;

        try {
            // Find all URLs in the same group, sorted by order
            const groupURLs = this.urls.filter(u => u.groupId === url.groupId).sort((a, b) => (a.order || 0) - (b.order || 0));
            const currentIndex = groupURLs.findIndex(u => u.id === urlId);

            if (currentIndex > 0) {
                const targetURL = groupURLs[currentIndex - 1];

                // Swap orders
                const tempOrder = url.order;
                url.order = targetURL.order;
                targetURL.order = tempOrder;

                url.lastModified = new Date().toISOString();
                targetURL.lastModified = new Date().toISOString();

                // Save and update UI
                await this.saveData();
                this.renderURLs();

                // Re-focus the moved URL
                setTimeout(() => {
                    const movedURL = document.querySelector(`[data-url-id="${urlId}"]`);
                    if (movedURL) movedURL.focus();
                }, 100);

                this.showMessage(`"${url.title}" moved up`);
                console.log(`URL "${url.title}" moved up`);
            }
        } catch (error) {
            console.error('Error moving URL up:', error);
            this.showError('Failed to move URL up');
        }
    }

    async moveURLDown(urlId) {
        const url = this.urls.find(u => u.id === urlId);
        if (!url) return;

        try {
            // Find all URLs in the same group, sorted by order
            const groupURLs = this.urls.filter(u => u.groupId === url.groupId).sort((a, b) => (a.order || 0) - (b.order || 0));
            const currentIndex = groupURLs.findIndex(u => u.id === urlId);

            if (currentIndex < groupURLs.length - 1) {
                const targetURL = groupURLs[currentIndex + 1];

                // Swap orders
                const tempOrder = url.order;
                url.order = targetURL.order;
                targetURL.order = tempOrder;

                url.lastModified = new Date().toISOString();
                targetURL.lastModified = new Date().toISOString();

                // Save and update UI
                await this.saveData();
                this.renderURLs();

                // Re-focus the moved URL
                setTimeout(() => {
                    const movedURL = document.querySelector(`[data-url-id="${urlId}"]`);
                    if (movedURL) movedURL.focus();
                }, 100);

                this.showMessage(`"${url.title}" moved down`);
                console.log(`URL "${url.title}" moved down`);
            }
        } catch (error) {
            console.error('Error moving URL down:', error);
            this.showError('Failed to move URL down');
        }
    }

    async moveURLToPreviousGroup(urlId) {
        const url = this.urls.find(u => u.id === urlId);
        if (!url) return;

        try {
            // Find all groups sorted by order
            const sortedGroups = this.groups.sort((a, b) => (a.order || 0) - (b.order || 0));
            const currentGroupIndex = sortedGroups.findIndex(g => g.id === url.groupId);

            if (currentGroupIndex > 0) {
                const targetGroup = sortedGroups[currentGroupIndex - 1];
                const fromGroupId = url.groupId;

                // Get the maximum order in the target group
                const targetGroupURLs = this.urls.filter(u => u.groupId === targetGroup.id);
                const maxOrder = targetGroupURLs.length > 0 ? Math.max(...targetGroupURLs.map(u => u.order || 0)) : 0;

                // Move URL to target group
                url.groupId = targetGroup.id;
                url.order = maxOrder + 1;
                url.lastModified = new Date().toISOString();

                // Use optimized storage movement (only if different storage keys)
                try {
                    await FavURLUtils.moveURLBetweenStorageKeys(urlId, fromGroupId, targetGroup.id, this.groups.map(g => g.toJSON()));
                } catch (storageError) {
                    console.warn('Optimized storage move failed, falling back to full save:', storageError);
                    // Fall back to full save if optimized move fails
                    await this.saveData();
                }

                this.renderURLs();

                // Re-focus the moved URL
                setTimeout(() => {
                    const movedURL = document.querySelector(`[data-url-id="${urlId}"]`);
                    if (movedURL) movedURL.focus();
                }, 100);

                this.showMessage(`"${url.title}" moved to ${targetGroup.name}`);
                console.log(`URL "${url.title}" moved to group ${targetGroup.name}`);
            }
        } catch (error) {
            console.error('Error moving URL to previous group:', error);
            this.showError('Failed to move URL to previous group');
        }
    }

    async moveURLToNextGroup(urlId) {
        const url = this.urls.find(u => u.id === urlId);
        if (!url) return;

        try {
            // Find all groups sorted by order
            const sortedGroups = this.groups.sort((a, b) => (a.order || 0) - (b.order || 0));
            const currentGroupIndex = sortedGroups.findIndex(g => g.id === url.groupId);

            if (currentGroupIndex < sortedGroups.length - 1) {
                const targetGroup = sortedGroups[currentGroupIndex + 1];
                const fromGroupId = url.groupId;

                // Get the maximum order in the target group
                const targetGroupURLs = this.urls.filter(u => u.groupId === targetGroup.id);
                const maxOrder = targetGroupURLs.length > 0 ? Math.max(...targetGroupURLs.map(u => u.order || 0)) : 0;

                // Move URL to target group
                url.groupId = targetGroup.id;
                url.order = maxOrder + 1;
                url.lastModified = new Date().toISOString();

                // Use optimized storage movement (only if different storage keys)
                try {
                    await FavURLUtils.moveURLBetweenStorageKeys(urlId, fromGroupId, targetGroup.id, this.groups.map(g => g.toJSON()));
                } catch (storageError) {
                    console.warn('Optimized storage move failed, falling back to full save:', storageError);
                    // Fall back to full save if optimized move fails
                    await this.saveData();
                }

                this.renderURLs();

                // Re-focus the moved URL
                setTimeout(() => {
                    const movedURL = document.querySelector(`[data-url-id="${urlId}"]`);
                    if (movedURL) movedURL.focus();
                }, 100);

                this.showMessage(`"${url.title}" moved to ${targetGroup.name}`);
                console.log(`URL "${url.title}" moved to group ${targetGroup.name}`);
            }
        } catch (error) {
            console.error('Error moving URL to next group:', error);
            this.showError('Failed to move URL to next group');
        }
    }

    handleURLToGroupDragOver(e, targetGroupId) {
        e.preventDefault(); // Allow drop

        // Only allow drop if we have a dragged URL and it's not the same group
        if (this.draggedURL && this.draggedURL.groupId !== targetGroupId) {
            e.dataTransfer.dropEffect = 'move';
        } else {
            e.dataTransfer.dropEffect = 'none';
        }
    }

    handleURLToGroupDragEnter(e, targetGroupId) {
        e.preventDefault();

        // Add visual feedback if valid drop target
        if (this.draggedURL && this.draggedURL.groupId !== targetGroupId) {
            e.currentTarget.classList.add('drag-over');
        }
    }

    handleURLToGroupDragLeave(e) {
        // Remove visual feedback only if leaving the header element itself
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('drag-over');
        }
    }

    async handleURLToGroupDrop(e, targetGroupId) {
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

    // Unified Drag and Drop Event Handlers
    handleUnifiedDragOver(e, targetGroupId) {
        e.preventDefault();

        // Debug logging
        console.log('Unified dragover:', {
            targetGroupId,
            draggedGroup: this.draggedGroup?.name,
            draggedURL: this.draggedURL?.title
        });

        // Determine what type of drag operation this is
        if (this.draggedGroup) {
            // Group reordering operation
            console.log('Routing to group reorder dragover');
            this.handleGroupReorderDragOver(e, targetGroupId);
        } else if (this.draggedURL) {
            // URL to group assignment operation
            console.log('Routing to URL-to-group dragover');
            this.handleURLToGroupDragOver(e, targetGroupId);
        }
    }

    handleUnifiedDrop(e, targetGroupId) {
        e.preventDefault();

        // Debug logging
        console.log('Unified drop:', {
            targetGroupId,
            draggedGroup: this.draggedGroup?.name,
            draggedURL: this.draggedURL?.title
        });

        // Route to appropriate handler based on drag type
        if (this.draggedGroup) {
            // Group reordering operation
            console.log('Routing to group reorder drop');
            this.handleGroupReorderDrop(e, targetGroupId);
        } else if (this.draggedURL) {
            // URL to group assignment operation
            console.log('Routing to URL-to-group drop');
            this.handleURLToGroupDrop(e, targetGroupId);
        }
    }

    handleUnifiedDragEnter(e, targetGroupId) {
        e.preventDefault();

        // Route to appropriate handler based on drag type
        if (this.draggedGroup) {
            // Group reordering operation
            this.handleGroupReorderDragEnter(e, targetGroupId);
        } else if (this.draggedURL) {
            // URL to group assignment operation
            this.handleURLToGroupDragEnter(e, targetGroupId);
        }
    }

    handleUnifiedDragLeave(e) {
        // Route to appropriate handler based on drag type
        if (this.draggedGroup) {
            // Group reordering operation
            this.handleGroupReorderDragLeave(e);
        } else if (this.draggedURL) {
            // URL to group assignment operation
            this.handleURLToGroupDragLeave(e);
        }
    }

    // Group Reordering Drag and Drop Methods
    handleGroupDragStart(e, group) {
        // Store the dragged group data
        this.draggedGroup = group;
        e.dataTransfer.setData('text/plain', group.id);
        e.dataTransfer.setData('application/json', JSON.stringify({
            id: group.id,
            name: group.name,
            order: group.order
        }));

        // Set drag effect
        e.dataTransfer.effectAllowed = 'move';

        // Add visual feedback
        e.target.classList.add('dragging');

        console.log('Group drag started:', group.name);
    }

    handleGroupDragEnd(e) {
        // Remove visual feedback from dragged element
        e.target.classList.remove('dragging');

        // Clear all drop zone visual states
        document.querySelectorAll('.group-header').forEach(header => {
            header.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        // Clear reference
        this.draggedGroup = null;

        console.log('Group drag ended');
    }

    handleGroupReorderDragOver(e, targetGroupId) {
        e.preventDefault();

        // Only handle group reordering, not URL drops
        if (!this.draggedGroup || this.draggedGroup.id === targetGroupId) {
            console.log('Group reorder dragover: skipping', {
                noDraggedGroup: !this.draggedGroup,
                sameGroup: this.draggedGroup?.id === targetGroupId
            });
            return;
        }

        e.dataTransfer.dropEffect = 'move';

        // Determine drop position based on mouse position
        const rect = e.currentTarget.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const isTopHalf = e.clientY < midpoint;

        console.log('Group reorder dragover: positioning', {
            targetGroupId,
            draggedGroup: this.draggedGroup.name,
            isTopHalf,
            mouseY: e.clientY,
            midpoint
        });

        // Clear previous drop indicators from all headers
        document.querySelectorAll('.group-header').forEach(header => {
            header.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        // Add appropriate drop indicator
        if (isTopHalf) {
            e.currentTarget.classList.add('drag-over-top');
            console.log('Added drag-over-top to', targetGroupId);
        } else {
            e.currentTarget.classList.add('drag-over-bottom');
            console.log('Added drag-over-bottom to', targetGroupId);
        }
    }

    handleGroupReorderDragEnter(e) {
        e.preventDefault();
        // Visual feedback is handled in dragover
    }

    handleGroupReorderDragLeave(e) {
        // Remove drop indicators when leaving
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');
        }
    }

    async handleGroupReorderDrop(e, targetGroupId) {
        e.preventDefault();

        console.log('Group reorder drop started:', {
            draggedGroup: this.draggedGroup?.name,
            targetGroupId,
            sameGroup: this.draggedGroup?.id === targetGroupId
        });

        if (!this.draggedGroup || this.draggedGroup.id === targetGroupId) {
            console.log('Group reorder drop: skipping - no dragged group or same group');
            return;
        }

        // Save dragged group reference before it gets cleared by dragend event
        const draggedGroup = this.draggedGroup;
        const draggedGroupName = draggedGroup.name;

        try {
            // Remove visual feedback from all headers
            document.querySelectorAll('.group-header').forEach(header => {
                header.classList.remove('drag-over-top', 'drag-over-bottom');
            });

            // Determine drop position
            const rect = e.currentTarget.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const isTopHalf = e.clientY < midpoint;

            // Find target group
            const targetGroup = this.groups.find(g => g.id === targetGroupId);
            if (!targetGroup) {
                console.error('Target group not found:', targetGroupId);
                return;
            }

            console.log('Group reorder drop: positioning', {
                targetGroup: targetGroup.name,
                targetOrder: targetGroup.order,
                isTopHalf,
                mouseY: e.clientY,
                midpoint
            });

            // Calculate new order
            let newOrder;
            if (isTopHalf) {
                // Drop above target
                newOrder = targetGroup.order - 0.5;
            } else {
                // Drop below target
                newOrder = targetGroup.order + 0.5;
            }

            // Don't allow reordering above ungrouped
            if (newOrder <= 0) {
                newOrder = 1;
                console.log('Adjusted newOrder to 1 to prevent going above ungrouped');
            }

            console.log('Group reorder drop: executing', {
                draggedGroup: draggedGroupName,
                oldOrder: draggedGroup.order,
                newOrder
            });

            this.showLoading(`Moving "${draggedGroupName}" group...`);

            // Update the dragged group's order
            draggedGroup.order = newOrder;
            draggedGroup.lastModified = new Date().toISOString();

            // Normalize all group orders to integers
            this.normalizeGroupOrders();

            // Save to storage
            await this.saveData();

            // Update UI
            this.renderURLs();

            // Show success message
            this.showMessage(`Group "${draggedGroupName}" moved successfully!`);

            this.hideLoading();

            console.log(`Group "${draggedGroupName}" moved to position ${newOrder} successfully`);

        } catch (error) {
            console.error('Error reordering group:', error);
            this.showError('Failed to reorder group');
            this.hideLoading();
        }
    }

    normalizeGroupOrders() {
        // Sort groups by current order (excluding ungrouped which stays at 0)
        const sortableGroups = this.groups.filter(g => g.id !== 'ungrouped').sort((a, b) => (a.order || 0) - (b.order || 0));

        // Reassign orders starting from 1
        sortableGroups.forEach((group, index) => {
            group.order = index + 1;
        });

        console.log('Normalized group orders');
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
                // Ctrl+Shift+Down: Move group down
                if (e.ctrlKey && e.shiftKey) {
                    this.moveGroupDown(currentHeader.getAttribute('data-group-id'));
                } else {
                    // Normal navigation
                    const nextIndex = (currentIndex + 1) % allHeaders.length;
                    allHeaders[nextIndex].focus();
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                // Ctrl+Shift+Up: Move group up
                if (e.ctrlKey && e.shiftKey) {
                    this.moveGroupUp(currentHeader.getAttribute('data-group-id'));
                } else {
                    // Normal navigation
                    const prevIndex = currentIndex === 0 ? allHeaders.length - 1 : currentIndex - 1;
                    allHeaders[prevIndex].focus();
                }
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

    // Keyboard Group Reordering Methods
    async moveGroupUp(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group || group.protected || group.id === 'ungrouped') {
            return; // Can't move protected groups
        }

        try {
            // Find the group with the order just above this one
            const sortableGroups = this.groups.filter(g => g.id !== 'ungrouped').sort((a, b) => (a.order || 0) - (b.order || 0));
            const currentIndex = sortableGroups.findIndex(g => g.id === groupId);

            if (currentIndex > 0) {
                const targetGroup = sortableGroups[currentIndex - 1];

                // Swap orders
                const tempOrder = group.order;
                group.order = targetGroup.order;
                targetGroup.order = tempOrder;

                group.lastModified = new Date().toISOString();
                targetGroup.lastModified = new Date().toISOString();

                // Save and update UI
                await this.saveData();
                this.renderURLs();

                // Re-focus the moved group
                setTimeout(() => {
                    const movedHeader = document.querySelector(`[data-group-id="${groupId}"]`);
                    if (movedHeader) movedHeader.focus();
                }, 100);

                this.showMessage(`Group "${group.name}" moved up`);
                console.log(`Group "${group.name}" moved up`);
            }
        } catch (error) {
            console.error('Error moving group up:', error);
            this.showError('Failed to move group up');
        }
    }

    async moveGroupDown(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group || group.protected || group.id === 'ungrouped') {
            return; // Can't move protected groups
        }

        try {
            // Find the group with the order just below this one
            const sortableGroups = this.groups.filter(g => g.id !== 'ungrouped').sort((a, b) => (a.order || 0) - (b.order || 0));
            const currentIndex = sortableGroups.findIndex(g => g.id === groupId);

            if (currentIndex < sortableGroups.length - 1) {
                const targetGroup = sortableGroups[currentIndex + 1];

                // Swap orders
                const tempOrder = group.order;
                group.order = targetGroup.order;
                targetGroup.order = tempOrder;

                group.lastModified = new Date().toISOString();
                targetGroup.lastModified = new Date().toISOString();

                // Save and update UI
                await this.saveData();
                this.renderURLs();

                // Re-focus the moved group
                setTimeout(() => {
                    const movedHeader = document.querySelector(`[data-group-id="${groupId}"]`);
                    if (movedHeader) movedHeader.focus();
                }, 100);

                this.showMessage(`Group "${group.name}" moved down`);
                console.log(`Group "${group.name}" moved down`);
            }
        } catch (error) {
            console.error('Error moving group down:', error);
            this.showError('Failed to move group down');
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
            const usage = await StorageManager.getStorageUsage();
            this.storageQuotaUsed = usage.bytesInUse;
            console.log(`Storage usage: ${usage.formatted}`);
        } catch (error) {
            console.warn('Could not get storage usage:', error);
        }
    }

    async getStorageInfo() {
        const usage = await StorageManager.getStorageUsage();
        return usage.formatted;
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
        return FavURLUtils.extractDomain(url);
    }

    escapeHtml(text) {
        return FavURLUtils.escapeHtml(text);
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

    showToast(message) {
        console.log('Success:', message);

        // Create temporary success toast
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #4caf50;
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

    // Menu functionality
    toggleMenu() {
        const menuButton = document.getElementById('menuButton');
        const menuDropdown = document.getElementById('menuDropdown');
        if (!menuButton || !menuDropdown) return;

        const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
        if (isOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        const menuButton = document.getElementById('menuButton');
        const menuDropdown = document.getElementById('menuDropdown');
        if (!menuButton || !menuDropdown) return;

        menuButton.setAttribute('aria-expanded', 'true');
        menuDropdown.setAttribute('aria-hidden', 'false');
    }

    closeMenu() {
        const menuButton = document.getElementById('menuButton');
        const menuDropdown = document.getElementById('menuDropdown');
        if (!menuButton || !menuDropdown) return;

        menuButton.setAttribute('aria-expanded', 'false');
        menuDropdown.setAttribute('aria-hidden', 'true');
    }

    // Export functionality
    async exportData() {
        try {
            // Prepare keys for chunked storage
            const keys = ['groupCount', 'urlCount', 'dataModelVersion', 'startPageEnabled', 'openInNewTab', 'urls', 'groups'];

            // Add all possible group keys (group00-group31)
            for (let i = 0; i < 32; i++) {
                keys.push(`group${i.toString().padStart(2, '0')}`);
            }

            // Add all possible URL keys (url000-url399)
            for (let i = 0; i < 400; i++) {
                keys.push(`url${i.toString().padStart(3, '0')}`);
            }

            // Load current data from storage
            const result = await chrome.storage.sync.get(keys);

            // Reconstruct groups array from chunked storage or legacy format
            let groups = [];
            if (result.groupCount || result.group00) {
                // New chunked format
                const groupCount = result.groupCount || 1; // At least 1 for ungrouped
                for (let i = 0; i < groupCount && i < 32; i++) {
                    const key = `group${i.toString().padStart(2, '0')}`;
                    if (result[key]) {
                        groups.push(result[key]);
                    }
                }
            } else if (result.groups) {
                // Legacy format
                groups = result.groups;
            }

            // Reconstruct URLs array from chunked storage or legacy format
            let urls = [];
            if (result.urlCount || result.url000) {
                // New chunked format
                const urlCount = result.urlCount || 0;
                for (let i = 0; i < urlCount && i < 400; i++) {
                    const key = `url${i.toString().padStart(3, '0')}`;
                    if (result[key]) {
                        urls.push(result[key]);
                    }
                }
            } else if (result.urls) {
                // Legacy format
                urls = result.urls;
            }

            // Create export data with metadata
            const exportData = {
                metadata: {
                    version: "1.0",
                    exportDate: new Date().toISOString(),
                    source: "FavURL Extension",
                    totalGroups: groups.length,
                    totalUrls: urls.length
                },
                groups: groups,
                urls: urls
            };

            // Convert to JSON
            const jsonString = JSON.stringify(exportData, null, 2);

            // Create filename with timestamp
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `favurl-backup-${timestamp}.json`;

            // Create blob and download
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            // Create temporary download link
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = filename;
            downloadLink.style.display = 'none';

            // Trigger download
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            // Clean up blob URL
            URL.revokeObjectURL(url);

            this.showToast(`Data exported successfully as ${filename}`);
            console.log('Export completed:', filename);

        } catch (error) {
            console.error('Export failed:', error);
            this.showToast('Export failed. Please try again.');
        }
    }

    // Import functionality
    importData() {
        const fileInput = document.getElementById('importFileInput');
        if (fileInput) {
            fileInput.click();
        }
    }

    async handleImportFile(file) {
        if (!file) return;

        try {
            console.log('Starting import file handling:', file.name);

            // Validate file type
            if (!file.name.toLowerCase().endsWith('.json')) {
                this.showToast('Please select a JSON file.');
                return;
            }

            // Check file size (limit to 1MB)
            if (file.size > 1024 * 1024) {
                this.showToast('File is too large. Maximum size is 1MB.');
                return;
            }

            // Read file content
            const fileContent = await this.readFileAsText(file);
            console.log('File content read successfully, length:', fileContent.length);

            // Parse JSON
            let importData;
            try {
                importData = JSON.parse(fileContent);
                console.log('JSON parsed successfully:', importData);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                this.showToast('Invalid JSON file. Please check the file format.');
                return;
            }

            // Validate import data structure
            const validation = this.validateImportData(importData);
            if (!validation.valid) {
                console.error('Validation failed:', validation.error);
                this.showToast(`Import validation failed: ${validation.error}`);
                return;
            }

            console.log('Validation passed, showing confirmation dialog');

            // Show confirmation dialog
            this.showImportConfirmation(importData);

        } catch (error) {
            console.error('Import file handling failed:', error);
            this.showToast('Failed to read the file. Please try again.');
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    validateImportData(data) {
        // Check required structure
        if (!data || typeof data !== 'object') {
            return { valid: false, error: 'Invalid data format' };
        }

        if (!data.groups || !Array.isArray(data.groups)) {
            return { valid: false, error: 'Missing or invalid groups data' };
        }

        if (!data.urls || !Array.isArray(data.urls)) {
            return { valid: false, error: 'Missing or invalid URLs data' };
        }

        // Validate groups
        for (const group of data.groups) {
            if (!group.id || !group.name) {
                return { valid: false, error: 'Invalid group data: missing id or name' };
            }
        }

        // Validate URLs
        for (const url of data.urls) {
            if (!url.id || !url.url || !url.title) {
                return { valid: false, error: 'Invalid URL data: missing required fields' };
            }

            // Basic URL validation
            try {
                new URL(url.url);
            } catch {
                return { valid: false, error: `Invalid URL format: ${url.url}` };
            }
        }

        return { valid: true };
    }

    showImportConfirmation(importData) {
        try {
            const { groups, urls } = importData;
            const groupCount = groups.length;
            const urlCount = urls.length;

            // Store import data for later use
            this.pendingImportData = importData;

            // Get templates
            const template = document.getElementById('importConfirmationModalTemplate');
            const footerTemplate = document.getElementById('importConfirmationModalFooterTemplate');

            if (!template || !footerTemplate) {
                console.error('Import confirmation templates not found');
                // Fallback to simple confirm dialog
                const confirmMessage = `Import ${groupCount} group(s) and ${urlCount} URL(s)?\n\nChoose:\nOK = Replace all data (deletes items not in import)\nCancel = Cancel import`;
                if (confirm(confirmMessage)) {
                    this.processReplaceImport(importData);
                }
                return;
            }

            // Clone template content
            const modalBody = template.content.cloneNode(true);
            const modalFooter = footerTemplate.content.cloneNode(true);

            // Set up modal content before opening
            const groupCountElement = modalBody.getElementById('importGroupCount');
            const urlCountElement = modalBody.getElementById('importUrlCount');

            if (groupCountElement) groupCountElement.textContent = groupCount;
            if (urlCountElement) urlCountElement.textContent = urlCount;

            // Open modal
            this.openModal('Import Data Confirmation', modalBody, modalFooter);

            // Set up event listeners after modal is opened
            setTimeout(() => {
                this.setupImportConfirmationListeners();
            }, 100);

        } catch (error) {
            console.error('Error opening import confirmation modal:', error);
            // Fallback to simple confirm dialog
            const confirmMessage = `Import ${importData.groups.length} group(s) and ${importData.urls.length} URL(s)?\n\nThis will REPLACE all existing data. Continue?`;
            if (confirm(confirmMessage)) {
                this.processReplaceImport(importData);
            }
        }
    }

    setupImportConfirmationListeners() {
        const replaceRadio = document.getElementById('importModeReplace');
        const mergeRadio = document.getElementById('importModeMerge');
        const warning = document.getElementById('replaceWarning');
        const confirmBtn = document.getElementById('confirmImport');
        const cancelBtn = document.getElementById('cancelImport');

        if (!replaceRadio || !mergeRadio || !warning || !confirmBtn || !cancelBtn) {
            console.error('Import confirmation elements not found');
            return;
        }

        const updateWarningVisibility = () => {
            if (replaceRadio.checked) {
                warning.classList.remove('hidden');
            } else {
                warning.classList.add('hidden');
            }
        };

        // Initial state
        updateWarningVisibility();

        // Add event listeners
        replaceRadio.addEventListener('change', updateWarningVisibility);
        mergeRadio.addEventListener('change', updateWarningVisibility);

        confirmBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const selectedMode = document.querySelector('input[name="importMode"]:checked')?.value || 'replace';
            this.closeModal();

            if (selectedMode === 'replace') {
                this.processReplaceImport(this.pendingImportData);
            } else {
                this.processImport(this.pendingImportData);
            }
        });

        cancelBtn.addEventListener('click', () => {
            this.closeModal();
            this.pendingImportData = null;
        });
    }

    async processImport(importData) {
        try {
            // Load existing data from new storage structure
            const existingGroupsResult = await chrome.storage.sync.get(['groups']);
            const existingGroups = existingGroupsResult.groups || [];

            // Load existing URLs from 32-key structure
            const existingUrls = await FavURLUtils.loadAllURLsFromStorage();

            console.log(`Merge import: Loading ${existingUrls.length} existing URLs from storage`);

            // Merge groups
            const mergedGroups = this.mergeGroups(existingGroups, importData.groups);

            // Merge URLs
            const mergedUrls = this.mergeUrls(existingUrls, importData.urls);

            console.log(`Merge import: After merge - ${mergedUrls.length} total URLs`);

            // Save merged groups
            await chrome.storage.sync.set({
                groups: mergedGroups,
                version: '1.0',
                lastUpdated: new Date().toISOString(),
                dataModelVersion: this.dataModelVersion
            });

            // Save merged URLs using new 32-key structure
            await FavURLUtils.saveURLsToStorage(mergedUrls, mergedGroups);

            console.log(`Merge import: Saved ${mergedUrls.length} URLs to 32-key storage structure`);

            // Reload data and UI
            await this.loadData();
            this.renderURLs();

            this.showToast(`Import completed: ${importData.urls.length} URLs and ${importData.groups.length} groups processed.`);
            console.log('Import completed successfully');

        } catch (error) {
            console.error('Import processing failed:', error);
            this.showToast('Import failed. Please try again.');
        }
    }

    async processReplaceImport(importData) {
        try {
            // Validate import data one more time
            const validation = this.validateImportData(importData);
            if (!validation.valid) {
                this.showToast(`Import validation failed: ${validation.error}`);
                return;
            }

            // Apply URL and group limits
            const limitedUrls = importData.urls.slice(0, 400);
            const limitedGroups = importData.groups.slice(0, 32);

            // Convert imported data to data model instances
            this.urls = limitedUrls.map(urlData => {
                if (urlData instanceof URLDataModel) {
                    return urlData;
                }
                return URLDataModel.fromJSON(urlData);
            });

            this.groups = limitedGroups.map(groupData => {
                if (groupData instanceof GroupDataModel) {
                    return groupData;
                }
                return GroupDataModel.fromJSON(groupData);
            });

            // Ensure default "Ungrouped" group exists and has correct properties
            this.initializeDefaultGroup();

            // Clear all existing storage (both old and new formats)
            const keysToRemove = ['urls', 'groups', 'groupCount', 'urlCount'];

            // Add all possible chunk keys for cleanup
            for (let i = 0; i < 32; i++) {
                keysToRemove.push(`group${i.toString().padStart(2, '0')}`);
            }
            for (let i = 0; i < 400; i++) {
                keysToRemove.push(`url${i.toString().padStart(3, '0')}`);
            }

            await chrome.storage.sync.remove(keysToRemove);

            // Save the new data using the chunked storage format
            await this.saveData();

            // Reload data and UI
            await this.loadData();
            this.renderURLs();

            const warningMessage = (importData.urls.length > 400 || importData.groups.length > 32)
                ? ` (Limited to 400 URLs and 32 groups)`
                : '';

            this.showToast(`Data replaced successfully: ${Math.min(importData.urls.length, 400)} URLs and ${Math.min(importData.groups.length, 32)} groups imported${warningMessage}.`);
            console.log('Replace import completed successfully');

        } catch (error) {
            console.error('Replace import processing failed:', error);
            this.showError('Replace import failed. Please try again.');
        }
    }

    mergeGroups(existing, imported) {
        const groupMap = new Map();

        // Add existing groups
        existing.forEach(group => {
            groupMap.set(group.id, group);
        });

        // Merge imported groups
        imported.forEach(importedGroup => {
            const existing = groupMap.get(importedGroup.id);
            if (existing) {
                // Update if imported group is newer
                const existingTime = new Date(existing.lastModified || existing.created || 0);
                const importedTime = new Date(importedGroup.lastModified || importedGroup.created || 0);

                if (importedTime > existingTime) {
                    groupMap.set(importedGroup.id, importedGroup);
                }
            } else {
                // Add new group
                groupMap.set(importedGroup.id, importedGroup);
            }
        });

        return Array.from(groupMap.values());
    }

    mergeUrls(existing, imported) {
        const urlMap = new Map();

        // Add existing URLs
        existing.forEach(url => {
            const key = `${url.url}|${url.title}`;
            urlMap.set(key, url);
        });

        // Merge imported URLs
        imported.forEach(importedUrl => {
            const key = `${importedUrl.url}|${importedUrl.title}`;
            const existing = urlMap.get(key);

            if (existing) {
                // Update if imported URL is newer
                const existingTime = new Date(existing.lastModified || existing.timestamp || 0);
                const importedTime = new Date(importedUrl.lastModified || importedUrl.timestamp || 0);

                if (importedTime > existingTime) {
                    urlMap.set(key, importedUrl);
                }
            } else {
                // Add new URL
                urlMap.set(key, importedUrl);
            }
        });

        return Array.from(urlMap.values());
    }

    // Color Settings Modal Functions
    async openColorSettingsModal() {
        try {
            // Load current color theme
            const colorTheme = await StorageManager.loadColorTheme();

            // Get templates
            const template = document.getElementById('colorSettingsModalTemplate');
            const footerTemplate = document.getElementById('colorSettingsModalFooterTemplate');

            if (!template || !footerTemplate) {
                console.error('Color settings templates not found');
                this.showToast('Color settings unavailable');
                return;
            }

            // Clone template content
            const modalBody = template.content.cloneNode(true);
            const modalFooter = footerTemplate.content.cloneNode(true);

            // Set current color values
            const pageColorInput = modalBody.getElementById('pageBackgroundColor');
            const pageColorHexInput = modalBody.getElementById('pageBackgroundColorHex');
            const groupColorInput = modalBody.getElementById('groupHeaderBackgroundColor');
            const groupColorHexInput = modalBody.getElementById('groupHeaderBackgroundColorHex');
            const urlColorInput = modalBody.getElementById('urlItemBackgroundColor');
            const urlColorHexInput = modalBody.getElementById('urlItemBackgroundColorHex');

            if (pageColorInput && pageColorHexInput) {
                pageColorInput.value = colorTheme.pageBackground;
                pageColorHexInput.value = colorTheme.pageBackground;
            }
            if (groupColorInput && groupColorHexInput) {
                groupColorInput.value = colorTheme.groupHeaderBackground;
                groupColorHexInput.value = colorTheme.groupHeaderBackground;
            }
            if (urlColorInput && urlColorHexInput) {
                urlColorInput.value = colorTheme.urlItemBackground;
                urlColorHexInput.value = colorTheme.urlItemBackground;
            }

            // Open modal
            this.openModal('Color Settings', modalBody, modalFooter);

            // Setup event listeners after modal is opened
            setTimeout(() => {
                this.setupColorSettingsListeners();
            }, 100);

        } catch (error) {
            console.error('Error opening color settings modal:', error);
            this.showToast('Failed to open color settings');
        }
    }

    setupColorSettingsListeners() {
        // Color picker and hex input sync
        const syncColorInputs = (colorInput, hexInput) => {
            if (!colorInput || !hexInput) return;

            colorInput.addEventListener('input', (e) => {
                hexInput.value = e.target.value.toUpperCase();
            });

            hexInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                    colorInput.value = value;
                }
            });
        };

        syncColorInputs(
            document.getElementById('pageBackgroundColor'),
            document.getElementById('pageBackgroundColorHex')
        );
        syncColorInputs(
            document.getElementById('groupHeaderBackgroundColor'),
            document.getElementById('groupHeaderBackgroundColorHex')
        );
        syncColorInputs(
            document.getElementById('urlItemBackgroundColor'),
            document.getElementById('urlItemBackgroundColorHex')
        );

        // Save button
        const form = document.getElementById('colorSettingsForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveColorSettings();
            });
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancelColorSettings');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }

        // Reset button
        const resetBtn = document.getElementById('resetColorTheme');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                await this.resetColorSettings();
            });
        }
    }

    async saveColorSettings() {
        try {
            const pageColor = document.getElementById('pageBackgroundColorHex')?.value;
            const groupColor = document.getElementById('groupHeaderBackgroundColorHex')?.value;
            const urlColor = document.getElementById('urlItemBackgroundColorHex')?.value;

            // Validate color format
            const colorPattern = /^#[0-9A-Fa-f]{6}$/;
            if (!colorPattern.test(pageColor) || !colorPattern.test(groupColor) || !colorPattern.test(urlColor)) {
                this.showToast('Invalid color format. Please use hex format (#RRGGBB)');
                return;
            }

            const colorTheme = {
                pageBackground: pageColor,
                groupHeaderBackground: groupColor,
                urlItemBackground: urlColor
            };

            // Update instance variable so it's preserved in saveData()
            this.colorTheme = colorTheme;

            await StorageManager.saveColorTheme(colorTheme);

            // Apply colors immediately to popup
            this.applyColorTheme(colorTheme);

            this.closeModal();
            this.showToast('Color settings saved successfully');

        } catch (error) {
            console.error('Error saving color settings:', error);
            this.showToast('Failed to save color settings');
        }
    }

    async resetColorSettings() {
        try {
            await StorageManager.resetColorTheme();

            // Get default colors and update inputs
            const defaultTheme = StorageManager.getDefaultColorTheme();

            // Update instance variable so it's preserved in saveData()
            this.colorTheme = defaultTheme;

            const pageColorInput = document.getElementById('pageBackgroundColor');
            const pageColorHexInput = document.getElementById('pageBackgroundColorHex');
            const groupColorInput = document.getElementById('groupHeaderBackgroundColor');
            const groupColorHexInput = document.getElementById('groupHeaderBackgroundColorHex');
            const urlColorInput = document.getElementById('urlItemBackgroundColor');
            const urlColorHexInput = document.getElementById('urlItemBackgroundColorHex');

            if (pageColorInput && pageColorHexInput) {
                pageColorInput.value = defaultTheme.pageBackground;
                pageColorHexInput.value = defaultTheme.pageBackground;
            }
            if (groupColorInput && groupColorHexInput) {
                groupColorInput.value = defaultTheme.groupHeaderBackground;
                groupColorHexInput.value = defaultTheme.groupHeaderBackground;
            }
            if (urlColorInput && urlColorHexInput) {
                urlColorInput.value = defaultTheme.urlItemBackground;
                urlColorHexInput.value = defaultTheme.urlItemBackground;
            }

            this.showToast('Colors reset to defaults');

        } catch (error) {
            console.error('Error resetting colors:', error);
            this.showToast('Failed to reset colors');
        }
    }

    applyColorTheme(colorTheme) {
        // Apply colors to popup using CSS custom properties
        document.documentElement.style.setProperty('--page-bg', colorTheme.pageBackground);
        document.documentElement.style.setProperty('--group-header-bg', colorTheme.groupHeaderBackground);
        document.documentElement.style.setProperty('--url-item-bg', colorTheme.urlItemBackground);
    }

    async loadAndApplyColorTheme() {
        try {
            const colorTheme = await StorageManager.loadColorTheme();
            this.applyColorTheme(colorTheme);
        } catch (error) {
            console.error('Error loading color theme:', error);
        }
    }

    // Display version number from manifest
    displayVersion() {
        try {
            const manifest = chrome.runtime.getManifest();
            const versionElement = document.getElementById('popupVersion');
            if (versionElement && manifest.version) {
                versionElement.textContent = `v${manifest.version}`;
            }
        } catch (error) {
            console.error('Error displaying version:', error);
        }
    }

    // Font Settings Modal Functions
    async openFontSettingsModal() {
        try {
            // Load current font settings
            const fontSettings = await StorageManager.loadFontSettings();

            // Get templates
            const template = document.getElementById('fontSettingsModalTemplate');
            const footerTemplate = document.getElementById('fontSettingsModalFooterTemplate');

            if (!template || !footerTemplate) {
                console.error('Font settings templates not found');
                this.showToast('Font settings unavailable');
                return;
            }

            // Clone template content
            const modalBody = template.content.cloneNode(true);
            const modalFooter = footerTemplate.content.cloneNode(true);

            // Set current values for group title
            const groupFamilySelect = modalBody.getElementById('groupTitleFontFamily');
            const groupSizeRange = modalBody.getElementById('groupTitleFontSize');
            const groupSizeNumber = modalBody.getElementById('groupTitleFontSizeNumber');
            const groupColorInput = modalBody.getElementById('groupTitleFontColor');
            const groupColorHex = modalBody.getElementById('groupTitleFontColorHex');

            if (groupFamilySelect) groupFamilySelect.value = fontSettings.groupTitle.family;
            if (groupSizeRange && groupSizeNumber) {
                const sizeValue = parseInt(fontSettings.groupTitle.size);
                groupSizeRange.value = sizeValue;
                groupSizeNumber.value = sizeValue;
            }
            if (groupColorInput && groupColorHex) {
                groupColorInput.value = fontSettings.groupTitle.color;
                groupColorHex.value = fontSettings.groupTitle.color;
            }

            // Set current values for URL item
            const urlFamilySelect = modalBody.getElementById('urlItemFontFamily');
            const urlSizeRange = modalBody.getElementById('urlItemFontSize');
            const urlSizeNumber = modalBody.getElementById('urlItemFontSizeNumber');
            const urlColorInput = modalBody.getElementById('urlItemFontColor');
            const urlColorHex = modalBody.getElementById('urlItemFontColorHex');

            if (urlFamilySelect) urlFamilySelect.value = fontSettings.urlItem.family;
            if (urlSizeRange && urlSizeNumber) {
                const sizeValue = parseInt(fontSettings.urlItem.size);
                urlSizeRange.value = sizeValue;
                urlSizeNumber.value = sizeValue;
            }
            if (urlColorInput && urlColorHex) {
                urlColorInput.value = fontSettings.urlItem.color;
                urlColorHex.value = fontSettings.urlItem.color;
            }

            // Open modal
            this.openModal('Font Settings', modalBody, modalFooter);

            // Setup event listeners after modal is opened
            setTimeout(() => {
                this.setupFontSettingsListeners();
            }, 100);

        } catch (error) {
            console.error('Error opening font settings modal:', error);
            this.showToast('Failed to open font settings');
        }
    }

    setupFontSettingsListeners() {
        // Sync range sliders with number inputs
        const syncSizeInputs = (rangeInput, numberInput) => {
            if (!rangeInput || !numberInput) return;

            rangeInput.addEventListener('input', (e) => {
                numberInput.value = e.target.value;
            });

            numberInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (value >= 10 && value <= 32) {
                    rangeInput.value = value;
                }
            });
        };

        syncSizeInputs(
            document.getElementById('groupTitleFontSize'),
            document.getElementById('groupTitleFontSizeNumber')
        );
        syncSizeInputs(
            document.getElementById('urlItemFontSize'),
            document.getElementById('urlItemFontSizeNumber')
        );

        // Sync color pickers with hex inputs
        const syncColorInputs = (colorInput, hexInput) => {
            if (!colorInput || !hexInput) return;

            colorInput.addEventListener('input', (e) => {
                hexInput.value = e.target.value.toUpperCase();
            });

            hexInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                    colorInput.value = value;
                }
            });
        };

        syncColorInputs(
            document.getElementById('groupTitleFontColor'),
            document.getElementById('groupTitleFontColorHex')
        );
        syncColorInputs(
            document.getElementById('urlItemFontColor'),
            document.getElementById('urlItemFontColorHex')
        );

        // Save button
        const form = document.getElementById('fontSettingsForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveFontSettings();
            });
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancelFontSettings');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }

        // Reset button
        const resetBtn = document.getElementById('resetFontSettings');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                await this.resetFontSettings();
            });
        }
    }

    async saveFontSettings() {
        try {
            const groupFamily = document.getElementById('groupTitleFontFamily')?.value;
            const groupSize = document.getElementById('groupTitleFontSizeNumber')?.value;
            const groupColor = document.getElementById('groupTitleFontColorHex')?.value;
            const urlFamily = document.getElementById('urlItemFontFamily')?.value;
            const urlSize = document.getElementById('urlItemFontSizeNumber')?.value;
            const urlColor = document.getElementById('urlItemFontColorHex')?.value;

            // Validate inputs
            const colorPattern = /^#[0-9A-Fa-f]{6}$/;
            if (!colorPattern.test(groupColor) || !colorPattern.test(urlColor)) {
                this.showToast('Invalid color format. Please use hex format (#RRGGBB)');
                return;
            }

            const groupSizeNum = parseInt(groupSize);
            const urlSizeNum = parseInt(urlSize);
            if (groupSizeNum < 10 || groupSizeNum > 32 || urlSizeNum < 10 || urlSizeNum > 32) {
                this.showToast('Font size must be between 10 and 32 pixels');
                return;
            }

            const fontSettings = {
                groupTitle: {
                    family: groupFamily,
                    size: `${groupSizeNum}px`,
                    color: groupColor
                },
                urlItem: {
                    family: urlFamily,
                    size: `${urlSizeNum}px`,
                    color: urlColor
                }
            };

            // Update instance variable so it's preserved in saveData()
            this.fontSettings = fontSettings;

            await StorageManager.saveFontSettings(fontSettings);

            this.closeModal();
            this.showToast('Font settings saved successfully');

        } catch (error) {
            console.error('Error saving font settings:', error);
            this.showToast('Failed to save font settings');
        }
    }

    async resetFontSettings() {
        try {
            await StorageManager.resetFontSettings();

            // Get default settings and update inputs
            const defaultSettings = StorageManager.getDefaultFontSettings();

            // Update instance variable so it's preserved in saveData()
            this.fontSettings = defaultSettings;

            // Update group title inputs
            const groupFamilySelect = document.getElementById('groupTitleFontFamily');
            const groupSizeRange = document.getElementById('groupTitleFontSize');
            const groupSizeNumber = document.getElementById('groupTitleFontSizeNumber');
            const groupColorInput = document.getElementById('groupTitleFontColor');
            const groupColorHex = document.getElementById('groupTitleFontColorHex');

            if (groupFamilySelect) groupFamilySelect.value = defaultSettings.groupTitle.family;
            if (groupSizeRange && groupSizeNumber) {
                const sizeValue = parseInt(defaultSettings.groupTitle.size);
                groupSizeRange.value = sizeValue;
                groupSizeNumber.value = sizeValue;
            }
            if (groupColorInput && groupColorHex) {
                groupColorInput.value = defaultSettings.groupTitle.color;
                groupColorHex.value = defaultSettings.groupTitle.color;
            }

            // Update URL item inputs
            const urlFamilySelect = document.getElementById('urlItemFontFamily');
            const urlSizeRange = document.getElementById('urlItemFontSize');
            const urlSizeNumber = document.getElementById('urlItemFontSizeNumber');
            const urlColorInput = document.getElementById('urlItemFontColor');
            const urlColorHex = document.getElementById('urlItemFontColorHex');

            if (urlFamilySelect) urlFamilySelect.value = defaultSettings.urlItem.family;
            if (urlSizeRange && urlSizeNumber) {
                const sizeValue = parseInt(defaultSettings.urlItem.size);
                urlSizeRange.value = sizeValue;
                urlSizeNumber.value = sizeValue;
            }
            if (urlColorInput && urlColorHex) {
                urlColorInput.value = defaultSettings.urlItem.color;
                urlColorHex.value = defaultSettings.urlItem.color;
            }

            this.showToast('Fonts reset to defaults');

        } catch (error) {
            console.error('Error resetting fonts:', error);
            this.showToast('Failed to reset fonts');
        }
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