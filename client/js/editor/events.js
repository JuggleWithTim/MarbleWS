// Event listener setup for the level editor

export const events = {
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
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomOut());
        document.getElementById('resetZoom').addEventListener('click', () => this.resetZoom());

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

        // View transparent controls
        document.getElementById('viewTransparent').addEventListener('change', (e) => {
            this.viewTransparent = e.target.checked;
            this.render();
        });

        // Level info and marble properties
        document.getElementById('levelName').addEventListener('input', (e) => {
            this.level.name = e.target.value;
            this.saveState();
        });

        document.getElementById('levelDescription').addEventListener('input', (e) => {
            this.level.description = e.target.value;
            this.saveState();
        });

        document.getElementById('levelType').addEventListener('change', (e) => {
            this.level.levelType = e.target.value;
            this.updateLevelTypeVisibility();
            this.saveState();
        });

        const raceLapsInput = document.getElementById('raceLaps');
        if (raceLapsInput) {
            raceLapsInput.addEventListener('input', (e) => {
                const laps = parseInt(e.target.value);
                if (!this.level.race) {
                    this.level.race = { laps: 3 };
                }
                this.level.race.laps = isNaN(laps) ? 3 : laps;
                this.saveState();
            });
        }

        document.getElementById('backgroundImage').addEventListener('input', (e) => {
            this.level.backgroundImage = e.target.value;
            this.loadBackgroundImage();
            this.render();
            this.saveState();
        });

        // Level size controls for dungeon worlds
        document.getElementById('levelWidth').addEventListener('input', (e) => {
            this.level.levelWidth = parseInt(e.target.value);
            this.saveState();
        });

        document.getElementById('levelHeight').addEventListener('input', (e) => {
            this.level.levelHeight = parseInt(e.target.value);
            this.saveState();
        });

        // World physics properties
        document.getElementById('worldGravity').addEventListener('input', (e) => {
            this.level.world.gravity = parseFloat(e.target.value);
            this.updateJsonDisplay(); // Update JSON panel when gravity changes
            this.saveState();
        });

        // Marble property inputs
        document.getElementById('marbleColor').addEventListener('input', (e) => {
            this.level.marble.color = e.target.value;
            this.saveState();
        });

        document.getElementById('marbleRadius').addEventListener('input', (e) => {
            this.level.marble.radius = parseInt(e.target.value);
            this.saveState();
        });

        document.getElementById('marbleFriction').addEventListener('input', (e) => {
            this.level.marble.friction = parseFloat(e.target.value);
            this.saveState();
        });

        document.getElementById('marbleRestitution').addEventListener('input', (e) => {
            this.level.marble.restitution = parseFloat(e.target.value);
            this.saveState();
        });

        document.getElementById('marbleDensity').addEventListener('input', (e) => {
            this.level.marble.density = parseFloat(e.target.value);
            this.saveState();
        });

        // Emote property inputs
        document.getElementById('emoteRadius').addEventListener('input', (e) => {
            this.level.emote.radius = parseInt(e.target.value);
            this.saveState();
        });

        document.getElementById('emoteFriction').addEventListener('input', (e) => {
            this.level.emote.friction = parseFloat(e.target.value);
            this.saveState();
        });

        document.getElementById('emoteRestitution').addEventListener('input', (e) => {
            this.level.emote.restitution = parseFloat(e.target.value);
            this.saveState();
        });

        document.getElementById('emoteMaxActive').addEventListener('input', (e) => {
            this.level.emote.maxActiveEmotes = parseInt(e.target.value);
            this.saveState();
        });

        document.getElementById('emoteDensity').addEventListener('input', (e) => {
            this.level.emote.density = parseFloat(e.target.value);
            this.saveState();
        });

        document.getElementById('emoteSpawnAll').addEventListener('change', (e) => {
            this.level.emote.spawnAll = e.target.checked;
            this.saveState();
        });

        // Show/hide nextLevel field when goal checkbox is toggled
        document.getElementById('objectGoal').addEventListener('change', (e) => {
            document.getElementById('nextLevelContainer').style.display =
                e.target.checked ? 'block' : 'none';
        });

        // Show/hide checkpoint order field when checkpoint checkbox is toggled
        document.getElementById('objectCheckpoint').addEventListener('change', (e) => {
            document.getElementById('checkpointOrderContainer').style.display =
                e.target.checked ? 'block' : 'none';

            if (e.target.checked) {
                this.updateSelectedObject();
            }
        });

        // Show/hide item type field when item spawn checkbox is toggled
        document.getElementById('objectItemSpawn').addEventListener('change', (e) => {
            document.getElementById('itemSpawnTypeContainer').style.display =
                e.target.checked ? 'block' : 'none';

            if (e.target.checked) {
                this.updateSelectedObject();
            }
        });

        // Show/hide teleporterTarget field when teleporter checkbox is toggled
        document.getElementById('objectTeleporter').addEventListener('change', (e) => {
            document.getElementById('teleporterTargetContainer').style.display =
                e.target.checked ? 'block' : 'none';
        });

        // Show/hide chairNumber field when chair checkbox is toggled
        document.getElementById('objectChair').addEventListener('change', (e) => {
            document.getElementById('chairNumberContainer').style.display =
                e.target.checked ? 'block' : 'none';

            if (e.target.checked) {
                const chairInput = document.getElementById('objectChairNumber');
                const currentValue = parseInt(chairInput.value);
                if (isNaN(currentValue) || currentValue < 1) {
                    chairInput.value = this.getNextChairNumber();
                }
                this.updateSelectedObject();
            }
        });

        // Show/hide active options when active checkbox is toggled
        document.getElementById('objectActive').addEventListener('change', (e) => {
            document.getElementById('activeOptionsContainer').style.display =
                e.target.checked ? 'block' : 'none';
        });

        // Show/hide advanced rotation options when advanced checkbox is toggled
        document.getElementById('objectAdvancedRotation').addEventListener('change', (e) => {
            document.getElementById('advancedRotationOptions').style.display =
                e.target.checked ? 'block' : 'none';
        });

        // Property inputs
        const propertyInputs = [
            'objectColor', 'objectAlpha', 'objectBackgroundImage', 'objectWidth', 'objectHeight', 'objectRadius',
            'objectVertexAX', 'objectVertexAY', 'objectVertexBX', 'objectVertexBY', 'objectVertexCX', 'objectVertexCY',
            'objectFriction', 'objectRestitution', 'objectDensity', 'objectRotation', 'objectStatic',
            'objectSpawnpoint', 'objectPlayerspawn', 'objectEmotespawn', 'objectGoal', 'objectNextLevel',
            'objectCheckpoint', 'objectCheckpointOrder', 'objectFinish', 'objectBoostPad',
            'objectItemSpawn', 'objectItemType',
            'objectTeleporter', 'objectTeleporterTarget', 'objectChair', 'objectChairNumber', 'objectSolid', 'objectZIndex',
            'objectActive', 'objectPointAX', 'objectPointAY', 'objectPointBX', 'objectPointBY', 'objectTimeToA', 'objectTimeFromA', 'objectSpeedToB', 'objectSpeedFromB',
            'objectRotationA', 'objectRotationB', 'objectRotationPointX', 'objectRotationPointY', 'objectAdvancedRotation', 'objectRotationSpeedToB', 'objectRotationSpeedFromB'
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

        // Mouse wheel zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.ctrlKey) {
                // Zoom towards mouse cursor
                this.handleZoom(e.deltaY, e.clientX, e.clientY);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.shiftKey = e.shiftKey;
            this.ctrlKey = e.ctrlKey;
            if (e.key === 'Delete' && this.selectedObjects.length > 0) {
                // Delete all selected objects
                this.selectedObjects.forEach(obj => this.deleteObject(obj));
            } else if (e.ctrlKey && e.key === 'c' && this.selectedObjects.length > 0) {
                // Copy selected objects
                this.copyObjects();
            } else if (e.ctrlKey && e.key === 'v' && this.clipboard.length > 0) {
                // Paste objects from clipboard
                this.pasteObjects();
            } else if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
                // Undo with Ctrl+Z
                this.undo();
            } else if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
                // Redo with Ctrl+Shift+Z
                this.redo();
            }
        });

        document.addEventListener('keyup', (e) => {
            this.shiftKey = e.shiftKey;
            this.ctrlKey = e.ctrlKey;
        });

        // Point selection event listeners
        document.getElementById('pickPointA').addEventListener('click', () => this.startPointSelection('pointA'));
        document.getElementById('pickPointB').addEventListener('click', () => this.startPointSelection('pointB'));
        document.getElementById('pickRotationPoint').addEventListener('click', () => this.startPointSelection('rotationPoint'));

        // Remove connections button
        document.getElementById('removeConnections').addEventListener('click', () => this.removeObjectConnections());

        // JSON panel event listeners
        document.getElementById('toggleJsonPanel').addEventListener('click', () => this.toggleJsonPanel());
        document.getElementById('closeJsonPanel').addEventListener('click', () => this.hideJsonPanel());
        document.getElementById('formatJson').addEventListener('click', () => this.formatJson());
        document.getElementById('applyJson').addEventListener('click', () => this.applyJsonChanges());
        document.getElementById('resetJson').addEventListener('click', () => this.resetJson());
    }
};
