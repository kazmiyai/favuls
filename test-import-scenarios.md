# Import Test Scenarios

## Scenario 1: Replace Mode Test

### Current Application Data:
- Groups: "001", "002", "Ungrouped"
- URLs: "受信トレイ" in group "001", "Google" in group "002", "GitHub" in group "001"

### Import File Data:
- Groups: "001", "002", "Ungrouped"
- URLs: "Google" in group "002", "GitHub" in group "001"
- Missing: "受信トレイ" (should be deleted)

### Expected Result with Replace Mode:
- Groups: "001", "002", "Ungrouped"
- URLs: Only "Google" and "GitHub" remain
- "受信トレイ" is deleted because it's not in the import file

### Expected Result with Merge Mode:
- Groups: "001", "002", "Ungrouped"
- URLs: "受信トレイ", "Google", "GitHub" all remain
- "受信トレイ" is preserved because merge mode doesn't delete existing items

## Test JSON File Example:

```json
{
  "metadata": {
    "version": "1.0",
    "exportDate": "2025-09-22T23:09:53.449Z",
    "source": "FavURL Extension",
    "totalGroups": 3,
    "totalUrls": 2
  },
  "groups": [
    {
      "color": "#2196f3",
      "created": "2025-09-22T20:23:10.066Z",
      "description": "",
      "id": "ungrouped",
      "isDefault": true,
      "lastModified": "2025-09-22T20:23:27.972Z",
      "name": "Ungrouped",
      "order": 0,
      "protected": true,
      "urlCount": 0
    },
    {
      "color": "#2196f3",
      "created": "2025-09-22T20:23:47.792Z",
      "description": "",
      "id": "group_mfvkqjww_kscicgjw2",
      "isDefault": false,
      "lastModified": "2025-09-22T20:37:38.788Z",
      "name": "001",
      "order": 1,
      "protected": false,
      "urlCount": 1
    },
    {
      "color": "#2196f3",
      "created": "2025-09-22T20:23:51.747Z",
      "description": "",
      "id": "group_mfvkqmyr_8r6gbw1oi",
      "isDefault": false,
      "lastModified": "2025-09-22T20:24:25.259Z",
      "name": "002",
      "order": 2,
      "protected": false,
      "urlCount": 1
    }
  ],
  "urls": [
    {
      "created": "2025-09-22T20:23:41.243Z",
      "domain": "www.google.com",
      "favicon": "https://www.google.com/s2/favicons?domain=www.google.com&sz=16",
      "groupId": "group_mfvkqmyr_8r6gbw1oi",
      "id": "url_mfvkqeuz_ku9aabso7",
      "lastModified": "2025-09-22T20:37:22.855Z",
      "order": 1,
      "tags": [],
      "timestamp": "2025-09-22T20:23:41.243Z",
      "title": "Google",
      "url": "https://www.google.com/"
    },
    {
      "created": "2025-09-22T20:23:30.311Z",
      "domain": "github.com",
      "favicon": "https://www.google.com/s2/favicons?domain=github.com&sz=16",
      "groupId": "group_mfvkqjww_kscicgjw2",
      "id": "url_mfvkq6fb_1rn4b8xqk",
      "lastModified": "2025-09-22T20:37:45.937Z",
      "order": 2,
      "tags": [],
      "timestamp": "2025-09-22T20:23:30.311Z",
      "title": "GitHub · Build and ship software on a single, collaborative platform · GitHub",
      "url": "https://github.com/"
    }
  ]
}
```

## How to Test:

1. **Load Extension**: Load the extension in Chrome and add some test data including "受信トレイ"
2. **Export Data**: Use the export function to create a backup
3. **Modify Export**: Remove one or more URLs from the exported JSON file
4. **Test Replace Mode**: Import the modified file using "Replace All Data" - missing URLs should be deleted
5. **Test Merge Mode**: Import the same file using "Merge Data" - existing URLs should be preserved

## Key Differences:

**Replace Mode (`processReplaceImport`)**:
- Completely overwrites chrome.storage.sync with import data
- Deletes any existing items not present in import file
- Provides exact replication of the import file state

**Merge Mode (`processImport` with merge logic)**:
- Preserves all existing data
- Adds new items from import file
- Updates existing items only if import has newer timestamps
- Never deletes existing items