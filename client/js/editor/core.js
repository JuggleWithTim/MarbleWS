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

    // Ensure level has all required properties with defaults
    ensureLevelDefaults(level) {
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
        const canvasX = clientX - rect.left;
        const canvasY = clientY - rect.top;

        // Calculate zoom factor
        const zoomFactor = deltaY > 0 ? 0.9 : 1.1; // Zoom out or in

        // Calculate the world point under the cursor
        const worldX = (canvasX - this.panX) / this.zoomLevel;
        const worldY = (canvasY - this.panY) / this.zoomLevel;

        // Apply zoom
        const newZoomLevel = Math.max(0.1, Math.min(5.0, this.zoomLevel * zoomFactor));
        const actualZoomFactor = newZoomLevel / this.zoomLevel;

        // Adjust pan to keep the world point under the cursor
        this.panX = canvasX - worldX * newZoomLevel;
        this.panY = canvasY - worldY * newZoomLevel;

        this.zoomLevel = newZoomLevel;

        this.render();
        this.updateZoomDisplay();
    }

    // Zoom methods for toolbar buttons
    zoomIn() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        this.handleZoom(-1, centerX, centerY);
    }

    zoomOut() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
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
}
