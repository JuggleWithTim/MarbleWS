// Core functionality for the LevelEditor class

import { DEFAULT_LEVEL, CANVAS_SCALE, RESIZE_HANDLE_SIZE, ROTATION_HANDLE_OFFSET } from './constants.js';
import { loadObjectImage } from './utils.js';

export class LevelEditorCore {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.currentTool = 'select';
        this.selectedObjects = [];
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.mousePos = { x: 0, y: 0 };
        this.gridSize = 20;
        this.showGrid = true;
        this.snapToGrid = true;
        this.viewTransparent = false;

        // Canvas scaling factors (display size vs logical size)
        this.scaleX = CANVAS_SCALE.X;
        this.scaleY = CANVAS_SCALE.Y;

        this.level = { ...DEFAULT_LEVEL };

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
        this.resizeHandleSize = RESIZE_HANDLE_SIZE;

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

        // Area selection state
        this.isAreaSelecting = false;
        this.areaSelectStart = { x: 0, y: 0 };
        this.dragOffsets = new Map(); // Store original positions for multi-object dragging

        // Clipboard for copy/paste functionality
        this.clipboard = [];

        // Zoom and pan state
        this.zoomLevel = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };

        // Undo/redo history
        this.actionHistory = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
    }

    async init() {
        // Load client configuration first
        await this.loadConfig();

        this.canvas = document.getElementById('editorCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.setupEventListeners();
        this.updateObjectList();

        // Hide remove connections button initially (no object selected)
        const removeConnectionsBtn = document.getElementById('removeConnections');
        if (removeConnectionsBtn) {
            removeConnectionsBtn.style.display = 'none';
        }

        // Save initial state for undo functionality
        this.saveState();

        this.render();
        this.updateZoomDisplay();
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

    // Ensure level has all required properties with defaults
    ensureLevelDefaults(level) {
        if (!level.race) {
            level.race = { ...DEFAULT_LEVEL.race };
        } else {
            level.race.laps = level.race.laps || DEFAULT_LEVEL.race.laps;
        }

        // Ensure marble properties exist
        if (!level.marble) {
            level.marble = { ...DEFAULT_LEVEL.marble };
        } else {
            // Ensure all marble properties exist with defaults
            level.marble.color = level.marble.color || DEFAULT_LEVEL.marble.color;
            level.marble.radius = level.marble.radius || DEFAULT_LEVEL.marble.radius;
            level.marble.friction = level.marble.friction || DEFAULT_LEVEL.marble.friction;
            level.marble.restitution = level.marble.restitution || DEFAULT_LEVEL.marble.restitution;
            level.marble.density = level.marble.density || DEFAULT_LEVEL.marble.density;
        }

        // Ensure world properties exist
        if (!level.world) {
            level.world = { ...DEFAULT_LEVEL.world };
        } else {
            level.world.gravity = level.world.gravity || DEFAULT_LEVEL.world.gravity;
        }

        // Ensure emote properties exist
        if (!level.emote) {
            level.emote = { ...DEFAULT_LEVEL.emote };
        } else {
            // Ensure all emote properties exist with defaults
            level.emote.maxActiveEmotes = level.emote.maxActiveEmotes || DEFAULT_LEVEL.emote.maxActiveEmotes;
            level.emote.radius = level.emote.radius || DEFAULT_LEVEL.emote.radius;
            level.emote.friction = level.emote.friction || DEFAULT_LEVEL.emote.friction;
            level.emote.restitution = level.emote.restitution || DEFAULT_LEVEL.emote.restitution;
            level.emote.density = level.emote.density || DEFAULT_LEVEL.emote.density;
            level.emote.spawnAll = level.emote.spawnAll !== undefined ? level.emote.spawnAll : DEFAULT_LEVEL.emote.spawnAll;
        }

        // Ensure arrays exist
        level.objects = level.objects || [];
        level.connections = level.connections || [];

        // Ensure other properties exist
        level.name = level.name || DEFAULT_LEVEL.name;
        level.description = level.description || DEFAULT_LEVEL.description;
        level.version = level.version || DEFAULT_LEVEL.version;
        level.levelType = level.levelType || DEFAULT_LEVEL.levelType;
        level.backgroundImage = level.backgroundImage || DEFAULT_LEVEL.backgroundImage;

        // Set level size defaults based on level type
        if (level.levelType === 'Dungeon') {
            level.levelWidth = level.levelWidth || 3840; // 2x default width for dungeon levels
            level.levelHeight = level.levelHeight || 2160; // 2x default height for dungeon levels
        } else {
            level.levelWidth = level.levelWidth || 1920; // Standard size for other level types
            level.levelHeight = level.levelHeight || 1080; // Standard size for other level types
        }

        return level;
    }

    // Load object background image using the utility function
    loadObjectImage(url) {
        const promise = loadObjectImage(url, this.objectImages);

        // When the image loads, trigger a re-render
        promise.then(() => {
            if (this.render) {
                this.render();
            }
        });

        return promise;
    }

    // Handle zoom with mouse wheel
    handleZoom(deltaY, clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        // Convert display pixels to logical pixels
        const logicalX = (clientX - rect.left) * (this.canvas.width / rect.width);
        const logicalY = (clientY - rect.top) * (this.canvas.height / rect.height);

        // Calculate zoom factor
        const zoomFactor = deltaY > 0 ? 0.9 : 1.1; // Zoom out or in
        const newZoomLevel = Math.max(0.1, Math.min(5.0, this.zoomLevel * zoomFactor));

        // Keep the world point under the cursor by adjusting pan
        // panX/panY are in logical pixel space, logicalX/logicalY are in logical pixel space
        this.panX = logicalX - (logicalX - this.panX) * (newZoomLevel / this.zoomLevel);
        this.panY = logicalY - (logicalY - this.panY) * (newZoomLevel / this.zoomLevel);

        this.zoomLevel = newZoomLevel;

        this.render();
        this.updateZoomDisplay();
    }

    // Zoom methods for toolbar buttons
    zoomIn() {
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        this.handleZoom(-1, centerX, centerY);
    }

    zoomOut() {
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        this.handleZoom(1, centerX, centerY);
    }

    resetZoom() {
        this.zoomLevel = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.render();
        this.updateZoomDisplay();
    }

    // Update the zoom level display in the status bar
    updateZoomDisplay() {
        const zoomElement = document.getElementById('zoomLevel');
        if (zoomElement) {
            const zoomPercent = Math.round(this.zoomLevel * 100);
            zoomElement.innerHTML = `<span id="mousePos">Mouse: 0, 0</span> | Zoom: ${zoomPercent}%`;
        }
    }

    // Undo/redo functionality
    saveState() {
        // Create a deep clone of the current level state
        const levelCopy = JSON.parse(JSON.stringify(this.level));

        // Remove future history if we're not at the end
        this.actionHistory = this.actionHistory.slice(0, this.historyIndex + 1);

        // Add the new state
        this.actionHistory.push(levelCopy);

        // Trim old history if exceeding max
        if (this.actionHistory.length > this.maxHistory) {
            this.actionHistory.shift();
        } else {
            this.historyIndex++;
        }
    }

    canUndo() {
        return this.historyIndex > 0;
    }

    canRedo() {
        return this.historyIndex < this.actionHistory.length - 1;
    }

    undo() {
        if (this.canUndo()) {
            this.historyIndex--;
            this.loadState();
            this.updateStatus('Undid last action');
        } else {
            this.updateStatus('Cannot undo');
        }
    }

    redo() {
        if (this.canRedo()) {
            this.historyIndex++;
            this.loadState();
            this.updateStatus('Redid last action');
        } else {
            this.updateStatus('Cannot redo');
        }
    }

    loadState() {
        // Load the level from history
        this.level = JSON.parse(JSON.stringify(this.actionHistory[this.historyIndex]));

        // Reset selections and update UI
        this.selectedObjects = [];
        this.selectedObject = null;

        // Update all UI elements
        this.updateObjectList();
        this.updateJsonDisplay();
        this.render();

        // Update form inputs to reflect the loaded level
        this.updateFormInputs();
    }

    // Update form inputs to match the current level state
    updateFormInputs() {
        // Level info
        if (document.getElementById('levelName')) {
            document.getElementById('levelName').value = this.level.name || '';
        }
        if (document.getElementById('levelDescription')) {
            document.getElementById('levelDescription').value = this.level.description || '';
        }
        if (document.getElementById('levelType')) {
            document.getElementById('levelType').value = this.level.levelType || 'Marble';
        }
        if (document.getElementById('backgroundImage')) {
            document.getElementById('backgroundImage').value = this.level.backgroundImage || '';
            this.loadBackgroundImage();
        }

        if (document.getElementById('raceLaps')) {
            document.getElementById('raceLaps').value = this.level.race?.laps || DEFAULT_LEVEL.race.laps;
        }

        // Level size controls (show/hide based on level type)
        this.updateLevelTypeVisibility();
        if (document.getElementById('levelWidth')) {
            document.getElementById('levelWidth').value = this.level.levelWidth || 1920;
        }
        if (document.getElementById('levelHeight')) {
            document.getElementById('levelHeight').value = this.level.levelHeight || 1080;
        }

        // World physics properties
        if (document.getElementById('worldGravity')) {
            document.getElementById('worldGravity').value = this.level.world?.gravity || 9.8;
        }

        // Marble properties
        if (this.level.marble) {
            if (document.getElementById('marbleColor')) {
                document.getElementById('marbleColor').value = this.level.marble.color || '#ffffff';
            }
            if (document.getElementById('marbleRadius')) {
                document.getElementById('marbleRadius').value = this.level.marble.radius || 10;
            }
            if (document.getElementById('marbleFriction')) {
                document.getElementById('marbleFriction').value = this.level.marble.friction || 0.1;
            }
            if (document.getElementById('marbleRestitution')) {
                document.getElementById('marbleRestitution').value = this.level.marble.restitution || 0.8;
            }
            if (document.getElementById('marbleDensity')) {
                document.getElementById('marbleDensity').value = this.level.marble.density || 0.001;
            }
        }

        // Emote properties
        if (this.level.emote) {
            if (document.getElementById('emoteMaxActive')) {
                document.getElementById('emoteMaxActive').value = this.level.emote.maxActiveEmotes || 222;
            }
            if (document.getElementById('emoteRadius')) {
                document.getElementById('emoteRadius').value = this.level.emote.radius || 5;
            }
            if (document.getElementById('emoteFriction')) {
                document.getElementById('emoteFriction').value = this.level.emote.friction || 0.1;
            }
            if (document.getElementById('emoteRestitution')) {
                document.getElementById('emoteRestitution').value = this.level.emote.restitution || 0.8;
            }
            if (document.getElementById('emoteDensity')) {
                document.getElementById('emoteDensity').value = this.level.emote.density || 0.001;
            }
            if (document.getElementById('emoteSpawnAll')) {
                document.getElementById('emoteSpawnAll').checked = this.level.emote.spawnAll || false;
            }
        }
    }

    // Update level type visibility
    updateLevelTypeVisibility() {
        const levelType = this.level.levelType || 'Marble';
        const levelSizeGroup = document.getElementById('levelSizeGroup');
        if (levelSizeGroup) {
            levelSizeGroup.style.display = 'block';
        }
        const raceSettingsGroup = document.getElementById('raceSettingsGroup');
        if (raceSettingsGroup) {
            raceSettingsGroup.style.display = levelType === 'Race' ? 'block' : 'none';
        }
        if (document.getElementById('levelType')) {
            document.getElementById('levelType').value = levelType;
        }
    }
}
