// Data Validator - Centralized data validation and integrity checking
// Validates URLs and groups, fixes data integrity issues

/**
 * Updates URL counts for all groups
 * @param {Array} groups - Array of group objects
 * @param {Array} urls - Array of URL objects
 */
function updateGroupUrlCounts(groups, urls) {
    // Reset all counts
    groups.forEach(group => {
        group.urlCount = 0;
    });

    // Count URLs in each group
    urls.forEach(url => {
        const group = groups.find(g => g.id === url.groupId);
        if (group) {
            group.urlCount++;
        }
    });
}

/**
 * Validates and fixes URL data integrity
 * @param {Array} urls - Array of URL objects (will be modified in place)
 * @param {Array} groups - Array of group objects
 * @param {string} defaultGroupId - Default group ID for orphaned URLs
 * @returns {number} Number of URLs fixed
 */
function validateAndFixURLs(urls, groups, defaultGroupId = 'ungrouped') {
    let fixedCount = 0;

    urls.forEach((url, index) => {
        // Convert plain objects to URLDataModel instances if needed
        if (typeof URLDataModel !== 'undefined' && !(url instanceof URLDataModel)) {
            urls[index] = URLDataModel.fromJSON(url);
            fixedCount++;
        }

        // Check if URL has a valid group assignment
        if (!url.groupId || !groups.find(g => g.id === url.groupId)) {
            url.groupId = defaultGroupId;
            url.lastModified = new Date().toISOString();
            fixedCount++;
        }

        // Validate URL data integrity if validation method exists
        if (typeof url.validate === 'function') {
            const validation = url.validate();
            if (!validation.isValid) {
                console.warn(`URL validation failed for ${url.id}:`, validation.errors);
            }
        }
    });

    return fixedCount;
}

/**
 * Validates and fixes group data integrity
 * @param {Array} groups - Array of group objects (will be modified in place)
 * @returns {number} Number of groups fixed
 */
function validateAndFixGroups(groups) {
    let fixedCount = 0;

    groups.forEach((group, index) => {
        // Convert plain objects to GroupDataModel instances if needed
        if (typeof GroupDataModel !== 'undefined' && !(group instanceof GroupDataModel)) {
            groups[index] = GroupDataModel.fromJSON(group);
            fixedCount++;
        }

        // Validate group data integrity if validation method exists
        if (typeof group.validate === 'function') {
            const validation = group.validate();
            if (!validation.isValid) {
                console.warn(`Group validation failed for ${group.id}:`, validation.errors);
            }
        }
    });

    return fixedCount;
}

/**
 * Validates and fixes all data integrity issues
 * @param {Array} groups - Array of group objects
 * @param {Array} urls - Array of URL objects
 * @param {string} defaultGroupId - Default group ID for orphaned URLs
 * @returns {Object} Validation result with hasChanges, urlsFixed, groupsFixed
 */
function validateAndFixDataIntegrity(groups, urls, defaultGroupId = 'ungrouped') {
    const result = {
        hasChanges: false,
        urlsFixed: 0,
        groupsFixed: 0,
        validationErrors: []
    };

    // Validate and fix URL data
    result.urlsFixed = validateAndFixURLs(urls, groups, defaultGroupId);

    // Validate and fix group data
    result.groupsFixed = validateAndFixGroups(groups);

    // Update group URL counts
    updateGroupUrlCounts(groups, urls);

    result.hasChanges = result.urlsFixed > 0 || result.groupsFixed > 0;

    if (result.hasChanges) {
        console.log(`Data integrity check: Fixed ${result.urlsFixed} URLs and ${result.groupsFixed} groups`);
    }

    return result;
}

/**
 * Checks if URL exists in array (by URL string)
 * @param {Array} urls - Array of URL objects
 * @param {string} urlString - URL string to check
 * @returns {boolean} True if URL exists
 */
function urlExists(urls, urlString) {
    return urls.some(url => url.url === urlString);
}

/**
 * Finds duplicate URLs in array
 * @param {Array} urls - Array of URL objects
 * @returns {Array} Array of duplicate URL objects
 */
function findDuplicateURLs(urls) {
    const seen = new Map();
    const duplicates = [];

    urls.forEach(url => {
        if (seen.has(url.url)) {
            duplicates.push({
                url: url.url,
                ids: [seen.get(url.url), url.id]
            });
        } else {
            seen.set(url.url, url.id);
        }
    });

    return duplicates;
}

/**
 * Validates URL string format
 * @param {string} urlString - URL string to validate
 * @returns {boolean} True if valid URL
 */
function isValidURL(urlString) {
    try {
        const url = new URL(urlString);
        return ['http:', 'https:'].includes(url.protocol);
    } catch (_) {
        return false;
    }
}

/**
 * Validates group name
 * @param {string} name - Group name to validate
 * @returns {Object} Validation result {isValid, error}
 */
function validateGroupName(name) {
    if (!name || typeof name !== 'string') {
        return { isValid: false, error: 'Group name is required' };
    }
    if (name.length === 0) {
        return { isValid: false, error: 'Group name cannot be empty' };
    }
    if (name.length > 50) {
        return { isValid: false, error: 'Group name must be 50 characters or less' };
    }
    return { isValid: true };
}

/**
 * Checks if a group can be deleted (not protected)
 * @param {Object} group - Group object
 * @returns {boolean} True if group can be deleted
 */
function canDeleteGroup(group) {
    return !group.protected && group.id !== 'ungrouped';
}

/**
 * Removes orphaned URLs (URLs without valid groups)
 * @param {Array} urls - Array of URL objects
 * @param {Array} groups - Array of group objects
 * @returns {number} Number of URLs removed
 */
function removeOrphanedURLs(urls, groups) {
    const validGroupIds = new Set(groups.map(g => g.id));
    const before = urls.length;

    // Filter out URLs with invalid group IDs
    urls.splice(0, urls.length, ...urls.filter(url => validGroupIds.has(url.groupId)));

    const removed = before - urls.length;
    if (removed > 0) {
        console.log(`Removed ${removed} orphaned URLs`);
    }

    return removed;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
        updateGroupUrlCounts,
        validateAndFixURLs,
        validateAndFixGroups,
        validateAndFixDataIntegrity,
        urlExists,
        findDuplicateURLs,
        isValidURL,
        validateGroupName,
        canDeleteGroup,
        removeOrphanedURLs
    };
} else {
    // Browser environment - attach to window
    window.DataValidator = {
        updateGroupUrlCounts,
        validateAndFixURLs,
        validateAndFixGroups,
        validateAndFixDataIntegrity,
        urlExists,
        findDuplicateURLs,
        isValidURL,
        validateGroupName,
        canDeleteGroup,
        removeOrphanedURLs
    };
}