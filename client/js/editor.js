class LevelEditor {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.currentTool = 'select';
        this.selectedObject = null;
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.mousePos = { x: 0, y: 0 };
        this.gridSize = 20;
        this.showGrid = true;
        this.snapToGrid = true;

        // Canvas scaling factors (display size vs logical size)
        this.scaleX = 1920 / 1280; // 1.5
        this.scaleY = 1080 / 720;  // 1.5

        this.level = {
            name: 'new-level',
            description: '',
            version: '1.0',
            backgroundImage: '',
            objects: [],
            connections: []
        };

        this.backgroundImage = null; // To store the loaded image
        this.objectImages = new Map(); // Cache for object background images

        this.objectIdCounter = 1;
        this.connectionIdCounter = 1;

        // Base path for API calls (loaded from config)
        this.basePath = '';

        // Resize state
        this.isResizing = false;
        this.resizeCorner = null;
        this.originalSize = null;
        this.resizeHandleSize = 10;

        // Rotation state
        this.isRotating = false;
        this.initialRotation = 0;
        this.initialMouseAngle = 0;

        // Connection state
        this.isConnecting = false;
        this.connectionStart = null;
        this.connectionStartPoint = null; // Store click position relative to object center
        this.connections = [];

        // JSON panel state
        this.jsonPanelVisible = false;

        // Point selection state
        this.pointSelectionMode = null; // 'pointA' or 'pointB' or null
    }

    async init() {
        // Load client configuration first
        await this.loadConfig();

        this.canvas = document.getElementById('editorCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.setupEventListeners();
        this.updateObjectList();
        this.render();
    }

    async loadConfig() {
        // Fetch from relative path - nginx will proxy it based on current location
        try {
            const response = await fetch('api/client-config');
            if (response.ok) {
                const config = await response.json();
                this.basePath = config.basePath || '';
                console.log('Editor config loaded:', config);
                return;
            }
        } catch (error) {
            console.error('Failed to load editor config:', error);
        }

        // If config fetch fails, use empty base path as fallback
        this.basePath = '';
        console.log('Using default editor config (empty base path)');
    }

    setupEventListeners() {
        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        
        // Tool buttons
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setTool(e.target.dataset.tool);
            });
        });
        
        // Toolbar buttons
        document.getElementById('newLevel').addEventListener('click', () => this.newLevel());
        document.getElementById('loadLevel').addEventListener('click', () => this.loadLevel());
        document.getElementById('saveLevel').addEventListener('click', () => this.saveLevel());
        document.getElementById('testLevel').addEventListener('click', () => this.testLevel());
        
        // Grid controls
        document.getElementById('showGrid').addEventListener('change', (e) => {
            this.showGrid = e.target.checked;
            this.render();
        });
        
        document.getElementById('snapToGrid').addEventListener('change', (e) => {
            this.snapToGrid = e.target.checked;
        });
        
        document.getElementById('gridSize').addEventListener('input', (e) => {
            this.gridSize = parseInt(e.target.value);
            this.render();
        });
        
        // Level info
        document.getElementById('levelName').addEventListener('input', (e) => {
            this.level.name = e.target.value;
        });
        
        document.getElementById('levelDescription').addEventListener('input', (e) => {
            this.level.description = e.target.value;
        });
        
        document.getElementById('backgroundImage').addEventListener('input', (e) => {
            this.level.backgroundImage = e.target.value;
            this.loadBackgroundImage();
            this.render();
        });
        
        // Show/hide nextLevel field when goal checkbox is toggled
        document.getElementById('objectGoal').addEventListener('change', (e) => {
            document.getElementById('nextLevelContainer').style.display =
                e.target.checked ? 'block' : 'none';
        });

        // Show/hide teleporterTarget field when teleporter checkbox is toggled
        document.getElementById('objectTeleporter').addEventListener('change', (e) => {
            document.getElementById('teleporterTargetContainer').style.display =
                e.target.checked ? 'block' : 'none';
        });

        // Show/hide active options when active checkbox is toggled
        document.getElementById('objectActive').addEventListener('change', (e) => {
            document.getElementById('activeOptionsContainer').style.display =
                e.target.checked ? 'block' : 'none';
        });
        
        // Property inputs
        const propertyInputs = [
            'objectColor', 'objectAlpha', 'objectBackgroundImage', 'objectWidth', 'objectHeight', 'objectRadius',
            'objectFriction', 'objectRestitution', 'objectDensity', 'objectRotation', 'objectStatic',
            'objectSpawnpoint', 'objectPlayerspawn', 'objectEmotespawn', 'objectGoal', 'objectNextLevel', 'objectTeleporter', 'objectTeleporterTarget', 'objectSolid', 'objectZIndex',
            'objectActive', 'objectPointAX', 'objectPointAY', 'objectPointBX', 'objectPointBY', 'objectTimeToA', 'objectTimeFromA', 'objectSpeedToB', 'objectSpeedFromB'
        ];

        propertyInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => this.updateSelectedObject());
            }
        });

        // Special handling for alpha slider to update display
        const alphaInput = document.getElementById('objectAlpha');
        if (alphaInput) {
            alphaInput.addEventListener('input', (e) => {
                this.updateAlphaDisplay(e.target.value);
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this.selectedObject) {
                this.deleteObject(this.selectedObject);
            }
        });

        // Point selection event listeners
        document.getElementById('pickPointA').addEventListener('click', () => this.startPointSelection('pointA'));
        document.getElementById('pickPointB').addEventListener('click', () => this.startPointSelection('pointB'));

        // JSON panel event listeners
        document.getElementById('toggleJsonPanel').addEventListener('click', () => this.toggleJsonPanel());
        document.getElementById('closeJsonPanel').addEventListener('click', () => this.hideJsonPanel());
        document.getElementById('formatJson').addEventListener('click', () => this.formatJson());
        document.getElementById('applyJson').addEventListener('click', () => this.applyJsonChanges());
        document.getElementById('resetJson').addEventListener('click', () => this.resetJson());
    }

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
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Convert display coordinates to logical coordinates
        const x = (e.clientX - rect.left) * this.scaleX;
        const y = (e.clientY - rect.top) * this.scaleY;

        this.mousePos = { x, y };
        this.dragStart = { x, y };

        if (this.snapToGrid) {
            this.mousePos.x = Math.round(x / this.gridSize) * this.gridSize;
            this.mousePos.y = Math.round(y / this.gridSize) * this.gridSize;
        }

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
            case 'connect':
                this.handleConnect(this.mousePos.x, this.mousePos.y);
                break;
            case 'delete':
                this.handleDelete(this.mousePos.x, this.mousePos.y);
                break;
        }
    }

    onMouseMove(e) {
        try {
            const rect = this.canvas.getBoundingClientRect();
            // Convert display coordinates to logical coordinates
            const x = (e.clientX - rect.left) * this.scaleX;
            const y = (e.clientY - rect.top) * this.scaleY;

            this.mousePos = { x, y };

            if (this.snapToGrid) {
                this.mousePos.x = Math.round(x / this.gridSize) * this.gridSize;
                this.mousePos.y = Math.round(y / this.gridSize) * this.gridSize;
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

            // Handle dragging
            if (this.isDragging && this.selectedObject) {
                this.selectedObject.x = this.mousePos.x;
                this.selectedObject.y = this.mousePos.y;
                this.render();
                return;
            }

            // Update cursor based on resize handles
            this.updateCursor();
        } catch (error) {
            console.error('Error in onMouseMove:', error);
            this.resetCursor();
        }
    }

    updateCursor() {
        if (!this.canvas) return;

        // Reset cursor to default first
        let cursor = 'default';

        // Point selection mode takes priority
        if (this.pointSelectionMode) {
            cursor = 'crosshair';
        } else if (this.currentTool === 'select' && this.selectedObject) {
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
                // Check if mouse is over the object for moving
                const objectAtMouse = this.getObjectAt(this.mousePos.x, this.mousePos.y);
                if (objectAtMouse === this.selectedObject) {
                    cursor = 'move';
                }
            }
        } else {
            // Set cursor based on current tool
            switch (this.currentTool) {
                case 'rectangle':
                case 'circle':
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
    }

    resetCursor() {
        if (this.canvas) {
            this.canvas.style.cursor = 'default';
        }
    }

    onMouseUp(e) {
        this.isDragging = false;
        this.isResizing = false;
        this.resizeCorner = null;
        this.originalSize = null;
        this.isRotating = false;
        this.initialRotation = 0;
        this.initialMouseAngle = 0;
        this.updateStatus('Ready');
    }

    handleSelect(x, y) {
        // First check if clicking on any handle
        const handle = this.getHandleAt(x, y);
        if (handle) {
            if (handle === 'rotation') {
                this.startRotating(x, y);
            } else {
                this.startResizing(handle);
            }
            return;
        }

        const clickedObject = this.getObjectAt(x, y);

        if (clickedObject) {
            this.selectObject(clickedObject);
            this.isDragging = true;
        } else {
            this.selectObject(null);
        }
    }

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
    }

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
        }

        // Initialize connections array if it doesn't exist
        if (!this.level.connections) {
            this.level.connections = [];
        }

        this.level.connections.push(connection);
        this.render();
        this.updateJsonDisplay();
        this.updateStatus(`Created ${connection.type} connection: ${objA.id} ↔ ${objB.id}`);
    }

    handleDelete(x, y) {
        const clickedObject = this.getObjectAt(x, y);
        if (clickedObject) {
            this.deleteObject(clickedObject);
        }
    }

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
            }
        }

        return null;
    }

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
    }

    getHandleAt(x, y) {
        if (!this.selectedObject) return null;

        const obj = this.selectedObject;
        const handleSize = this.resizeHandleSize;

        // Check rotation handle first - need to account for object rotation
        let rotationHandleX = obj.x;
        let rotationHandleY = obj.y - Math.max(obj.width || obj.radius * 2, obj.height || obj.radius * 2) / 2 - 30;

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
        }

        return null;
    }

    startResizing(corner) {
        if (!this.selectedObject) return;

        this.isResizing = true;
        this.resizeCorner = corner;
        this.originalSize = {
            width: this.selectedObject.width,
            height: this.selectedObject.height,
            radius: this.selectedObject.radius,
            x: this.selectedObject.x,
            y: this.selectedObject.y
        };

        this.updateStatus(`Resizing ${this.selectedObject.id} from ${corner} corner`);
    }

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
            }

            // Update property inputs with error handling
            this.updatePropertyInputs(obj);

            this.render();
        } catch (error) {
            console.error('Error in performResize:', error);
            this.resetResizeState();
        }
    }

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
            }
        } catch (error) {
            console.error('Error updating property inputs:', error);
        }
    }

    resetResizeState() {
        this.isResizing = false;
        this.resizeCorner = null;
        this.originalSize = null;
        this.resetCursor();
    }

    startRotating(x, y) {
        if (!this.selectedObject) return;

        this.isRotating = true;
        this.initialRotation = this.selectedObject.rotation || 0;

        // Calculate initial mouse angle relative to object center
        const dx = x - this.selectedObject.x;
        const dy = y - this.selectedObject.y;
        this.initialMouseAngle = Math.atan2(dy, dx);

        this.updateStatus(`Rotating ${this.selectedObject.id}`);
    }

    performRotation(x, y) {
        if (!this.isRotating || !this.selectedObject) return;

        try {
            // Calculate current mouse angle relative to object center
            const dx = x - this.selectedObject.x;
            const dy = y - this.selectedObject.y;
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
    }

    createRectangle(x, y) {
        const backgroundImage = document.getElementById('objectBackgroundImage').value;
        const hexColor = document.getElementById('objectColor').value;
        const alpha = parseInt(document.getElementById('objectAlpha').value);

        // Load the background image if provided
        if (backgroundImage) {
            this.loadObjectImage(backgroundImage);
        }

        const obj = {
            id: this.generateUniqueObjectName('rect'),
            shape: 'rectangle',
            x: x,
            y: y,
            width: parseInt(document.getElementById('objectWidth').value),
            height: parseInt(document.getElementById('objectHeight').value),
            rotation: parseFloat(document.getElementById('objectRotation').value) * Math.PI / 180, // Convert to radians
            color: this.createRgba(hexColor, alpha),
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
    }

    createCircle(x, y) {
        const backgroundImage = document.getElementById('objectBackgroundImage').value;
        const hexColor = document.getElementById('objectColor').value;
        const alpha = parseInt(document.getElementById('objectAlpha').value);

        // Load the background image if provided
        if (backgroundImage) {
            this.loadObjectImage(backgroundImage);
        }

        const obj = {
            id: this.generateUniqueObjectName('circle'),
            shape: 'circle',
            x: x,
            y: y,
            radius: parseInt(document.getElementById('objectRadius').value),
            rotation: parseFloat(document.getElementById('objectRotation').value) * Math.PI / 180, // Convert to radians
            color: this.createRgba(hexColor, alpha),
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
    }

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
    }
    
    getNextLevel() {
        if (document.getElementById('objectGoal').checked) {
            return document.getElementById('objectNextLevel').value.trim();
        }
        return '';
    }

    getTeleporterTarget() {
        if (document.getElementById('objectTeleporter').checked) {
            return document.getElementById('objectTeleporterTarget').value.trim();
        }
        return '';
    }

    // Helper function to convert hex color to RGB components
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    // Helper function to convert RGB to hex
    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    // Helper function to parse RGBA string and return components
    parseRgba(rgbaString) {
        const match = rgbaString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
            return {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3]),
                a: match[4] ? parseFloat(match[4]) : 1
            };
        }
        return null;
    }

    // Helper function to create RGBA string from hex and alpha
    createRgba(hexColor, alpha) {
        const rgb = this.hexToRgb(hexColor);
        if (rgb) {
            return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha / 255})`;
        }
        return hexColor; // fallback
    }

    selectObject(obj) {
        this.selectedObject = obj;

        if (obj) {
            // Parse color and alpha from stored RGBA string or convert from hex
            let colorHex = obj.color;
            let alpha = 255; // default full opacity

            if (obj.color && obj.color.startsWith('rgba(')) {
                const rgba = this.parseRgba(obj.color);
                if (rgba) {
                    colorHex = this.rgbToHex(rgba.r, rgba.g, rgba.b);
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
            }

            this.updateStatus(`Selected: ${obj.id}`);
        } else {
            this.updateStatus('No object selected');
        }

        this.updateObjectList();
        this.render();
    }

    // Update alpha display percentage
    updateAlphaDisplay(alpha) {
        const alphaValueElement = document.getElementById('alphaValue');
        if (alphaValueElement) {
            const percentage = Math.round((alpha / 255) * 100);
            alphaValueElement.textContent = `${percentage}%`;
        }
    }

    updateSelectedObject() {
        if (!this.selectedObject) return;

        // Get the new background image value
        const newBackgroundImage = document.getElementById('objectBackgroundImage').value;

        // Check if the background image has changed
        if (newBackgroundImage !== this.selectedObject.backgroundImage) {
            // Load the new background image
            if (newBackgroundImage) {
                this.loadObjectImage(newBackgroundImage);
            }
        }

        // Update properties from inputs
        const hexColor = document.getElementById('objectColor').value;
        const alpha = parseInt(document.getElementById('objectAlpha').value);
        this.selectedObject.color = this.createRgba(hexColor, alpha);

        this.selectedObject.backgroundImage = newBackgroundImage;
        this.selectedObject.isStatic = document.getElementById('objectStatic').checked;
        this.selectedObject.isSolid = document.getElementById('objectSolid').checked;
        this.selectedObject.zIndex = parseInt(document.getElementById('objectZIndex').value);
        this.selectedObject.friction = parseFloat(document.getElementById('objectFriction').value);
        this.selectedObject.restitution = parseFloat(document.getElementById('objectRestitution').value);
        this.selectedObject.density = parseFloat(document.getElementById('objectDensity').value);
        this.selectedObject.rotation = parseFloat(document.getElementById('objectRotation').value) * Math.PI / 180; // Convert to radians

        if (this.selectedObject.shape === 'rectangle') {
            this.selectedObject.width = parseInt(document.getElementById('objectWidth').value);
            this.selectedObject.height = parseInt(document.getElementById('objectHeight').value);
        } else if (this.selectedObject.shape === 'circle') {
            this.selectedObject.radius = parseInt(document.getElementById('objectRadius').value);
        }

        // Update properties
        this.selectedObject.properties = this.getSelectedProperties();

        // Update nextLevel property for goal objects
        const nextLevel = this.getNextLevel();
        if (nextLevel) {
            this.selectedObject.nextLevel = nextLevel;
        } else if (this.selectedObject.nextLevel) {
            delete this.selectedObject.nextLevel;
        }

        // Update teleporterTarget property for teleporter objects
        const teleporterTarget = this.getTeleporterTarget();
        if (teleporterTarget) {
            this.selectedObject.teleporterTarget = teleporterTarget;
        } else if (this.selectedObject.teleporterTarget) {
            delete this.selectedObject.teleporterTarget;
        }

        // Update active properties
        const isActive = document.getElementById('objectActive').checked;
        if (isActive) {
            this.selectedObject.active = true;
            this.selectedObject.pointA = {
                x: parseFloat(document.getElementById('objectPointAX').value) || 0,
                y: parseFloat(document.getElementById('objectPointAY').value) || 0
            };
            this.selectedObject.pointB = {
                x: parseFloat(document.getElementById('objectPointBX').value) || 0,
                y: parseFloat(document.getElementById('objectPointBY').value) || 0
            };
            this.selectedObject.timeToA = parseFloat(document.getElementById('objectTimeToA').value) || 2;
            this.selectedObject.timeFromA = parseFloat(document.getElementById('objectTimeFromA').value) || 2;
            this.selectedObject.speedToB = parseFloat(document.getElementById('objectSpeedToB').value) || 1;
            this.selectedObject.speedFromB = parseFloat(document.getElementById('objectSpeedFromB').value) || 1;
        } else {
            this.selectedObject.active = false;
            // Remove active properties if not active
            if (this.selectedObject.pointA) delete this.selectedObject.pointA;
            if (this.selectedObject.pointB) delete this.selectedObject.pointB;
            if (this.selectedObject.timeToA) delete this.selectedObject.timeToA;
            if (this.selectedObject.timeFromA) delete this.selectedObject.timeFromA;
            if (this.selectedObject.speedToB) delete this.selectedObject.speedToB;
            if (this.selectedObject.speedFromB) delete this.selectedObject.speedFromB;
        }

        this.updateObjectList();
        this.render();
    }

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

            if (this.selectedObject === obj) {
                this.selectObject(null);
            }
            this.updateObjectList();
            this.render();
            this.updateJsonDisplay();
            this.updateStatus(`Deleted: ${obj.id} and related connections`);
        }
    }

    updateObjectList() {
        const objectList = document.getElementById('objectList');
        objectList.innerHTML = '';
        
        this.level.objects.forEach(obj => {
            const item = document.createElement('div');
            item.className = 'object-item';
            if (obj === this.selectedObject) {
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
    }

    loadObjectImage(url) {
        if (!url) return null;
        
        // Check if image is already cached
        if (this.objectImages.has(url)) {
            return this.objectImages.get(url);
        }
        
        // Create a new image and cache it
        const img = new Image();
        img.src = url;
        
        // Store a promise that resolves when the image loads
        const promise = new Promise((resolve) => {
            img.onload = () => {
                this.objectImages.set(url, img);
                this.render(); // Re-render when image loads
                resolve(img);
            };
            img.onerror = () => {
                this.objectImages.set(url, null);
                resolve(null);
            };
        });
        
        this.objectImages.set(url, promise);
        return promise;
    }

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
    }

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

            // Draw connections first (behind objects)
            if (this.level.connections) {
                this.level.connections.forEach(connection => {
                    this.drawConnection(connection);
                });
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
        } catch (error) {
            console.error('Error in render:', error);
        }
    }

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
    }

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
    }

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
    }

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
    }

    async loadLevel() {
        const levelName = prompt('Enter level name to load:');
        if (!levelName) return;

        try {
            const response = await fetch(`${this.basePath}/api/levels/${levelName}`);
            if (response.ok) {
                const levelData = await response.json();
                this.level = levelData;

                document.getElementById('levelName').value = this.level.name;
                document.getElementById('levelDescription').value = this.level.description || '';

                // Ensure backgroundImage property exists
                if (!this.level.hasOwnProperty('backgroundImage')) {
                    this.level.backgroundImage = '';
                }

                document.getElementById('backgroundImage').value = this.level.backgroundImage || '';
                this.loadBackgroundImage();

                // Load background images for objects
                this.level.objects.forEach(obj => {
                    if (obj.backgroundImage) {
                        this.loadObjectImage(obj.backgroundImage);
                    }
                });

                // Update counters based on existing objects to prevent duplicates
                this.updateObjectCounters();

                // Validate and fix any duplicate IDs that might exist
                this.validateAndFixDuplicateIds();

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
    }

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
        this.recalculateConnectionLengths();
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
    }

    testLevel() {
        const levelName = document.getElementById('levelName').value;
        if (!levelName) {
            alert('Please save the level first');
            return;
        }

        // Open game in new tab with level parameter, using base path
        window.open(`${this.basePath}/?level=${levelName}`, '_blank');
    }

    updateStatus(message) {
        document.getElementById('statusText').textContent = message;
    }

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
    }

    hideJsonPanel() {
        this.jsonPanelVisible = false;
        const panel = document.getElementById('jsonPanel');
        panel.classList.remove('visible');
    }

    updateJsonDisplay() {
        if (!this.jsonPanelVisible) return;

        const textarea = document.getElementById('levelJsonTextarea');
        if (textarea) {
            // Create a deep copy of the level data for display
            const levelCopy = JSON.parse(JSON.stringify(this.level));
            textarea.value = JSON.stringify(levelCopy, null, 2);
        }
    }

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
    }

    applyJsonChanges() {
        const textarea = document.getElementById('levelJsonTextarea');
        if (!textarea) return;

        try {
            const newLevelData = JSON.parse(textarea.value);

            // Basic validation
            if (!newLevelData.objects || !Array.isArray(newLevelData.objects)) {
                throw new Error('Invalid level data: objects array required');
            }

            // Update the level data
            this.level = newLevelData;

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
            this.updateObjectCounters();

            // Validate and fix any duplicate IDs that might exist
            this.validateAndFixDuplicateIds();

            // Reset selection and update UI
            this.selectedObject = null;
            this.updateObjectList();
            this.render();
            this.updateStatus('JSON changes applied successfully');
        } catch (error) {
            this.updateStatus(`Error applying JSON: ${error.message}`);
            console.error('JSON apply error:', error);
        }
    }

    resetJson() {
        this.updateJsonDisplay();
        this.updateStatus('JSON reset to current level state');
    }

    // Generate a unique object name that doesn't conflict with existing objects
    generateUniqueObjectName(baseName) {
        let counter = 1;
        let candidateName = `${baseName}_${counter}`;

        // Keep incrementing counter until we find a unique name
        while (this.level.objects.some(obj => obj.id === candidateName)) {
            counter++;
            candidateName = `${baseName}_${counter}`;
        }

        return candidateName;
    }

    // Update object ID counters based on existing objects
    updateObjectCounters() {
        let maxRectId = 0;
        let maxCircleId = 0;
        let maxConnectionId = 0;

        // Scan existing objects to find highest IDs
        this.level.objects.forEach(obj => {
            if (obj.id.startsWith('rect_')) {
                const idNum = parseInt(obj.id.replace('rect_', ''));
                if (!isNaN(idNum) && idNum > maxRectId) {
                    maxRectId = idNum;
                }
            } else if (obj.id.startsWith('circle_')) {
                const idNum = parseInt(obj.id.replace('circle_', ''));
                if (!isNaN(idNum) && idNum > maxCircleId) {
                    maxCircleId = idNum;
                }
            }
        });

        // Scan connections for highest ID
        if (this.level.connections) {
            this.level.connections.forEach(conn => {
                if (conn.id.startsWith('connection_')) {
                    const idNum = parseInt(conn.id.replace('connection_', ''));
                    if (!isNaN(idNum) && idNum > maxConnectionId) {
                        maxConnectionId = idNum;
                    }
                }
            });
        }

        // Set counters to next available numbers
        this.objectIdCounter = Math.max(maxRectId, maxCircleId) + 1;
        this.connectionIdCounter = maxConnectionId + 1;
    }

    // Validate and fix duplicate object IDs in the level
    validateAndFixDuplicateIds() {
        const seenIds = new Set();
        const duplicates = [];

        // Find duplicates
        this.level.objects.forEach(obj => {
            if (seenIds.has(obj.id)) {
                duplicates.push(obj);
            } else {
                seenIds.add(obj.id);
            }
        });

        // Fix duplicates by generating new unique names
        duplicates.forEach(obj => {
            const baseName = obj.shape; // 'rectangle' or 'circle'
            const newId = this.generateUniqueObjectName(baseName);
            console.warn(`Fixed duplicate ID: ${obj.id} -> ${newId}`);
            obj.id = newId;
        });

        // Update connections that reference the old IDs
        if (this.level.connections) {
            this.level.connections.forEach(conn => {
                if (duplicates.some(obj => obj.id === conn.bodyA)) {
                    const oldObj = duplicates.find(obj => obj.id === conn.bodyA);
                    if (oldObj) conn.bodyA = oldObj.id;
                }
                if (duplicates.some(obj => obj.id === conn.bodyB)) {
                    const oldObj = duplicates.find(obj => obj.id === conn.bodyB);
                    if (oldObj) conn.bodyB = oldObj.id;
                }
            });
        }

        if (duplicates.length > 0) {
            console.log(`Fixed ${duplicates.length} duplicate object IDs`);
            this.updateObjectList();
            this.render();
        }
    }

    // Recalculate connection lengths based on current object positions and rotations
    recalculateConnectionLengths() {
        if (!this.level.connections) return;

        this.level.connections.forEach(connection => {
            // Find the connected objects
            const objA = this.level.objects.find(obj => obj.id === connection.bodyA);
            const objB = this.level.objects.find(obj => obj.id === connection.bodyB);

            if (!objA || !objB) return;

            // Calculate the actual attachment points in world coordinates
            let attachPointA = { x: objA.x, y: objA.y };
            let attachPointB = { x: objB.x, y: objB.y };

            // Apply pointA offset to object A
            if (connection.pointA) {
                if (objA.rotation && objA.rotation !== 0) {
                    // Apply rotation to the offset point
                    const cos = Math.cos(objA.rotation);
                    const sin = Math.sin(objA.rotation);
                    attachPointA.x += connection.pointA.x * cos - connection.pointA.y * sin;
                    attachPointA.y += connection.pointA.x * sin + connection.pointA.y * cos;
                } else {
                    attachPointA.x += connection.pointA.x;
                    attachPointA.y += connection.pointA.y;
                }
            }

            // Apply pointB offset to object B
            if (connection.pointB) {
                if (objB.rotation && objB.rotation !== 0) {
                    // Apply rotation to the offset point
                    const cos = Math.cos(objB.rotation);
                    const sin = Math.sin(objB.rotation);
                    attachPointB.x += connection.pointB.x * cos - connection.pointB.y * sin;
                    attachPointB.y += connection.pointB.x * sin + connection.pointB.y * cos;
                } else {
                    attachPointB.x += connection.pointB.x;
                    attachPointB.y += connection.pointB.y;
                }
            }

            // Recalculate the distance between attachment points
            connection.length = Math.sqrt(Math.pow(attachPointB.x - attachPointA.x, 2) + Math.pow(attachPointB.y - attachPointA.y, 2));
        });
    }

    // Start point selection mode
    startPointSelection(pointType) {
        if (!this.selectedObject) {
            this.updateStatus('No object selected');
            return;
        }

        this.pointSelectionMode = pointType;
        this.updateStatus(`Click on canvas to set Point ${pointType === 'pointA' ? 'A' : 'B'}`);
        this.render();
    }

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
        }

        // Ensure active is set
        this.selectedObject.active = true;
        document.getElementById('objectActive').checked = true;
        document.getElementById('activeOptionsContainer').style.display = 'block';

        const pointLabel = this.pointSelectionMode === 'pointA' ? 'A' : 'B';
        this.pointSelectionMode = null;
        this.updateStatus(`Point ${pointLabel} set`);
        this.render();
    }
}
