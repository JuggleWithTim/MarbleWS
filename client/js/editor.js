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
            objects: []
        };

        this.backgroundImage = null; // To store the loaded image
        this.objectImages = new Map(); // Cache for object background images

        this.objectIdCounter = 1;

        // Resize state
        this.isResizing = false;
        this.resizeCorner = null;
        this.originalSize = null;
        this.resizeHandleSize = 8;
    }

    init() {
        this.canvas = document.getElementById('editorCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.setupEventListeners();
        this.updateObjectList();
        this.render();
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
        
        // Property inputs
        const propertyInputs = [
            'objectColor', 'objectBackgroundImage', 'objectWidth', 'objectHeight', 'objectRadius',
            'objectFriction', 'objectRestitution', 'objectRotation', 'objectStatic',
            'objectSpawnpoint', 'objectGoal', 'objectNextLevel', 'objectSolid', 'objectZIndex'
        ];
        
        propertyInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => this.updateSelectedObject());
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this.selectedObject) {
                this.deleteObject(this.selectedObject);
            }
        });
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
            case 'delete':
                this.handleDelete(this.mousePos.x, this.mousePos.y);
                break;
        }
    }

    onMouseMove(e) {
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
        document.getElementById('mousePos').textContent = `Mouse: ${Math.round(this.mousePos.x)}, ${Math.round(this.mousePos.y)}`;

        // Handle resizing
        if (this.isResizing) {
            this.performResize(this.mousePos.x, this.mousePos.y);
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
        if (this.currentTool === 'select' && this.selectedObject) {
            const resizeHandle = this.getResizeHandleAt(this.mousePos.x, this.mousePos.y);
            if (resizeHandle) {
                switch (resizeHandle) {
                    case 'nw':
                        this.canvas.style.cursor = 'nw-resize';
                        break;
                    case 'ne':
                        this.canvas.style.cursor = 'ne-resize';
                        break;
                    case 'sw':
                        this.canvas.style.cursor = 'sw-resize';
                        break;
                    case 'se':
                        this.canvas.style.cursor = 'se-resize';
                        break;
                    case 'radius':
                        this.canvas.style.cursor = 'ew-resize';
                        break;
                }
            } else {
                // Check if mouse is over the object for moving
                const objectAtMouse = this.getObjectAt(this.mousePos.x, this.mousePos.y);
                if (objectAtMouse === this.selectedObject) {
                    this.canvas.style.cursor = 'move';
                } else {
                    this.canvas.style.cursor = 'default';
                }
            }
        }
    }

    onMouseUp(e) {
        this.isDragging = false;
        this.isResizing = false;
        this.resizeCorner = null;
        this.originalSize = null;
        this.updateStatus('Ready');
    }

    handleSelect(x, y) {
        // First check if clicking on a resize handle
        const resizeHandle = this.getResizeHandleAt(x, y);
        if (resizeHandle) {
            this.startResizing(resizeHandle);
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
                if (x >= obj.x - obj.width/2 && x <= obj.x + obj.width/2 &&
                    y >= obj.y - obj.height/2 && y <= obj.y + obj.height/2) {
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

    getResizeHandleAt(x, y) {
        if (!this.selectedObject) return null;

        const obj = this.selectedObject;
        const handleSize = this.resizeHandleSize;

        if (obj.shape === 'rectangle') {
            // Check all 4 corners
            const corners = [
                { name: 'nw', x: obj.x - obj.width/2, y: obj.y - obj.height/2 },
                { name: 'ne', x: obj.x + obj.width/2, y: obj.y - obj.height/2 },
                { name: 'sw', x: obj.x - obj.width/2, y: obj.y + obj.height/2 },
                { name: 'se', x: obj.x + obj.width/2, y: obj.y + obj.height/2 }
            ];

            for (const corner of corners) {
                if (x >= corner.x - handleSize && x <= corner.x + handleSize &&
                    y >= corner.y - handleSize && y <= corner.y + handleSize) {
                    return corner.name;
                }
            }
        } else if (obj.shape === 'circle') {
            // For circles, use a single resize handle on the right edge
            const handleX = obj.x + obj.radius;
            const handleY = obj.y;

            if (x >= handleX - handleSize && x <= handleX + handleSize &&
                y >= handleY - handleSize && y <= handleY + handleSize) {
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

    performResize(x, y) {
        if (!this.isResizing || !this.selectedObject) return;

        const obj = this.selectedObject;
        const original = this.originalSize;
        const preserveAspectRatio = event.shiftKey; // Check if Shift is held

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

        // Update property inputs
        if (obj.shape === 'rectangle') {
            document.getElementById('objectWidth').value = obj.width;
            document.getElementById('objectHeight').value = obj.height;
        } else if (obj.shape === 'circle') {
            document.getElementById('objectRadius').value = obj.radius;
        }

        this.render();
    }

    createRectangle(x, y) {
        const backgroundImage = document.getElementById('objectBackgroundImage').value;
        
        // Load the background image if provided
        if (backgroundImage) {
            this.loadObjectImage(backgroundImage);
        }
        
        const obj = {
            id: `rect_${this.objectIdCounter++}`,
            shape: 'rectangle',
            x: x,
            y: y,
            width: parseInt(document.getElementById('objectWidth').value),
            height: parseInt(document.getElementById('objectHeight').value),
            rotation: parseFloat(document.getElementById('objectRotation').value) * Math.PI / 180, // Convert to radians
            color: document.getElementById('objectColor').value,
            backgroundImage: backgroundImage,
            isStatic: document.getElementById('objectStatic').checked,
            isSolid: document.getElementById('objectSolid').checked,
            zIndex: parseInt(document.getElementById('objectZIndex').value),
            friction: parseFloat(document.getElementById('objectFriction').value),
            restitution: parseFloat(document.getElementById('objectRestitution').value),
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
        this.updateStatus(`Created rectangle: ${obj.id}`);
    }

    createCircle(x, y) {
        const backgroundImage = document.getElementById('objectBackgroundImage').value;
        
        // Load the background image if provided
        if (backgroundImage) {
            this.loadObjectImage(backgroundImage);
        }
        
        const obj = {
            id: `circle_${this.objectIdCounter++}`,
            shape: 'circle',
            x: x,
            y: y,
            radius: parseInt(document.getElementById('objectRadius').value),
            rotation: parseFloat(document.getElementById('objectRotation').value) * Math.PI / 180, // Convert to radians
            color: document.getElementById('objectColor').value,
            backgroundImage: backgroundImage,
            isStatic: document.getElementById('objectStatic').checked,
            isSolid: document.getElementById('objectSolid').checked,
            zIndex: parseInt(document.getElementById('objectZIndex').value),
            friction: parseFloat(document.getElementById('objectFriction').value),
            restitution: parseFloat(document.getElementById('objectRestitution').value),
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
        this.updateStatus(`Created circle: ${obj.id}`);
    }

    getSelectedProperties() {
        const properties = [];
        if (document.getElementById('objectSpawnpoint').checked) {
            properties.push('spawnpoint');
        }
        if (document.getElementById('objectGoal').checked) {
            properties.push('goal');
        }
        return properties;
    }
    
    getNextLevel() {
        if (document.getElementById('objectGoal').checked) {
            return document.getElementById('objectNextLevel').value.trim();
        }
        return '';
    }

    selectObject(obj) {
        this.selectedObject = obj;
        
        if (obj) {
            // Update property inputs
            document.getElementById('objectColor').value = obj.color;
            document.getElementById('objectBackgroundImage').value = obj.backgroundImage || '';
            document.getElementById('objectStatic').checked = obj.isStatic;
            document.getElementById('objectSolid').checked = obj.isSolid !== false; // Default to true if not specified
            document.getElementById('objectZIndex').value = obj.zIndex || 0;
            document.getElementById('objectFriction').value = obj.friction;
            document.getElementById('objectRestitution').value = obj.restitution;
            document.getElementById('objectRotation').value = Math.round((obj.rotation || 0) * 180 / Math.PI); // Convert to degrees
            
            if (obj.shape === 'rectangle') {
                document.getElementById('objectWidth').value = obj.width;
                document.getElementById('objectHeight').value = obj.height;
            } else if (obj.shape === 'circle') {
                document.getElementById('objectRadius').value = obj.radius;
            }
            
            // Update property checkboxes
            document.getElementById('objectSpawnpoint').checked = obj.properties.includes('spawnpoint');
            document.getElementById('objectGoal').checked = obj.properties.includes('goal');
            
            // Show/hide nextLevel field based on goal property
            document.getElementById('nextLevelContainer').style.display = 
                obj.properties.includes('goal') ? 'block' : 'none';
            
            // Set nextLevel value if it exists
            document.getElementById('objectNextLevel').value = obj.nextLevel || '';
            
            this.updateStatus(`Selected: ${obj.id}`);
        } else {
            this.updateStatus('No object selected');
        }
        
        this.updateObjectList();
        this.render();
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
        this.selectedObject.color = document.getElementById('objectColor').value;
        this.selectedObject.backgroundImage = newBackgroundImage;
        this.selectedObject.isStatic = document.getElementById('objectStatic').checked;
        this.selectedObject.isSolid = document.getElementById('objectSolid').checked;
        this.selectedObject.zIndex = parseInt(document.getElementById('objectZIndex').value);
        this.selectedObject.friction = parseFloat(document.getElementById('objectFriction').value);
        this.selectedObject.restitution = parseFloat(document.getElementById('objectRestitution').value);
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
        
        this.updateObjectList();
        this.render();
    }

    deleteObject(obj) {
        const index = this.level.objects.indexOf(obj);
        if (index > -1) {
            this.level.objects.splice(index, 1);
            if (this.selectedObject === obj) {
                this.selectObject(null);
            }
            this.updateObjectList();
            this.render();
            this.updateStatus(`Deleted: ${obj.id}`);
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
        
        // Draw objects
        this.level.objects.forEach(obj => {
            this.drawObject(obj);
        });
        
        // Highlight selected object
        if (this.selectedObject) {
            this.drawObjectOutline(this.selectedObject);
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
        
        this.ctx.restore(); // Restore context state
        
        // Draw property indicators
        if (obj.properties.includes('spawnpoint')) {
            this.ctx.fillStyle = '#00ff00';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('SPAWN', obj.x, obj.y - 20);
        }
        
        if (obj.properties.includes('goal')) {
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GOAL', obj.x, obj.y - 20);
        }
        
        // Draw static indicator
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
    }

    drawObjectOutline(obj) {
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
    }

    newLevel() {
        if (confirm('Create a new level? This will clear the current level.')) {
            this.level = {
                name: 'new-level',
                description: '',
                version: '1.0',
                backgroundImage: '',
                objects: []
            };
            
            document.getElementById('levelName').value = this.level.name;
            document.getElementById('levelDescription').value = this.level.description;
            document.getElementById('backgroundImage').value = '';
            this.backgroundImage = null;
            
            this.selectedObject = null;
            this.objectIdCounter = 1;
            this.updateObjectList();
            this.render();
            this.updateStatus('New level created');
        }
    }

    async loadLevel() {
        const levelName = prompt('Enter level name to load:');
        if (!levelName) return;
        
        try {
            const response = await fetch(`/api/levels/${levelName}`);
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
                
                this.selectedObject = null;
                this.updateObjectList();
                this.render();
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
        
        this.level.name = levelName;
        this.level.description = document.getElementById('levelDescription').value;
        this.level.backgroundImage = document.getElementById('backgroundImage').value;
        
        try {
            const response = await fetch(`/api/levels/${levelName}`, {
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
        
        // Open game in new tab with level parameter
        window.open(`/?level=${levelName}`, '_blank');
    }

    updateStatus(message) {
        document.getElementById('statusText').textContent = message;
    }
}
