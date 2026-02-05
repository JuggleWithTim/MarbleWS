// Tool management for the level editor

export const tools = {
    setTool(tool) {
        this.currentTool = tool;

        // Update button states
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tool="${tool}"]`).classList.add('active');

        // Update cursor
        switch (tool) {
            case 'select':
                this.canvas.style.cursor = 'default';
                break;
            case 'rectangle':
            case 'circle':
            case 'triangle':
                this.canvas.style.cursor = 'crosshair';
                break;
            case 'connect':
                this.canvas.style.cursor = 'pointer';
                break;
            case 'delete':
                this.canvas.style.cursor = 'not-allowed';
                break;
        }

        this.updateStatus(`Tool: ${tool}`);
    },

    updateCursor() {
        if (!this.canvas) return;

        // Reset cursor to default first
        let cursor = 'default';

        // Point selection mode takes priority
        if (this.pointSelectionMode) {
            cursor = 'crosshair';
        } else if (this.currentTool === 'select' && this.selectedObjects.length > 0) {
            const handle = this.getHandleAt(this.mousePos.x, this.mousePos.y);
            if (handle) {
                switch (handle) {
                    case 'nw':
                        cursor = 'nw-resize';
                        break;
                    case 'ne':
                        cursor = 'ne-resize';
                        break;
                    case 'sw':
                        cursor = 'sw-resize';
                        break;
                    case 'se':
                        cursor = 'se-resize';
                        break;
                    case 'radius':
                        cursor = 'ew-resize';
                        break;
                    case 'rotation':
                        cursor = 'alias'; // Use alias cursor for rotation
                        break;
                }
            } else {
                // Check if mouse is over a selected object for moving
                const objectAtMouse = this.getObjectAt(this.mousePos.x, this.mousePos.y);
                if (objectAtMouse && this.selectedObjects.includes(objectAtMouse)) {
                    cursor = 'move';
                }
            }
        } else {
            // Set cursor based on current tool
            switch (this.currentTool) {
                case 'rectangle':
                case 'circle':
                case 'triangle':
                    cursor = 'crosshair';
                    break;
                case 'connect':
                    cursor = 'pointer';
                    break;
                case 'delete':
                    cursor = 'not-allowed';
                    break;
            }
        }

        this.canvas.style.cursor = cursor;
    },

    resetCursor() {
        if (this.canvas) {
            this.canvas.style.cursor = 'default';
        }
    }
};
