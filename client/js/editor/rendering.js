// Canvas rendering functionality

export const rendering = {
    validateCanvasState() {
        if (!this.canvas) {
            console.error('Canvas element not found');
            return false;
        }
        if (!this.ctx) {
            console.error('Canvas context not available');
            return false;
        }
        return true;
    },

    render() {
        try {
            if (!this.validateCanvasState()) {
                console.error('Canvas state invalid, skipping render');
                return;
            }

            // Clear canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // Apply zoom and pan transformation
            this.ctx.save();
            // Apply zoom/pan in the logical coordinate space
            this.ctx.translate(this.panX, this.panY);
            this.ctx.scale(this.zoomLevel, this.zoomLevel);

            // Get world bounds for background scaling
            const levelWidth = this.level.levelWidth || 1920;
            const levelHeight = this.level.levelHeight || 1080;

            // Draw background
            if (this.backgroundImage) {
                // Draw the background image scaled to world bounds for consistency
                this.ctx.drawImage(this.backgroundImage, 0, 0, levelWidth, levelHeight);

                // Add a slight overlay to ensure objects are visible
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                this.ctx.fillRect(0, 0, levelWidth, levelHeight);
            } else {
                // Draw default gradient background covering the entire world
                const gradient = this.ctx.createLinearGradient(0, 0, 0, levelHeight);
                gradient.addColorStop(0, '#1a1a2e');
                gradient.addColorStop(1, '#16213e');
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(0, 0, levelWidth, levelHeight);
            }

            // Draw world boundaries (always show for visual feedback)
            this.drawWorldBoundaries();

            // Draw grid
            if (this.showGrid) {
                this.drawGrid();
            }

            // Sort level objects by zIndex (if present) before rendering
            const sortedObjects = [...this.level.objects].sort((a, b) => {
                return (a.zIndex || 0) - (b.zIndex || 0);
            });

            // Draw objects
            sortedObjects.forEach(obj => {
                this.drawObject(obj);
            });

            // Highlight selected objects
            if (this.selectedObjects.length > 0) {
                this.selectedObjects.forEach(obj => {
                    this.drawObjectOutline(obj);
                });
            }

            // Draw area selection rectangle
            if (this.isAreaSelecting) {
                this.drawAreaSelectionRectangle();
            }

            // Draw connections on top (always visible)
            if (this.level.connections) {
                this.level.connections.forEach(connection => {
                    this.drawConnection(connection);
                });
            }

            // Restore the zoom and pan transformation
            this.ctx.restore();
        } catch (error) {
            console.error('Error in render:', error);
            // If there's an error, make sure we restore the context
            this.ctx.restore();
        }
    },

    drawWorldBoundaries() {
        const levelWidth = this.level.levelWidth || 1920;
        const levelHeight = this.level.levelHeight || 1080;

        // Draw world boundary rectangle
        this.ctx.strokeStyle = 'rgba(255, 165, 0, 0.7)'; // Orange color for world boundaries
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([10, 5]);
        this.ctx.strokeRect(0, 0, levelWidth, levelHeight);

        // Reset line dash
        this.ctx.setLineDash([]);

        // Draw dimension labels
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';

        // Top center label
        this.ctx.fillText(`${levelWidth} x ${levelHeight}`, levelWidth / 2, -10);

        // Bottom right corner label (show it's the world size)
        this.ctx.fillStyle = 'rgba(255, 165, 0, 0.9)';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.fillText('WORLD BOUNDS', levelWidth - 10, levelHeight - 10);
    },

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;

        const levelWidth = this.level.levelWidth || 1920;
        const levelHeight = this.level.levelHeight || 1080;

        // Vertical lines covering the entire world bounds
        for (let x = 0; x <= levelWidth; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, levelHeight);
            this.ctx.stroke();
        }

        // Horizontal lines covering the entire world bounds
        for (let y = 0; y <= levelHeight; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(levelWidth, y);
            this.ctx.stroke();
        }
    },

    drawObject(obj) {
        this.ctx.save(); // Save current context state

        // Apply rotation if object has rotation
        if (obj.rotation && obj.rotation !== 0) {
            this.ctx.translate(obj.x, obj.y);
            this.ctx.rotate(obj.rotation);
            this.ctx.translate(-obj.x, -obj.y);
        }

        // Check if object has a background image
        if (obj.backgroundImage) {
            // Try to get the image from cache or load it
            if (!this.objectImages.has(obj.backgroundImage)) {
                this.loadObjectImage(obj.backgroundImage);
            }

            const image = this.objectImages.get(obj.backgroundImage);

            if (image instanceof HTMLImageElement) {
                // Draw the background image
                if (obj.shape === 'rectangle') {
                    this.ctx.drawImage(
                        image,
                        obj.x - obj.width/2,
                        obj.y - obj.height/2,
                        obj.width,
                        obj.height
                    );
                } else if (obj.shape === 'circle') {
                    // For circles, we need to clip the image to a circle shape
                    this.ctx.save();
                    this.ctx.beginPath();
                    this.ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
                    this.ctx.clip();

                    this.ctx.drawImage(
                        image,
                        obj.x - obj.radius,
                        obj.y - obj.radius,
                        obj.radius * 2,
                        obj.radius * 2
                    );
                    this.ctx.restore();
                } else if (obj.shape === 'triangle') {
                    const vertices = this.getTriangleWorldVertices(obj);
                    this.ctx.save();
                    this.ctx.beginPath();
                    this.ctx.moveTo(vertices[0].x, vertices[0].y);
                    this.ctx.lineTo(vertices[1].x, vertices[1].y);
                    this.ctx.lineTo(vertices[2].x, vertices[2].y);
                    this.ctx.closePath();
                    this.ctx.clip();

                    const bounds = this.getTriangleBounds(obj);
                    this.ctx.drawImage(
                        image,
                        bounds.minX,
                        bounds.minY,
                        bounds.maxX - bounds.minX,
                        bounds.maxY - bounds.minY
                    );
                    this.ctx.restore();
                }
            } else {
                // Image is still loading or failed to load, use color as fallback
                this.ctx.fillStyle = obj.color;

                if (obj.shape === 'rectangle') {
                    this.ctx.fillRect(
                        obj.x - obj.width/2,
                        obj.y - obj.height/2,
                        obj.width,
                        obj.height
                    );
                } else if (obj.shape === 'circle') {
                    this.ctx.beginPath();
                    this.ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
                    this.ctx.fill();
                } else if (obj.shape === 'triangle') {
                    this.drawTrianglePath(obj);
                    this.ctx.fill();
                }
            }
        } else {
            // No background image, just use color
            let fillColor = obj.color;

            // If viewTransparent is enabled, override alpha for transparent objects
            if (this.viewTransparent) {
                // Parse the color to check if it's transparent
                if (typeof obj.color === 'string' && obj.color.startsWith('rgba(')) {
                    const rgbaMatch = obj.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                    if (rgbaMatch && rgbaMatch[4]) {
                        const alpha = parseFloat(rgbaMatch[4]);
                        if (alpha < 1.0) {
                            // Override to 50% opacity for editor visibility
                            fillColor = `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, 0.5)`;
                        }
                    }
                }
            }

            this.ctx.fillStyle = fillColor;

            if (obj.shape === 'rectangle') {
                this.ctx.fillRect(
                    obj.x - obj.width/2,
                    obj.y - obj.height/2,
                    obj.width,
                    obj.height
                );
            } else if (obj.shape === 'circle') {
                this.ctx.beginPath();
                this.ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (obj.shape === 'triangle') {
                this.drawTrianglePath(obj);
                this.ctx.fill();
            }
        }

        // Draw static indicator (before restore so it rotates with the object)
        if (!obj.isStatic) {
            this.ctx.strokeStyle = '#4ecdc4';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);

            if (obj.shape === 'rectangle') {
                this.ctx.strokeRect(
                    obj.x - obj.width/2,
                    obj.y - obj.height/2,
                    obj.width,
                    obj.height
                );
            } else if (obj.shape === 'circle') {
                this.ctx.beginPath();
                this.ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
                this.ctx.stroke();
            } else if (obj.shape === 'triangle') {
                this.drawTrianglePath(obj);
                this.ctx.stroke();
            }

            this.ctx.setLineDash([]);
        }

        this.ctx.restore(); // Restore context state

        // Draw property indicators
        if (obj.properties.includes('spawnpoint')) {
            this.ctx.fillStyle = '#00ff00';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('SPAWN', obj.x, obj.y - 20);
        }

        if (obj.properties.includes('playerspawn')) {
            this.ctx.fillStyle = '#4ecdc4';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PLAYER', obj.x, obj.y - 20);
        }

        if (obj.properties.includes('goal')) {
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GOAL', obj.x, obj.y - 20);
        }

        if (obj.properties.includes('emotespawn')) {
            this.ctx.fillStyle = '#ff00ff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('EMOTE', obj.x, obj.y - 20);
        }

        if (obj.properties.includes('teleporter')) {
            this.ctx.fillStyle = '#00ffff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('TELEPORTER', obj.x, obj.y - 20);
        }

        if (obj.properties.includes('checkpoint')) {
            const checkpointLabel = obj.checkpointOrder !== undefined
                ? `CP ${obj.checkpointOrder}`
                : 'CHECKPOINT';
            this.ctx.save();
            this.ctx.fillStyle = '#4ecdc4';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(checkpointLabel, obj.x, obj.y - 30);
            this.ctx.restore();
        }

        if (obj.properties.includes('finish')) {
            this.ctx.save();
            this.ctx.fillStyle = '#ff6b6b';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('FINISH', obj.x, obj.y - 35);
            this.ctx.restore();
        }
    },

    drawObjectOutline(obj) {
        this.ctx.save(); // Save context state

        // Apply the same rotation transformation as drawObject
        if (obj.rotation && obj.rotation !== 0) {
            this.ctx.translate(obj.x, obj.y);
            this.ctx.rotate(obj.rotation);
            this.ctx.translate(-obj.x, -obj.y);
        }

        this.ctx.strokeStyle = '#ff6b6b';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([]);

        if (obj.shape === 'rectangle') {
            this.ctx.strokeRect(
                obj.x - obj.width/2 - 2,
                obj.y - obj.height/2 - 2,
                obj.width + 4,
                obj.height + 4
            );

            // Only draw resize handles if this is the only selected object
            if (this.selectedObjects.length === 1) {
                this.ctx.fillStyle = '#ff6b6b';
                const handleSize = this.resizeHandleSize;
                const corners = [
                    { x: obj.x - obj.width/2, y: obj.y - obj.height/2 },
                    { x: obj.x + obj.width/2, y: obj.y - obj.height/2 },
                    { x: obj.x - obj.width/2, y: obj.y + obj.height/2 },
                    { x: obj.x + obj.width/2, y: obj.y + obj.height/2 }
                ];

                corners.forEach(corner => {
                    this.ctx.fillRect(
                        corner.x - handleSize/2,
                        corner.y - handleSize/2,
                        handleSize,
                        handleSize
                    );
                });
            }
        } else if (obj.shape === 'circle') {
            this.ctx.beginPath();
            this.ctx.arc(obj.x, obj.y, obj.radius + 2, 0, Math.PI * 2);
            this.ctx.stroke();

            // Only draw resize handle if this is the only selected object
            if (this.selectedObjects.length === 1) {
                this.ctx.fillStyle = '#ff6b6b';
                const handleSize = this.resizeHandleSize;
                const handleX = obj.x + obj.radius;
                const handleY = obj.y;

                this.ctx.fillRect(
                    handleX - handleSize/2,
                    handleY - handleSize/2,
                    handleSize,
                    handleSize
                );
            }
        } else if (obj.shape === 'triangle') {
            this.drawTrianglePath(obj, 2);
            this.ctx.stroke();

            if (this.selectedObjects.length === 1) {
                const bounds = this.getTriangleBounds(obj);
                this.ctx.fillStyle = '#ff6b6b';
                const handleSize = this.resizeHandleSize;
                const corners = [
                    { x: bounds.minX, y: bounds.minY },
                    { x: bounds.maxX, y: bounds.minY },
                    { x: bounds.minX, y: bounds.maxY },
                    { x: bounds.maxX, y: bounds.maxY }
                ];

                corners.forEach(corner => {
                    this.ctx.fillRect(
                        corner.x - handleSize/2,
                        corner.y - handleSize/2,
                        handleSize,
                        handleSize
                    );
                });
            }
        }

        // Only draw rotation handle if this is the only selected object
        if (this.selectedObjects.length === 1) {
            this.ctx.fillStyle = '#ff6b6b';
            const handleSize = this.resizeHandleSize;
            const rotationHandleX = obj.x;
            const boundsForHandle = this.getObjectBounds(obj);
            const rotationHandleY = obj.y - (boundsForHandle.maxY - boundsForHandle.minY) / 2 - 30;

            this.ctx.fillRect(
                rotationHandleX - handleSize/2,
                rotationHandleY - handleSize/2,
                handleSize,
                handleSize
            );

            // Draw line from object center to rotation handle
            this.ctx.strokeStyle = '#ff6b6b';
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([3, 3]);
            this.ctx.beginPath();
            this.ctx.moveTo(obj.x, obj.y);
            this.ctx.lineTo(rotationHandleX, rotationHandleY);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        // Draw active points if object is active
        if (obj.active) {
            // Draw rotation point
            if (obj.rotationPoint) {
                let rotationPointX = obj.x + obj.rotationPoint.x;
                let rotationPointY = obj.y + obj.rotationPoint.y;

                // Apply rotation to rotation point
                if (obj.rotation && obj.rotation !== 0) {
                    const cos = Math.cos(obj.rotation);
                    const sin = Math.sin(obj.rotation);
                    const rotatedX = obj.rotationPoint.x * cos - obj.rotationPoint.y * sin;
                    const rotatedY = obj.rotationPoint.x * sin + obj.rotationPoint.y * cos;
                    rotationPointX = obj.x + rotatedX;
                    rotationPointY = obj.y + rotatedY;
                }

                this.ctx.fillStyle = '#ffff00'; // Yellow for rotation point
                this.ctx.beginPath();
                this.ctx.arc(rotationPointX, rotationPointY, 6, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.strokeStyle = '#ffff00';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();

                // Label rotation point
                this.ctx.fillStyle = '#000000';
                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('R', rotationPointX, rotationPointY - 10);
            }

            // Draw point A
            if (obj.pointA) {
                let pointAX = obj.x + obj.pointA.x;
                let pointAY = obj.y + obj.pointA.y;

                // Apply rotation to point A
                if (obj.rotation && obj.rotation !== 0) {
                    const cos = Math.cos(obj.rotation);
                    const sin = Math.sin(obj.rotation);
                    const rotatedX = obj.pointA.x * cos - obj.pointA.y * sin;
                    const rotatedY = obj.pointA.x * sin + obj.pointA.y * cos;
                    pointAX = obj.x + rotatedX;
                    pointAY = obj.y + rotatedY;
                }

                this.ctx.fillStyle = '#00ff00'; // Green for point A
                this.ctx.beginPath();
                this.ctx.arc(pointAX, pointAY, 6, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.strokeStyle = '#00ff00';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();

                // Label point A
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('A', pointAX, pointAY - 10);
            }

            // Draw point B
            if (obj.pointB) {
                let pointBX = obj.x + obj.pointB.x;
                let pointBY = obj.y + obj.pointB.y;

                // Apply rotation to point B
                if (obj.rotation && obj.rotation !== 0) {
                    const cos = Math.cos(obj.rotation);
                    const sin = Math.sin(obj.rotation);
                    const rotatedX = obj.pointB.x * cos - obj.pointB.y * sin;
                    const rotatedY = obj.pointB.x * sin + obj.pointB.y * cos;
                    pointBX = obj.x + rotatedX;
                    pointBY = obj.y + rotatedY;
                }

                this.ctx.fillStyle = '#ff0000'; // Red for point B
                this.ctx.beginPath();
                this.ctx.arc(pointBX, pointBY, 6, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.strokeStyle = '#ff0000';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();

                // Label point B
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('B', pointBX, pointBY - 10);
            }
        }

        this.ctx.restore(); // Restore context state
    },

    getTriangleWorldVertices(obj) {
        const vertices = obj.vertices || [];
        return vertices.map(vertex => ({
            x: obj.x + vertex.x,
            y: obj.y + vertex.y
        }));
    },

    getTriangleBounds(obj) {
        const vertices = this.getTriangleWorldVertices(obj);
        const xs = vertices.map(vertex => vertex.x);
        const ys = vertices.map(vertex => vertex.y);
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys)
        };
    },

    getObjectBounds(obj) {
        if (obj.shape === 'rectangle') {
            return {
                minX: obj.x - obj.width / 2,
                maxX: obj.x + obj.width / 2,
                minY: obj.y - obj.height / 2,
                maxY: obj.y + obj.height / 2
            };
        }

        if (obj.shape === 'circle') {
            return {
                minX: obj.x - obj.radius,
                maxX: obj.x + obj.radius,
                minY: obj.y - obj.radius,
                maxY: obj.y + obj.radius
            };
        }

        if (obj.shape === 'triangle') {
            return this.getTriangleBounds(obj);
        }

        return { minX: obj.x, maxX: obj.x, minY: obj.y, maxY: obj.y };
    },

    drawTrianglePath(obj, inset = 0) {
        const vertices = this.getTriangleWorldVertices(obj);
        this.ctx.beginPath();
        this.ctx.moveTo(vertices[0].x, vertices[0].y);
        this.ctx.lineTo(vertices[1].x, vertices[1].y);
        this.ctx.lineTo(vertices[2].x, vertices[2].y);
        this.ctx.closePath();

        if (inset !== 0) {
            this.ctx.lineWidth = this.ctx.lineWidth + inset;
        }
    },

    drawConnection(connection) {
        // Find the connected objects
        const objA = this.level.objects.find(obj => obj.id === connection.bodyA);
        const objB = this.level.objects.find(obj => obj.id === connection.bodyB);

        if (!objA || !objB) return;

        // Calculate connection points using stored pointA/pointB offsets
        let startX = objA.x;
        let startY = objA.y;
        let endX = objB.x;
        let endY = objB.y;

        // Apply pointA offset to object A
        if (connection.pointA) {
            if (objA.rotation && objA.rotation !== 0) {
                // Apply rotation to the offset point
                const cos = Math.cos(objA.rotation);
                const sin = Math.sin(objA.rotation);
                startX += connection.pointA.x * cos - connection.pointA.y * sin;
                startY += connection.pointA.x * sin + connection.pointA.y * cos;
            } else {
                startX += connection.pointA.x;
                startY += connection.pointA.y;
            }
        }

        // Apply pointB offset to object B
        if (connection.pointB) {
            if (objB.rotation && objB.rotation !== 0) {
                // Apply rotation to the offset point
                const cos = Math.cos(objB.rotation);
                const sin = Math.sin(objB.rotation);
                endX += connection.pointB.x * cos - connection.pointB.y * sin;
                endY += connection.pointB.x * sin + connection.pointB.y * cos;
            } else {
                endX += connection.pointB.x;
                endY += connection.pointB.y;
            }
        }

        // Set line style based on connection type
        this.ctx.save();
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([]);

        switch (connection.type) {
            case 'revolute':
                this.ctx.strokeStyle = '#ff6b6b'; // Red for revolute joints
                break;
            case 'rope':
                this.ctx.strokeStyle = '#4ecdc4'; // Teal for ropes
                this.ctx.setLineDash([10, 5]);
                break;
            case 'spring':
                this.ctx.strokeStyle = '#ffff00'; // Yellow for springs
                this.ctx.setLineDash([5, 5]);
                break;
            case 'distance':
                this.ctx.strokeStyle = '#00ff00'; // Green for distance constraints
                break;
            case 'glue':
                this.ctx.strokeStyle = '#800080'; // Purple for glue connections
                break;
            default:
                this.ctx.strokeStyle = '#ffffff'; // White for unknown types
        }

        // Draw the connection line
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();

        // Draw connection points
        this.ctx.fillStyle = this.ctx.strokeStyle;
        this.ctx.beginPath();
        this.ctx.arc(startX, startY, 4, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(endX, endY, 4, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw connection type label
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(connection.type.toUpperCase(), midX, midY - 5);

        this.ctx.restore();
    },

    drawAreaSelectionRectangle() {
        const startX = Math.min(this.areaSelectStart.x, this.mousePos.x);
        const startY = Math.min(this.areaSelectStart.y, this.mousePos.y);
        const width = Math.abs(this.mousePos.x - this.areaSelectStart.x);
        const height = Math.abs(this.mousePos.y - this.areaSelectStart.y);

        this.ctx.save();
        this.ctx.strokeStyle = '#00ff00'; // Green for selection rectangle
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(startX, startY, width, height);

        // Fill with semi-transparent green
        this.ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
        this.ctx.fillRect(startX, startY, width, height);

        this.ctx.restore();
    }
};
