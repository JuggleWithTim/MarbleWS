// Mouse event handling for the level editor

export const mouse = {
    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Convert display pixels to logical pixels FIRST
        let x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        let y = (e.clientY - rect.top) * (this.canvas.height / rect.height);

        // Now apply inverse transforms in logical pixel space
        // Rendering: translate(panX, panY) -> scale(zoomLevel, zoomLevel)
        // Inverse: undo translate, then undo scale
        
        x -= this.panX;      // panX is in logical pixels
        y -= this.panY;      // panY is in logical pixels
        
        x /= this.zoomLevel;
        y /= this.zoomLevel;

        this.mousePos = { x, y };
        this.dragStart = { x, y };

        if (this.snapToGrid) {
            this.mousePos.x = Math.round(this.mousePos.x / this.gridSize) * this.gridSize;
            this.mousePos.y = Math.round(this.mousePos.y / this.gridSize) * this.gridSize;
        }

        // Store logical coordinates for panning (rect already declared above)
        const logicalX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const logicalY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        this.panStart = { x: logicalX, y: logicalY };

        // Handle point selection mode first
        if (this.pointSelectionMode) {
            this.setPoint(this.mousePos.x, this.mousePos.y);
            return;
        }

        switch (this.currentTool) {
            case 'select':
                this.handleSelect(this.mousePos.x, this.mousePos.y);
                break;
            case 'rectangle':
                this.createRectangle(this.mousePos.x, this.mousePos.y);
                break;
            case 'circle':
                this.createCircle(this.mousePos.x, this.mousePos.y);
                break;
            case 'triangle':
                this.createTriangle(this.mousePos.x, this.mousePos.y);
                break;
            case 'connect':
                this.handleConnect(this.mousePos.x, this.mousePos.y);
                break;
            case 'delete':
                this.handleDelete(this.mousePos.x, this.mousePos.y);
                break;
        }
    },

    onMouseMove(e) {
        try {
            const rect = this.canvas.getBoundingClientRect();
            // Convert display pixels to logical pixels FIRST
            let x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            let y = (e.clientY - rect.top) * (this.canvas.height / rect.height);

            // Now apply inverse transforms in logical pixel space
            // Rendering: translate(panX, panY) -> scale(zoomLevel, zoomLevel)
            // Inverse: undo translate, then undo scale
            
            x -= this.panX;      // panX is in logical pixels
            y -= this.panY;      // panY is in logical pixels
            
            x /= this.zoomLevel;
            y /= this.zoomLevel;

            this.mousePos = { x, y };

            if (this.snapToGrid) {
                this.mousePos.x = Math.round(this.mousePos.x / this.gridSize) * this.gridSize;
                this.mousePos.y = Math.round(this.mousePos.y / this.gridSize) * this.gridSize;
            }

            // Update mouse position display (show logical coordinates)
            const mousePosElement = document.getElementById('mousePos');
            if (mousePosElement) {
                mousePosElement.textContent = `Mouse: ${Math.round(this.mousePos.x)}, ${Math.round(this.mousePos.y)}`;
            }

            // Handle resizing
            if (this.isResizing) {
                this.performResize(this.mousePos.x, this.mousePos.y, e.shiftKey);
                return;
            }

            // Handle rotation
            if (this.isRotating) {
                this.performRotation(this.mousePos.x, this.mousePos.y);
                return;
            }

            // Handle panning (CTRL + drag)
            if (this.isPanning) {
                // Get current logical coordinates
                const currentLogicalX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
                const currentLogicalY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

                // Calculate delta in logical space (panStart is in logical coordinates)
                const logicalDeltaX = currentLogicalX - this.panStart.x;
                const logicalDeltaY = currentLogicalY - this.panStart.y;

                // Update pan (panX/panY are in logical pixel space)
                this.panX += logicalDeltaX;
                this.panY += logicalDeltaY;

                // Update panStart to current logical position
                this.panStart.x = currentLogicalX;
                this.panStart.y = currentLogicalY;

                this.render();
                return;
            }

            // Handle dragging
            if (this.isDragging && this.selectedObjects.length > 0) {
                // Move all selected objects together, maintaining their relative positions to the mouse
                this.selectedObjects.forEach(obj => {
                    const offset = this.dragOffsets.get(obj);
                    obj.x = this.mousePos.x + offset.x;
                    obj.y = this.mousePos.y + offset.y;
                });
                this.render();
                return;
            }

            // Handle area selection rectangle
            if (this.isAreaSelecting) {
                this.render();
                return;
            }

            // Update cursor based on resize handles
            this.updateCursor();
        } catch (error) {
            console.error('Error in onMouseMove:', error);
            this.resetCursor();
        }
    },

    onMouseUp(e) {
        // Handle area selection completion
        if (this.isAreaSelecting) {
            this.completeAreaSelection();
            this.isAreaSelecting = false;
            this.render();
            return;
        }

        // Save state if we were dragging objects
        if (this.isDragging) {
            this.saveState();
        }

        this.isDragging = false;
        this.isPanning = false;
        this.isResizing = false;
        this.resizeCorner = null;
        this.originalSize = null;
        this.isRotating = false;
        this.initialRotation = 0;
        this.initialMouseAngle = 0;
        this.updateStatus('Ready');
    },

    handleSelect(x, y) {
        // If CTRL is pressed, start panning instead of selecting
        if (this.ctrlKey) {
            this.isPanning = true;
            return;
        }

        // First check if clicking on any handle (only if we have a single selected object for now)
        if (this.selectedObjects.length === 1) {
            const handle = this.getHandleAt(x, y);
            if (handle) {
                if (handle === 'rotation') {
                    this.startRotating(x, y);
                } else {
                    this.startResizing(handle);
                }
                return;
            }
        }

        const clickedObject = this.getObjectAt(x, y);

        if (clickedObject) {
            const isAlreadySelected = this.selectedObjects.includes(clickedObject);

            if (isAlreadySelected) {
                if (this.shiftKey) {
                    // Shift+click on selected object - remove from selection
                    this.toggleObjectSelection(clickedObject);
                } else {
                    // Regular click on selected object - set up dragging for entire selection
                    this.isDragging = true;
                    // Store offsets from mouse position for dragging all selected objects
                    this.dragOffsets.clear();
                    this.selectedObjects.forEach(obj => {
                        this.dragOffsets.set(obj, { x: obj.x - this.dragStart.x, y: obj.y - this.dragStart.y });
                    });
                }
            } else {
                // Clicking on an unselected object
                if (this.shiftKey) {
                    // Shift+click on unselected object - add to selection
                    this.toggleObjectSelection(clickedObject);
                } else {
                    // Regular click on unselected object - replace selection
                    this.selectObject(clickedObject);
                }
                // Set up dragging for the new selection
                this.isDragging = true;
                this.dragOffsets.clear();
                this.selectedObjects.forEach(obj => {
                    this.dragOffsets.set(obj, { x: obj.x - this.dragStart.x, y: obj.y - this.dragStart.y });
                });
            }
        } else {
            // Start area selection if clicking on empty space
            this.isAreaSelecting = true;
            this.areaSelectStart = { x, y };
            // Clear selection if not holding shift
            if (!this.shiftKey) {
                this.selectObjects([]);
            }
        }
    },

    completeAreaSelection() {
        const startX = Math.min(this.areaSelectStart.x, this.mousePos.x);
        const startY = Math.min(this.areaSelectStart.y, this.mousePos.y);
        const endX = Math.max(this.areaSelectStart.x, this.mousePos.x);
        const endY = Math.max(this.areaSelectStart.y, this.mousePos.y);

        const selectedObjects = [];

        // Find all objects within the selection rectangle
        this.level.objects.forEach(obj => {
            if (this.isObjectInRectangle(obj, startX, startY, endX, endY)) {
                selectedObjects.push(obj);
            }
        });

        this.selectObjects(selectedObjects);
        this.updateStatus(`Selected ${selectedObjects.length} object(s)`);
    },

    isObjectInRectangle(obj, rectX1, rectY1, rectX2, rectY2) {
        if (obj.shape === 'rectangle') {
            // Check if any corner of the rectangle is inside the selection rectangle
            const corners = [
                { x: obj.x - obj.width/2, y: obj.y - obj.height/2 },
                { x: obj.x + obj.width/2, y: obj.y - obj.height/2 },
                { x: obj.x - obj.width/2, y: obj.y + obj.height/2 },
                { x: obj.x + obj.width/2, y: obj.y + obj.height/2 }
            ];

            // Apply rotation to corners if needed
            if (obj.rotation && obj.rotation !== 0) {
                const cos = Math.cos(obj.rotation);
                const sin = Math.sin(obj.rotation);
                corners.forEach(corner => {
                    const dx = corner.x - obj.x;
                    const dy = corner.y - obj.y;
                    corner.x = obj.x + dx * cos - dy * sin;
                    corner.y = obj.y + dx * sin + dy * cos;
                });
            }

            return corners.some(corner =>
                corner.x >= rectX1 && corner.x <= rectX2 &&
                corner.y >= rectY1 && corner.y <= rectY2
            );
        } else if (obj.shape === 'circle') {
            // For circles, check if the center is in the rectangle or if the circle intersects the rectangle
            const centerInRect = obj.x >= rectX1 && obj.x <= rectX2 && obj.y >= rectY1 && obj.y <= rectY2;
            if (centerInRect) return true;

            // Check if circle intersects rectangle edges
            const closestX = Math.max(rectX1, Math.min(obj.x, rectX2));
            const closestY = Math.max(rectY1, Math.min(obj.y, rectY2));
            const distance = Math.sqrt(Math.pow(obj.x - closestX, 2) + Math.pow(obj.y - closestY, 2));

            return distance <= obj.radius;
        } else if (obj.shape === 'triangle') {
            const vertices = this.getTriangleWorldVertices(obj);
            return vertices.some(vertex =>
                vertex.x >= rectX1 && vertex.x <= rectX2 &&
                vertex.y >= rectY1 && vertex.y <= rectY2
            );
        }

        return false;
    },

    handleConnect(x, y) {
        const clickedObject = this.getObjectAt(x, y);

        if (clickedObject) {
            if (!this.connectionStart) {
                // First click - select starting object and store click position relative to center
                this.connectionStart = clickedObject;
                this.connectionStartPoint = this.getRelativeClickPosition(clickedObject, x, y);
                this.updateStatus(`Connecting from: ${clickedObject.id}`);
            } else if (this.connectionStart === clickedObject) {
                // Clicked same object - cancel connection
                this.connectionStart = null;
                this.connectionStartPoint = null;
                this.updateStatus('Connection cancelled');
            } else {
                // Second click - create connection between the two objects
                const endPoint = this.getRelativeClickPosition(clickedObject, x, y);
                this.createConnection(this.connectionStart, clickedObject, this.connectionStartPoint, endPoint);
                this.connectionStart = null;
                this.connectionStartPoint = null;
                this.updateStatus('Connection created. Click another object to start a new connection.');
            }
        } else if (this.connectionStart) {
            // Clicked empty space - cancel connection
            this.connectionStart = null;
            this.connectionStartPoint = null;
            this.updateStatus('Connection cancelled');
        }
    },

    handleDelete(x, y) {
        const clickedObject = this.getObjectAt(x, y);
        if (clickedObject) {
            this.deleteObject(clickedObject);
        }
    },

    getObjectAt(x, y) {
        // Check objects in reverse order (top to bottom)
        for (let i = this.level.objects.length - 1; i >= 0; i--) {
            const obj = this.level.objects[i];

            if (obj.shape === 'rectangle') {
                // Apply inverse rotation to click coordinates for rotated rectangles
                let checkX = x;
                let checkY = y;

                if (obj.rotation && obj.rotation !== 0) {
                    const cos = Math.cos(-obj.rotation);
                    const sin = Math.sin(-obj.rotation);
                    const dx = x - obj.x;
                    const dy = y - obj.y;
                    checkX = dx * cos - dy * sin + obj.x;
                    checkY = dx * sin + dy * cos + obj.y;
                }

                if (checkX >= obj.x - obj.width/2 && checkX <= obj.x + obj.width/2 &&
                    checkY >= obj.y - obj.height/2 && checkY <= obj.y + obj.height/2) {
                    return obj;
                }
            } else if (obj.shape === 'circle') {
                const distance = Math.sqrt(Math.pow(x - obj.x, 2) + Math.pow(y - obj.y, 2));
                if (distance <= obj.radius) {
                    return obj;
                }
            } else if (obj.shape === 'triangle') {
                const localPoint = this.getTriangleLocalPoint(obj, x, y);
                if (this.isPointInTriangle(localPoint, obj.vertices || [])) {
                    return obj;
                }
            }
        }

        return null;
    },

    getRelativeClickPosition(obj, clickX, clickY) {
        // Calculate click position relative to object center
        let relativeX = clickX - obj.x;
        let relativeY = clickY - obj.y;

        // If object has rotation, we need to apply inverse rotation to get the relative position
        // in the object's local coordinate system
        if (obj.rotation && obj.rotation !== 0) {
            const cos = Math.cos(-obj.rotation);
            const sin = Math.sin(-obj.rotation);

            const rotatedX = relativeX * cos - relativeY * sin;
            const rotatedY = relativeX * sin + relativeY * cos;

            relativeX = rotatedX;
            relativeY = rotatedY;
        }

        return { x: relativeX, y: relativeY };
    },

    getHandleAt(x, y) {
        if (this.selectedObjects.length !== 1) return null;

        const obj = this.selectedObjects[0];
        const handleSize = this.resizeHandleSize;

        // Check rotation handle first - need to account for object rotation
        let rotationHandleX = obj.x;
        let rotationHandleHeight = Math.max(obj.width || obj.radius * 2, obj.height || obj.radius * 2);
        if (obj.shape === 'triangle') {
            const bounds = this.getTriangleBoundsLocal(obj);
            rotationHandleHeight = bounds.maxY - bounds.minY;
        }
        let rotationHandleY = obj.y - rotationHandleHeight / 2 - 30;

        // If object has rotation, we need to transform the mouse coordinates
        // by the inverse rotation to check against the handle position
        let checkX = x;
        let checkY = y;

        if (obj.rotation && obj.rotation !== 0) {
            // Apply inverse rotation to mouse coordinates
            const cos = Math.cos(-obj.rotation);
            const sin = Math.sin(-obj.rotation);

            // Translate to object center
            const dx = x - obj.x;
            const dy = y - obj.y;

            // Apply inverse rotation
            checkX = dx * cos - dy * sin + obj.x;
            checkY = dx * sin + dy * cos + obj.y;
        }

        if (checkX >= rotationHandleX - handleSize && checkX <= rotationHandleX + handleSize &&
            checkY >= rotationHandleY - handleSize && checkY <= rotationHandleY + handleSize) {
            return 'rotation';
        }

        // If object has rotation, we need to transform the mouse coordinates
        // by the inverse rotation to check against the unrotated handle positions
        if (obj.rotation && obj.rotation !== 0) {
            // Apply inverse rotation to mouse coordinates
            const cos = Math.cos(-obj.rotation);
            const sin = Math.sin(-obj.rotation);

            // Translate to object center
            const dx = x - obj.x;
            const dy = y - obj.y;

            // Apply inverse rotation
            checkX = dx * cos - dy * sin + obj.x;
            checkY = dx * sin + dy * cos + obj.y;
        }

        if (obj.shape === 'rectangle') {
            // Check all 4 corners in the unrotated coordinate system
            const corners = [
                { name: 'nw', x: obj.x - obj.width/2, y: obj.y - obj.height/2 },
                { name: 'ne', x: obj.x + obj.width/2, y: obj.y - obj.height/2 },
                { name: 'sw', x: obj.x - obj.width/2, y: obj.y + obj.height/2 },
                { name: 'se', x: obj.x + obj.width/2, y: obj.y + obj.height/2 }
            ];

            for (const corner of corners) {
                if (checkX >= corner.x - handleSize && checkX <= corner.x + handleSize &&
                    checkY >= corner.y - handleSize && checkY <= corner.y + handleSize) {
                    return corner.name;
                }
            }
        } else if (obj.shape === 'circle') {
            // For circles, use a single resize handle on the right edge
            const handleX = obj.x + obj.radius;
            const handleY = obj.y;

            if (checkX >= handleX - handleSize && checkX <= handleX + handleSize &&
                checkY >= handleY - handleSize && checkY <= handleY + handleSize) {
                return 'radius';
            }
        } else if (obj.shape === 'triangle') {
            const bounds = this.getTriangleBoundsLocal(obj);
            const corners = [
                { name: 'nw', x: bounds.minX, y: bounds.minY },
                { name: 'ne', x: bounds.maxX, y: bounds.minY },
                { name: 'sw', x: bounds.minX, y: bounds.maxY },
                { name: 'se', x: bounds.maxX, y: bounds.maxY }
            ];

            for (const corner of corners) {
                if (checkX >= corner.x - handleSize && checkX <= corner.x + handleSize &&
                    checkY >= corner.y - handleSize && checkY <= corner.y + handleSize) {
                    return corner.name;
                }
            }
        }

        return null;
    },

    getTriangleLocalPoint(obj, x, y) {
        let localX = x - obj.x;
        let localY = y - obj.y;

        if (obj.rotation && obj.rotation !== 0) {
            const cos = Math.cos(-obj.rotation);
            const sin = Math.sin(-obj.rotation);
            const rotatedX = localX * cos - localY * sin;
            const rotatedY = localX * sin + localY * cos;
            localX = rotatedX;
            localY = rotatedY;
        }

        return { x: localX, y: localY };
    },

    getTriangleWorldVertices(obj) {
        const vertices = obj.vertices || [];
        return vertices.map(vertex => {
            let vx = vertex.x;
            let vy = vertex.y;

            if (obj.rotation && obj.rotation !== 0) {
                const cos = Math.cos(obj.rotation);
                const sin = Math.sin(obj.rotation);
                const rotatedX = vx * cos - vy * sin;
                const rotatedY = vx * sin + vy * cos;
                vx = rotatedX;
                vy = rotatedY;
            }

            return { x: obj.x + vx, y: obj.y + vy };
        });
    },

    getTriangleBoundsLocal(obj) {
        const vertices = obj.vertices || [];
        const xs = vertices.map(vertex => obj.x + vertex.x);
        const ys = vertices.map(vertex => obj.y + vertex.y);
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys)
        };
    },

    isPointInTriangle(point, vertices) {
        if (!vertices || vertices.length < 3) return false;

        const [a, b, c] = vertices;
        const area = (p1, p2, p3) =>
            Math.abs((p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2);

        const totalArea = area(a, b, c);
        const area1 = area(point, b, c);
        const area2 = area(a, point, c);
        const area3 = area(a, b, point);

        return Math.abs(totalArea - (area1 + area2 + area3)) < 0.5;
    },

    createConnection(objA, objB, pointA, pointB) {
        // Get selected connection type from dropdown
        const connectionType = document.getElementById('connectionType').value;

        // Calculate the actual attachment points in world coordinates
        let attachPointA = { x: objA.x, y: objA.y };
        let attachPointB = { x: objB.x, y: objB.y };

        // Apply pointA offset to object A
        if (pointA) {
            if (objA.rotation && objA.rotation !== 0) {
                // Apply rotation to the offset point
                const cos = Math.cos(objA.rotation);
                const sin = Math.sin(objA.rotation);
                attachPointA.x += pointA.x * cos - pointA.y * sin;
                attachPointA.y += pointA.x * sin + pointA.y * cos;
            } else {
                attachPointA.x += pointA.x;
                attachPointA.y += pointA.y;
            }
        }

        // Apply pointB offset to object B
        if (pointB) {
            if (objB.rotation && objB.rotation !== 0) {
                // Apply rotation to the offset point
                const cos = Math.cos(objB.rotation);
                const sin = Math.sin(objB.rotation);
                attachPointB.x += pointB.x * cos - pointB.y * sin;
                attachPointB.y += pointB.x * sin + pointB.y * cos;
            } else {
                attachPointB.x += pointB.x;
                attachPointB.y += pointB.y;
            }
        }

        // For Glue connections, adjust points to be at the same world coordinates
        if (connectionType === 'glue') {
            // Use the attachment point from object A as the common connection point
            const commonPoint = attachPointA;

            // Calculate new relative points for both objects to this common point
            pointA = {
                x: commonPoint.x - objA.x,
                y: commonPoint.y - objA.y
            };
            pointB = {
                x: commonPoint.x - objB.x,
                y: commonPoint.y - objB.y
            };

            // If objects have rotation, we need to apply inverse rotation to get local coordinates
            if (objA.rotation && objA.rotation !== 0) {
                const cos = Math.cos(-objA.rotation);
                const sin = Math.sin(-objA.rotation);
                const rotatedX = pointA.x * cos - pointA.y * sin;
                const rotatedY = pointA.x * sin + pointA.y * cos;
                pointA = { x: rotatedX, y: rotatedY };
            }

            if (objB.rotation && objB.rotation !== 0) {
                const cos = Math.cos(-objB.rotation);
                const sin = Math.sin(-objB.rotation);
                const rotatedX = pointB.x * cos - pointB.y * sin;
                const rotatedY = pointB.x * sin + pointB.y * cos;
                pointB = { x: rotatedX, y: rotatedY };
            }

            // Both attachment points are now the same
            attachPointB = commonPoint;
        }

        // Calculate the actual distance between attachment points
        const length = Math.sqrt(Math.pow(attachPointB.x - attachPointA.x, 2) + Math.pow(attachPointB.y - attachPointA.y, 2));

        // Create connection properties based on type
        const connection = {
            id: `connection_${this.connectionIdCounter++}`,
            type: connectionType,
            bodyA: objA.id,
            bodyB: objB.id,
            pointA: pointA, // Use the captured click position relative to object center
            pointB: pointB, // Use the captured click position relative to object center
            length: length, // Distance between actual attachment points
            stiffness: 1,
            damping: 0.1
        };

        // Adjust properties based on connection type
        switch (connectionType) {
            case 'revolute':
                // Revolute joint - fixed stiffness, low damping
                connection.stiffness = 1;
                connection.damping = 0.1;
                break;
            case 'rope':
                // Rope - no stiffness (slack), low damping
                connection.stiffness = 0;
                connection.damping = 0.05;
                break;
            case 'spring':
                // Spring - medium stiffness, medium damping
                connection.stiffness = 0.1;
                connection.damping = 0.05;
                break;
            case 'distance':
                // Distance - high stiffness (fixed length), low damping
                connection.stiffness = 1;
                connection.damping = 0.1;
                break;
            case 'glue':
                // Glue - rope with length 1 (extremely rigid)
                connection.stiffness = 0;
                connection.damping = 0;
                break;
        }

        // Initialize connections array if it doesn't exist
        if (!this.level.connections) {
            this.level.connections = [];
        }

        this.level.connections.push(connection);
        this.saveState();

        // Update remove connections button visibility for both connected objects
        this.updateRemoveConnectionsButtonVisibility();

        this.render();
        this.updateJsonDisplay();
        this.updateStatus(`Created ${connection.type} connection: ${objA.id} ↔ ${objB.id}`);
    }
};
