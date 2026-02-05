const BaseGameMode = require('./baseMode');

class DungeonMode extends BaseGameMode {
  constructor(eventEmitter, playerManager, levelManager) {
    super(eventEmitter, playerManager, levelManager);

    // Dungeon Mode specific properties
    this.ignoreCameraMoves = true; // Flag to communicate camera handling to clients

    // Player scaling configuration
    this.playerScale = 1.0; // Normal size for consistency across modes

    // Camera bounds (to prevent camera from going outside level)
    this.cameraBoundsTop = 0;
    this.cameraBoundsBottom = 1080;
    this.cameraBoundsLeft = 0;
    this.cameraBoundsRight = 1920;
    this.cameraMargin = 200; // Keep players this far from edge of screen
  }

  getModeName() {
    return 'Dungeon';
  }

  init(levelData) {
    super.init(levelData);
    console.log('Dungeon mode initialized');

    // Calculate camera bounds based on level if smaller than full screen
    if (levelData.levelWidth && levelData.levelHeight) {
      this.cameraBoundsRight = levelData.levelWidth;
      this.cameraBoundsBottom = levelData.levelHeight;
    }

    // Additional setup can go here
    console.log(`Player scale: ${this.playerScale}x, Camera bounds: ${this.cameraBoundsLeft}-${this.cameraBoundsRight}, ${this.cameraBoundsTop}-${this.cameraBoundsBottom}`);
  }

  cleanup() {
    super.cleanup();
    console.log('Dungeon mode cleaned up');
  }

  // Override to provide mode-specific game state
  getGameStateData() {
    const baseData = super.getGameStateData();
    return {
      ...baseData,
      mode: 'dungeon',
      playerScale: this.playerScale,
      ignoreCameraMoves: this.ignoreCameraMoves,
      cameraBounds: {
        left: this.cameraBoundsLeft,
        right: this.cameraBoundsRight,
        top: this.cameraBoundsTop,
        bottom: this.cameraBoundsBottom,
        margin: this.cameraMargin
      }
    };
  }

  // Handle player joining dungeon mode
  handlePlayerJoin(player) {
    return { canJoin: true, spawnImmediately: true };
  }

  // Dungeon mode doesn't override movement controls
  handlePlayerInput(playerId, input) {
    return true; // Allow all inputs
  }

  // Beam usage allowed in dungeon mode
  canPlayerUseBeam(playerId) {
    return true;
  }

  // Reset camera bounds when level changes
  resetCameraBounds(levelData) {
    this.cameraBoundsTop = 0;
    this.cameraBoundsBottom = levelData.levelHeight || 1080;
    this.cameraBoundsLeft = 0;
    this.cameraBoundsRight = levelData.levelWidth || 1920;
  }

  // Dungeon mode doesn't use special timing or rounds
  update(deltaTime) {
    // No special per-frame logic needed for dungeon mode
    // The mode-specific rendering handles the camera and scaling
  }

  // No win conditions for dungeon mode - it's an exploration/experience mode
  checkWinConditions() {
    return null;
  }
}

module.exports = DungeonMode;