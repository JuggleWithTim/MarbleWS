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
            objects: []
        };
        
        this.objectIdCounter = 1;
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
        
        // Property inputs
        const propertyInputs = [
            'objectColor', 'objectWidth', 'objectHeight', 'objectRadius',
            'objectFriction', 'objectRestitution', 'objectStatic',
            'objectSpawnpoint', 'objectGoal'
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
        
        // Handle dragging
        if (this.isDragging && this.selectedObject) {
            this.selectedObject.x = this.mousePos.x;
            this.selectedObject.y = this.mousePos.y;
            this.render();
        }
    }

    onMouseUp(e) {
        this.isDragging = false;
    }

    handleSelect(x, y) {
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

    createRectangle(x, y) {
        const obj = {
            id: `rect_${this.objectIdCounter++}`,
            shape: 'rectangle',
            x: x,
            y: y,
            width: parseInt(document.getElementById('objectWidth').value),
            height: parseInt(document.getElementById('objectHeight').value),
            color: document.getElementById('objectColor').value,
            isStatic: document.getElementById('objectStatic').checked,
            friction: parseFloat(document.getElementById('objectFriction').value),
            restitution: parseFloat(document.getElementById('objectRestitution').value),
            properties: this.getSelectedProperties()
        };
        
        this.level.objects.push(obj);
        this.selectObject(obj);
        this.updateObjectList();
        this.render();
        this.updateStatus(`Created rectangle: ${obj.id}`);
    }

    createCircle(x, y) {
        const obj = {
            id: `circle_${this.objectIdCounter++}`,
            shape: 'circle',
            x: x,
            y: y,
            radius: parseInt(document.getElementById('objectRadius').value),
            color: document.getElementById('objectColor').value,
            isStatic: document.getElementById('objectStatic').checked,
            friction: parseFloat(document.getElementById('objectFriction').value),
            restitution: parseFloat(document.getElementById('objectRestitution').value),
            properties: this.getSelectedProperties()
        };
        
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

    selectObject(obj) {
        this.selectedObject = obj;
        
        if (obj) {
            // Update property inputs
            document.getElementById('objectColor').value = obj.color;
            document.getElementById('objectStatic').checked = obj.isStatic;
            document.getElementById('objectFriction').value = obj.friction;
            document.getElementById('objectRestitution').value = obj.restitution;
            
            if (obj.shape === 'rectangle') {
                document.getElementById('objectWidth').value = obj.width;
                document.getElementById('objectHeight').value = obj.height;
            } else if (obj.shape === 'circle') {
                document.getElementById('objectRadius').value = obj.radius;
            }
            
            // Update property checkboxes
            document.getElementById('objectSpawnpoint').checked = obj.properties.includes('spawnpoint');
            document.getElementById('objectGoal').checked = obj.properties.includes('goal');
            
            this.updateStatus(`Selected: ${obj.id}`);
        } else {
            this.updateStatus('No object selected');
        }
        
        this.updateObjectList();
        this.render();
    }

    updateSelectedObject() {
        if (!this.selectedObject) return;
        
        // Update properties from inputs
        this.selectedObject.color = document.getElementById('objectColor').value;
        this.selectedObject.isStatic = document.getElementById('objectStatic').checked;
        this.selectedObject.friction = parseFloat(document.getElementById('objectFriction').value);
        this.selectedObject.restitution = parseFloat(document.getElementById('objectRestitution').value);
        
        if (this.selectedObject.shape === 'rectangle') {
            this.selectedObject.width = parseInt(document.getElementById('objectWidth').value);
            this.selectedObject.height = parseInt(document.getElementById('objectHeight').value);
        } else if (this.selectedObject.shape === 'circle') {
            this.selectedObject.radius = parseInt(document.getElementById('objectRadius').value);
        }
        
        // Update properties
        this.selectedObject.properties = this.getSelectedProperties();
        
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

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
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
        } else if (obj.shape === 'circle') {
            this.ctx.beginPath();
            this.ctx.arc(obj.x, obj.y, obj.radius + 2, 0, Math.PI * 2);
            this.ctx.stroke();
        }
    }

    newLevel() {
        if (confirm('Create a new level? This will clear the current level.')) {
            this.level = {
                name: 'new-level',
                description: '',
                version: '1.0',
                objects: []
            };
            
            document.getElementById('levelName').value = this.level.name;
            document.getElementById('levelDescription').value = this.level.description;
            
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
