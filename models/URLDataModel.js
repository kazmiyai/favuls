// URL Data Model for FavURL Chrome Extension

class URLDataModel {
    constructor(data = {}) {
        this.id = data.id || FavURLUtils.generateUniqueId('url_');
        this.url = data.url || '';
        this.title = data.title || '';
        this.timestamp = data.timestamp || new Date().toISOString();
        this.groupId = data.groupId || 'ungrouped';
        this.created = data.created || new Date().toISOString();
        this.lastModified = data.lastModified || new Date().toISOString();
        this.domain = data.domain || FavURLUtils.extractDomain(this.url);
        this.favicon = data.favicon || FavURLUtils.generateFaviconUrl(this.domain);
        this.tags = data.tags || [];
        this.order = data.order !== undefined ? data.order : Date.now(); // Use timestamp as default order
        this.isValidated = false;
    }

    generateUniqueId() {
        return FavURLUtils.generateUniqueId('url_');
    }

    extractDomain(url) {
        return FavURLUtils.extractDomain(url);
    }

    generateFaviconUrl(domain) {
        return FavURLUtils.generateFaviconUrl(domain);
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
            tags: this.tags,
            order: this.order
        };
    }

    static fromJSON(data) {
        return new URLDataModel(data);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = URLDataModel;
} else {
    // Browser environment - attach to window
    window.URLDataModel = URLDataModel;
}