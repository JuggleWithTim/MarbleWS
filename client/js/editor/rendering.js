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

            // Draw background
            if (this.backgroundImage) {
                // Draw the background image
                this.ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);

                // Add a slight overlay to ensure objects are visible
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            } else {
                // Draw default gradient background
                const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
                gradient.addColorStop(0, '#1a1a2e');
                gradient.addColorStop(1, '#16213e');
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }

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

            // Highlight selected object
            if (this.selectedObject) {
                this.drawObjectOutline(this.selectedObject);
            }

            // Draw connections on top (always visible)
            if (this.level.connections) {
                this.level.connections.forEach(connection => {
                    this.drawConnection(connection);
                });
            }
        } catch (error) {
            console.error('Error in render:', error);
        }
    },

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;

        // Vertical lines
        for (let x = 0; x <= this.canvas.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= this.canvas.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
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
                }
            }
        } else {
            // No background image, just use color
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

            // Draw resize handles
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
        } else if (obj.shape === 'circle') {
            this.ctx.beginPath();
            this.ctx.arc(obj.x, obj.y, obj.radius + 2, 0, Math.PI * 2);
            this.ctx.stroke();

            // Draw resize handle for circle
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

        // Draw rotation handle
        this.ctx.fillStyle = '#ff6b6b';
        const handleSize = this.resizeHandleSize;
        const rotationHandleX = obj.x;
        const rotationHandleY = obj.y - Math.max(obj.width || obj.radius * 2, obj.height || obj.radius * 2) / 2 - 30;

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

        // Draw active points if object is active
        if (obj.active) {
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
    }
};
