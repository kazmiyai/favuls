// Chrome Extension Start Page JavaScript
// Loads and displays bookmarks from chrome.storage.sync

// Start Page Application Class
class StartPageApp {
    constructor() {
        this.urls = [];
        this.groups = [];
        this.filteredData = { urls: [], groups: [] };
        this.searchTerm = '';
        this.collapsedGroups = new Set();
        this.startPageEnabled = true; // Default to enabled
        this.openInNewTab = true; // Default to opening in new tab
        this.colorTheme = null; // Will be loaded from storage
        this.fontSettings = null; // Will be loaded from storage

        // Initialize drag & drop manager
        this.dragDropManager = new DragDropManager('startpage');

        this.elements = {
            groupsGrid: document.getElementById('groupsGrid'),
            emptyState: document.getElementById('emptyState'),
            loadingState: document.getElementById('loadingState'),
            searchInput: document.getElementById('searchInput'),
            searchClear: document.getElementById('searchClear'),
            groupCardTemplate: document.getElementById('groupCardTemplate'),
            bookmarkTemplate: document.getElementById('bookmarkTemplate')
        };

        this.init();
    }

    async init() {
        try {
            // First check if start page is enabled
            await this.checkStartPageToggle();

            // If disabled, show blank page and return early
            if (!this.startPageEnabled) {
                this.showBlankPage();
                return;
            }

            // Load collapsed groups state from localStorage
            const collapsedData = localStorage.getItem('favurl-collapsed-groups');
            if (collapsedData) {
                this.collapsedGroups = new Set(JSON.parse(collapsedData));
            }

            // Load and apply color theme
            await this.loadAndApplyColorTheme();

            // Load and apply font settings
            await this.loadAndApplyFontSettings();

            // Set up event listeners
            this.setupEventListeners();

            // Load data from chrome.storage.sync
            await this.loadData();

            // Render the page
            this.render();

            // Display version
            this.displayVersion();
        } catch (error) {
            console.error('Failed to initialize start page:', error);
            this.showError('Failed to load bookmarks. Please try refreshing the page.');
        }
    }

    async checkStartPageToggle() {
        try {
            // Load the start page toggle state from chrome.storage.sync
            const result = await chrome.storage.sync.get(['startPageEnabled', 'openInNewTab']);
            this.startPageEnabled = result.startPageEnabled !== undefined ? result.startPageEnabled : true;
            this.openInNewTab = result.openInNewTab !== undefined ? result.openInNewTab : true;
            console.log('Start page enabled:', this.startPageEnabled);
        } catch (error) {
            console.error('Error loading start page toggle state:', error);
            // Default to enabled if we can't load the setting
            this.startPageEnabled = true;
        }
    }

    showBlankPage() {
        // Hide all content and show minimal blank page
        this.elements.loadingState.style.display = 'none';
        this.elements.groupsGrid.style.display = 'none';
        this.elements.emptyState.style.display = 'none';

        // Hide search section
        const searchSection = document.querySelector('.search-section');
        if (searchSection) {
            searchSection.style.display = 'none';
        }

        // Set document title
        document.title = 'New Tab';

        // Change background to a clean white
        document.body.style.background = 'white';
        document.body.style.color = '#333';

        console.log('Start page disabled - showing blank page');
    }

    setupEventListeners() {
        // Search functionality
        this.elements.searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        this.elements.searchClear.addEventListener('click', () => {
            this.elements.searchInput.value = '';
            this.handleSearch('');
        });

        // Show/hide clear button based on input
        this.elements.searchInput.addEventListener('input', (e) => {
            if (e.target.value.trim()) {
                this.elements.searchClear.classList.add('visible');
            } else {
                this.elements.searchClear.classList.remove('visible');
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.elements.searchInput.value = '';
                this.handleSearch('');
                this.elements.searchInput.blur();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.elements.searchInput.focus();
            }
        });
    }

    async loadData() {
        try {
            // Use StorageManager to load data
            const data = await StorageManager.loadDataFromStorage();

            // Process URLs - convert to model instances
            this.urls = data.urls.map(urlData => URLDataModel.fromJSON(urlData));

            // Ensure URLs have order values
            this.urls.forEach((url, index) => {
                if (url.order === undefined || url.order === null) {
                    url.order = index + 1;
                }
            });

            // Process groups - convert to model instances
            let groups = data.groups;

            // Ensure default "Ungrouped" exists
            let ungroupedExists = groups.some(group => group.id === 'ungrouped');

            if (!ungroupedExists) {
                groups.unshift({
                    id: 'ungrouped',
                    name: 'Ungrouped',
                    created: new Date().toISOString(),
                    lastModified: new Date().toISOString(),
                    isDefault: true,
                    protected: true,
                    color: '#666666',
                    description: 'Default group for uncategorized bookmarks',
                    urlCount: 0,
                    order: 0
                });
            }

            this.groups = groups.map(groupData => GroupDataModel.fromJSON(groupData));

            // Update group URL counts using DataValidator
            DataValidator.updateGroupUrlCounts(this.groups, this.urls);

            // Ensure groups have order values
            this.groups.forEach((group, index) => {
                if (group.order === undefined || group.order === null) {
                    group.order = index;
                }
            });

            // Sort groups by order, then by name
            this.groups.sort((a, b) => {
                if (a.order !== b.order) {
                    return a.order - b.order;
                }
                return a.name.localeCompare(b.name);
            });

            // Filter data initially (no search term)
            this.filterData('');

            console.log(`Start page loaded ${this.groups.length} groups and ${this.urls.length} URLs using StorageManager`);
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    // Moved to DataValidator utility - updateGroupUrlCounts()

    handleSearch(searchTerm) {
        this.searchTerm = searchTerm.toLowerCase().trim();
        this.filterData(this.searchTerm);
        this.render();
    }

    filterData(searchTerm) {
        if (!searchTerm) {
            // No search term - show all data
            this.filteredData.groups = [...this.groups];
            this.filteredData.urls = this.urls;
            return;
        }

        // Filter URLs by search term
        const filteredUrls = this.urls.filter(url =>
            url.title.toLowerCase().includes(searchTerm) ||
            url.url.toLowerCase().includes(searchTerm) ||
            url.domain.toLowerCase().includes(searchTerm)
        );

        // Filter groups that have matching URLs or matching group names
        const groupsWithMatchingUrls = new Set(filteredUrls.map(url => url.groupId));
        const filteredGroups = this.groups.filter(group =>
            groupsWithMatchingUrls.has(group.id) ||
            group.name.toLowerCase().includes(searchTerm)
        );

        this.filteredData.groups = filteredGroups;
        this.filteredData.urls = filteredUrls;
    }

    render() {
        // Hide loading state
        this.elements.loadingState.style.display = 'none';

        // Check if we have any data to show
        if (this.filteredData.groups.length === 0) {
            this.showEmptyState();
            return;
        }

        // Hide empty state and show content
        this.elements.emptyState.style.display = 'none';
        this.elements.groupsGrid.style.display = 'grid';

        // Clear existing content
        this.elements.groupsGrid.innerHTML = '';

        // Render each group
        this.filteredData.groups.forEach(group => {
            const groupUrls = this.filteredData.urls.filter(url => url.groupId === group.id)
                .sort((a, b) => (a.order || 0) - (b.order || 0));
            this.renderGroup(group, groupUrls);
        });
    }

    renderGroup(group, urls) {
        const template = this.elements.groupCardTemplate.content.cloneNode(true);
        const groupCard = template.querySelector('.group-card');
        const groupHeader = template.querySelector('.group-header');
        const groupTitle = template.querySelector('.group-title');
        const groupCount = template.querySelector('.group-count');
        const bookmarksList = template.querySelector('.bookmarks-list');
        const collapseToggle = template.querySelector('.collapse-toggle');
        const dragHandle = template.querySelector('.group-drag-handle');

        // Set group data
        groupCard.setAttribute('data-group-id', group.id);
        groupHeader.setAttribute('data-group-id', group.id);
        groupTitle.textContent = group.name;
        groupCount.textContent = urls.length;

        // Check if group is collapsed
        const isCollapsed = this.collapsedGroups.has(group.id);
        if (isCollapsed) {
            groupCard.classList.add('collapsed');
        }

        // Configure drag & drop for groups (only if not protected)
        const isDraggable = !group.protected && group.id !== 'ungrouped';
        if (isDraggable) {
            groupHeader.classList.add('draggable');

            // Group drag events
            groupHeader.addEventListener('dragstart', (e) => {
                this.dragDropManager.handleGroupDragStart(e, group);
            });

            groupHeader.addEventListener('dragend', (e) => {
                this.dragDropManager.handleGroupDragEnd(e);
            });
        } else {
            // Remove drag handle for protected groups
            if (dragHandle) {
                dragHandle.remove();
            }
            groupHeader.removeAttribute('draggable');
        }

        // Unified drag and drop support (handles both group reordering and URL-to-group assignment)
        groupHeader.addEventListener('dragover', (e) => {
            this.dragDropManager.handleUnifiedDragOver(e, group.id);
        });

        groupHeader.addEventListener('drop', (e) => {
            this.dragDropManager.handleUnifiedDrop(e, group.id, this);
        });

        groupHeader.addEventListener('dragenter', (e) => {
            this.dragDropManager.handleUnifiedDragEnter(e, group.id);
        });

        groupHeader.addEventListener('dragleave', (e) => {
            this.dragDropManager.handleUnifiedDragLeave(e);
        });

        // Set up collapse toggle
        collapseToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleGroupCollapse(group.id);
        });

        // Make header clickable for collapse/expand (but not if clicking on drag handle)
        groupHeader.addEventListener('click', (e) => {
            // Don't trigger expand/collapse if clicking on drag handle
            if (e.target.closest('.group-drag-handle')) {
                e.preventDefault();
                return;
            }
            this.toggleGroupCollapse(group.id);
        });

        // Prevent drag handle clicks from triggering other events
        if (dragHandle) {
            dragHandle.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Render bookmarks
        urls.forEach(url => {
            this.renderBookmark(url, bookmarksList);
        });

        this.elements.groupsGrid.appendChild(template);
    }

    renderBookmark(url, container) {
        const template = this.elements.bookmarkTemplate.content.cloneNode(true);
        const bookmarkItem = template.querySelector('.bookmark-item');
        const bookmarkFavicon = template.querySelector('.bookmark-favicon');
        const bookmarkLink = template.querySelector('.bookmark-link');
        const bookmarkTitle = template.querySelector('.bookmark-title');
        const dragHandle = template.querySelector('.bookmark-drag-handle');

        // Set bookmark data
        bookmarkItem.setAttribute('data-url', url.url);
        bookmarkItem.setAttribute('data-url-id', url.id);
        bookmarkItem.setAttribute('data-group-id', url.groupId);
        bookmarkLink.setAttribute('href', url.url);
        bookmarkTitle.textContent = url.title;

        // Set target based on toggle setting
        if (this.openInNewTab) {
            bookmarkLink.setAttribute('target', '_blank');
            bookmarkLink.setAttribute('rel', 'noopener noreferrer');
        } else {
            bookmarkLink.removeAttribute('target');
            bookmarkLink.removeAttribute('rel');
        }

        // Set favicon
        bookmarkFavicon.src = url.favicon;
        bookmarkFavicon.alt = `${url.title} favicon`;

        // Handle favicon load errors
        bookmarkFavicon.addEventListener('error', () => {
            bookmarkFavicon.classList.add('error');
            bookmarkFavicon.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjRjVGNUY1IiByeD0iMiIvPgo8cGF0aCBkPSJNNCA2SDE0VjEwSDRWNloiIGZpbGw9IiNEREREREQiLz4KPHBhdGggZD0iTTYgOEgxMlY5SDZWOFoiIGZpbGw9IiNCQkJCQkIiLz4KPC9zdmc+';
        });

        // Asynchronously fetch and update with direct favicon from website
        FavURLUtils.updateFaviconAsync(bookmarkFavicon, url.url);

        // Add drag-and-drop event listeners for bookmark reordering and group assignment
        bookmarkItem.addEventListener('dragstart', (e) => {
            this.dragDropManager.handleURLDragStart(e, url);
        });

        bookmarkItem.addEventListener('dragend', (e) => {
            this.dragDropManager.handleURLDragEnd(e);
        });

        // Add URL-to-URL reordering support
        bookmarkItem.addEventListener('dragover', (e) => {
            this.dragDropManager.handleURLReorderDragOver(e, url);
        });

        bookmarkItem.addEventListener('drop', (e) => {
            this.dragDropManager.handleURLReorderDrop(e, url, this);
        });

        bookmarkItem.addEventListener('dragenter', (e) => {
            this.dragDropManager.handleURLReorderDragEnter(e, url);
        });

        bookmarkItem.addEventListener('dragleave', (e) => {
            this.dragDropManager.handleURLReorderDragLeave(e);
        });

        // Prevent drag handle clicks from opening URL
        if (dragHandle) {
            dragHandle.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
            });
        }

        // Highlight search terms
        if (this.searchTerm) {
            this.highlightSearchTerm(bookmarkTitle, url.title, this.searchTerm);
        }

        container.appendChild(template);
    }

    highlightSearchTerm(element, text, searchTerm) {
        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const highlightedText = text.replace(regex, '<span class="search-highlight">$1</span>');
        element.innerHTML = highlightedText;
    }

    toggleGroupCollapse(groupId) {
        const groupCard = document.querySelector(`[data-group-id="${groupId}"]`);
        if (!groupCard) return;

        if (this.collapsedGroups.has(groupId)) {
            this.collapsedGroups.delete(groupId);
            groupCard.classList.remove('collapsed');
        } else {
            this.collapsedGroups.add(groupId);
            groupCard.classList.add('collapsed');
        }

        // Save collapsed state to localStorage
        localStorage.setItem('favurl-collapsed-groups', JSON.stringify([...this.collapsedGroups]));
    }

    showEmptyState() {
        this.elements.groupsGrid.style.display = 'none';
        this.elements.emptyState.style.display = 'block';

        const emptyContent = this.elements.emptyState.querySelector('.empty-content');
        if (this.searchTerm) {
            emptyContent.innerHTML = `
                <h2>No Results Found</h2>
                <p>No bookmarks found matching "${this.searchTerm}". Try a different search term.</p>
            `;
        } else if (this.urls.length === 0) {
            emptyContent.innerHTML = `
                <h2>No Bookmarks Found</h2>
                <p>Start saving bookmarks using the FavURL extension to see them here.</p>
            `;
        }
    }

    showError(message) {
        this.elements.loadingState.style.display = 'none';
        this.elements.groupsGrid.style.display = 'none';
        this.elements.emptyState.style.display = 'block';

        const emptyContent = this.elements.emptyState.querySelector('.empty-content');
        emptyContent.innerHTML = `
            <h2>Error</h2>
            <p>${message}</p>
        `;
    }

    // Data persistence method for drag & drop operations
    async saveData() {
        try {
            console.log('Saving data from start page...');

            // Prepare metadata (preserve existing settings to prevent reset)
            const metadata = {
                version: '1.0',
                dataModelVersion: '1.0',
                startPageEnabled: this.startPageEnabled,
                openInNewTab: this.openInNewTab,
                colorTheme: this.colorTheme,
                fontSettings: this.fontSettings
            };

            // Use StorageManager to save data
            await StorageManager.saveDataToStorage(this.groups, this.urls, metadata);

            console.log('Data saved successfully from start page using StorageManager');
        } catch (error) {
            console.error('Error saving data from start page:', error);
            if (error.message && (error.message.includes('quota') || error.message.includes('Storage limit'))) {
                console.error('Chrome storage quota exceeded - data too large');
            } else if (error.message && error.message.includes('MAX_WRITE_OPERATIONS_PER_MINUTE')) {
                console.error('Chrome storage write quota exceeded - too many operations');
            }
            throw error;
        }
    }

    // Color Theme Functions
    async loadAndApplyColorTheme() {
        try {
            this.colorTheme = await StorageManager.loadColorTheme();
            this.applyColorTheme(this.colorTheme);
        } catch (error) {
            console.error('Error loading color theme:', error);
        }
    }

    applyColorTheme(colorTheme) {
        // Apply colors to startpage using CSS custom properties
        document.documentElement.style.setProperty('--page-bg', colorTheme.pageBackground);
        document.documentElement.style.setProperty('--group-header-bg', colorTheme.groupHeaderBackground);
        document.documentElement.style.setProperty('--url-item-bg', colorTheme.urlItemBackground);
    }

    // Font Settings Functions
    async loadAndApplyFontSettings() {
        try {
            this.fontSettings = await StorageManager.loadFontSettings();
            this.applyFontSettings(this.fontSettings);
        } catch (error) {
            console.error('Error loading font settings:', error);
        }
    }

    applyFontSettings(fontSettings) {
        // Apply font settings to startpage using CSS custom properties
        document.documentElement.style.setProperty('--group-title-font-family', fontSettings.groupTitle.family);
        document.documentElement.style.setProperty('--group-title-font-size', fontSettings.groupTitle.size);
        document.documentElement.style.setProperty('--group-title-font-color', fontSettings.groupTitle.color);
        document.documentElement.style.setProperty('--url-item-font-family', fontSettings.urlItem.family);
        document.documentElement.style.setProperty('--url-item-font-size', fontSettings.urlItem.size);
        document.documentElement.style.setProperty('--url-item-font-color', fontSettings.urlItem.color);
    }

    // Display version number from manifest
    displayVersion() {
        try {
            const manifest = chrome.runtime.getManifest();
            const versionElement = document.getElementById('startpageVersion');
            if (versionElement && manifest.version) {
                versionElement.textContent = `v${manifest.version}`;
            }
        } catch (error) {
            console.error('Error displaying version:', error);
        }
    }
}

// Initialize the start page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're in a Chrome extension context
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        new StartPageApp();
    } else {
        console.error('Chrome extension APIs not available');
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        document.querySelector('.empty-content').innerHTML = `
            <h2>Extension Context Required</h2>
            <p>This start page must be loaded as a Chrome extension to access your bookmarks.</p>
        `;
    }
});

// Listen for storage changes and update the display
if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
            // If start page toggle or open new tab toggle changed, reload the page immediately
            if (changes.startPageEnabled || changes.openInNewTab) {
                window.location.reload();
                return;
            }

            // If color theme changed, reload the page to apply new colors
            if (changes.colorTheme) {
                window.location.reload();
                return;
            }

            // If font settings changed, reload the page to apply new fonts
            if (changes.fontSettings) {
                window.location.reload();
                return;
            }

            // Check for changes in chunked storage or legacy storage
            let hasDataChanges = false;

            // Check for legacy format changes
            if (changes.urls || changes.groups) {
                hasDataChanges = true;
            }

            // Check for chunked format changes
            if (changes.urlCount || changes.groupCount) {
                hasDataChanges = true;
            }

            // Check for any url### or group## key changes
            for (const key in changes) {
                if (key.startsWith('url') && /^url\d{3}$/.test(key)) {
                    hasDataChanges = true;
                    break;
                }
                if (key.startsWith('group') && /^group\d{2}$/.test(key)) {
                    hasDataChanges = true;
                    break;
                }
            }

            // If any data changed, reload the page
            if (hasDataChanges) {
                window.location.reload();
            }
        }
    });
}