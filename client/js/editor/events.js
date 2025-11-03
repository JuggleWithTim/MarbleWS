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

        // Level info and marble properties
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

        // World physics properties
        document.getElementById('worldGravity').addEventListener('input', (e) => {
            this.level.world.gravity = parseFloat(e.target.value);
            this.updateJsonDisplay(); // Update JSON panel when gravity changes
        });

        // Marble property inputs
        document.getElementById('marbleColor').addEventListener('input', (e) => {
            this.level.marble.color = e.target.value;
        });

        document.getElementById('marbleRadius').addEventListener('input', (e) => {
            this.level.marble.radius = parseInt(e.target.value);
        });

        document.getElementById('marbleFriction').addEventListener('input', (e) => {
            this.level.marble.friction = parseFloat(e.target.value);
        });

        document.getElementById('marbleRestitution').addEventListener('input', (e) => {
            this.level.marble.restitution = parseFloat(e.target.value);
        });

        document.getElementById('marbleDensity').addEventListener('input', (e) => {
            this.level.marble.density = parseFloat(e.target.value);
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
};
