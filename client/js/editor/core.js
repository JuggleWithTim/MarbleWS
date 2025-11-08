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

        // Ensure arrays exist
        level.objects = level.objects || [];
        level.connections = level.connections || [];

        // Ensure other properties exist
        level.name = level.name || DEFAULT_LEVEL.name;
        level.description = level.description || DEFAULT_LEVEL.description;
        level.version = level.version || DEFAULT_LEVEL.version;
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
}
