# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FavURL is a Chrome Manifest V3 extension for bookmark management with local sync via `chrome.storage.sync`. It features URL grouping, drag-and-drop organization, import/export, and a customizable start page.

## Architecture

### Core Components

**Storage Layer** ([utils/storageManager.js](utils/storageManager.js))
- Centralized storage operations for all chrome.storage.sync interactions
- **Chunked Storage Structure**: Uses 32 separate keys (`url000`-`url399`) to store up to 400 URLs, and 32 keys (`group00`-`group31`) for up to 32 groups
- Handles automatic migration from legacy single-key format to chunked format
- Key functions: `loadDataFromStorage()`, `saveDataToStorage()`, `loadColorTheme()`, `saveFontSettings()`
- Storage limits: 100KB total, 8KB per item

**Data Models**
- [URLDataModel](models/URLDataModel.js): Manages URL data with validation, domain extraction, and favicon generation
- [GroupDataModel](models/GroupDataModel.js): Manages group data with validation and ordering
- Both models provide `toJSON()` for serialization and `fromJSON()` for deserialization

**Main UI Components**
- [popup/popup.js](popup/popup.js): Extension popup (400x600px) - BookmarkManager class handles all UI interactions, URL management, import/export, and settings
- [startpage/startpage.js](startpage/startpage.js): New tab override page - StartPageApp class renders bookmarks with collapsible groups
- Both share utility functions from [utils/shared.js](utils/shared.js)

### Data Flow

1. **URL Capture**: User clicks extension → `captureCurrentTab()` in BookmarkManager → saves via StorageManager
2. **Data Persistence**: BookmarkManager maintains in-memory state (`this.urls`, `this.groups`) → `saveData()` writes to storage via StorageManager → automatic sync across devices
3. **Start Page**: StartPageApp loads data via StorageManager → renders using templates → listens for storage changes

### Storage Schema

**Metadata Keys** (stored directly in chrome.storage.sync):
- `groupCount`, `urlCount`: Track item counts
- `dataModelVersion`: Schema version for migrations
- `startPageEnabled`, `openInNewTab`: User preferences
- `colorTheme`: Background colors for page, group headers, URL items
- `fontSettings`: Font family, size, color for group titles and URL items

**Chunked Storage**:
- `url000`-`url399`: Individual URL objects (max 400)
- `group00`-`group31`: Individual group objects (max 32)
- `group00` is always the "Ungrouped" group (id: "ungrouped")

### Critical State Management

**BookmarkManager Class** ([popup/popup.js](popup/popup.js))
- IMPORTANT: Always include `colorTheme` and `fontSettings` in `saveData()` metadata to prevent reset to defaults
- Pattern:
  ```javascript
  const metadata = {
      version: '1.0',
      dataModelVersion: this.dataModelVersion,
      startPageEnabled: this.startPageEnabled,
      openInNewTab: this.openInNewTab,
      colorTheme: this.colorTheme,        // Must include
      fontSettings: this.fontSettings     // Must include
  };
  ```

**Group Management**:
- Default "Ungrouped" group (id: "ungrouped") is protected and cannot be deleted
- When a group is deleted, all its URLs are moved to "Ungrouped"
- Groups are reorderable via drag-and-drop, tracked by `order` property

**URL Management**:
- URLs stored with `order` property for custom sorting
- Favicons use Chrome's Manifest V3 API: `chrome-extension://[ID]/_favicon/?pageUrl={url}&size=16`
- Favicon fallback: Direct fetch from `/favicon.ico`, then default SVG icon

### Import/Export

**Export** ([popup/popup.js](popup/popup.js) - `exportData()`):
- Reads all chunked storage keys
- Consolidates into single JSON with metadata
- Filename format: `favurl-backup-YYYY-MM-DDTHH-MM-SS.json`

**Import** ([popup/popup.js](popup/popup.js) - `handleImportFile()`):
- Validates JSON structure via `validateImportData()`
- Shows confirmation modal with merge/replace options
- Duplicate detection: Compares URL + title, uses timestamp for conflict resolution

### Customization Features

**Color Theme** (accessible via popup menu → "Color..."):
- Stored in `colorTheme` object with `pageBackground`, `groupHeaderBackground`, `urlItemBackground`
- Applied via CSS custom properties: `--page-bg`, `--group-header-bg`, `--url-item-bg`
- Changes auto-sync and reload start page

**Font Settings** (accessible via popup menu → "Font..."):
- Stored in `fontSettings` object with `groupTitle` and `urlItem` sub-objects
- Each has `family`, `size`, `color` properties
- Applied via CSS custom properties on start page only
- 9 font families available, size range 10-32px

### Drag & Drop

**Implementation** ([utils/dragDrop.js](utils/dragDrop.js)):
- DragDropManager handles both URL reordering and group assignment
- Context-aware: Detects 'popup' vs 'startpage' context
- Visual feedback: Drop zones, drag handles, hover states
- Persistence: Updates order properties and saves via StorageManager

## Development Commands

### Building for Chrome Web Store

Update version in [manifest.json](manifest.json), then:

```bash
zip -r favurl-extension.zip . -x "favurl-extension.zip" "*.git*" "node_modules/*" "*.DS_Store" "CLAUDE.md" "debug.md" "todo.md" "how_to_submit_chrome_web_store.txt" ".gitignore" "test-*" "test_*"
```

### Local Testing

1. Load unpacked extension:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the project directory

2. Test import scenarios using [test-import-scenarios.md](test-import-scenarios.md)

## Key Patterns & Conventions

**Modal Management** ([popup/popup.js](popup/popup.js)):
- Use template cloning: `template.content.cloneNode(true)`
- Pattern: `openModal(title, bodyTemplate, footerTemplate)` → setup listeners → `closeModal()`
- Setup listeners in `setTimeout()` after modal opens to ensure DOM is ready

**Storage Operations**:
- Always use StorageManager methods, never direct chrome.storage.sync calls
- Load: `const data = await StorageManager.loadDataFromStorage()` → access `data.metadata`, `data.groups`, `data.urls`
- Save: `await StorageManager.saveDataToStorage(groups, urls, metadata)`

**Error Handling**:
- Toast notifications: `this.showToast(message)` for non-critical feedback
- Error dialogs: `this.showError(message)` for critical errors
- Validation: Data models provide `validate()` method

**Accessibility**:
- All interactive elements have ARIA labels
- Modals use focus trapping
- Keyboard navigation: Tab, Enter/Space, Escape, Arrow keys
- Screen reader support via ARIA roles and live regions

## Important Files

- [manifest.json](manifest.json): Extension manifest, version must be updated for releases
- [utils/storageManager.js](utils/storageManager.js): All storage operations, add new storage keys here
- [popup/popup.js](popup/popup.js): Main extension logic, ~3800 lines
- [startpage/startpage.js](startpage/startpage.js): Start page logic, renders bookmarks
- [models/](models/): Data validation and structure

## Extension Permissions

- `activeTab`: Capture current tab URL
- `storage`: chrome.storage.sync for bookmark data
- `favicon`: Chrome's internal favicon API

## Chrome Web Store Deployment

See [how_to_submit_chrome_web_store.txt](how_to_submit_chrome_web_store.txt) for detailed submission instructions (in Japanese).

Key requirements:
- Version update in manifest.json
- Privacy policy (no data collection, local storage only)
- Screenshots: 1280x800px or 640x400px (1-5 images)
- Review time: 1-7 business days
