// Object transformation functionality (resizing, rotation)

export const transform = {
    startResizing(corner) {
        if (!this.selectedObject) return;

        this.isResizing = true;
        this.resizeCorner = corner;
        this.originalSize = {
            width: this.selectedObject.width,
            height: this.selectedObject.height,
            radius: this.selectedObject.radius,
            vertices: this.selectedObject.vertices ? this.selectedObject.vertices.map(vertex => ({ ...vertex })) : null,
            x: this.selectedObject.x,
            y: this.selectedObject.y
        };

        this.updateStatus(`Resizing ${this.selectedObject.id} from ${corner} corner`);
    },

    performResize(x, y, shiftKey = false) {
        if (!this.isResizing || !this.selectedObject) return;

        try {
            const obj = this.selectedObject;
            const original = this.originalSize;
            const preserveAspectRatio = shiftKey; // Check if Shift is held

            if (obj.shape === 'rectangle') {
                let newWidth = original.width;
                let newHeight = original.height;

                switch (this.resizeCorner) {
                    case 'nw':
                        newWidth = original.x + original.width/2 - x;
                        newHeight = original.y + original.height/2 - y;
                        obj.x = x + newWidth/2;
                        obj.y = y + newHeight/2;
                        break;
                    case 'ne':
                        newWidth = x - (original.x - original.width/2);
                        newHeight = original.y + original.height/2 - y;
                        obj.x = original.x - original.width/2 + newWidth/2;
                        obj.y = y + newHeight/2;
                        break;
                    case 'sw':
                        newWidth = original.x + original.width/2 - x;
                        newHeight = y - (original.y - original.height/2);
                        obj.x = x + newWidth/2;
                        obj.y = original.y - original.height/2 + newHeight/2;
                        break;
                    case 'se':
                        newWidth = x - (original.x - original.width/2);
                        newHeight = y - (original.y - original.height/2);
                        obj.x = original.x - original.width/2 + newWidth/2;
                        obj.y = original.y - original.height/2 + newHeight/2;
                        break;
                }

                // Prevent negative sizes
                newWidth = Math.max(10, newWidth);
                newHeight = Math.max(10, newHeight);

                // Preserve aspect ratio if Shift is held
                if (preserveAspectRatio) {
                    const aspectRatio = original.width / original.height;
                    if (Math.abs(newWidth - original.width) > Math.abs(newHeight - original.height)) {
                        newHeight = newWidth / aspectRatio;
                    } else {
                        newWidth = newHeight * aspectRatio;
                    }
                }

                obj.width = Math.round(newWidth);
                obj.height = Math.round(newHeight);

            } else if (obj.shape === 'circle') {
                // For circles, resize based on distance from center to mouse
                const distance = Math.sqrt(Math.pow(x - original.x, 2) + Math.pow(y - original.y, 2));
                obj.radius = Math.max(5, Math.round(distance));
            } else if (obj.shape === 'triangle') {
                const originalVertices = original.vertices || [];
                if (originalVertices.length === 3) {
                    const xs = originalVertices.map(vertex => vertex.x);
                    const ys = originalVertices.map(vertex => vertex.y);
                    const minX = Math.min(...xs);
                    const maxX = Math.max(...xs);
                    const minY = Math.min(...ys);
                    const maxY = Math.max(...ys);
                    const originalWidth = Math.max(10, maxX - minX);
                    const originalHeight = Math.max(10, maxY - minY);

                    let targetX = x - original.x;
                    let targetY = y - original.y;

                    if (obj.rotation && obj.rotation !== 0) {
                        const cos = Math.cos(-obj.rotation);
                        const sin = Math.sin(-obj.rotation);
                        const rotatedX = targetX * cos - targetY * sin;
                        const rotatedY = targetX * sin + targetY * cos;
                        targetX = rotatedX;
                        targetY = rotatedY;
                    }

                    let scaleX = 1;
                    let scaleY = 1;

                    switch (this.resizeCorner) {
                        case 'nw':
                            scaleX = (maxX - targetX) / originalWidth;
                            scaleY = (maxY - targetY) / originalHeight;
                            break;
                        case 'ne':
                            scaleX = (targetX - minX) / originalWidth;
                            scaleY = (maxY - targetY) / originalHeight;
                            break;
                        case 'sw':
                            scaleX = (maxX - targetX) / originalWidth;
                            scaleY = (targetY - minY) / originalHeight;
                            break;
                        case 'se':
                            scaleX = (targetX - minX) / originalWidth;
                            scaleY = (targetY - minY) / originalHeight;
                            break;
                    }

                    scaleX = Math.max(0.1, scaleX);
                    scaleY = Math.max(0.1, scaleY);

                    if (preserveAspectRatio) {
                        const uniformScale = Math.min(scaleX, scaleY);
                        scaleX = uniformScale;
                        scaleY = uniformScale;
                    }

                    obj.vertices = originalVertices.map(vertex => ({
                        x: vertex.x * scaleX,
                        y: vertex.y * scaleY
                    }));
                }
            }

            // Update property inputs with error handling
            this.updatePropertyInputs(obj);

            this.render();
        } catch (error) {
            console.error('Error in performResize:', error);
            this.resetResizeState();
        }
    },

    updatePropertyInputs(obj) {
        try {
            if (obj.shape === 'rectangle') {
                const widthInput = document.getElementById('objectWidth');
                const heightInput = document.getElementById('objectHeight');
                if (widthInput) widthInput.value = obj.width;
                if (heightInput) heightInput.value = obj.height;
            } else if (obj.shape === 'circle') {
                const radiusInput = document.getElementById('objectRadius');
                if (radiusInput) radiusInput.value = obj.radius;
            } else if (obj.shape === 'triangle') {
                const [a, b, c] = obj.vertices || [];
                if (a) {
                    document.getElementById('objectVertexAX').value = Math.round(a.x);
                    document.getElementById('objectVertexAY').value = Math.round(a.y);
                }
                if (b) {
                    document.getElementById('objectVertexBX').value = Math.round(b.x);
                    document.getElementById('objectVertexBY').value = Math.round(b.y);
                }
                if (c) {
                    document.getElementById('objectVertexCX').value = Math.round(c.x);
                    document.getElementById('objectVertexCY').value = Math.round(c.y);
                }
            }
        } catch (error) {
            console.error('Error updating property inputs:', error);
        }
    },

    resetResizeState() {
        this.isResizing = false;
        this.resizeCorner = null;
        this.originalSize = null;
        this.resetCursor();
    },

    startRotating(x, y) {
        if (!this.selectedObject) return;

        this.isRotating = true;
        this.initialRotation = this.selectedObject.rotation || 0;

        // Use rotation point if specified, otherwise use object center
        const rotationPoint = this.selectedObject.rotationPoint || { x: 0, y: 0 };
        const pivotX = this.selectedObject.x + rotationPoint.x;
        const pivotY = this.selectedObject.y + rotationPoint.y;

        // Calculate initial mouse angle relative to rotation pivot
        const dx = x - pivotX;
        const dy = y - pivotY;
        this.initialMouseAngle = Math.atan2(dy, dx);

        this.updateStatus(`Rotating ${this.selectedObject.id}`);
    },

    performRotation(x, y) {
        if (!this.isRotating || !this.selectedObject) return;

        try {
            // Use rotation point if specified, otherwise use object center
            const rotationPoint = this.selectedObject.rotationPoint || { x: 0, y: 0 };
            const pivotX = this.selectedObject.x + rotationPoint.x;
            const pivotY = this.selectedObject.y + rotationPoint.y;

            // Calculate current mouse angle relative to rotation pivot
            const dx = x - pivotX;
            const dy = y - pivotY;
            const currentMouseAngle = Math.atan2(dy, dx);

            // Calculate angle difference
            const angleDiff = currentMouseAngle - this.initialMouseAngle;

            // Apply rotation
            this.selectedObject.rotation = this.initialRotation + angleDiff;

            // Update rotation input field
            const rotationInput = document.getElementById('objectRotation');
            if (rotationInput) {
                rotationInput.value = Math.round(this.selectedObject.rotation * 180 / Math.PI);
            }

            this.render();
        } catch (error) {
            console.error('Error in performRotation:', error);
        }
    }
};
