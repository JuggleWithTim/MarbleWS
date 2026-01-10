class BaseGameMode {
  constructor(eventEmitter, playerManager, levelManager) {
    this.eventEmitter = eventEmitter;
    this.playerManager = playerManager;
    this.levelManager = levelManager;
    this.currentLevel = null;
    this.isActive = false;
  }

  // Initialize the game mode with level data
  init(levelData) {
    this.currentLevel = levelData;
    this.isActive = true;
    console.log(`Initialized ${this.getModeName()} mode for level: ${levelData.name}`);
  }

  // Clean up when switching modes or shutting down
  cleanup() {
    this.isActive = false;
    console.log(`Cleaned up ${this.getModeName()} mode`);
  }

  // Get the name of this game mode
  getModeName() {
    return 'Base';
  }

  // Handle player joining during active gameplay
  handlePlayerJoin(player) {
    // Default: allow immediate spawn
    return { canJoin: true, spawnImmediately: true };
  }

  // Handle player leaving
  handlePlayerLeave(playerId) {
    // Default: no special handling
  }

  // Update game logic (called every physics tick)
  update(deltaTime) {
    // Default: no special updates
  }

  // Get mode-specific data for game state
  getGameStateData() {
    return {};
  }

  // Handle player input (movement, beam, etc.)
  handlePlayerInput(playerId, input) {
    // Default: allow all inputs
    return true;
  }

  // Check if player can use beam
  canPlayerUseBeam(playerId) {
    return true;
  }

  // Handle player death/out (mode-specific)
  handlePlayerDeath(playerId) {
    // Default: no special handling
  }

  // Check win/lose conditions
  checkWinConditions() {
    return null; // null = no win condition met
  }
}

module.exports = BaseGameMode;
