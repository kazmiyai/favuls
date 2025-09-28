// Shared Drag & Drop Utilities
// Used by both popup and start page for consistent drag & drop behavior

class DragDropManager {
    constructor(context) {
        this.context = context; // 'popup' or 'startpage'
        this.draggedURL = null;
        this.draggedGroup = null;
    }

    // URL Drag & Drop Methods
    handleURLDragStart(e, urlData) {
        // Store the URL data in the drag event
        e.dataTransfer.setData('text/plain', urlData.id);
        e.dataTransfer.setData('application/json', JSON.stringify({
            id: urlData.id,
            title: urlData.title,
            url: urlData.url,
            groupId: urlData.groupId,
            order: urlData.order
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
        document.querySelectorAll('.url-item, .bookmark-item').forEach(item => {
            item.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        // Clear reference
        this.draggedURL = null;

        console.log('Drag ended');
    }

    // URL-to-URL Reordering Methods
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

        // Clear previous drop indicators from all URL/bookmark items
        const itemSelector = this.context === 'popup' ? '.url-item' : '.bookmark-item';
        document.querySelectorAll(itemSelector).forEach(item => {
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

    async handleURLReorderDrop(e, targetURLData, appInstance) {
        e.preventDefault();

        if (!this.draggedURL || this.draggedURL.id === targetURLData.id) {
            return;
        }

        // Only allow reordering within the same group
        if (this.draggedURL.groupId !== targetURLData.groupId) {
            return;
        }

        try {
            // Remove visual feedback from all items
            const itemSelector = this.context === 'popup' ? '.url-item' : '.bookmark-item';
            document.querySelectorAll(itemSelector).forEach(item => {
                item.classList.remove('drag-over-top', 'drag-over-bottom');
            });

            // Determine drop position
            const rect = e.currentTarget.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const isTopHalf = e.clientY < midpoint;

            let newOrder;
            if (isTopHalf) {
                // Drop above target
                newOrder = targetURLData.order - 0.5;
            } else {
                // Drop below target
                newOrder = targetURLData.order + 0.5;
            }

            // Update the dragged URL's order
            this.draggedURL.order = newOrder;
            this.draggedURL.lastModified = new Date().toISOString();

            // Normalize URL orders within the group
            this.normalizeURLOrdersInGroup(this.draggedURL.groupId, appInstance.urls);

            // Save to storage and update UI
            await appInstance.saveData();
            if (this.context === 'popup') {
                appInstance.renderURLs();
            } else {
                appInstance.render();
            }

            console.log(`URL "${this.draggedURL.title}" reordered successfully`);
        } catch (error) {
            console.error('Error reordering URL:', error);
        }
    }

    // URL-to-Group Assignment Methods
    handleURLToGroupDragOver(e, targetGroupId) {
        e.preventDefault();

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

    async handleURLToGroupDrop(e, targetGroupId, appInstance) {
        e.preventDefault();

        try {
            // Remove visual feedback
            e.currentTarget.classList.remove('drag-over');

            // Get the dragged URL data
            const urlId = e.dataTransfer.getData('text/plain');
            const url = appInstance.urls.find(u => u.id === urlId);

            if (!url) {
                console.error('Dragged URL not found:', urlId);
                return;
            }

            // Don't move if it's the same group
            if (url.groupId === targetGroupId) {
                return;
            }

            // Update the URL's group
            url.groupId = targetGroupId;
            url.lastModified = new Date().toISOString();

            // Set order to end of target group
            const targetGroupUrls = appInstance.urls.filter(u => u.groupId === targetGroupId);
            const maxOrder = Math.max(0, ...targetGroupUrls.map(u => u.order || 0));
            url.order = maxOrder + 1;

            // Save to storage and update UI
            await appInstance.saveData();
            if (this.context === 'popup') {
                appInstance.renderURLs();
            } else {
                appInstance.render();
            }

            console.log(`URL "${url.title}" moved to group successfully`);
        } catch (error) {
            console.error('Error moving URL to group:', error);
        }
    }

    // Group Drag & Drop Methods
    handleGroupDragStart(e, group) {
        // Validate group object
        if (!group || !group.id || !group.name) {
            console.error('Invalid group object in drag start:', group);
            e.preventDefault();
            return;
        }

        // Store the dragged group data
        this.draggedGroup = {
            id: group.id,
            name: group.name,
            order: group.order || 0,
            protected: group.protected || false
        };

        e.dataTransfer.setData('text/plain', group.id);
        e.dataTransfer.setData('application/json', JSON.stringify({
            id: group.id,
            name: group.name,
            order: group.order || 0
        }));

        // Set drag effect
        e.dataTransfer.effectAllowed = 'move';

        // Add visual feedback
        e.target.classList.add('dragging');

        console.log('Group drag started:', group.name, 'with order:', group.order);
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
            return;
        }

        e.dataTransfer.dropEffect = 'move';

        // Determine drop position based on mouse position
        const rect = e.currentTarget.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const isTopHalf = e.clientY < midpoint;

        // Clear previous drop indicators from all headers
        document.querySelectorAll('.group-header').forEach(header => {
            header.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        // Add appropriate drop indicator
        if (isTopHalf) {
            e.currentTarget.classList.add('drag-over-top');
        } else {
            e.currentTarget.classList.add('drag-over-bottom');
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

    async handleGroupReorderDrop(e, targetGroupId, appInstance) {
        e.preventDefault();

        if (!this.draggedGroup || this.draggedGroup.id === targetGroupId) {
            console.log('Group reorder drop: skipping - no dragged group or same group');
            return;
        }

        try {
            // Remove visual feedback from all headers
            document.querySelectorAll('.group-header').forEach(header => {
                header.classList.remove('drag-over-top', 'drag-over-bottom');
            });

            // Find the actual dragged group in the appInstance.groups array
            const draggedGroupInArray = appInstance.groups.find(g => g.id === this.draggedGroup.id);
            if (!draggedGroupInArray) {
                console.error('Dragged group not found in groups array:', this.draggedGroup.id);
                return;
            }

            // Find target group
            const targetGroup = appInstance.groups.find(g => g.id === targetGroupId);
            if (!targetGroup) {
                console.error('Target group not found:', targetGroupId);
                return;
            }

            console.log('Group reorder drop:', {
                draggedGroup: draggedGroupInArray.name,
                targetGroup: targetGroup.name,
                draggedOrder: draggedGroupInArray.order,
                targetOrder: targetGroup.order
            });

            // Determine drop position
            const rect = e.currentTarget.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const isTopHalf = e.clientY < midpoint;

            let newOrder;
            if (isTopHalf) {
                // Drop above target
                newOrder = targetGroup.order - 0.5;
            } else {
                // Drop below target
                newOrder = targetGroup.order + 0.5;
            }

            // Update the dragged group's order (use the reference from the array)
            draggedGroupInArray.order = newOrder;
            draggedGroupInArray.lastModified = new Date().toISOString();

            // Normalize group orders
            this.normalizeGroupOrders(appInstance.groups);

            // Save to storage and update UI
            await appInstance.saveData();
            if (this.context === 'popup') {
                appInstance.renderURLs();
            } else {
                appInstance.render();
            }

            console.log(`Group "${draggedGroupInArray.name}" reordered successfully to position ${newOrder}`);
        } catch (error) {
            console.error('Error reordering group:', error);
        }
    }

    // Unified Drag and Drop Event Handlers
    handleUnifiedDragOver(e, targetGroupId) {
        e.preventDefault();

        // Determine what type of drag operation this is
        if (this.draggedGroup) {
            // Group reordering operation
            this.handleGroupReorderDragOver(e, targetGroupId);
        } else if (this.draggedURL) {
            // URL to group assignment operation
            this.handleURLToGroupDragOver(e, targetGroupId);
        }
    }

    handleUnifiedDrop(e, targetGroupId, appInstance) {
        e.preventDefault();

        // Route to appropriate handler based on drag type
        if (this.draggedGroup) {
            // Group reordering operation
            this.handleGroupReorderDrop(e, targetGroupId, appInstance);
        } else if (this.draggedURL) {
            // URL to group assignment operation
            this.handleURLToGroupDrop(e, targetGroupId, appInstance);
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

    // Utility Methods
    normalizeURLOrdersInGroup(groupId, urls) {
        // Get all URLs in the group and sort by order
        const groupUrls = urls.filter(url => url.groupId === groupId)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        // Reassign sequential orders
        groupUrls.forEach((url, index) => {
            url.order = index + 1;
        });
    }

    normalizeGroupOrders(groups) {
        if (!groups || !Array.isArray(groups)) {
            console.error('Invalid groups array in normalizeGroupOrders:', groups);
            return;
        }

        // Get all groups (except protected ones) and sort by order
        const reorderableGroups = groups.filter(g => g && !g.protected)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        // Reassign sequential orders
        reorderableGroups.forEach((group, index) => {
            if (group) {
                group.order = index + 1;
            }
        });

        console.log('Normalized group orders:', reorderableGroups.map(g => ({ name: g.name, order: g.order })));
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DragDropManager;
} else if (typeof window !== 'undefined') {
    window.DragDropManager = DragDropManager;
}