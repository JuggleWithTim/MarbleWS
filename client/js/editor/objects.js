// Object creation, selection, and manipulation

import { DEFAULT_OBJECT_PROPERTIES } from './constants.js';
import { generateUniqueObjectName, createRgba, parseRgba, rgbToHex, loadObjectImage } from './utils.js';

export const objects = {
    createRectangle(x, y) {
        const backgroundImage = document.getElementById('objectBackgroundImage').value;
        const hexColor = document.getElementById('objectColor').value;
        const alpha = parseInt(document.getElementById('objectAlpha').value);

        // Load the background image if provided
        if (backgroundImage) {
            loadObjectImage(backgroundImage, this.objectImages);
        }

        const obj = {
            id: generateUniqueObjectName('rect', this.level.objects),
            shape: 'rectangle',
            x: x,
            y: y,
            width: parseInt(document.getElementById('objectWidth').value),
            height: parseInt(document.getElementById('objectHeight').value),
            rotation: parseFloat(document.getElementById('objectRotation').value) * Math.PI / 180, // Convert to radians
            color: createRgba(hexColor, alpha),
            backgroundImage: backgroundImage,
            isStatic: document.getElementById('objectStatic').checked,
            isSolid: document.getElementById('objectSolid').checked,
            zIndex: parseInt(document.getElementById('objectZIndex').value),
            friction: parseFloat(document.getElementById('objectFriction').value),
            restitution: parseFloat(document.getElementById('objectRestitution').value),
            density: parseFloat(document.getElementById('objectDensity').value),
            properties: this.getSelectedProperties()
        };

        // Add nextLevel property for goal objects
        const nextLevel = this.getNextLevel();
        if (nextLevel) {
            obj.nextLevel = nextLevel;
        }

        // Add teleporterTarget property for teleporter objects
        const teleporterTarget = this.getTeleporterTarget();
        if (teleporterTarget) {
            obj.teleporterTarget = teleporterTarget;
        }

        this.level.objects.push(obj);
        this.selectObject(obj);
        this.updateObjectList();
        this.render();
        this.updateJsonDisplay();
        this.updateStatus(`Created rectangle: ${obj.id}`);
    },

    createCircle(x, y) {
        const backgroundImage = document.getElementById('objectBackgroundImage').value;
        const hexColor = document.getElementById('objectColor').value;
        const alpha = parseInt(document.getElementById('objectAlpha').value);

        // Load the background image if provided
        if (backgroundImage) {
            loadObjectImage(backgroundImage, this.objectImages);
        }

        const obj = {
            id: generateUniqueObjectName('circle', this.level.objects),
            shape: 'circle',
            x: x,
            y: y,
            radius: parseInt(document.getElementById('objectRadius').value),
            rotation: parseFloat(document.getElementById('objectRotation').value) * Math.PI / 180, // Convert to radians
            color: createRgba(hexColor, alpha),
            backgroundImage: backgroundImage,
            isStatic: document.getElementById('objectStatic').checked,
            isSolid: document.getElementById('objectSolid').checked,
            zIndex: parseInt(document.getElementById('objectZIndex').value),
            friction: parseFloat(document.getElementById('objectFriction').value),
            restitution: parseFloat(document.getElementById('objectRestitution').value),
            density: parseFloat(document.getElementById('objectDensity').value),
            properties: this.getSelectedProperties()
        };

        // Add nextLevel property for goal objects
        const nextLevel = this.getNextLevel();
        if (nextLevel) {
            obj.nextLevel = nextLevel;
        }

        this.level.objects.push(obj);
        this.selectObject(obj);
        this.updateObjectList();
        this.render();
        this.updateJsonDisplay();
        this.updateStatus(`Created circle: ${obj.id}`);
    },

    getSelectedProperties() {
        const properties = [];
        if (document.getElementById('objectSpawnpoint').checked) {
            properties.push('spawnpoint');
        }
        if (document.getElementById('objectPlayerspawn').checked) {
            properties.push('playerspawn');
        }
        if (document.getElementById('objectEmotespawn').checked) {
            properties.push('emotespawn');
        }
        if (document.getElementById('objectGoal').checked) {
            properties.push('goal');
        }
        if (document.getElementById('objectTeleporter').checked) {
            properties.push('teleporter');
        }
        return properties;
    },

    getNextLevel() {
        if (document.getElementById('objectGoal').checked) {
            return document.getElementById('objectNextLevel').value.trim();
        }
        return '';
    },

    getTeleporterTarget() {
        if (document.getElementById('objectTeleporter').checked) {
            return document.getElementById('objectTeleporterTarget').value.trim();
        }
        return '';
    },

    selectObject(obj) {
        this.selectObjects(obj ? [obj] : []);
    },

    selectObjects(objects) {
        this.selectedObjects = [...objects];
        // Keep selectedObject for backward compatibility
        this.selectedObject = objects.length === 1 ? objects[0] : null;

        // Update remove connections button visibility
        this.updateRemoveConnectionsButtonVisibility();

        if (objects.length === 1) {
            const obj = objects[0];
            // Parse color and alpha from stored RGBA string or convert from hex
            let colorHex = obj.color;
            let alpha = 255; // default full opacity

            if (obj.color && obj.color.startsWith('rgba(')) {
                const rgba = parseRgba(obj.color);
                if (rgba) {
                    colorHex = rgbToHex(rgba.r, rgba.g, rgba.b);
                    alpha = Math.round(rgba.a * 255);
                }
            } else if (obj.color && obj.color.startsWith('#')) {
                // Legacy hex color, keep alpha at full
                colorHex = obj.color;
                alpha = 255;
            }

            // Update property inputs
            document.getElementById('objectColor').value = colorHex;
            document.getElementById('objectAlpha').value = alpha;
            this.updateAlphaDisplay(alpha);

            document.getElementById('objectBackgroundImage').value = obj.backgroundImage || '';
            document.getElementById('objectStatic').checked = obj.isStatic;
            document.getElementById('objectSolid').checked = obj.isSolid !== false; // Default to true if not specified
            document.getElementById('objectZIndex').value = obj.zIndex || 0;
            document.getElementById('objectFriction').value = obj.friction;
            document.getElementById('objectRestitution').value = obj.restitution;
            document.getElementById('objectDensity').value = obj.density || 0.001;
            document.getElementById('objectRotation').value = Math.round((obj.rotation || 0) * 180 / Math.PI); // Convert to degrees

            if (obj.shape === 'rectangle') {
                document.getElementById('objectWidth').value = obj.width;
                document.getElementById('objectHeight').value = obj.height;
            } else if (obj.shape === 'circle') {
                document.getElementById('objectRadius').value = obj.radius;
            }

            // Update property checkboxes
            document.getElementById('objectSpawnpoint').checked = obj.properties.includes('spawnpoint');
            document.getElementById('objectPlayerspawn').checked = obj.properties.includes('playerspawn');
            document.getElementById('objectEmotespawn').checked = obj.properties.includes('emotespawn');
            document.getElementById('objectGoal').checked = obj.properties.includes('goal');
            document.getElementById('objectTeleporter').checked = obj.properties.includes('teleporter');

            // Show/hide nextLevel field based on goal property
            document.getElementById('nextLevelContainer').style.display =
                obj.properties.includes('goal') ? 'block' : 'none';

            // Show/hide teleporterTarget field based on teleporter property
            document.getElementById('teleporterTargetContainer').style.display =
                obj.properties.includes('teleporter') ? 'block' : 'none';

            // Set nextLevel value if it exists
            document.getElementById('objectNextLevel').value = obj.nextLevel || '';

            // Set teleporterTarget value if it exists
            document.getElementById('objectTeleporterTarget').value = obj.teleporterTarget || '';

            // Set active properties
            document.getElementById('objectActive').checked = obj.active || false;
            document.getElementById('activeOptionsContainer').style.display = (obj.active) ? 'block' : 'none';

            if (obj.active) {
                document.getElementById('objectPointAX').value = obj.pointA ? obj.pointA.x : 0;
                document.getElementById('objectPointAY').value = obj.pointA ? obj.pointA.y : 0;
                document.getElementById('objectPointBX').value = obj.pointB ? obj.pointB.x : 0;
                document.getElementById('objectPointBY').value = obj.pointB ? obj.pointB.y : 0;
                document.getElementById('objectTimeToA').value = obj.timeToA || 2;
                document.getElementById('objectTimeFromA').value = obj.timeFromA || 2;
                document.getElementById('objectSpeedToB').value = obj.speedToB || 1;
                document.getElementById('objectSpeedFromB').value = obj.speedFromB || 1;
                document.getElementById('objectRotationA').value = obj.rotationA !== undefined ? Math.round((obj.rotationA || 0) * 180 / Math.PI) : Math.round((obj.rotation || 0) * 180 / Math.PI);
                document.getElementById('objectRotationB').value = obj.rotationB !== undefined ? Math.round((obj.rotationB || 0) * 180 / Math.PI) : Math.round((obj.rotation || 0) * 180 / Math.PI);
                document.getElementById('objectRotationPointX').value = obj.rotationPoint ? obj.rotationPoint.x : 0;
                document.getElementById('objectRotationPointY').value = obj.rotationPoint ? obj.rotationPoint.y : 0;
                document.getElementById('objectAdvancedRotation').checked = obj.advancedRotation || false;
                document.getElementById('advancedRotationOptions').style.display = (obj.advancedRotation) ? 'block' : 'none';
                document.getElementById('objectRotationSpeedToB').value = obj.rotationSpeedToB !== undefined ? obj.rotationSpeedToB : 90;
                document.getElementById('objectRotationSpeedFromB').value = obj.rotationSpeedFromB !== undefined ? obj.rotationSpeedFromB : 90;
            }

            this.updateStatus(`Selected: ${obj.id}`);
        } else if (objects.length > 1) {
            this.updateStatus(`Selected ${objects.length} objects`);
        } else {
            this.updateStatus('No object selected');
        }

        this.updateObjectList();
        this.render();
    },

    toggleObjectSelection(obj) {
        const index = this.selectedObjects.indexOf(obj);
        if (index > -1) {
            this.selectedObjects.splice(index, 1);
        } else {
            this.selectedObjects.push(obj);
        }
        this.selectObjects(this.selectedObjects); // Refresh UI
    },

    // Update alpha display percentage
    updateAlphaDisplay(alpha) {
        const alphaValueElement = document.getElementById('alphaValue');
        if (alphaValueElement) {
            const percentage = Math.round((alpha / 255) * 100);
            alphaValueElement.textContent = `${percentage}%`;
        }
    },

    updateSelectedObject() {
        if (this.selectedObjects.length === 0) return;

        // Get the new background image value
        const newBackgroundImage = document.getElementById('objectBackgroundImage').value;

        // Check if the background image has changed
        if (newBackgroundImage !== this.selectedObjects[0].backgroundImage) {
            // Load the new background image
            if (newBackgroundImage) {
                loadObjectImage(newBackgroundImage, this.objectImages);
            }
        }

        // Update properties from inputs
        const hexColor = document.getElementById('objectColor').value;
        const alpha = parseInt(document.getElementById('objectAlpha').value);
        const newColor = createRgba(hexColor, alpha);

        // Properties that can be applied to multiple objects
        const sharedProperties = {
            color: newColor,
            backgroundImage: newBackgroundImage,
            isStatic: document.getElementById('objectStatic').checked,
            isSolid: document.getElementById('objectSolid').checked,
            zIndex: parseInt(document.getElementById('objectZIndex').value),
            friction: parseFloat(document.getElementById('objectFriction').value),
            restitution: parseFloat(document.getElementById('objectRestitution').value),
            density: parseFloat(document.getElementById('objectDensity').value)
        };

        // Apply shared properties to all selected objects
        this.selectedObjects.forEach(obj => {
            Object.assign(obj, sharedProperties);
        });

        // For single object selection, also update object-specific properties
        if (this.selectedObjects.length === 1) {
            const obj = this.selectedObjects[0];

            obj.rotation = parseFloat(document.getElementById('objectRotation').value) * Math.PI / 180; // Convert to radians

            if (obj.shape === 'rectangle') {
                obj.width = parseInt(document.getElementById('objectWidth').value);
                obj.height = parseInt(document.getElementById('objectHeight').value);
            } else if (obj.shape === 'circle') {
                obj.radius = parseInt(document.getElementById('objectRadius').value);
            }

            // Update properties
            obj.properties = this.getSelectedProperties();

            // Update nextLevel property for goal objects
            const nextLevel = this.getNextLevel();
            if (nextLevel) {
                obj.nextLevel = nextLevel;
            } else if (obj.nextLevel) {
                delete obj.nextLevel;
            }

            // Update teleporterTarget property for teleporter objects
            const teleporterTarget = this.getTeleporterTarget();
            if (teleporterTarget) {
                obj.teleporterTarget = teleporterTarget;
            } else if (obj.teleporterTarget) {
                delete obj.teleporterTarget;
            }

            // Update active properties
            const isActive = document.getElementById('objectActive').checked;
            if (isActive) {
                obj.active = true;
                obj.pointA = {
                    x: parseFloat(document.getElementById('objectPointAX').value) || 0,
                    y: parseFloat(document.getElementById('objectPointAY').value) || 0
                };
                obj.pointB = {
                    x: parseFloat(document.getElementById('objectPointBX').value) || 0,
                    y: parseFloat(document.getElementById('objectPointBY').value) || 0
                };
                obj.timeToA = parseFloat(document.getElementById('objectTimeToA').value) || 2;
                obj.timeFromA = parseFloat(document.getElementById('objectTimeFromA').value) || 2;
                obj.speedToB = parseFloat(document.getElementById('objectSpeedToB').value) || 1;
                obj.speedFromB = parseFloat(document.getElementById('objectSpeedFromB').value) || 1;
                obj.rotationA = parseFloat(document.getElementById('objectRotationA').value) * Math.PI / 180; // Convert to radians
                obj.rotationB = parseFloat(document.getElementById('objectRotationB').value) * Math.PI / 180; // Convert to radians
                const rotationPointX = parseFloat(document.getElementById('objectRotationPointX').value) || 0;
                const rotationPointY = parseFloat(document.getElementById('objectRotationPointY').value) || 0;
                if (rotationPointX !== 0 || rotationPointY !== 0) {
                    obj.rotationPoint = { x: rotationPointX, y: rotationPointY };
                } else {
                    // Remove rotation point if set to center
                    if (obj.rotationPoint) delete obj.rotationPoint;
                }
                obj.advancedRotation = document.getElementById('objectAdvancedRotation').checked;
                if (obj.advancedRotation) {
                    obj.rotationSpeedToB = parseFloat(document.getElementById('objectRotationSpeedToB').value) || 90;
                    obj.rotationSpeedFromB = parseFloat(document.getElementById('objectRotationSpeedFromB').value) || 90;
                } else {
                    // Remove advanced rotation properties if not using advanced mode
                    if (obj.rotationSpeedToB !== undefined) delete obj.rotationSpeedToB;
                    if (obj.rotationSpeedFromB !== undefined) delete obj.rotationSpeedFromB;
                }
            } else {
                obj.active = false;
                // Remove active properties if not active
                if (obj.pointA) delete obj.pointA;
                if (obj.pointB) delete obj.pointB;
                if (obj.rotationPoint) delete obj.rotationPoint;
                if (obj.timeToA) delete obj.timeToA;
                if (obj.timeFromA) delete obj.timeFromA;
                if (obj.speedToB) delete obj.speedToB;
                if (obj.speedFromB) delete obj.speedFromB;
                if (obj.rotationA !== undefined) delete obj.rotationA;
                if (obj.rotationB !== undefined) delete obj.rotationB;
                if (obj.rotationSpeedToB !== undefined) delete obj.rotationSpeedToB;
                if (obj.rotationSpeedFromB !== undefined) delete obj.rotationSpeedFromB;
            }
        }

        this.updateObjectList();
        this.render();
    },

    deleteObject(obj) {
        const index = this.level.objects.indexOf(obj);
        if (index > -1) {
            // Remove the object from the objects array
            this.level.objects.splice(index, 1);

            // Remove any connections that reference this object
            if (this.level.connections) {
                this.level.connections = this.level.connections.filter(connection =>
                    connection.bodyA !== obj.id && connection.bodyB !== obj.id
                );
            }

            // Remove from selected objects if it was selected
            const selectedIndex = this.selectedObjects.indexOf(obj);
            if (selectedIndex > -1) {
                this.selectedObjects.splice(selectedIndex, 1);
                this.selectObjects(this.selectedObjects); // Refresh selection
            }

            this.updateObjectList();
            this.render();
            this.updateJsonDisplay();
            this.updateStatus(`Deleted: ${obj.id} and related connections`);
        }
    },

    updateObjectList() {
        const objectList = document.getElementById('objectList');
        objectList.innerHTML = '';

        this.level.objects.forEach(obj => {
            const item = document.createElement('div');
            item.className = 'object-item';
            if (this.selectedObjects.includes(obj)) {
                item.classList.add('selected');
            }

            const label = document.createElement('span');
            label.textContent = `${obj.id} (${obj.shape})`;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '×';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteObject(obj);
            };

            item.appendChild(label);
            item.appendChild(deleteBtn);

            item.onclick = () => this.selectObject(obj);

            objectList.appendChild(item);
        });
    },

    loadBackgroundImage() {
        if (!this.level.backgroundImage) {
            this.backgroundImage = null;
            return;
        }

        // Create a new image
        const img = new Image();
        img.onload = () => {
            this.backgroundImage = img;
            this.render();
            this.updateStatus('Background image loaded');
        };
        img.onerror = () => {
            this.backgroundImage = null;
            this.updateStatus('Failed to load background image');
        };
        img.src = this.level.backgroundImage;
    },

    // Point selection mode
    startPointSelection(pointType) {
        if (!this.selectedObject) {
            this.updateStatus('No object selected');
            return;
        }

        this.pointSelectionMode = pointType;
        let pointLabel = '';
        if (pointType === 'pointA') pointLabel = 'A';
        else if (pointType === 'pointB') pointLabel = 'B';
        else if (pointType === 'rotationPoint') pointLabel = 'Rotation Point';
        this.updateStatus(`Click on canvas to set Point ${pointLabel}`);
        this.render();
    },

    // Set point coordinates from canvas click
    setPoint(x, y) {
        if (!this.selectedObject || !this.pointSelectionMode) return;

        // Calculate relative coordinates from object center
        const relativeX = x - this.selectedObject.x;
        const relativeY = y - this.selectedObject.y;

        if (this.pointSelectionMode === 'pointA') {
            this.selectedObject.pointA = { x: relativeX, y: relativeY };
            document.getElementById('objectPointAX').value = Math.round(relativeX);
            document.getElementById('objectPointAY').value = Math.round(relativeY);
        } else if (this.pointSelectionMode === 'pointB') {
            this.selectedObject.pointB = { x: relativeX, y: relativeY };
            document.getElementById('objectPointBX').value = Math.round(relativeX);
            document.getElementById('objectPointBY').value = Math.round(relativeY);
        } else if (this.pointSelectionMode === 'rotationPoint') {
            this.selectedObject.rotationPoint = { x: relativeX, y: relativeY };
            document.getElementById('objectRotationPointX').value = Math.round(relativeX);
            document.getElementById('objectRotationPointY').value = Math.round(relativeY);
        }

        // Ensure active is set
        this.selectedObject.active = true;
        document.getElementById('objectActive').checked = true;
        document.getElementById('activeOptionsContainer').style.display = 'block';

        let pointLabel = '';
        if (this.pointSelectionMode === 'pointA') pointLabel = 'A';
        else if (this.pointSelectionMode === 'pointB') pointLabel = 'B';
        else if (this.pointSelectionMode === 'rotationPoint') pointLabel = 'Rotation Point';

        this.pointSelectionMode = null;
        this.updateStatus(`Point ${pointLabel} set`);
        this.render();
    },

    updateRemoveConnectionsButtonVisibility() {
        const button = document.getElementById('removeConnections');
        if (!button) return;

        // Show button only if an object is selected AND it has connections
        const shouldShow = this.selectedObject && this.hasConnections(this.selectedObject);
        button.style.display = shouldShow ? 'block' : 'none';
    },

    hasConnections(obj) {
        if (!this.level.connections || this.level.connections.length === 0) {
            return false;
        }

        return this.level.connections.some(connection =>
            connection.bodyA === obj.id || connection.bodyB === obj.id
        );
    },

    removeObjectConnections() {
        if (!this.selectedObject) {
            this.updateStatus('No object selected');
            return;
        }

        if (!this.level.connections || this.level.connections.length === 0) {
            this.updateStatus('No connections to remove');
            return;
        }

        const objectId = this.selectedObject.id;
        const initialCount = this.level.connections.length;

        // Filter out connections that reference the selected object
        this.level.connections = this.level.connections.filter(connection =>
            connection.bodyA !== objectId && connection.bodyB !== objectId
        );

        const removedCount = initialCount - this.level.connections.length;

        if (removedCount > 0) {
            this.updateStatus(`Removed ${removedCount} connection(s) from ${objectId}`);
        } else {
            this.updateStatus(`No connections found for ${objectId}`);
        }

        // Update button visibility after removing connections
        this.updateRemoveConnectionsButtonVisibility();

        this.render();
        this.updateJsonDisplay();
    }
};
