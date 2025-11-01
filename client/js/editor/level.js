// Level management functionality (loading, saving, etc.)

import { updateObjectCounters, validateAndFixDuplicateIds, recalculateConnectionLengths } from './utils.js';

export const level = {
    newLevel() {
        if (confirm('Create a new level? This will clear the current level.')) {
            this.level = {
                name: 'new-level',
                description: '',
                version: '1.0',
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

                document.getElementById('levelName').value = this.level.name;
                document.getElementById('levelDescription').value = this.level.description;

                document.getElementById('backgroundImage').value = this.level.backgroundImage;
                this.loadBackgroundImage();

                // Update world physics inputs
                document.getElementById('worldGravity').value = this.level.world.gravity;

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

        // Validate level
        const hasSpawn = this.level.objects.some(obj => obj.properties.includes('spawnpoint'));
        const hasGoal = this.level.objects.some(obj => obj.properties.includes('goal'));

        if (!hasSpawn) {
            alert('Level must have at least one spawnpoint!');
            return;
        }

        if (!hasGoal) {
            alert('Level must have at least one goal!');
            return;
        }

        // Recalculate connection lengths to account for any rotations
        recalculateConnectionLengths(this.level);
        this.updateJsonDisplay();

        this.level.name = levelName;
        this.level.description = document.getElementById('levelDescription').value;
        this.level.backgroundImage = document.getElementById('backgroundImage').value;

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

    testLevel() {
        const levelName = document.getElementById('levelName').value;
        if (!levelName) {
            alert('Please save the level first');
            return;
        }

        // Open game in new tab with level parameter, using base path
        window.open(`${this.basePath}/?level=${levelName}`, '_blank');
    },

    updateStatus(message) {
        document.getElementById('statusText').textContent = message;
    }
};
