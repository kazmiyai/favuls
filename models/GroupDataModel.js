// Group Data Model for FavURL Chrome Extension

class GroupDataModel {
    constructor(data = {}) {
        this.id = data.id || FavURLUtils.generateUniqueId('group_');
        this.name = data.name || '';
        this.created = data.created || new Date().toISOString();
        this.lastModified = data.lastModified || new Date().toISOString();
        this.isDefault = data.isDefault || false;
        this.protected = data.protected || false;
        this.color = data.color || '#2196f3';
        this.description = data.description || '';
        this.urlCount = data.urlCount || 0;
        this.order = data.order || 0;
        this.isValidated = false;
    }

    generateUniqueId() {
        return FavURLUtils.generateUniqueId('group_');
    }

    validate() {
        const errors = [];

        if (!this.name || typeof this.name !== 'string') {
            errors.push('Group name is required and must be a string');
        } else if (this.name.trim().length === 0) {
            errors.push('Group name cannot be empty');
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
            urlCount: this.urlCount,
            order: this.order
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
            description: 'Default group for uncategorized bookmarks',
            order: 0
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = GroupDataModel;
} else {
    // Browser environment - attach to window
    window.GroupDataModel = GroupDataModel;
}