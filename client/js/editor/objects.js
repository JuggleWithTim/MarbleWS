// Object creation, selection, and manipulation

import { DEFAULT_OBJECT_PROPERTIES } from './constants.js';
import { generateUniqueObjectName, createRgba, parseRgba, rgbToHex, hexToRgb, loadObjectImage } from './utils.js';

export const objects = {
    createTriangle(x, y) {
        const backgroundImage = document.getElementById('objectBackgroundImage').value;
        const hexColor = document.getElementById('objectColor').value;
        const alpha = parseInt(document.getElementById('objectAlpha').value);

        // Load the background image if provided
        if (backgroundImage) {
            loadObjectImage(backgroundImage, this.objectImages);
        }

        const vertexAX = parseFloat(document.getElementById('objectVertexAX').value);
        const vertexAY = parseFloat(document.getElementById('objectVertexAY').value);
        const vertexBX = parseFloat(document.getElementById('objectVertexBX').value);
        const vertexBY = parseFloat(document.getElementById('objectVertexBY').value);
        const vertexCX = parseFloat(document.getElementById('objectVertexCX').value);
        const vertexCY = parseFloat(document.getElementById('objectVertexCY').value);

        const obj = {
            id: generateUniqueObjectName('triangle', this.level.objects),
            shape: 'triangle',
            x: x,
            y: y,
            vertices: [
                { x: isNaN(vertexAX) ? 0 : vertexAX, y: isNaN(vertexAY) ? -40 : vertexAY },
                { x: isNaN(vertexBX) ? -35 : vertexBX, y: isNaN(vertexBY) ? 30 : vertexBY },
                { x: isNaN(vertexCX) ? 35 : vertexCX, y: isNaN(vertexCY) ? 30 : vertexCY }
            ],
            rotation: parseFloat(document.getElementById('objectRotation').value) * Math.PI / 180,
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

        const nextLevel = this.getNextLevel();
        if (nextLevel) {
            obj.nextLevel = nextLevel;
        }

        const teleporterTarget = this.getTeleporterTarget();
        if (teleporterTarget) {
            obj.teleporterTarget = teleporterTarget;
        }

        const chairNumber = this.getChairNumber();
        if (chairNumber !== null) {
            obj.chair = chairNumber;
        }

        const checkpointOrder = this.getCheckpointOrder();
        if (checkpointOrder !== null) {
            obj.checkpointOrder = checkpointOrder;
        }

        const itemType = this.getItemType();
        if (itemType) {
            obj.itemType = itemType;
        }

        this.level.objects.push(obj);
        this.saveState();
        this.selectObject(obj);
        this.updateObjectList();
        this.render();
        this.updateJsonDisplay();
        this.updateStatus(`Created triangle: ${obj.id}`);
    },
    createRectangle(x, y) {
        const backgroundImage = document.getElementById('objectBackgroundImage').value;
        const hexColor = document.getElementById('objectColor').value;
        const alpha = parseInt(document.getElementById('objectAlpha').value);

        // Load the background image if provided
        if (backgroundImage) {
            loadObjectImage(backgroundImage, this.objectImages);
        }

        const widthValue = parseInt(document.getElementById('objectWidth').value);
        const heightValue = parseInt(document.getElementById('objectHeight').value);

        const obj = {
            id: generateUniqueObjectName('rect', this.level.objects),
            shape: 'rectangle',
            x: x,
            y: y,
            width: isNaN(widthValue) ? DEFAULT_OBJECT_PROPERTIES.width : widthValue,
            height: isNaN(heightValue) ? DEFAULT_OBJECT_PROPERTIES.height : heightValue,
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

        // Add chair property for chair objects
        const chairNumber = this.getChairNumber();
        if (chairNumber !== null) {
            obj.chair = chairNumber;
        }

        const checkpointOrder = this.getCheckpointOrder();
        if (checkpointOrder !== null) {
            obj.checkpointOrder = checkpointOrder;
        }

        const itemType = this.getItemType();
        if (itemType) {
            obj.itemType = itemType;
        }

        this.level.objects.push(obj);
        this.saveState();
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

        const radiusValue = parseInt(document.getElementById('objectRadius').value);

        const obj = {
            id: generateUniqueObjectName('circle', this.level.objects),
            shape: 'circle',
            x: x,
            y: y,
            radius: isNaN(radiusValue) ? DEFAULT_OBJECT_PROPERTIES.radius : radiusValue,
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

        // Add chair property for chair objects
        const chairNumber = this.getChairNumber();
        if (chairNumber !== null) {
            obj.chair = chairNumber;
        }

        const checkpointOrder = this.getCheckpointOrder();
        if (checkpointOrder !== null) {
            obj.checkpointOrder = checkpointOrder;
        }

        const itemType = this.getItemType();
        if (itemType) {
            obj.itemType = itemType;
        }

        this.level.objects.push(obj);
        this.saveState();
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
        if (document.getElementById('objectCheckpoint').checked) {
            properties.push('checkpoint');
        }
        if (document.getElementById('objectFinish').checked) {
            properties.push('finish');
        }
        if (document.getElementById('objectPlayerEffect').checked) {
            properties.push('playereffect');
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

    getCheckpointOrder() {
        if (document.getElementById('objectCheckpoint').checked) {
            const order = parseInt(document.getElementById('objectCheckpointOrder').value);
            return isNaN(order) ? null : order;
        }
        return null;
    },

    getNextCheckpointOrder() {
        const usedOrders = new Set();
        this.level.objects.forEach(obj => {
            if (typeof obj.checkpointOrder === 'number' && obj.checkpointOrder > 0) {
                usedOrders.add(obj.checkpointOrder);
            }
        });

        let nextOrder = 1;
        while (usedOrders.has(nextOrder)) {
            nextOrder += 1;
        }

        return nextOrder;
    },

    getItemType() {
        if (document.getElementById('objectPlayerEffect').checked) {
            return document.getElementById('objectEffectType').value.trim();
        }
        return '';
    },

    getNextChairNumber() {
        const usedNumbers = new Set();
        this.level.objects.forEach(obj => {
            if (typeof obj.chair === 'number' && obj.chair > 0) {
                usedNumbers.add(obj.chair);
            }
        });

        let nextNumber = 1;
        while (usedNumbers.has(nextNumber)) {
            nextNumber += 1;
        }

        return nextNumber;
    },

    getChairNumber() {
        if (document.getElementById('objectChair').checked) {
            const num = parseInt(document.getElementById('objectChairNumber').value);
            return isNaN(num) || num < 1 || num > 99 ? null : num;
        }
        return null;
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
            document.getElementById('objectStatic').indeterminate = false;
            document.getElementById('objectSolid').checked = obj.isSolid !== false; // Default to true if not specified
            document.getElementById('objectSolid').indeterminate = false;
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
            } else if (obj.shape === 'triangle') {
                const [a, b, c] = obj.vertices || [];
                if (a) {
                    document.getElementById('objectVertexAX').value = a.x;
                    document.getElementById('objectVertexAY').value = a.y;
                }
                if (b) {
                    document.getElementById('objectVertexBX').value = b.x;
                    document.getElementById('objectVertexBY').value = b.y;
                }
                if (c) {
                    document.getElementById('objectVertexCX').value = c.x;
                    document.getElementById('objectVertexCY').value = c.y;
                }
            }

            // Update property checkboxes
            document.getElementById('objectSpawnpoint').checked = obj.properties.includes('spawnpoint');
            document.getElementById('objectPlayerspawn').checked = obj.properties.includes('playerspawn');
            document.getElementById('objectEmotespawn').checked = obj.properties.includes('emotespawn');
            document.getElementById('objectGoal').checked = obj.properties.includes('goal');
            document.getElementById('objectCheckpoint').checked = obj.properties.includes('checkpoint');
            document.getElementById('objectFinish').checked = obj.properties.includes('finish');
            document.getElementById('objectPlayerEffect').checked = obj.properties.includes('playereffect');
            document.getElementById('objectTeleporter').checked = obj.properties.includes('teleporter');
            document.getElementById('objectChair').checked = obj.chair !== undefined;

            // Show/hide nextLevel field based on goal property
            document.getElementById('nextLevelContainer').style.display =
                obj.properties.includes('goal') ? 'block' : 'none';

            // Show/hide checkpoint order field based on checkpoint property
            document.getElementById('checkpointOrderContainer').style.display =
                obj.properties.includes('checkpoint') ? 'block' : 'none';

            // Show/hide item type field based on item spawn property
            document.getElementById('playerEffectTypeContainer').style.display =
                obj.properties.includes('playereffect') ? 'block' : 'none';

            // Show/hide teleporterTarget field based on teleporter property
            document.getElementById('teleporterTargetContainer').style.display =
                obj.properties.includes('teleporter') ? 'block' : 'none';

            // Show/hide chairNumber field based on chair property
            document.getElementById('chairNumberContainer').style.display =
                obj.chair !== undefined ? 'block' : 'none';

            // Set nextLevel value if it exists
            document.getElementById('objectNextLevel').value = obj.nextLevel || '';

            // Set checkpoint order value if it exists
            document.getElementById('objectCheckpointOrder').value = obj.checkpointOrder || '';

            // Set item type value if it exists
            document.getElementById('objectEffectType').value = obj.itemType || '';

            // Set teleporterTarget value if it exists
            document.getElementById('objectTeleporterTarget').value = obj.teleporterTarget || '';

            // Set chairNumber value if it exists
            document.getElementById('objectChairNumber').value = obj.chair || '';

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
            // For grouped selection, clear all inputs to avoid applying old values
            document.getElementById('objectColor').value = '#888888';
            document.getElementById('objectAlpha').value = 255;
            this.updateAlphaDisplay(255);
            document.getElementById('objectBackgroundImage').value = '';
            // Handle Static checkbox - show common value or indeterminate if mixed
            const staticValues = objects.map(obj => obj.isStatic);
            const allSameStatic = staticValues.every(val => val === staticValues[0]);
            if (allSameStatic) {
                document.getElementById('objectStatic').checked = staticValues[0];
                document.getElementById('objectStatic').indeterminate = false;
            } else {
                document.getElementById('objectStatic').indeterminate = true;
            }

            // Handle Solid checkbox - show common value or indeterminate if mixed
            const solidValues = objects.map(obj => obj.isSolid !== false); // Default to true
            const allSameSolid = solidValues.every(val => val === solidValues[0]);
            if (allSameSolid) {
                document.getElementById('objectSolid').checked = solidValues[0];
                document.getElementById('objectSolid').indeterminate = false;
            } else {
                document.getElementById('objectSolid').indeterminate = true;
            }
            document.getElementById('objectZIndex').value = '';
            document.getElementById('objectFriction').value = '';
            document.getElementById('objectRestitution').value = '';
            document.getElementById('objectDensity').value = '';
            document.getElementById('objectRotation').value = '';
            document.getElementById('objectWidth').value = '';
            document.getElementById('objectHeight').value = '';
            document.getElementById('objectRadius').value = '';
            document.getElementById('objectVertexAX').value = '';
            document.getElementById('objectVertexAY').value = '';
            document.getElementById('objectVertexBX').value = '';
            document.getElementById('objectVertexBY').value = '';
            document.getElementById('objectVertexCX').value = '';
            document.getElementById('objectVertexCY').value = '';
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

        // Properties that can be applied to multiple objects - only include if user has changed from cleared state
        const sharedProperties = {};

        const colorValue = document.getElementById('objectColor').value;
        const alphaValue = parseInt(document.getElementById('objectAlpha').value);

        // Handle alpha changes for multiple objects (preserve individual colors)
        if (this.selectedObjects.length > 1 && alphaValue !== 255) {
            this.selectedObjects.forEach(obj => {
                if (obj.color && obj.color.startsWith('rgba(')) {
                    const rgba = parseRgba(obj.color);
                    if (rgba) {
                        obj.color = `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${alphaValue / 255})`;
                    }
                } else if (obj.color && obj.color.startsWith('#')) {
                    const rgb = hexToRgb(obj.color);
                    if (rgb) {
                        obj.color = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alphaValue / 255})`;
                    }
                }
            });
        }

        // Handle color changes
        if (this.selectedObjects.length === 1 || colorValue !== '#888888') {
            const hexColor = document.getElementById('objectColor').value;
            const alpha = parseInt(document.getElementById('objectAlpha').value);
            const newColor = createRgba(hexColor, alpha);
            sharedProperties.color = newColor;
        }

        if (newBackgroundImage.trim() !== '') {
            sharedProperties.backgroundImage = newBackgroundImage;
        }

        if (!document.getElementById('objectStatic').indeterminate) {
            sharedProperties.isStatic = document.getElementById('objectStatic').checked;
        }
        if (!document.getElementById('objectSolid').indeterminate) {
            sharedProperties.isSolid = document.getElementById('objectSolid').checked;
        }

        const zIndexValue = parseInt(document.getElementById('objectZIndex').value);
        if (!isNaN(zIndexValue)) {
            sharedProperties.zIndex = zIndexValue;
        }

        const frictionValue = parseFloat(document.getElementById('objectFriction').value);
        if (!isNaN(frictionValue)) {
            sharedProperties.friction = frictionValue;
        }

        const restitutionValue = parseFloat(document.getElementById('objectRestitution').value);
        if (!isNaN(restitutionValue)) {
            sharedProperties.restitution = restitutionValue;
        }

        const densityValue = parseFloat(document.getElementById('objectDensity').value);
        if (!isNaN(densityValue)) {
            sharedProperties.density = densityValue;
        }

        const rotationValue = parseFloat(document.getElementById('objectRotation').value);
        if (!isNaN(rotationValue)) {
            sharedProperties.rotation = rotationValue * Math.PI / 180; // Convert to radians
        }

        // Only include shape-specific properties if they are valid numbers (i.e., user has entered values)
        const widthValue = parseInt(document.getElementById('objectWidth').value);
        const heightValue = parseInt(document.getElementById('objectHeight').value);
        const radiusValue = parseInt(document.getElementById('objectRadius').value);
        const vertexAX = parseFloat(document.getElementById('objectVertexAX').value);
        const vertexAY = parseFloat(document.getElementById('objectVertexAY').value);
        const vertexBX = parseFloat(document.getElementById('objectVertexBX').value);
        const vertexBY = parseFloat(document.getElementById('objectVertexBY').value);
        const vertexCX = parseFloat(document.getElementById('objectVertexCX').value);
        const vertexCY = parseFloat(document.getElementById('objectVertexCY').value);
        if (!isNaN(widthValue)) {
            sharedProperties.width = widthValue;
        }
        if (!isNaN(heightValue)) {
            sharedProperties.height = heightValue;
        }
        if (!isNaN(radiusValue)) {
            sharedProperties.radius = radiusValue;
        }
        if (!isNaN(vertexAX) && !isNaN(vertexAY) && !isNaN(vertexBX) && !isNaN(vertexBY) && !isNaN(vertexCX) && !isNaN(vertexCY)) {
            sharedProperties.vertices = [
                { x: vertexAX, y: vertexAY },
                { x: vertexBX, y: vertexBY },
                { x: vertexCX, y: vertexCY }
            ];
        }

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
            } else if (obj.shape === 'triangle') {
                const updatedVertexAX = parseFloat(document.getElementById('objectVertexAX').value);
                const updatedVertexAY = parseFloat(document.getElementById('objectVertexAY').value);
                const updatedVertexBX = parseFloat(document.getElementById('objectVertexBX').value);
                const updatedVertexBY = parseFloat(document.getElementById('objectVertexBY').value);
                const updatedVertexCX = parseFloat(document.getElementById('objectVertexCX').value);
                const updatedVertexCY = parseFloat(document.getElementById('objectVertexCY').value);
                if (!isNaN(updatedVertexAX) && !isNaN(updatedVertexAY) && !isNaN(updatedVertexBX) && !isNaN(updatedVertexBY) && !isNaN(updatedVertexCX) && !isNaN(updatedVertexCY)) {
                    obj.vertices = [
                        { x: updatedVertexAX, y: updatedVertexAY },
                        { x: updatedVertexBX, y: updatedVertexBY },
                        { x: updatedVertexCX, y: updatedVertexCY }
                    ];
                }
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

            // Update checkpoint order for race checkpoints
            const checkpointOrderInput = parseInt(document.getElementById('objectCheckpointOrder').value);
            if (obj.properties.includes('checkpoint') && !isNaN(checkpointOrderInput)) {
                obj.checkpointOrder = checkpointOrderInput;
            } else if (obj.checkpointOrder !== undefined) {
                delete obj.checkpointOrder;
            }

            // Update item type for item spawns
            const itemType = document.getElementById('objectEffectType').value;
            if (obj.properties.includes('playereffect') && itemType) {
                obj.itemType = itemType;
            } else if (obj.itemType !== undefined) {
                delete obj.itemType;
            }

            // Update teleporterTarget property for teleporter objects
            const teleporterTarget = this.getTeleporterTarget();
            if (teleporterTarget) {
                obj.teleporterTarget = teleporterTarget;
            } else if (obj.teleporterTarget) {
                delete obj.teleporterTarget;
            }

            // Update chair property for chair objects
            const chairNumber = this.getChairNumber();
            if (chairNumber !== null) {
                obj.chair = chairNumber;
            } else if (obj.chair !== undefined) {
                delete obj.chair;
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

        // Update color and alpha inputs to reflect the current object color
        if (this.selectedObjects.length === 1) {
            const obj = this.selectedObjects[0];
            let colorHex = obj.color;
            let alpha = 255; // default

            if (obj.color && obj.color.startsWith('rgba(')) {
                const rgba = parseRgba(obj.color);
                if (rgba) {
                    colorHex = rgbToHex(rgba.r, rgba.g, rgba.b);
                    alpha = Math.round(rgba.a * 255);
                }
            } else if (obj.color && obj.color.startsWith('#')) {
                colorHex = obj.color;
                alpha = 255;
            }

            document.getElementById('objectColor').value = colorHex;
            document.getElementById('objectAlpha').value = alpha;
            this.updateAlphaDisplay(alpha);
        }

        this.saveState();
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

            this.saveState();
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
        this.saveState();
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

        this.saveState();
        this.render();
        this.updateJsonDisplay();
    },

    copyObjects() {
        if (this.selectedObjects.length === 0) {
            this.updateStatus('No objects selected to copy');
            return;
        }

        // Deep clone the selected objects
        this.clipboard = JSON.parse(JSON.stringify(this.selectedObjects));
        this.updateStatus(`Copied ${this.selectedObjects.length} object(s)`);
    },

    pasteObjects() {
        if (this.clipboard.length === 0) {
            this.updateStatus('Clipboard is empty');
            return;
        }

        const pastedObjects = [];

        // Create new objects from clipboard with new IDs and offset positions
        this.clipboard.forEach(copiedObj => {
            const newObj = JSON.parse(JSON.stringify(copiedObj));

            // Generate new unique ID
            const baseName = newObj.shape === 'rectangle' ? 'rect' : (newObj.shape === 'circle' ? 'circle' : 'triangle');
            newObj.id = generateUniqueObjectName(baseName, this.level.objects);

            // Offset position slightly so pasted objects are visible
            newObj.x += 20;
            newObj.y += 20;

            // Add to level
            this.level.objects.push(newObj);
            pastedObjects.push(newObj);
        });

        // Select the newly pasted objects
        this.selectObjects(pastedObjects);

        this.saveState();
        this.updateObjectList();
        this.render();
        this.updateJsonDisplay();
        this.updateStatus(`Pasted ${pastedObjects.length} object(s)`);
    }
};
