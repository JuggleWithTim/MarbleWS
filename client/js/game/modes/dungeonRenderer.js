class DungeonRenderer {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.canvas = renderer.canvas;
        this.ctx = renderer.ctx;

        // Dungeon Mode specific properties
        this.playerScale = 0.5; // 50% of normal UFO size
        this.cameraZoom = 2.0; // 2x zoom for zoomed-in dungeon view
        this.cameraBounds = {
            left: 0,
            right: 1920,
            top: 0,
            bottom: 1080,
            margin: 200
        };

        // Camera smoothing for better responsiveness
        this.currentCameraX = 960;
        this.currentCameraY = 540;
        this.targetCameraX = 960;
        this.targetCameraY = 540;
        this.cameraLerpSpeed = 0.1; // How quickly camera follows player
    }

    // Update Dungeon Mode specific data
    updateGameModeData(gameModeData) {
        if (!gameModeData || gameModeData.mode !== 'dungeon') return;

        // Update configuration from server
        this.playerScale = gameModeData.playerScale || 0.5;
        this.cameraBounds = gameModeData.cameraBounds || this.cameraBounds;

        // Update camera target based on current player position
        if (this.game.currentPlayer && this.game.gameState && this.game.gameState.players) {
            const currentPlayer = this.game.gameState.players.find(p => p.id === this.game.currentPlayer.id);
            if (currentPlayer) {
                this.targetCameraX = currentPlayer.x;
                this.targetCameraY = currentPlayer.y;
            }
        }
    }

    // Apply camera for Dungeon Mode (called from game.js render loop)
    applyCamera(gameModeData) {
        if (!gameModeData || gameModeData.mode !== 'dungeon') {
            // Not dungeon mode, use default camera
            this.renderer.setCamera(960, 540, 1);
            return;
        }

        // Update dungeon mode data
        this.updateGameModeData(gameModeData);

        // Smoothly interpolate camera position
        this.currentCameraX += (this.targetCameraX - this.currentCameraX) * this.cameraLerpSpeed;
        this.currentCameraY += (this.targetCameraY - this.currentCameraY) * this.cameraLerpSpeed;

        // Apply camera bounds to prevent going outside level
        const zoom = this.cameraZoom;
        const viewWidth = this.canvas.width / zoom;
        const viewHeight = this.canvas.height / zoom;

        // Calculate camera bounds, keeping margin from edges
        const margin = this.cameraBounds.margin;
        const minCameraX = this.cameraBounds.left + viewWidth / 2 + margin;
        const maxCameraX = this.cameraBounds.right - viewWidth / 2 - margin;
        const minCameraY = this.cameraBounds.top + viewHeight / 2 + margin;
        const maxCameraY = this.cameraBounds.bottom - viewHeight / 2 - margin;

        // Clamp camera position to bounds
        const clampedCameraX = Math.max(minCameraX, Math.min(maxCameraX, this.currentCameraX));
        const clampedCameraY = Math.max(minCameraY, Math.min(maxCameraY, this.currentCameraY));

        // Apply the camera with proper bounds
        this.renderer.setCamera(clampedCameraX, clampedCameraY, zoom);
    }

    // Render Dungeon Mode specific elements (if any)
    // Most rendering will be handled by the main game.js render loop
    // This can be used for dungeon-specific overlays, effects, etc.
    render() {
        // Currently no special overlay elements needed
        // But this method is here for future dungeon-specific visual effects
    }

    // Get the dungeon-scaled UFO size for a given base size
    getScaledUFOSize(baseSize = 30) {
        return baseSize * this.playerScale;
    }
}

// Make it globally available
window.DungeonRenderer = DungeonRenderer;