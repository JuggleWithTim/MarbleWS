const BaseGameMode = require('./baseMode');

class MarbleMode extends BaseGameMode {
  constructor(eventEmitter, playerManager, levelManager) {
    super(eventEmitter, playerManager, levelManager);
  }

  getModeName() {
    return 'Marble';
  }

  // Marble mode is the classic gameplay - marble rolling, goals, etc.
  // Most functionality is handled by the existing levelManager and physics engine

  getGameStateData() {
    return {
      mode: 'marble',
      // Include any marble-specific data if needed
    };
  }

  checkWinConditions() {
    // Check if marble reached goal (handled by existing goal detection)
    // This would be checked by the existing goal collision detection
    return null; // Let existing system handle win conditions
  }
}

module.exports = MarbleMode;
