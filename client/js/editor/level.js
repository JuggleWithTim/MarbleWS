// Level management functionality (loading, saving, etc.)

import { updateObjectCounters, validateAndFixDuplicateIds, recalculateConnectionLengths } from './utils.js';

export const level = {
    newLevel() {
        if (confirm('Create a new level? This will clear the current level.')) {
            this.level = {
                name: 'new-level',
                description: '',
                version: '1.0',
                levelType: 'Marble',
                backgroundImage: '',
                objects: [],
                connections: []
            };

            // Ensure all default level properties are present
            this.level = this.ensureLevelDefaults(this.level);

            document.getElementById('levelName').value = this.level.name;
            document.getElementById('levelDescription').value = this.level.description;
            document.getElementById('backgroundImage').value = '';
            this.backgroundImage = null;

            this.selectedObject = null;
            this.objectIdCounter = 1;
            this.connectionIdCounter = 1;
            this.updateObjectList();
            this.render();
            this.updateJsonDisplay();

            // Save the new level as initial state for undo/redo
            this.saveState();

            this.updateStatus('New level created');
        }
    },

    async loadLevel() {
        const levelName = prompt('Enter level name to load:');
        if (!levelName) return;

        try {
            const response = await fetch(`${this.basePath}/api/levels/${levelName}`);
            if (response.ok) {
                const levelData = await response.json();
                    this.level = levelData;

                // Ensure all level properties have defaults
                this.level = this.ensureLevelDefaults(this.level);

                // Update marble property inputs
                document.getElementById('marbleColor').value = this.level.marble.color;
                document.getElementById('marbleRadius').value = this.level.marble.radius;
                document.getElementById('marbleFriction').value = this.level.marble.friction;
                document.getElementById('marbleRestitution').value = this.level.marble.restitution;
                document.getElementById('marbleDensity').value = this.level.marble.density;

                // Update emote property inputs
                document.getElementById('emoteMaxActive').value = this.level.emote.maxActiveEmotes || 222;
                document.getElementById('emoteRadius').value = this.level.emote.radius;
                document.getElementById('emoteFriction').value = this.level.emote.friction;
                document.getElementById('emoteRestitution').value = this.level.emote.restitution;
                document.getElementById('emoteDensity').value = this.level.emote.density;
                document.getElementById('emoteSpawnAll').checked = this.level.emote.spawnAll || false;

                document.getElementById('levelName').value = this.level.name;
                document.getElementById('levelDescription').value = this.level.description;
                document.getElementById('levelType').value = this.level.levelType || 'Marble';

                document.getElementById('backgroundImage').value = this.level.backgroundImage;
                this.loadBackgroundImage();

                // Update world physics inputs
                document.getElementById('worldGravity').value = this.level.world.gravity;

                // Update level size inputs
                document.getElementById('levelWidth').value = this.level.levelWidth || 1920;
                document.getElementById('levelHeight').value = this.level.levelHeight || 1080;

                // Load background images for objects
                this.level.objects.forEach(obj => {
                    if (obj.backgroundImage) {
                        this.loadObjectImage(obj.backgroundImage);
                    }
                });

                // Update counters based on existing objects to prevent duplicates
                const counters = updateObjectCounters(this.level);
                this.objectIdCounter = counters.objectIdCounter;
                this.connectionIdCounter = counters.connectionIdCounter;

                // Validate and fix any duplicate IDs that might exist
                validateAndFixDuplicateIds(this.level);

                this.selectedObject = null;
                this.updateObjectList();
                this.render();
                this.updateJsonDisplay();

                // Save the loaded level as initial state for undo/redo
                this.saveState();

                this.updateStatus(`Loaded level: ${levelName}`);
            } else {
                alert('Level not found!');
            }
        } catch (error) {
            alert('Failed to load level: ' + error.message);
        }
    },

    async saveLevel() {
        const levelName = document.getElementById('levelName').value;
        if (!levelName) {
            alert('Please enter a level name');
            return;
        }

        // Recalculate connection lengths to account for any rotations
        recalculateConnectionLengths(this.level);
        this.updateJsonDisplay();

        this.level.name = levelName;
        this.level.description = document.getElementById('levelDescription').value;
        this.level.levelType = document.getElementById('levelType').value;
        this.level.backgroundImage = document.getElementById('backgroundImage').value;

        // Save level size if specified
        const levelWidth = parseInt(document.getElementById('levelWidth').value);
        const levelHeight = parseInt(document.getElementById('levelHeight').value);
        if (levelWidth && levelHeight) {
            this.level.levelWidth = levelWidth;
            this.level.levelHeight = levelHeight;
        }

        try {
            const response = await fetch(`${this.basePath}/api/levels/${levelName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.level),
            });

            if (response.ok) {
                this.updateStatus(`Saved level: ${levelName}`);
            } else {
                alert('Failed to save level');
            }
        } catch (error) {
            alert('Failed to save level: ' + error.message);
        }
    },

    updateStatus(message) {
        document.getElementById('statusText').textContent = message;
    }
};
