// JSON panel functionality

export const json = {
    // JSON Panel Methods
    toggleJsonPanel() {
        this.jsonPanelVisible = !this.jsonPanelVisible;
        const panel = document.getElementById('jsonPanel');
        if (this.jsonPanelVisible) {
            panel.classList.add('visible');
            this.updateJsonDisplay();
        } else {
            panel.classList.remove('visible');
        }
    },

    hideJsonPanel() {
        this.jsonPanelVisible = false;
        const panel = document.getElementById('jsonPanel');
        panel.classList.remove('visible');
    },

    updateJsonDisplay() {
        if (!this.jsonPanelVisible) return;

        const textarea = document.getElementById('levelJsonTextarea');
        if (textarea) {
            // Create a deep copy of the level data for display
            const levelCopy = JSON.parse(JSON.stringify(this.level));
            textarea.value = JSON.stringify(levelCopy, null, 2);
        }
    },

    formatJson() {
        const textarea = document.getElementById('levelJsonTextarea');
        if (!textarea) return;

        try {
            const parsed = JSON.parse(textarea.value);
            textarea.value = JSON.stringify(parsed, null, 2);
            this.updateStatus('JSON formatted');
        } catch (error) {
            this.updateStatus('Invalid JSON - cannot format');
        }
    },

    applyJsonChanges() {
        const textarea = document.getElementById('levelJsonTextarea');
        if (!textarea) return;

        try {
            const newLevelData = JSON.parse(textarea.value);

            // Basic validation
            if (!newLevelData.objects || !Array.isArray(newLevelData.objects)) {
                throw new Error('Invalid level data: objects array required');
            }

            // Update the level data and ensure defaults
            this.level = this.ensureLevelDefaults(newLevelData);

            // Update UI elements
            document.getElementById('levelName').value = this.level.name || '';
            document.getElementById('levelDescription').value = this.level.description || '';
            document.getElementById('backgroundImage').value = this.level.backgroundImage || '';

            // Load background image if changed
            this.loadBackgroundImage();

            // Load object background images
            this.level.objects.forEach(obj => {
                if (obj.backgroundImage) {
                    this.loadObjectImage(obj.backgroundImage);
                }
            });

            // Update counters based on existing objects to prevent duplicates
            const counters = this.updateObjectCounters(this.level);
            this.objectIdCounter = counters.objectIdCounter;
            this.connectionIdCounter = counters.connectionIdCounter;

            // Validate and fix any duplicate IDs that might exist
            this.validateAndFixDuplicateIds(this.level);

            // Reset selection and update UI
            this.selectedObject = null;
            this.updateObjectList();
            this.render();
            this.updateStatus('JSON changes applied successfully');
        } catch (error) {
            this.updateStatus(`Error applying JSON: ${error.message}`);
            console.error('JSON apply error:', error);
        }
    },

    resetJson() {
        this.updateJsonDisplay();
        this.updateStatus('JSON reset to current level state');
    }
};
