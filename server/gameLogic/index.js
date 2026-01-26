const Matter = require('matter-js');
const EventEmitter = require('./eventEmitter');
const PlayerManager = require('./playerManager');
const LevelManager = require('./levelManager');
const PhysicsEngine = require('./physicsEngine');
const GameState = require('./gameState');

class GameLogic {
  constructor() {
    // Initialize Matter.js engine and world
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;

    // Configure physics
    this.engine.world.gravity.y = 0.8; // Default gravity, will be updated when level loads

    // Initialize modules
    this.eventEmitter = new EventEmitter();
    this.playerManager = new PlayerManager(this.eventEmitter);
    this.levelManager = new LevelManager(this.eventEmitter);
    this.physicsEngine = new PhysicsEngine(this.eventEmitter);
    this.gameState = new GameState(this.eventEmitter, this.playerManager, this.levelManager);

    // Set up cross-module references
    this.playerManager.setWorld(this.world);
    this.playerManager.setLevelObjects(this.levelManager.levelObjects);

    this.levelManager.setWorld(this.world);
    this.levelManager.setEngine(this.engine);
    this.levelManager.setPlayerManager(this.playerManager);
    this.levelManager.setActiveObjects(this.physicsEngine.activeObjects);

    this.physicsEngine.setWorld(this.world);
    this.physicsEngine.setEngine(this.engine);
    this.physicsEngine.setPlayerManager(this.playerManager);
    this.physicsEngine.setLevelManager(this.levelManager);

    // Start physics loop
    this.physicsEngine.startPhysicsLoop();
  }

  // Event system (delegate to eventEmitter)
  on(event, callback) {
    this.eventEmitter.on(event, callback);
  }

  emit(event, data) {
    this.eventEmitter.emit(event, data);
  }

  // Player management (delegate to playerManager)
  addPlayer(socketId, username, userId) {
    return this.playerManager.addPlayer(socketId, username, userId);
  }

  removePlayer(socketId) {
    this.playerManager.removePlayer(socketId);
  }

  updatePlayerInput(socketId, input) {
    this.playerManager.updatePlayerInput(socketId, input);
  }

  activateBeam(socketId, active) {
    this.playerManager.activateBeam(socketId, active);
  }

  updatePlayerAppearance(socketId, appearance) {
    this.playerManager.updatePlayerAppearance(socketId, appearance);
  }

  unlockUFO(socketId, ufoImage) {
    return this.playerManager.unlockUFO(socketId, ufoImage);
  }

  unlockPassenger(socketId, passengerImage) {
    return this.playerManager.unlockPassenger(socketId, passengerImage);
  }

  unlockHat(socketId, hatImage) {
    return this.playerManager.unlockHat(socketId, hatImage);
  }

  addCoinsToPlayer(userId, amount, reason = 'unknown') {
    return this.playerManager.addCoinsToPlayer(userId, amount, reason);
  }

  // Chair sitting functionality
  handlePlayerSit(socketId, chairNumber) {
    const player = this.players.get(socketId);
    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    return this.sitPlayerOnChair(player, chairNumber);
  }

  async handlePlayerSitByUserId(userId, chairNumber, username) {
    // Find online player first
    let player = Array.from(this.players.values()).find(p => p.userId === userId);

    if (player) {
      // Player is online, move their existing UFO
      return this.sitPlayerOnChair(player, chairNumber);
    } else {
      // Player is offline, spawn them at the chair
      return await this.spawnPlayerAtChair(userId, username, chairNumber);
    }
  }

  sitPlayerOnChair(player, chairNumber) {
    // Find available chairs in current level
    const chairs = this.levelManager.levelObjects.filter(obj => obj.chair !== undefined);

    if (chairs.length === 0) {
      return { success: false, message: 'No chairs available in this level' };
    }

    let targetChair;
    if (chairNumber !== null) {
      // Find specific chair
      targetChair = chairs.find(chair => chair.chair === chairNumber);
      if (!targetChair) {
        return { success: false, message: `Chair ${chairNumber} not found` };
      }
    } else {
      // Pick random available chair
      targetChair = chairs[Math.floor(Math.random() * chairs.length)];
      chairNumber = targetChair.chair;
    }

    // Move player to chair position (50px higher)
    if (player.body) {
      Matter.Body.setPosition(player.body, { x: targetChair.x, y: targetChair.y - 50 });
      Matter.Body.setVelocity(player.body, { x: 0, y: 0 });
      player.x = targetChair.x;
      player.y = targetChair.y - 50;
    }

    return {
      success: true,
      message: `Sat on chair ${chairNumber}`,
      chairNumber,
      x: targetChair.x,
      y: targetChair.y - 50
    };
  }

  async spawnPlayerAtChair(userId, username, chairNumber) {
    // Find available chairs in current level
    const chairs = this.levelManager.levelObjects.filter(obj => obj.chair !== undefined);

    if (chairs.length === 0) {
      return { success: false, message: 'No chairs available in this level' };
    }

    let targetChair;
    if (chairNumber !== null) {
      // Find specific chair
      targetChair = chairs.find(chair => chair.chair === chairNumber);
      if (!targetChair) {
        return { success: false, message: `Chair ${chairNumber} not found` };
      }
    } else {
      // Pick random available chair
      targetChair = chairs[Math.floor(Math.random() * chairs.length)];
      chairNumber = targetChair.chair;
    }

    // Create a temporary socket-like object for spawning
    const tempSocketId = `offline_${userId}_${Date.now()}`;

    // Spawn player at chair position
    const playerData = await this.playerManager.addPlayer(tempSocketId, username, userId);

    // Override spawn position to chair (50px higher)
    const player = this.players.get(tempSocketId);
    if (player && player.body) {
      Matter.Body.setPosition(player.body, { x: targetChair.x, y: targetChair.y - 50});
      player.x = targetChair.x;
      player.y = targetChair.y - 50;

      // Mark as offline spawn (could be used for cleanup later)
      player.isOfflineSpawn = true;
    }

    return {
      success: true,
      message: `Spawned at chair ${chairNumber}`,
      chairNumber,
      x: targetChair.x,
      y: targetChair.y - 50,
      playerId: tempSocketId
    };
  }

  // Level management (delegate to levelManager)
  loadLevel(levelData) {
    this.levelManager.loadLevel(levelData);
  }

  spawnMarble(x, y) {
    this.levelManager.spawnMarble(x, y);
  }

  spawnEmote(emoteUrl, emoteName) {
    this.levelManager.spawnEmote(emoteUrl, emoteName);
  }

  // Physics and interactions (delegate to physicsEngine)
  handleBeamInteraction(socketId, targetX, targetY) {
    this.physicsEngine.handleBeamInteraction(socketId, targetX, targetY);
  }

  // Game state (delegate to gameState)
  getGameState() {
    return this.gameState.getGameState();
  }

  // Expose current level for backward compatibility
  get currentLevel() {
    return this.levelManager.currentLevel;
  }

  // Expose players for backward compatibility
  get players() {
    return this.playerManager.players;
  }
}

module.exports = GameLogic;
