const BaseGameMode = require('./baseMode');
const MarbleMode = require('./marbleMode');
const ColorRushMode = require('./colorRushMode');
const DungeonMode = require('./dungeonMode');

class GameModeManager {
  constructor(eventEmitter, playerManager, levelManager) {
    this.eventEmitter = eventEmitter;
    this.playerManager = playerManager;
    this.levelManager = levelManager;
    this.currentMode = null;
    this.availableModes = {
      'Marble': MarbleMode,
      'Color Rush': ColorRushMode,
      'Dungeon': DungeonMode
    };
  }

  // Switch to a specific game mode
  switchMode(modeType, levelData) {
    // Clean up current mode
    if (this.currentMode) {
      this.currentMode.cleanup();
    }

    // Create new mode instance
    const ModeClass = this.availableModes[modeType];
    if (!ModeClass) {
      console.error(`Unknown game mode: ${modeType}`);
      // Fallback to Marble mode
      this.currentMode = new MarbleMode(this.eventEmitter, this.playerManager, this.levelManager);
    } else {
      this.currentMode = new ModeClass(this.eventEmitter, this.playerManager, this.levelManager);
    }

    // Initialize new mode
    this.currentMode.init(levelData);

    console.log(`Switched to game mode: ${this.currentMode.getModeName()}`);
    return this.currentMode;
  }

  // Get current mode
  getCurrentMode() {
    return this.currentMode;
  }

  // Get mode-specific game state data
  getGameStateData() {
    return this.currentMode ? this.currentMode.getGameStateData() : {};
  }

  // Delegate method calls to current mode
  handlePlayerJoin(player) {
    return this.currentMode ? this.currentMode.handlePlayerJoin(player) : { canJoin: true, spawnImmediately: true };
  }

  handlePlayerLeave(playerId) {
    if (this.currentMode) {
      this.currentMode.handlePlayerLeave(playerId);
    }
  }

  handlePlayerInput(playerId, input) {
    return this.currentMode ? this.currentMode.handlePlayerInput(playerId, input) : true;
  }

  canPlayerUseBeam(playerId) {
    return this.currentMode ? this.currentMode.canPlayerUseBeam(playerId) : true;
  }

  update(deltaTime) {
    if (this.currentMode) {
      this.currentMode.update(deltaTime);
    }
  }

  checkWinConditions() {
    return this.currentMode ? this.currentMode.checkWinConditions() : null;
  }
}

module.exports = GameModeManager;
