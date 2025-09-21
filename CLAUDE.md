# Chrome Extension Requirements Document

## Project Overview
A Chrome extension for bookmark management with local db sync(chrome.storage.sync).

## 1. Functional Requirements

### 1.1 Core Functionality
- **URL Storage**: When user clicks the extension icon, capture and store the current active tab's URL
- **Local Database**: Store URLs locally using Chrome's storage API of chrome.storage.sync
- **Export/Import Database**: Functions to export/import local database as JSON formatted file
- **URL Grouping**: Allow users to organize URLs into custom-named groups
- **Edit Database**: user can edit the database, like deleteing, adding, editing.

### 1.2 URL Management
- **Capture**: 
  - One-click on the icon to capture URL from current tab
  - default catgegory group is "Ungrouped" category.
- **Storage**:
  - Store URL, title, timestamp, and groupId.
  - Data stored in chrome.storage.sync with keys: "urls" and "groups"
  - Default "Ungrouped" group with id: "ungrouped" created automatically
- **Grouping**:
  - Create new groups with custom names (max 50 groups)
  - Assign URLs to existing groups via drag & drop or dropdown
  - Default "Ungrouped" category for unassigned URLs
  - Group deletion: URLs moved to "Ungrouped" when group is deleted
  - Group reordering: Drag & drop to reorder groups in UI
- **Display**: Show saved URLs organized by groups

### 1.3 Data Synchronization
- **Local-First**: Extension works offline with local storage
- **Automatic Sync**: Sync data when internet connection is available by using chrome.storage.sync
- **Conflict Resolution**: 
  - Handle conflicts between synced devices. 
  - if the record's "id" is same and title or metadata is updated, lookup the timestamp and update the record which has newer timestamp.

## 2. Technical Requirements

### 2.1 Chrome Extension Architecture
- **Manifest Version**: 3
- **Extension Type**: Browser Action extension
- **Permissions Required**:
  - `activeTab` - Access current tab information
  - `storage` - Local data storage
  - `host_permissions` - Access to Google Favicon API for favicon fetching

### 2.2 Local Database
- **Storage API**: Chrome Extension Storage API
- **Storage Type**: `chrome.storage.sync`.
- **Data Structure**:
  ```json
  {
    "urls": [
      {
        "id": "unique_id",
        "url": "https://example.com",
        "title": "Page Title",
        "timestamp": "ISO_timestamp",
        "groupId": "group_id"
      }
    ],
    "groups": [
      {
        "id": "group_id",
        "name": "Group Name",
        "created": "ISO_timestamp"
      }
    ]
  }
  ```
- **Storage Limits**:
  - chrome.storage.sync total limit: 100KB
  - Per-item limit: 8KB
- **Default Group**: "Ungrouped" group (id: "ungrouped") automatically created if not exists

## 3. Non-Functional Requirements

### 3.1 Performance
- **Response Time**: < 200ms for URL capture
- **Storage Limits**: Respect Chrome storage quotas
- **Sync Efficiency**: Incremental sync to minimize bandwidth

### 3.2 Security
- **Data Encryption**: All data encrypted in transit
- **Privacy**: No tracking or analytics without user consent

### 3.3 Usability
- **One-Click Save**: Primary action accessible with single click
- **Popup window**:
  - Dimensions: 400px width × 600px height
  - Add URL modal: URL and title input fields with group selection dropdown
  - Edit URL modal: URL, title, and group fields with delete button
  - Loading states: Spinner with descriptive text during operations
- **Open tab with URL**: Opens new tab with selected URL on click
- **Intuitive UI**:
  - Clear visual hierarchy and navigation
  - Modern graphical interface for business use
  - Responsive design for different screen sizes
- **Favicon**:
  - Fetched dynamically when URL is displayed in UI
  - Uses Google Favicon API: `https://www.google.com/s2/favicons?domain={domain}&sz=16`
  - Fallback to default bookmark icon if network request fails
  - No local storage - retrieved fresh on each display
- **Error Handling**:
  - Toast notifications for non-critical errors
  - Modal dialogs for critical errors requiring user action
  - Inline validation messages for form inputs
  - Network error handling with retry options

### 3.4 Reliability
- **Offline Support**: Core functionality available without internet
- **Data Integrity**: Prevent data loss during sync failures
- **Error Recovery**: Automatic retry mechanisms for failed operations

### 3.5 Accessibility
- **Keyboard Navigation**:
  - Tab navigation through all interactive elements
  - Enter/Space to activate buttons and links
  - Escape key to close modals and cancel operations
  - Arrow keys for navigating lists
- **Screen Reader Support**:
  - ARIA labels for all interactive elements
  - ARIA roles for dynamic content regions
  - Live regions for status updates and notifications
  - Descriptive alt text for icons and images
- **Focus Management**:
  - Visible focus indicators on all interactive elements
  - Logical focus order throughout the interface
  - Focus trapping in modal dialogs
  - Return focus to trigger element when modals close
- **Color and Contrast**:
  - WCAG 2.1 AA compliant color contrast ratios
  - No reliance on color alone to convey information
  - High contrast mode support

## 4. User Stories

### 4.1 URL Management
- As a user, I want to save the current page URL with one click
- As a user, I want to open a new tab with selected URL
- As a user, I want to manually add URLs that I'm not currently visiting
- As a user, I want to edit existing URLs to correct mistakes or update information
- As a user, I want to edit the titles of my saved URLs for better organization
- As a user, I want to move URLs between different groups
- As a user, I want to delete URLs I no longer need
- As a user, I want to organize my URLs into custom groups
- As a user, I want to create new groups and name them appropriately
- As a user, I want to view all my saved URLs organized by groups

### 4.2 Group Management
- As a user, I want to delete groups and have URLs moved to "Ungrouped"
- As a user, I want to reorder groups to match my workflow
- As a user, I want to be limited to a reasonable number of groups (50 max)

### 4.3 Import/Export
- As a user, I want to export my bookmarks as a JSON file for backup
- As a user, I want to import bookmarks from a JSON file
- As a user, I want duplicate URLs to be handled intelligently during import

### 4.4 Search and Filtering
- As a user, I want to search through my saved URLs by title or URL
- As a user, I want to filter URLs by group
- As a user, I want to see highlighted matching text in search results

### 4.5 Accessibility
- As a user with mobility impairments, I want to navigate the extension using only a keyboard
- As a user with visual impairments, I want the extension to work with my screen reader
- As a user with low vision, I want high contrast colors and clear focus indicators

### 4.6 Synchronization
- As a user, I want my bookmarks to sync across all my devices automatically
- As a user, I want to access my bookmarks even when offline

## 5. Technical Implementation Details

### 5.1 File Structure
```
/manifest.json
/popup/
  /popup.html
  /popup.js
  /popup.css
/background/
  /background.js
/content/
  /content.js (if needed)
```

### 5.2 Key APIs and Libraries
- Chrome Extension APIs (storage, tabs, runtime)
- HTML5 and modern JavaScript (ES6+)

### 5.3 Data Flow
1. User clicks extension icon
2. Extension captures current tab URL and metadata
3. Data stored locally immediately
4. On other devices, changes are synced with chrome.storage.sync.

### 1.4 Import/Export Functionality
- **Export**: Download all data as JSON file with timestamp in filename
- **Import**:
  - Upload JSON file to import URLs and groups
  - Duplicate detection: Compare URL + title, skip or update based on timestamp
  - Error handling: Invalid JSON format, missing required fields
  - Validation: Ensure imported data matches expected schema
  - Merge strategy: Preserve existing data, add new items, update modified items

### 1.5 Search and Filtering
- **Search Scope**: Search within URL, title, and group names
- **Search UI**: Search box at top of popup with real-time filtering
- **Search Behavior**:
  - Case-insensitive partial matching
  - Highlight matching text in results
  - Clear search button to reset filter
  - No results message when no matches found
- **Filtering**: Filter by group using dropdown or tabs

## 6. Future Enhancements (Optional)
- Advanced search with regex support
- Bulk operations for multiple URLs
- URL categorization by domain
- Tag-based organization system
