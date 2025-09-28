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

            // Set up event listeners
            this.setupEventListeners();

            // Load data from chrome.storage.sync
            await this.loadData();

            // Render the page
            this.render();
        } catch (error) {
            console.error('Failed to initialize start page:', error);
            this.showError('Failed to load bookmarks. Please try refreshing the page.');
        }
    }

    async checkStartPageToggle() {
        try {
            // Load the start page toggle state from chrome.storage.sync
            const result = await chrome.storage.sync.get(['startPageEnabled']);
            this.startPageEnabled = result.startPageEnabled !== undefined ? result.startPageEnabled : true;
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
            // Prepare keys for chunked storage
            const keys = ['groupCount', 'urlCount', 'dataModelVersion', 'startPageEnabled', 'urls', 'groups'];

            // Add all possible group keys (group00-group31)
            for (let i = 0; i < 32; i++) {
                keys.push(`group${i.toString().padStart(2, '0')}`);
            }

            // Add all possible URL keys (url000-url399)
            for (let i = 0; i < 400; i++) {
                keys.push(`url${i.toString().padStart(3, '0')}`);
            }

            const result = await chrome.storage.sync.get(keys);

            // Initialize arrays
            let groups = [];
            let urlsData = [];

            // Load groups from chunked storage or legacy format
            if (result.groupCount || result.group00) {
                // New chunked format
                const groupCount = result.groupCount || 1; // At least 1 for ungrouped
                for (let i = 0; i < groupCount && i < 32; i++) {
                    const key = `group${i.toString().padStart(2, '0')}`;
                    if (result[key]) {
                        groups.push(result[key]);
                    }
                }
                console.log(`Loaded ${groups.length} groups from chunked storage in start page`);
            } else if (result.groups) {
                // Legacy format
                groups = result.groups;
                console.log('Loading groups from legacy storage in start page...');
            }

            // Load URLs from chunked storage or legacy format
            if (result.urlCount || result.url000) {
                // New chunked format
                const urlCount = result.urlCount || 0;
                for (let i = 0; i < urlCount && i < 400; i++) {
                    const key = `url${i.toString().padStart(3, '0')}`;
                    if (result[key]) {
                        urlsData.push(result[key]);
                    }
                }
                console.log(`Loaded ${urlsData.length} URLs from chunked storage in start page`);
            } else if (result.urls) {
                // Legacy format
                urlsData = result.urls;
                console.log('Loading URLs from legacy storage in start page...');
            }

            // Process URLs
            this.urls = urlsData.map(urlData => URLDataModel.fromJSON(urlData));

            // Process groups and ensure default "Ungrouped" exists
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

            // Update group URL counts
            this.updateGroupCounts();

            // Sort groups by order, then by name
            this.groups.sort((a, b) => {
                if (a.order !== b.order) {
                    return a.order - b.order;
                }
                return a.name.localeCompare(b.name);
            });

            // Filter data initially (no search term)
            this.filterData('');

        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    updateGroupCounts() {
        // Reset counts
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

    handleSearch(searchTerm) {
        this.searchTerm = searchTerm.toLowerCase().trim();
        this.filterData(this.searchTerm);
        this.render();
    }

    filterData(searchTerm) {
        if (!searchTerm) {
            // No search term - show all data
            this.filteredData.groups = this.groups.filter(group => group.urlCount > 0);
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
            if (groupUrls.length > 0) {
                this.renderGroup(group, groupUrls);
            }
        });
    }

    renderGroup(group, urls) {
        const template = this.elements.groupCardTemplate.content.cloneNode(true);
        const groupCard = template.querySelector('.group-card');
        const groupTitle = template.querySelector('.group-title');
        const groupCount = template.querySelector('.group-count');
        const bookmarksList = template.querySelector('.bookmarks-list');
        const collapseToggle = template.querySelector('.collapse-toggle');

        // Set group data
        groupCard.setAttribute('data-group-id', group.id);
        groupTitle.textContent = group.name;
        groupCount.textContent = urls.length;

        // Check if group is collapsed
        const isCollapsed = this.collapsedGroups.has(group.id);
        if (isCollapsed) {
            groupCard.classList.add('collapsed');
        }

        // Set up collapse toggle
        collapseToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleGroupCollapse(group.id);
        });

        // Make entire header clickable for collapse/expand
        const groupHeader = template.querySelector('.group-header');
        groupHeader.addEventListener('click', () => {
            this.toggleGroupCollapse(group.id);
        });

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

        // Set bookmark data
        bookmarkItem.setAttribute('data-url', url.url);
        bookmarkLink.setAttribute('href', url.url);
        bookmarkTitle.textContent = url.title;

        // Set favicon
        bookmarkFavicon.src = url.favicon;
        bookmarkFavicon.alt = `${url.title} favicon`;

        // Handle favicon load errors
        bookmarkFavicon.addEventListener('error', () => {
            bookmarkFavicon.classList.add('error');
            bookmarkFavicon.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjRjVGNUY1IiByeD0iMiIvPgo8cGF0aCBkPSJNNCA2SDE0VjEwSDRWNloiIGZpbGw9IiNEREREREQiLz4KPHBhdGggZD0iTTYgOEgxMlY5SDZWOFoiIGZpbGw9IiNCQkJCQkIiLz4KPC9zdmc+';
        });

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
            // If start page toggle changed, reload the page immediately
            if (changes.startPageEnabled) {
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